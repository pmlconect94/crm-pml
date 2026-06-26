import { fetchFacturas } from '@/features/neptuno/queries';
import { fetchPagos } from '@/features/neptuno/pagos-queries';
import { fetchSkusNeptuno } from '@/features/neptuno/productos-queries';

/**
 * Central de Costos de Neptuno. Diferencia clave vs Blufin: NO hay recepción —
 * las cantidades de la factura SON el inventario. Tampoco hay forwards. El TC
 * efectivo de una factura sale de sus pagos reales ponderados; si no hay pagos,
 * se usa el TC del día estimado.
 */

/** Origen del TC efectivo de una factura. */
export type TcOrigen = 'pagos' | 'ninguno';

export type FuenteCosto = {
  factura_id: string;
  factura_num: string;
  fecha_factura: string | null;
  status: string;
  liquidada: boolean; // status Liquidada
  kg: number;
  precio_usd: number;
  tc: number | null; // TC efectivo REAL (null si no hay pagos)
  tc_origen: TcOrigen;
};

/** Una factura (= una entrada de inventario) con su costo total y TC efectivo. */
export type FacturaCosto = {
  factura_id: string;
  factura_num: string;
  fecha_factura: string | null;
  liquidada: boolean;
  status: string;
  total_usd: number;
  total_kg: number;
  tc: number | null;
  tc_origen: TcOrigen;
  lineas: { descripcion: string; kg: number; precio_usd: number; total_usd: number }[];
};

export type SkuCosto = {
  sku_id: string;
  code: string;
  producto: string | null;
  marca: string | null;
  talla: string | null;
  pct: string | null;
  descripcion: string;
  fuentes: FuenteCosto[]; // ordenadas por fecha_factura DESC (más nuevo primero)
  totalKg: number;
};

export type CostosData = {
  skus: SkuCosto[];
  facturas: FacturaCosto[]; // ordenadas por fecha_factura DESC
  tcDelDiaSugerido: number | null; // TC del pago más reciente (proxy del TC de hoy)
};

export type PromedioResultado = {
  avgUSD: number;
  avgTC: number | null;
  avgMXN: number | null;
  totalKg: number;
  faltante: number;
  sinTC: number;
  kgEstimado: number;
  usaEstimado: boolean;
  breakdown: (FuenteCosto & { kgUsado: number; tcUsado: number | null; tcEsEstimado: boolean })[];
};

/**
 * Costo promedio ponderado sobre el stock, tomando de la factura más nueva a la
 * más vieja. El TC promedio se pondera solo sobre los kg que sí tienen TC. Para
 * las facturas SIN TC oficial se usa `tcEstimado` si se provee — esos kg se
 * marcan como estimados.
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
  const breakdown: (FuenteCosto & { kgUsado: number; tcUsado: number | null; tcEsEstimado: boolean })[] =
    [];

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

/** TC efectivo de una factura: pagos reales ponderados → null. */
function tcEfectivo(
  facturaId: string,
  pagos: { factura_id: string | null; monto_usd: number; tc: number }[],
): { tc: number | null; origen: TcOrigen } {
  const ps = pagos.filter((p) => p.factura_id === facturaId);
  if (ps.length > 0) {
    const sumMonto = ps.reduce((s, p) => s + Number(p.monto_usd), 0);
    if (sumMonto > 0) {
      const sumProd = ps.reduce((s, p) => s + Number(p.tc) * Number(p.monto_usd), 0);
      return { tc: sumProd / sumMonto, origen: 'pagos' };
    }
  }
  return { tc: null, origen: 'ninguno' };
}

export async function fetchCostosData(empresaId: string): Promise<CostosData> {
  const [facturas, pagos, catalogo] = await Promise.all([
    fetchFacturas(empresaId),
    fetchPagos(empresaId),
    fetchSkusNeptuno(empresaId),
  ]);

  const skuById = new Map(catalogo.map((s) => [s.id, s]));
  const skuMap = new Map<string, SkuCosto>();
  const facturasCosto: FacturaCosto[] = [];

  const pagosLite = pagos.map((p) => ({
    factura_id: p.factura_id,
    monto_usd: Number(p.monto_usd),
    tc: Number(p.tc),
  }));

  for (const f of facturas) {
    const { tc, origen } = tcEfectivo(f.id, pagosLite);
    const liquidada = f.status === 'Liquidada';

    const facLineas: FacturaCosto['lineas'] = [];
    let facKg = 0;
    for (const linea of f.productos ?? []) {
      const kg = Number(linea.kg ?? 0);
      facLineas.push({
        descripcion: linea.descripcion ?? '—',
        kg,
        precio_usd: Number(linea.precio_usd ?? 0),
        total_usd:
          linea.total_usd != null ? Number(linea.total_usd) : kg * Number(linea.precio_usd ?? 0),
      });
      facKg += kg;

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
        factura_id: f.id,
        factura_num: f.factura_num,
        fecha_factura: f.fecha_factura,
        status: f.status ?? 'Pendiente',
        liquidada,
        kg,
        precio_usd: Number(linea.precio_usd ?? 0),
        tc,
        tc_origen: origen,
      });
      sku.totalKg += kg;
    }

    facturasCosto.push({
      factura_id: f.id,
      factura_num: f.factura_num,
      fecha_factura: f.fecha_factura,
      liquidada,
      status: f.status ?? 'Pendiente',
      total_usd: Number(f.total_usd ?? 0),
      total_kg: facKg,
      tc,
      tc_origen: origen,
      lineas: facLineas,
    });
  }

  // Ordenar fuentes por fecha_factura DESC (nulls al final)
  for (const sku of skuMap.values()) {
    sku.fuentes.sort((a, b) => (b.fecha_factura ?? '').localeCompare(a.fecha_factura ?? ''));
  }
  facturasCosto.sort((a, b) => (b.fecha_factura ?? '').localeCompare(a.fecha_factura ?? ''));

  return {
    skus: Array.from(skuMap.values()).sort((a, b) => b.totalKg - a.totalKg),
    facturas: facturasCosto,
    tcDelDiaSugerido: pagos.length > 0 ? Number(pagos[0].tc) : null,
  };
}
