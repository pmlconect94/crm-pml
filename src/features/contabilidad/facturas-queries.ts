/**
 * Facturas recibidas — CFDIs sincronizados del SAT (crm.cont_facturas / cont_conceptos /
 * cont_concepto_impuestos). Solo lectura desde este frontend: el alta y la actualización
 * las hace el job de sincronización (backend Python) que habla directo con el SAT.
 */
import { supabase } from '@/lib/supabase';
import type { ContFactura, ContConceptoConImpuestos } from '@/types/database';

const BUCKET = 'cont-facturas';
export const FACTURAS_PAGE_SIZE = 50;

export type FacturasFiltros = {
  /** Razón social o RFC del emisor (búsqueda parcial, insensible a mayúsculas). */
  q?: string;
  /** Fecha de emisión >= (YYYY-MM-DD). */
  desde?: string;
  /** Fecha de emisión <= (YYYY-MM-DD). */
  hasta?: string;
  /** c_TipoDeComprobante: I/E/T/P. */
  tipoComprobante?: string;
  /** c_MetodoPago: PUE/PPD. */
  metodoPago?: string;
};

export type FacturasPagina = {
  facturas: ContFactura[];
  /** Total de filas que matchean el filtro (no solo las de esta página) — cuenta exacta
   *  server-side vía `{ count: 'exact' }`, no un scan client-side. */
  count: number;
};

/**
 * Lista paginada de facturas recibidas de una empresa, más nuevas primero.
 * `desde`/`hasta` se aplican server-side (la tabla ya tiene 2000+ filas, no se puede
 * traer todo y filtrar en cliente). `q` (razón social / RFC del emisor) también se
 * resuelve server-side con `.or(...)`: como la lista está paginada, filtrar solo la
 * página cargada dejaría fuera resultados que caen en otras páginas.
 */
export async function fetchFacturas(
  empresaId: string,
  filtros: FacturasFiltros = {},
  page = 0,
): Promise<FacturasPagina> {
  let query = supabase
    .from('cont_facturas')
    .select('*', { count: 'exact' })
    .eq('tipo', 'recibida')
    .eq('empresa_id', empresaId);

  if (filtros.desde) query = query.gte('fecha_emision', `${filtros.desde}T00:00:00`);
  if (filtros.hasta) query = query.lte('fecha_emision', `${filtros.hasta}T23:59:59`);
  if (filtros.tipoComprobante) query = query.eq('tipo_comprobante', filtros.tipoComprobante);
  if (filtros.metodoPago) query = query.eq('metodo_pago', filtros.metodoPago);

  const q = filtros.q?.trim();
  if (q) {
    // `,` y `()` rompen el parseo del string de `.or()` de PostgREST — se descartan del
    // término buscado (razones sociales/RFC casi nunca los necesitan para encontrarse).
    const term = q.replace(/[%,()]/g, ' ').trim();
    if (term) query = query.or(`emisor_nombre.ilike.%${term}%,emisor_rfc.ilike.%${term}%`);
  }

  const from = page * FACTURAS_PAGE_SIZE;
  const { data, error, count } = await query
    .order('fecha_emision', { ascending: false })
    .range(from, from + FACTURAS_PAGE_SIZE - 1);
  if (error) throw error;
  return { facturas: (data ?? []) as ContFactura[], count: count ?? 0 };
}

export type FacturaDetalle = {
  factura: ContFactura;
  conceptos: ContConceptoConImpuestos[];
};

export async function fetchFacturaDetalle(uuid: string): Promise<FacturaDetalle | null> {
  const [{ data: factura, error: fErr }, { data: conceptos, error: cErr }] = await Promise.all([
    supabase.from('cont_facturas').select('*').eq('uuid', uuid).maybeSingle(),
    // Los impuestos van anidados en la misma consulta (join real vía FK concepto_id) en
    // vez de un tercer round-trip: sin esto necesitaríamos primero los ids de concepto.
    supabase
      .from('cont_conceptos')
      .select('*, cont_concepto_impuestos(*)')
      .eq('factura_uuid', uuid)
      .order('num_linea', { ascending: true }),
  ]);
  if (fErr) throw fErr;
  if (cErr) throw cErr;
  if (!factura) return null;
  return {
    factura: factura as ContFactura,
    conceptos: (conceptos ?? []) as unknown as ContConceptoConImpuestos[],
  };
}

/** URL firmada (1h) para descargar el XML original desde el bucket privado `cont-facturas`. */
export async function getFacturaXmlUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Fecha/hora de la última corrida del sincronizador (tarea programada en
 * Contabilidad PML, 3 veces al día). `cont_solicitudes.created_at` se marca en
 * cada corrida sin importar si trajo facturas nuevas o no, así que refleja
 * "cuándo se revisó por última vez", no solo "cuándo llegó algo nuevo".
 */
export async function fetchUltimaSincronizacion(): Promise<string | null> {
  const { data, error } = await supabase
    .from('cont_solicitudes')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.created_at ?? null;
}
