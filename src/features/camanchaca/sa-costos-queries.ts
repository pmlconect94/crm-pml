import { fetchContenedoresSA, fetchCatalogosSA } from '@/features/camanchaca/sa-queries';
import { fetchPagosSA, fetchForwardsSA, fetchCostosImportacionSA } from '@/features/camanchaca/sa-pagos-queries';

/** Origen del TC efectivo de un contenedor (orden §7a: pagos → forward → null). */
export type TcOrigenSA = 'pagos' | 'forward' | 'ninguno';

export type FuenteCostoSA = {
  contenedor_id: string;
  folio: string;
  contenedor: string | null;
  naviera: string | null;
  eta_bodega: string | null;
  fecha: string | null;
  status: string;
  llegada_real: string | null;
  llego: boolean;
  kg: number;
  precio_usd: number;
  tc: number | null;
  tc_origen: TcOrigenSA;
};

export type SkuCostoSA = {
  sku_id: string;
  code: string;
  producto: string | null;
  marca: string | null;
  talla: string | null;
  pct: string | null;
  descripcion: string;
  fuentes: FuenteCostoSA[]; // ordenadas por eta_bodega DESC (más nuevo primero)
  totalKg: number;
};

/** Un contenedor con FOB + costo de importación = costo total internado. */
export type ContenedorCostoSA = {
  contenedor_id: string;
  folio: string;
  contenedor: string | null;
  naviera: string | null;
  eta_bodega: string | null;
  llegada_real: string | null;
  llego: boolean;
  liquidado: boolean;
  status: string;
  total_usd: number;
  total_kg: number;
  tc: number | null;
  tc_origen: TcOrigenSA;
  costoImportacionMxn: number;
  costosPorAgencia: { agencia: string; monto_mxn: number }[];
  lineas: { descripcion: string; kg: number; precio_usd: number; total_usd: number }[];
};

export type CostosDataSA = {
  skus: SkuCostoSA[];
  contenedores: ContenedorCostoSA[]; // ordenados por eta_bodega DESC
  agencias: string[]; // todas las agencias presentes (columnas de Comparación internación)
  tcDelDiaSugerido: number | null; // TC del pago más reciente
};

export type PromedioResultadoSA = {
  avgUSD: number;
  avgTC: number | null;
  avgMXN: number | null;
  totalKg: number;
  faltante: number;
  sinTC: number;
  kgEstimado: number;
  usaEstimado: boolean;
  breakdown: (FuenteCostoSA & { kgUsado: number; tcUsado: number | null; tcEsEstimado: boolean })[];
};

