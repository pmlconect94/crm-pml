import { fetchContratos } from '@/features/blufin/queries';
import { fetchPagos, fetchForwards } from '@/features/blufin/pagos-queries';
import { fetchSkusBlufin } from '@/features/blufin/productos-queries';

/** Origen del TC efectivo de un contenedor (orden de prioridad §14 regla 2). */
export type TcOrigen = 'pagos' | 'forward' | 'ponderado' | 'ninguno';

export type FuenteCosto = {
  contrato_id: string;
  folio: string;
  contenedor: string | null;
  naviera: string | null;
  eta_bodega: string | null;
  fecha_contrato: string | null;
  status: string;
  kg: number;
  precio_usd: number;
  tc: number | null; // TC efectivo (null si no se pudo determinar)
  tc_origen: TcOrigen;
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
  avgTC: number | null; // null si ninguna fuente usada tiene TC
  avgMXN: number | null;
  totalKg: number;
  faltante: number; // kg del stock que no alcanzó a cubrir el historial
  sinTC: number; // kg usados que no tenían TC
  breakdown: (FuenteCosto & { kgUsado: number })[];
};

/**
 * Costo promedio ponderado sobre el stock, tomando del contenedor más nuevo
 * al más viejo (ver §6). El TC promedio se pondera solo sobre los kg que sí
 * tienen TC; si ninguno lo tiene, avgMXN queda null.
 */
export function calcularPromedio(fuentes: FuenteCosto[], stockKg: number): PromedioResultado | null {
  let restante = stockKg;
  let sumUSD = 0;
  let sumTC = 0;
  let sumKg = 0;
  let sumKgConTC = 0;
  const breakdown: (FuenteCosto & { kgUsado: number })[] = [];

  for (const f of fuentes) {
    if (restante <= 0.0001) break;
    const usado = Math.min(f.kg, restante);
    sumUSD += f.precio_usd * usado;
    sumKg += usado;
    if (f.tc != null) {
      sumTC += f.tc * usado;
      sumKgConTC += usado;
    }
    restante -= usado;
    breakdown.push({ ...f, kgUsado: usado });
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
    breakdown,
  };
}

/** TC efectivo de un contenedor: pagos ponderados → forward → tc_ponderado → null. */
function tcEfectivo(
  contratoId: string,
  pagos: { contrato_id: string | null; monto_usd: number; tc: number }[],
  forwards: { contrato_id: string | null; tc_forward: number | null }[],
  tcPonderado: number | null,
): { tc: number | null; origen: TcOrigen } {
  const ps = pagos.filter((p) => p.contrato_id === contratoId);
  if (ps.length > 0) {
    const sumMonto = ps.reduce((s, p) => s + Number(p.monto_usd), 0);
    if (sumMonto > 0) {
      const sumProd = ps.reduce((s, p) => s + Number(p.tc) * Number(p.monto_usd), 0);
      return { tc: sumProd / sumMonto, origen: 'pagos' };
    }
  }
  const fwd = forwards.find((f) => f.contrato_id === contratoId && f.tc_forward != null);
  if (fwd?.tc_forward != null) return { tc: Number(fwd.tc_forward), origen: 'forward' };
  if (tcPonderado != null) return { tc: Number(tcPonderado), origen: 'ponderado' };
  return { tc: null, origen: 'ninguno' };
}

/**
 * Arma la lista de SKUs con sus fuentes (contenedores) y el TC efectivo de
 * cada uno. Reutiliza los fetch existentes para no duplicar queries.
 */
export async function fetchCostosData(empresaId: string): Promise<SkuCosto[]> {
  const [contratos, pagos, forwards, catalogo] = await Promise.all([
    fetchContratos(empresaId),
    fetchPagos(empresaId),
    fetchForwards(empresaId),
    fetchSkusBlufin(empresaId),
  ]);

  const skuById = new Map(catalogo.map((s) => [s.id, s]));
  const skuMap = new Map<string, SkuCosto>();

  for (const c of contratos) {
    const { tc, origen } = tcEfectivo(
      c.id,
      pagos.map((p) => ({ contrato_id: p.contrato_id, monto_usd: Number(p.monto_usd), tc: Number(p.tc) })),
      forwards.map((f) => ({ contrato_id: f.contrato_id, tc_forward: f.tc_forward })),
      c.tc_ponderado,
    );

    for (const linea of c.productos ?? []) {
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
      const kg = Number(linea.kg ?? 0);
      sku.fuentes.push({
        contrato_id: c.id,
        folio: c.folio,
        contenedor: c.contenedor,
        naviera: c.naviera,
        eta_bodega: c.eta_bodega,
        fecha_contrato: c.fecha,
        status: c.status,
        kg,
        precio_usd: Number(linea.precio_usd ?? 0),
        tc,
        tc_origen: origen,
      });
      sku.totalKg += kg;
    }
  }

  // Ordenar fuentes por eta_bodega DESC (nulls al final)
  for (const sku of skuMap.values()) {
    sku.fuentes.sort((a, b) => (b.eta_bodega ?? '').localeCompare(a.eta_bodega ?? ''));
  }

  return Array.from(skuMap.values()).sort((a, b) => b.totalKg - a.totalKg);
}
