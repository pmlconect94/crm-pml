/**
 * Exportación a Excel de facturas recibidas — una fila por concepto (línea),
 * con el desglose de impuestos (IVA/IEPS trasladado, ISR/IVA retenido) que la
 * vista de lista no puede mostrar. Descarga TODO lo que matchea los filtros
 * activos, no solo la página visible (la lista pagina de 50 en 50).
 */
import { supabase } from '@/lib/supabase';
import { downloadXlsx, type XlsxCell } from '@/lib/excel';
import type { ContFactura, ContConceptoConImpuestos } from '@/types/database';
import type { FacturasFiltros } from '@/features/contabilidad/facturas-queries';
import { formaPagoLabel, tipoComprobanteLabel } from '@/features/contabilidad/catalogos-sat';

const CHUNK = 150; // uuids por consulta .in() — evita URLs kilométricas con miles de facturas

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const num = (n: number | null | undefined): XlsxCell => (n == null ? '' : Number(n));
const txt = (s: string | null | undefined): XlsxCell => s ?? '';

/** Trae TODAS las facturas que matchean los filtros (sin paginar) — misma lógica
 *  de filtros que fetchFacturas, pero en bloques de 1000 (tope de PostgREST)
 *  hasta agotar resultados. */
async function fetchTodasLasFacturas(empresaId: string, filtros: FacturasFiltros): Promise<ContFactura[]> {
  const PAGE = 1000;
  const out: ContFactura[] = [];
  for (let page = 0; ; page++) {
    let query = supabase.from('cont_facturas').select('*').eq('tipo', 'recibida').eq('empresa_id', empresaId);
    if (filtros.desde) query = query.gte('fecha_emision', `${filtros.desde}T00:00:00`);
    if (filtros.hasta) query = query.lte('fecha_emision', `${filtros.hasta}T23:59:59`);
    if (filtros.tipoComprobante) query = query.eq('tipo_comprobante', filtros.tipoComprobante);
    if (filtros.metodoPago) query = query.eq('metodo_pago', filtros.metodoPago);
    const q = filtros.q?.trim();
    if (q) {
      const term = q.replace(/[%,()]/g, ' ').trim();
      if (term) query = query.or(`emisor_nombre.ilike.%${term}%,emisor_rfc.ilike.%${term}%`);
    }
    const from = page * PAGE;
    const { data, error } = await query.order('fecha_emision', { ascending: false }).range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as ContFactura[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Conceptos + impuestos de un conjunto de facturas, en bloques paralelos. */
async function fetchConceptosDe(uuids: string[]): Promise<Map<string, ContConceptoConImpuestos[]>> {
  const map = new Map<string, ContConceptoConImpuestos[]>();
  if (uuids.length === 0) return map;
  const resultados = await Promise.all(
    chunk(uuids, CHUNK).map((batch) =>
      supabase
        .from('cont_conceptos')
        .select('*, cont_concepto_impuestos(*)')
        .in('factura_uuid', batch)
        .order('num_linea', { ascending: true }),
    ),
  );
  for (const { data, error } of resultados) {
    if (error) throw error;
    for (const c of (data ?? []) as unknown as ContConceptoConImpuestos[]) {
      const arr = map.get(c.factura_uuid) ?? [];
      arr.push(c);
      map.set(c.factura_uuid, arr);
    }
  }
  return map;
}

/** Último saldo insoluto reportado (de cualquier comprobante de pago) por
 *  factura — mismo criterio que el detalle: el pago con fecha más reciente. */
async function fetchSaldosDe(uuids: string[]): Promise<Map<string, number>> {
  type Fila = { id_documento: string; imp_saldo_insoluto: number | null; cont_pagos: { fecha_pago: string | null } | null };
  const latest = new Map<string, { fecha: string; saldo: number }>();
  if (uuids.length === 0) return new Map();
  const resultados = await Promise.all(
    chunk(uuids, CHUNK).map((batch) =>
      supabase.from('cont_pagos_documentos').select('id_documento, imp_saldo_insoluto, cont_pagos(fecha_pago)').in('id_documento', batch),
    ),
  );
  for (const { data, error } of resultados) {
    if (error) throw error;
    for (const row of (data ?? []) as unknown as Fila[]) {
      if (row.imp_saldo_insoluto == null) continue;
      const fecha = row.cont_pagos?.fecha_pago ?? '';
      const prev = latest.get(row.id_documento);
      if (!prev || fecha > prev.fecha) latest.set(row.id_documento, { fecha, saldo: row.imp_saldo_insoluto });
    }
  }
  const out = new Map<string, number>();
  for (const [uuid, v] of latest) out.set(uuid, v.saldo);
  return out;
}

/** Suma los impuestos de un concepto agrupados por clave "tipo:impuesto"
 *  ('traslado:002' = IVA trasladado, 'retencion:001' = ISR retenido, etc). */
function impuestosDe(c: ContConceptoConImpuestos): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const imp of c.cont_concepto_impuestos ?? []) {
    const key = `${imp.tipo}:${imp.impuesto}`;
    acc[key] = (acc[key] ?? 0) + Number(imp.importe ?? 0);
  }
  return acc;
}

const HEADER = [
  'UUID', 'Serie', 'Folio', 'Tipo comprobante', 'Fecha emisión', 'Fecha timbrado',
  'Emisor RFC', 'Emisor', 'Receptor RFC', 'Receptor',
  'Método de pago', 'Forma de pago', 'Moneda', 'Tipo de cambio', 'Estatus SAT',
  '# línea', 'Clave SAT', 'Descripción SAT', 'Descripción', 'Cantidad', 'Unidad',
  'Precio unitario', 'Importe línea', 'Descuento línea',
  'IVA trasladado', 'IEPS trasladado', 'ISR retenido', 'IVA retenido',
  'Subtotal factura', 'Descuento factura', 'Total impuestos trasladados', 'Total impuestos retenidos',
  'Total factura', 'Saldo pendiente',
];

/** Genera y descarga el Excel. Devuelve cuántas facturas se exportaron
 *  (para el toast de confirmación). */
export async function exportFacturasDetallado(empresaId: string, filtros: FacturasFiltros): Promise<number> {
  const facturas = await fetchTodasLasFacturas(empresaId, filtros);
  const uuids = facturas.map((f) => f.uuid);
  const [conceptosPorFactura, saldoPorFactura] = await Promise.all([fetchConceptosDe(uuids), fetchSaldosDe(uuids)]);

  const rows: XlsxCell[][] = [HEADER];

  for (const f of facturas) {
    const filaBase: XlsxCell[] = [
      f.uuid,
      txt(f.serie),
      txt(f.folio),
      tipoComprobanteLabel(f.tipo_comprobante),
      txt(f.fecha_emision?.slice(0, 10)),
      txt(f.fecha_timbrado?.slice(0, 10)),
      f.emisor_rfc,
      txt(f.emisor_nombre),
      f.receptor_rfc,
      txt(f.receptor_nombre),
      txt(f.metodo_pago),
      formaPagoLabel(f.forma_pago),
      txt(f.moneda),
      num(f.tipo_cambio),
      f.estatus_sat === 'vigente' ? 'Vigente' : 'Cancelado',
    ];
    const saldo = saldoPorFactura.get(f.uuid);
    const filaTotales: XlsxCell[] = [
      num(f.subtotal),
      num(f.descuento),
      num(f.total_impuestos_trasladados),
      num(f.total_impuestos_retenidos),
      num(f.total),
      saldo != null ? num(saldo) : '',
    ];

    const conceptos = conceptosPorFactura.get(f.uuid) ?? [];
    if (conceptos.length === 0) {
      rows.push([...filaBase, '', '', '', '', '', '', '', '', '', '', '', '', ...filaTotales]);
      continue;
    }
    for (const c of conceptos) {
      const imp = impuestosDe(c);
      rows.push([
        ...filaBase,
        c.num_linea,
        txt(c.clave_prod_serv),
        txt(c.clave_prod_serv_desc),
        txt(c.descripcion),
        num(c.cantidad),
        txt(c.clave_unidad_desc ?? c.unidad),
        num(c.valor_unitario),
        num(c.importe),
        num(c.descuento),
        num(imp['traslado:002']),
        num(imp['traslado:003']),
        num(imp['retencion:001']),
        num(imp['retencion:002']),
        ...filaTotales,
      ]);
    }
  }

  const hoy = new Date().toISOString().slice(0, 10);
  downloadXlsx(`Facturas_PML_${hoy}`, [{ name: 'Facturas', rows }]);
  return facturas.length;
}