/** Costo promedio ponderado sobre el stock, del contenedor más nuevo al viejo (§6). */
export function calcularPromedioSA(
  fuentes: FuenteCostoSA[],
  stockKg: number,
  tcEstimado?: number | null,
): PromedioResultadoSA | null {
  let restante = stockKg;
  let sumUSD = 0;
  let sumTC = 0;
  let sumKg = 0;
  let sumKgConTC = 0;
  let sumKgEstimado = 0;
  const breakdown: (FuenteCostoSA & { kgUsado: number; tcUsado: number | null; tcEsEstimado: boolean })[] = [];

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

/** TC efectivo de un contenedor: pagos ponderados → forward → null (§7a). */
function tcEfectivoSA(
  contenedorId: string,
  pagos: { contenedor_id: string | null; monto_usd: number; tc: number }[],
  forwards: { contenedor_id: string | null; tc_forward: number | null }[],
): { tc: number | null; origen: TcOrigenSA } {
  const ps = pagos.filter((p) => p.contenedor_id === contenedorId);
  if (ps.length > 0) {
    const sumMonto = ps.reduce((s, p) => s + Number(p.monto_usd), 0);
    if (sumMonto > 0) {
      const sumProd = ps.reduce((s, p) => s + Number(p.tc) * Number(p.monto_usd), 0);
      return { tc: sumProd / sumMonto, origen: 'pagos' };
    }
  }
  const fwd = forwards.find((f) => f.contenedor_id === contenedorId && f.tc_forward != null);
  if (fwd?.tc_forward != null) return { tc: Number(fwd.tc_forward), origen: 'forward' };
  return { tc: null, origen: 'ninguno' };
}

/**
 * Arma SKUs con fuentes (contenedores) + cada contenedor con su FOB, TC efectivo
 * y costo de importación por agencia. Reutiliza los fetch existentes.
 */
export async function fetchCostosDataSA(empresaId: string): Promise<CostosDataSA> {
  const [contenedores, pagos, forwards, costos, catalogos] = await Promise.all([
    fetchContenedoresSA(empresaId),
    fetchPagosSA(empresaId),
    fetchForwardsSA(empresaId),
    fetchCostosImportacionSA(empresaId),
    fetchCatalogosSA(empresaId),
  ]);

  const skuById = new Map(catalogos.skus.map((s) => [s.id, s]));
  const skuMap = new Map<string, SkuCostoSA>();
  const conts: ContenedorCostoSA[] = [];
  const agenciasSet = new Set<string>();

  const pagosLite = pagos.map((p) => ({
    contenedor_id: p.contenedor_id,
    monto_usd: Number(p.monto_usd),
    tc: Number(p.tc),
  }));
  const forwardsLite = forwards.map((f) => ({ contenedor_id: f.contenedor_id, tc_forward: f.tc_forward }));

  // Costos de importación agrupados por contenedor (con agencia)
  const costosPorCont = new Map<string, Map<string, number>>();
  for (const c of costos) {
    if (!c.contenedor_id) continue;
    const agencia = c.agencia?.razon_social ?? (c.concepto || 'Otros');
    agenciasSet.add(agencia);
    let m = costosPorCont.get(c.contenedor_id);
    if (!m) {
      m = new Map();
      costosPorCont.set(c.contenedor_id, m);
    }
    m.set(agencia, (m.get(agencia) ?? 0) + Number(c.monto_mxn));
  }

  for (const c of contenedores) {
    const { tc, origen } = tcEfectivoSA(c.id, pagosLite, forwardsLite);
    const llego = !!c.llegada_real;

    const contLineas: ContenedorCostoSA['lineas'] = [];
    let contKg = 0;
    for (const linea of c.productos ?? []) {
      const kg = Number(linea.kg ?? 0);
      contLineas.push({
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
        contenedor_id: c.id,
        folio: c.folio_interno,
        contenedor: c.contenedor,
        naviera: c.naviera,
        eta_bodega: c.eta_bodega,
        fecha: c.fecha_factura,
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

    const costoMap = costosPorCont.get(c.id);
    const costosPorAgencia = costoMap
      ? Array.from(costoMap.entries()).map(([agencia, monto_mxn]) => ({ agencia, monto_mxn }))
      : [];
    const costoImportacionMxn = costosPorAgencia.reduce((s, a) => s + a.monto_mxn, 0);

    conts.push({
      contenedor_id: c.id,
      folio: c.folio_interno,
      contenedor: c.contenedor,
      naviera: c.naviera,
      eta_bodega: c.eta_bodega,
      llegada_real: c.llegada_real ?? null,
      llego,
      liquidado:
        Number(c.total_usd ?? 0) > 0 &&
        pagosLite.filter((p) => p.contenedor_id === c.id).reduce((s, p) => s + p.monto_usd, 0) >=
          Number(c.total_usd ?? 0) - 0.01,
      status: c.status,
      total_usd: Number(c.total_usd ?? 0),
      total_kg: contKg,
      tc,
      tc_origen: origen,
      costoImportacionMxn,
      costosPorAgencia,
      lineas: contLineas,
    });
  }

  for (const sku of skuMap.values()) {
    sku.fuentes.sort((a, b) => (b.eta_bodega ?? '').localeCompare(a.eta_bodega ?? ''));
  }
  conts.sort((a, b) => (b.eta_bodega ?? '').localeCompare(a.eta_bodega ?? ''));

  return {
    skus: Array.from(skuMap.values()).sort((a, b) => b.totalKg - a.totalKg),
    contenedores: conts,
    agencias: Array.from(agenciasSet).sort(),
    tcDelDiaSugerido: pagos.length > 0 ? Number(pagos[0].tc) : null,
  };
}
