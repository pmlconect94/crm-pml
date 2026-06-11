import { supabase } from '@/lib/supabase';
import type {
  BlufinContratoConProductos,
  BlufinRecepcionEnriquecida,
} from '@/types/database';

/**
 * Historial de recepciones con contrato, bodega y líneas (incluye SKU).
 * Ordenadas de la más reciente a la más vieja.
 */
export async function fetchRecepciones(empresaId: string): Promise<BlufinRecepcionEnriquecida[]> {
  const { data, error } = await supabase
    .from('blufin_recepciones')
    .select(
      'id, contrato_id, fecha_recepcion, bodega_id, entrada_intelisis, presentacion_recibida, observaciones, capturado_por, created_at, ' +
        'contrato:blufin_contratos!inner(folio, empresa_id, presentacion, total_kg), ' +
        'bodega:bodegas(nombre), ' +
        'lineas:blufin_recepcion_lineas(*, sku:catalogo_sku(code, descripcion))',
    )
    .eq('contrato.empresa_id', empresaId)
    .order('fecha_recepcion', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BlufinRecepcionEnriquecida[];
}

/**
 * Contratos pendientes de recibir: todo lo que no esté Entregado y no tenga
 * recepción registrada, con sus productos para precargar las líneas.
 * Ordenados por ETA bodega ascendente (lo más próximo primero).
 */
export async function fetchContratosPorRecibir(
  empresaId: string,
): Promise<BlufinContratoConProductos[]> {
  const [{ data: contratos, error }, { data: recepciones, error: recErr }] = await Promise.all([
    supabase
      .from('blufin_contratos')
      .select('*, productos:blufin_contrato_productos(*)')
      .eq('empresa_id', empresaId)
      .neq('status', 'Entregado')
      .order('eta_bodega', { ascending: true, nullsFirst: false }),
    supabase.from('blufin_recepciones').select('contrato_id'),
  ]);
  if (error) throw error;
  if (recErr) throw recErr;

  const yaRecibidos = new Set((recepciones ?? []).map((r) => r.contrato_id));
  return ((contratos ?? []) as unknown as BlufinContratoConProductos[]).filter(
    (c) => !yaRecibidos.has(c.id),
  );
}

export async function fetchContratoById(id: string): Promise<BlufinContratoConProductos | null> {
  const { data, error } = await supabase
    .from('blufin_contratos')
    .select('*, productos:blufin_contrato_productos(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as BlufinContratoConProductos | null;
}

export type RecepcionLineaParam = {
  sku_id: string | null;
  kg_contratados: number;
  kg_recibidos: number;
  observaciones: string | null;
};

export type RecepcionParams = {
  contrato_id: string;
  fecha_recepcion: string;
  bodega_id: number | null;
  bodega_nombre: string | null; // para actualizar bodega_destino del contrato
  entrada_intelisis: string | null;
  presentacion_recibida: string | null;
  observaciones: string | null;
  lote: string | null; // se captura AL RECIBIR — actualiza el contrato
  naviera: string | null; // naviera real — actualiza el contrato
  lineas: RecepcionLineaParam[];
};

/**
 * Registrar recepción:
 *   1. Inserta blufin_recepciones (1 por contrato — rechaza si ya existe)
 *   2. Inserta las líneas por SKU (diferencia se calcula en BD, columna generada)
 *   3. Actualiza el contrato: lote + naviera real + llegada_real + bodega_destino
 *      + status = 'Entregado'
 * Si algún paso falla, lanza error (el patrón de flags vive en frontend, ver §17).
 */
export async function createRecepcion(params: RecepcionParams): Promise<void> {
  if (params.lineas.length === 0) throw new Error('La recepción no tiene líneas');

  // 1) Una recepción por contrato
  const { count, error: chkErr } = await supabase
    .from('blufin_recepciones')
    .select('id', { count: 'exact', head: true })
    .eq('contrato_id', params.contrato_id);
  if (chkErr) throw chkErr;
  if ((count ?? 0) > 0) {
    throw new Error('Este contrato ya tiene una recepción registrada. Elimínala primero si necesitas corregirla.');
  }

  // 2) Insertar recepción
  const { data: recepcion, error: recErr } = await supabase
    .from('blufin_recepciones')
    .insert({
      contrato_id: params.contrato_id,
      fecha_recepcion: params.fecha_recepcion,
      bodega_id: params.bodega_id,
      entrada_intelisis: params.entrada_intelisis,
      presentacion_recibida: params.presentacion_recibida,
      observaciones: params.observaciones,
    })
    .select('id')
    .single();
  if (recErr) throw recErr;

  // 3) Insertar líneas en batch
  const { error: linErr } = await supabase.from('blufin_recepcion_lineas').insert(
    params.lineas.map((l) => ({
      recepcion_id: recepcion.id,
      sku_id: l.sku_id,
      kg_contratados: l.kg_contratados,
      kg_recibidos: l.kg_recibidos,
      observaciones: l.observaciones,
    })),
  );
  if (linErr) throw linErr;

  // 4) Actualizar contrato — aquí se capturan lote y naviera real
  const { error: updErr } = await supabase
    .from('blufin_contratos')
    .update({
      lote: params.lote,
      naviera: params.naviera,
      llegada_real: params.fecha_recepcion,
      bodega_destino: params.bodega_nombre,
      status: 'Entregado',
    })
    .eq('id', params.contrato_id);
  if (updErr) throw updErr;
}

/**
 * Eliminar recepción — simétrico al create:
 * borra la recepción (cascade borra líneas) y revierte el contrato a 'En puerto'
 * limpiando lote, naviera y llegada_real que la recepción capturó.
 */
export async function deleteRecepcion(id: string): Promise<void> {
  const { data: recepcion, error: rErr } = await supabase
    .from('blufin_recepciones')
    .select('contrato_id')
    .eq('id', id)
    .single();
  if (rErr) throw rErr;

  const { error: dErr } = await supabase.from('blufin_recepciones').delete().eq('id', id);
  if (dErr) throw dErr;

  if (!recepcion?.contrato_id) return;

  const { error: updErr } = await supabase
    .from('blufin_contratos')
    .update({
      lote: null,
      naviera: null,
      llegada_real: null,
      status: 'En puerto',
    })
    .eq('id', recepcion.contrato_id);
  if (updErr) throw updErr;
}
