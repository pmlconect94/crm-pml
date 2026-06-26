import { supabase } from '@/lib/supabase';
import type { CamContenedorSAConProductos, CamRecepcionSAEnriquecida } from '@/types/database';

/**
 * Historial de recepciones SA con contenedor, bodega y líneas (incluye SKU).
 */
export async function fetchRecepcionesSA(empresaId: string): Promise<CamRecepcionSAEnriquecida[]> {
  const { data, error } = await supabase
    .from('cam_recepcion_sa')
    .select(
      'id, contenedor_id, fecha, bodega_id, entrada_intelisis, presentacion_recibida, observaciones, capturado_por, created_at, ' +
        'contenedor:cam_contenedores_sa!inner(folio_interno, empresa_id, presentacion, total_kg), ' +
        'bodega:bodegas(nombre), ' +
        'lineas:cam_recepcion_sa_lineas(*, sku:catalogo_sku(code, descripcion))',
    )
    .eq('contenedor.empresa_id', empresaId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CamRecepcionSAEnriquecida[];
}

/**
 * Contenedores pendientes de recibir: no Entregados y sin recepción registrada,
 * con sus productos para precargar las líneas. Ordenados por ETA bodega ASC.
 */
export async function fetchContenedoresPorRecibirSA(
  empresaId: string,
): Promise<CamContenedorSAConProductos[]> {
  const [{ data: contenedores, error }, { data: recepciones, error: recErr }] = await Promise.all([
    supabase
      .from('cam_contenedores_sa')
      .select('*, productos:cam_productos_sa(*)')
      .eq('empresa_id', empresaId)
      .neq('status', 'Entregado')
      .order('eta_bodega', { ascending: true, nullsFirst: false }),
    supabase.from('cam_recepcion_sa').select('contenedor_id'),
  ]);
  if (error) throw error;
  if (recErr) throw recErr;

  const yaRecibidos = new Set((recepciones ?? []).map((r) => r.contenedor_id));
  return ((contenedores ?? []) as unknown as CamContenedorSAConProductos[]).filter(
    (c) => !yaRecibidos.has(c.id),
  );
}

/**
 * Reprogramar la llegada a bodega de un contenedor (fija la fecha oficial).
 */
export async function updateLlegadaContenedorSA(params: {
  contenedor_id: string;
  eta_bodega: string;
  bodega_destino: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from('cam_contenedores_sa')
    .update({
      eta_bodega: params.eta_bodega,
      bodega_destino: params.bodega_destino,
      eta_bodega_confirmada: true,
    })
    .eq('id', params.contenedor_id);
  if (error) throw error;
}

export async function fetchContenedorSAById(id: string): Promise<CamContenedorSAConProductos | null> {
  const { data, error } = await supabase
    .from('cam_contenedores_sa')
    .select('*, productos:cam_productos_sa(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CamContenedorSAConProductos | null;
}

export type RecepcionLineaParamSA = {
  sku_id: string | null;
  kg_contratados: number;
  kg_recibidos: number;
  observaciones: string | null;
};

export type RecepcionParamsSA = {
  contenedor_id: string;
  fecha: string;
  bodega_id: number | null;
  bodega_nombre: string | null;
  entrada_intelisis: string | null;
  presentacion_recibida: string | null;
  observaciones: string | null;
  lote: string | null;
  lineas: RecepcionLineaParamSA[];
};

/**
 * Registrar recepción SA:
 *   1. Inserta cam_recepcion_sa (1 por contenedor — rechaza si ya existe)
 *   2. Inserta las líneas por SKU (diferencia = columna generada en BD)
 *   3. Actualiza el contenedor: lote + llegada_real + bodega_destino + status='Entregado'
 */
export async function createRecepcionSA(params: RecepcionParamsSA): Promise<void> {
  if (params.lineas.length === 0) throw new Error('La recepción no tiene líneas');

  const { count, error: chkErr } = await supabase
    .from('cam_recepcion_sa')
    .select('id', { count: 'exact', head: true })
    .eq('contenedor_id', params.contenedor_id);
  if (chkErr) throw chkErr;
  if ((count ?? 0) > 0) {
    throw new Error('Este contenedor ya tiene una recepción registrada. Elimínala primero si necesitas corregirla.');
  }

  const { data: recepcion, error: recErr } = await supabase
    .from('cam_recepcion_sa')
    .insert({
      contenedor_id: params.contenedor_id,
      fecha: params.fecha,
      bodega_id: params.bodega_id,
      entrada_intelisis: params.entrada_intelisis,
      presentacion_recibida: params.presentacion_recibida,
      observaciones: params.observaciones,
    })
    .select('id')
    .single();
  if (recErr) throw recErr;

  const { error: linErr } = await supabase.from('cam_recepcion_sa_lineas').insert(
    params.lineas.map((l) => ({
      recepcion_id: recepcion.id,
      sku_id: l.sku_id,
      kg_contratados: l.kg_contratados,
      kg_recibidos: l.kg_recibidos,
      observaciones: l.observaciones,
    })),
  );
  if (linErr) throw linErr;

  const { error: updErr } = await supabase
    .from('cam_contenedores_sa')
    .update({
      lote: params.lote,
      llegada_real: params.fecha,
      bodega_destino: params.bodega_nombre,
      status: 'Entregado',
    })
    .eq('id', params.contenedor_id);
  if (updErr) throw updErr;
}

/**
 * Eliminar recepción — simétrico al create: revierte el contenedor a 'En Manzanillo'
 * limpiando lote y llegada_real.
 */
export async function deleteRecepcionSA(id: string): Promise<void> {
  const { data: recepcion, error: rErr } = await supabase
    .from('cam_recepcion_sa')
    .select('contenedor_id')
    .eq('id', id)
    .single();
  if (rErr) throw rErr;

  const { error: dErr } = await supabase.from('cam_recepcion_sa').delete().eq('id', id);
  if (dErr) throw dErr;

  if (!recepcion?.contenedor_id) return;
  const { error: updErr } = await supabase
    .from('cam_contenedores_sa')
    .update({ lote: null, llegada_real: null, status: 'En Manzanillo' })
    .eq('id', recepcion.contenedor_id);
  if (updErr) throw updErr;
}
