/**
 * Facturas recibidas — CFDIs sincronizados del SAT (crm.cont_facturas / cont_conceptos /
 * cont_concepto_impuestos). Solo lectura desde este frontend: el alta y la actualización
 * las hace el job de sincronización (backend Python) que habla directo con el SAT.
 */
import { supabase } from '@/lib/supabase';
import type { ContFactura, ContConceptoConImpuestos, ContRelacion, ContPago, ContPagoConDocumentos, ContPagoDocumento } from '@/types/database';

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

/** Relación (CfdiRelacionados) + los datos básicos del CFDI relacionado, cuando ese
 *  CFDI también está sincronizado (no siempre lo está: puede ser de otro periodo). */
export type ContRelacionConDatos = ContRelacion & {
  relacionada?: Pick<ContFactura, 'serie' | 'folio' | 'tipo_comprobante' | 'total' | 'moneda' | 'fecha_emision'> | null;
};

/** Una línea de "documento pagado" (dentro de un Complemento de Pago ajeno) que
 *  liquida ESTA factura, con los datos del pago que la trae + el folio del propio
 *  comprobante de pago (para poder abrirlo). Es la dirección inversa de `pagos`:
 *  el UUID de una factura normal casi nunca aparece en `cont_pagos.factura_uuid`
 *  (ese campo es el UUID del PROPIO comprobante de pago) — aparece en
 *  `cont_pagos_documentos.id_documento` de el/los pagos que la liquidaron. */
export type PagoRecibido = ContPagoDocumento & {
  pago: Pick<ContPago, 'id' | 'factura_uuid' | 'fecha_pago' | 'forma_pago' | 'monto' | 'moneda'>;
  comprobante?: Pick<ContFactura, 'serie' | 'folio'> | null;
};

export type FacturaDetalle = {
  factura: ContFactura;
  conceptos: ContConceptoConImpuestos[];
  relaciones: ContRelacionConDatos[];
  /** Si esta factura ES un comprobante de pago (tipo P): qué documentos liquida. */
  pagos: ContPagoConDocumentos[];
  /** Pagos que OTROS comprobantes de pago aplicaron a esta factura (el caso común
   *  para una factura PPD normal). */
  pagosRecibidos: PagoRecibido[];
};

export async function fetchFacturaDetalle(uuid: string): Promise<FacturaDetalle | null> {
  const [
    { data: factura, error: fErr },
    { data: conceptos, error: cErr },
    { data: relaciones, error: rErr },
    { data: pagos, error: pErr },
    { data: pagosRecibidos, error: prErr },
  ] = await Promise.all([
    supabase.from('cont_facturas').select('*').eq('uuid', uuid).maybeSingle(),
    // Los impuestos van anidados en la misma consulta (join real vía FK concepto_id) en
    // vez de un tercer round-trip: sin esto necesitaríamos primero los ids de concepto.
    supabase
      .from('cont_conceptos')
      .select('*, cont_concepto_impuestos(*)')
      .eq('factura_uuid', uuid)
      .order('num_linea', { ascending: true }),
    supabase.from('cont_relaciones').select('*').eq('factura_uuid', uuid),
    // Los documentos que liquida cada pago van anidados vía FK pago_id.
    supabase
      .from('cont_pagos')
      .select('*, cont_pagos_documentos(*)')
      .eq('factura_uuid', uuid)
      .order('fecha_pago', { ascending: true }),
    // Dirección inversa: documentos-pagados (de CUALQUIER comprobante de pago) que
    // referencian esta factura como `id_documento`.
    supabase
      .from('cont_pagos_documentos')
      .select('*, cont_pagos(id, factura_uuid, fecha_pago, forma_pago, monto, moneda)')
      .eq('id_documento', uuid),
  ]);
  if (fErr) throw fErr;
  if (cErr) throw cErr;
  if (rErr) throw rErr;
  if (pErr) throw pErr;
  if (prErr) throw prErr;
  if (!factura) return null;

  // uuid_relacionado no tiene FK propia (el CFDI relacionado puede no estar sincronizado
  // aún), así que se resuelve con una segunda consulta en vez de un embed de PostgREST.
  let relacionesConDatos = (relaciones ?? []) as ContRelacionConDatos[];
  if (relacionesConDatos.length > 0) {
    const uuids = relacionesConDatos.map((r) => r.uuid_relacionado);
    const { data: relacionadas, error: rdErr } = await supabase
      .from('cont_facturas')
      .select('uuid, serie, folio, tipo_comprobante, total, moneda, fecha_emision')
      .in('uuid', uuids);
    if (rdErr) throw rdErr;
    const porUuid = new Map((relacionadas ?? []).map((f) => [f.uuid, f]));
    relacionesConDatos = relacionesConDatos.map((r) => ({ ...r, relacionada: porUuid.get(r.uuid_relacionado) ?? null }));
  }

  // PostgREST anida el embed bajo el nombre de la tabla (`cont_pagos`), no bajo un alias
  // propio — se remapea a `pago` aquí para que el resto del código no tenga que saberlo.
  type PagoEmbebido = Pick<ContPago, 'id' | 'factura_uuid' | 'fecha_pago' | 'forma_pago' | 'monto' | 'moneda'>;
  let pagosRecibidosConDatos = ((pagosRecibidos ?? []) as unknown as (ContPagoDocumento & { cont_pagos: PagoEmbebido })[]).map(
    ({ cont_pagos, ...doc }) => ({ ...doc, pago: cont_pagos }) as PagoRecibido,
  );
  if (pagosRecibidosConDatos.length > 0) {
    const uuidsComprobantes = pagosRecibidosConDatos.map((p) => p.pago.factura_uuid);
    const { data: comprobantes, error: cpErr } = await supabase
      .from('cont_facturas')
      .select('uuid, serie, folio')
      .in('uuid', uuidsComprobantes);
    if (cpErr) throw cpErr;
    const porUuid = new Map((comprobantes ?? []).map((c) => [c.uuid, c]));
    pagosRecibidosConDatos = pagosRecibidosConDatos
      .map((p) => ({ ...p, comprobante: porUuid.get(p.pago.factura_uuid) ?? null }))
      .sort((a, b) => new Date(a.pago.fecha_pago ?? 0).getTime() - new Date(b.pago.fecha_pago ?? 0).getTime());
  }

  return {
    factura: factura as ContFactura,
    conceptos: (conceptos ?? []) as unknown as ContConceptoConImpuestos[],
    relaciones: relacionesConDatos,
    pagos: (pagos ?? []) as unknown as ContPagoConDocumentos[],
    pagosRecibidos: pagosRecibidosConDatos,
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
