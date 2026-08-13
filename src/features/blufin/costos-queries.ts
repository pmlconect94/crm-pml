import { fetchContratos } from '@/features/blufin/queries';
import { fetchPagos, fetchForwards, fetchSaldosPorContrato } from '@/features/blufin/pagos-queries';
import { fetchSkusBlufin } from '@/features/blufin/productos-queries';
import { tcContrato } from '@/features/blufin/tc-contrato';

/** Origen del TC efectivo de un contenedor (orden de prioridad §14 regla 2). */
export type TcOrigen = 'pagos' | 'forward' | 'mixto' | 'ponderado' | 'ninguno';

export type FuenteCosto = {
  contrato_id: string;
  folio: string;
  contenedor: string | null;
  naviera: string | null;
  eta_bodega: string | null;
  fecha_contrato: string | null;
  status: string;
  llegada_real: string | null;
  llego: boolean; // tiene recepción (ya llegó a bodega)
  kg: number;
  precio_usd: number;
  tc: number | null; // TC efectivo REAL (null si no se pudo determinar)
  tc_origen: TcOrigen;
};

/** Un contenedor (= un contrato) con su costo total y TC efectivo. */
export type ContenedorCosto = {
  contrato_id: string;
  folio: string;
  contenedor: string | null;
  naviera: string | null;
  eta_bodega: string | null;
  llegada_real: string | null;
  llego: boolean;
  liquidado: boolean; // saldo pagado
  status: string;
  total_usd: number;
  total_kg: number;
  tc: number | null; // TC efectivo REAL (null si no hay pagos/forward/ponderado)
  tc_origen: TcOrigen;
  lineas: { code: string; descripcion: string; kg: number; precio_usd: number; total_usd: number }[];
};

export type CostosData = {
  skus: SkuCosto[];
  contenedores: ContenedorCosto[]; // ordenados por eta_bodega DESC
  tcDelDiaSugerido: number | null; // TC del pago más reciente (proxy del TC de hoy)
};

export type SkuCosto = {
  sku_id: string;
  code: string;
  producto: string | null;
  marca: string | null;
  talla: string | null;
  pct: string | null;
  descripcion: string;
  fuentes: FuenteCosto[]; // ordenadas por eta_bodega DESC (más nuevo primero)
  totalKg: number;
};

export type PromedioResultado = {
  avgUSD: number;
  avgTC: number | null; // null si ninguna fuente usada tiene TC (ni estimado)
  avgMXN: number | null;
  totalKg: number;
  faltante: number; // kg del stock que no alcanzó a cubrir el historial
  sinTC: number; // kg usados que no tenían TC ni estimado
  kgEstimado: number; // kg que usaron el TC estimado del día (sin TC oficial)
  usaEstimado: boolean;
  breakdown: (FuenteCosto & { kgUsado: number; tcUsado: number | null; tcEsEstimado: boolean })[];
};

/**
 * Costo promedio ponderado sobre el stock, tomando del contenedor más nuevo
 * al más viejo (ver §6). El TC promedio se pondera solo sobre los kg que sí
 * tienen TC. Para los contenedores SIN TC oficial se usa `tcEstimado` (TC del
 * día) si se provee — esos kg se marcan como estimados (`tcEsEstimado`).
 */
export function calcularPromedio(
  fuentes: FuenteCosto[],
  stockKg: number,
  tcEstimado?: number | null,
): PromedioResultado | null {
  let restante = stockKg;
  let sumUSD = 0;
  let sumTC = 0;
  let sumKg = 0;
  let sumKgConTC = 0;
  let sumKgEstimado = 0;
  const breakdown: (FuenteCosto & { kgUsado: number; tcUsado: number | null; tcEsEstimado: boolean })[] = [];

  for (const f of fuentes) {
    if (restante <= 0.0001) break;
    const usado = Math.min(f.kg, restante);
    sumUSD += f.precio_usd * usado;
    sumKg += usado;
    const tcUsado = f.tc ?? (tcEstimado != null && tcEstimado > 0 ? tcEstimado : null);
    const esEstimado = f.tc == null && tcUsado != null;
    if (tcUsado != null) {
      sumTC += tcUsado * usado;
      sumKgConTC += usado;
      if (esEstimado) sumKgEstimado += usado;
    }
    restante -= usado;
    breakdown.push({ ...f, kgUsado: usado, tcUsado, tcEsEstimado: esEstimado });
  }

  if (sumKg === 0) return null;
  const avgUSD = sumUSD / sumKg;
  const avgTC = sumKgConTC > 0 ? sumTC / sumKgConTC : null;
  return {
    avgUSD,
    avgTC,
    avgMXN: avgTC != null ? avgUSD * avgTC : null,
    totalKg: sumKg,
    faltante: Math.max(0, restante),
    sinTC: sumKg - sumKgConTC,
    kgEstimado: sumKgEstimado,
    usaEstimado: sumKgEstimado > 0,
    breakdown,
  };
}

/**
 * TC efectivo REAL de un contenedor — el que ya NO se puede mover.
 *
 * Decisión del usuario 2026-07-07: no basta con tener un pago (el anticipo) para
 * dar por bueno su TC; mientras quede saldo, el costo en pesos sigue expuesto y
 * hay que estimarlo con el TC del día (en ámbar).
 *
 * Afinado 2026-08-13: un **forward pendiente también cierra el precio**. Si los
 * pagos hechos más los forwards cubren todo lo que falta, el contenedor ya no
 * está expuesto al tipo de cambio aunque el saldo no se haya pagado todavía —
 * eso es justo para lo que se contrata un forward. En ese caso el TC oficial es
 * el promedio ponderado de pagos + forwards.
 *
 * Se sigue devolviendo `null` (→ TC del día en ámbar) mientras quede cualquier
 * dólar sin asegurar: media cobertura no es un costo cerrado.
 */
function tcEfectivo(
  contratoId: string,
  liquidado: boolean,
  totalUsd: number,
  ncAplicadoUsd: number,
  pagos: { contrato_id: string | null; monto_usd: number; tc: number }[],
  forwardsPendientes: { contrato_id: string | null; monto_usd: number | null; tc_forward: number | null }[],
  forwardsTodos: { contrato_id: string | null; tc_forward: number | null }[],
  tcPonderado: number | null,
): { tc: number | null; origen: TcOrigen } {
  const ps = pagos.filter((p) => p.contrato_id === contratoId);

  const r = tcContrato({
    totalUsd,
    ncAplicadoUsd,
    pagos: ps,
    forwardsPendientes: forwardsPendientes.filter((f) => f.contrato_id === contratoId),
    tcDia: null, // aquí no se estima: si falta algo por asegurar, no hay TC oficial
    tcPonderado: null,
  });
  if (!r.estimado && r.tc != null) {
    return { tc: r.tc, origen: r.origen === 'mixto' ? 'mixto' : r.origen === 'forward' ? 'forward' : 'pagos' };
  }

  // Marcado como liquidado pero sin pagos que lo sustenten (raro: flag puesto a
  // mano en la importación histórica) → forward → tc_ponderado del contrato.
  if (liquidado) {
    const fwd = forwardsTodos.find((f) => f.contrato_id === contratoId && f.tc_forward != null);
    if (fwd?.tc_forward != null) return { tc: Number(fwd.tc_forward), origen: 'forward' };
    if (tcPonderado != null) return { tc: Number(tcPonderado), origen: 'ponderado' };
  }
  return { tc: null, origen: 'ninguno' };
}

/**
 * Arma la lista de SKUs con sus fuentes (contenedores) y el TC efectivo de
 * cada uno. Reutiliza los fetch existentes para no duplicar queries.
 */
export async function fetchCostosData(empresaId: string): Promise<CostosData> {
  // `saldos` solo se usa por el `ncAplicado`: una nota de crédito perdona dólares
  // que nunca se van a cambiar a pesos, así que sin ella un contenedor cerrado
  // con pagos + NC + forward se vería como si le faltara cobertura.
  const [contratos, pagos, forwards, catalogo, saldos] = await Promise.all([
    fetchContratos(empresaId),
    fetchPagos(empresaId),
    fetchForwards(empresaId),
    fetchSkusBlufin(empresaId),
    fetchSaldosPorContrato(empresaId),
  ]);

  const skuById = new Map(catalogo.map((s) => [s.id, s]));
  const skuMap = new Map<string, SkuCosto>();
  const contenedores: ContenedorCosto[] = [];

  const pagosLite = pagos.map((p) => ({
    contrato_id: p.contrato_id,
    monto_usd: Number(p.monto_usd),
    tc: Number(p.tc),
  }));
  // Solo los forwards que de hecho cubren a este contenedor. Un 'Remanente' (lo
  // que sobró al ejecutarlo contra un saldo menor), un 'Liberado' o uno usado
  // fuera de Blufin siguen apuntando al contrato de origen, pero su TC ya no es
  // el de ese contenedor.
  const forwardsLite = forwards
    .filter((f) => f.status === 'Pendiente' || f.status === 'Ejecutado')
    .map((f) => ({ contrato_id: f.contrato_id, tc_forward: f.tc_forward }));
  // Para medir cobertura solo cuentan los PENDIENTES: al ejecutar un forward se
  // inserta un pago, así que sumar también los 'Ejecutado' contaría dos veces
  // los mismos dólares.
  const forwardsPendientes = forwards
    .filter((f) => f.status === 'Pendiente')
    .map((f) => ({ contrato_id: f.contrato_id, monto_usd: f.monto_usd, tc_forward: f.tc_forward }));

  for (const c of contratos) {
    const liquidado = c.saldo_pagado === true;
    const { tc, origen } = tcEfectivo(
      c.id,
      liquidado,
      Number(c.total_usd ?? 0),
      saldos.get(c.id)?.ncAplicado ?? 0,
      pagosLite,
      forwardsPendientes,
      forwardsLite,
      c.tc_ponderado,
    );
    const llego = !!c.llegada_real;

    const contLineas: ContenedorCosto['lineas'] = [];
    let contKg = 0;
    for (const linea of c.productos ?? []) {
      const kg = Number(linea.kg ?? 0);
      contLineas.push({
        code: linea.sku_id ? (skuById.get(linea.sku_id)?.code ?? '') : '',
        descripcion: linea.descripcion ?? '—',
        kg,
        precio_usd: Number(linea.precio_usd ?? 0),
        total_usd: linea.total_usd != null ? Number(linea.total_usd) : kg * Number(linea.precio_usd ?? 0),
      });
      contKg += kg;

      if (!linea.sku_id) continue;
      const cat = skuById.get(linea.sku_id);
      if (!skuMap.has(linea.sku_id)) {
        skuMap.set(linea.sku_id, {
          sku_id: linea.sku_id,
          code: cat?.code ?? '—',
          producto: cat?.producto ?? linea.marca ?? null,
          marca: cat?.marca ?? linea.marca ?? null,
          talla: cat?.talla ?? linea.talla ?? null,
          pct: cat?.pct ?? linea.pct ?? null,
          descripcion: cat?.descripcion ?? linea.descripcion ?? '—',
          fuentes: [],
          totalKg: 0,
        });
      }
      const sku = skuMap.get(linea.sku_id)!;
      sku.fuentes.push({
        contrato_id: c.id,
        folio: c.folio,
        contenedor: c.contenedor,
        naviera: c.naviera,
        eta_bodega: c.eta_bodega,
        fecha_contrato: c.fecha,
        status: c.status,
        llegada_real: c.llegada_real ?? null,
        llego,
        kg,
        precio_usd: Number(linea.precio_usd ?? 0),
        tc,
        tc_origen: origen,
      });
      sku.totalKg += kg;
    }

    contenedores.push({
      contrato_id: c.id,
      folio: c.folio,
      contenedor: c.contenedor,
      naviera: c.naviera,
      eta_bodega: c.eta_bodega,
      llegada_real: c.llegada_real ?? null,
      llego,
      liquidado,
      status: c.status,
      total_usd: Number(c.total_usd ?? 0),
      total_kg: contKg,
      tc,
      tc_origen: origen,
      lineas: contLineas,
    });
  }

  // Ordenar fuentes por eta_bodega DESC (nulls al final)
  for (const sku of skuMap.values()) {
    sku.fuentes.sort((a, b) => (b.eta_bodega ?? '').localeCompare(a.eta_bodega ?? ''));
  }
  contenedores.sort((a, b) => (b.eta_bodega ?? '').localeCompare(a.eta_bodega ?? ''));

  return {
    skus: Array.from(skuMap.values()).sort((a, b) => b.totalKg - a.totalKg),
    contenedores,
    tcDelDiaSugerido: pagos.length > 0 ? Number(pagos[0].tc) : null,
  };
}
