import { supabase } from '@/lib/supabase';
import type {
  Database,
  BlufinContrato,
  BlufinContratoConProductos,
  BlufinContratoInsert,
  BlufinProductoInsert,
  CatalogoSku,
  Naviera,
  Bodega,
  Banco,
} from '@/types/database';

export async function fetchContratos(empresaId: string): Promise<BlufinContratoConProductos[]> {
  const { data, error } = await supabase
    .from('blufin_contratos')
    .select('*, productos:blufin_contrato_productos(*)')
    .eq('empresa_id', empresaId)
    .order('fecha', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BlufinContratoConProductos[];
}

export async function fetchContratoByFolio(folio: string): Promise<BlufinContratoConProductos | null> {
  const { data, error } = await supabase
    .from('blufin_contratos')
    .select('*, productos:blufin_contrato_productos(*)')
    .eq('folio', folio)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as BlufinContratoConProductos | null;
}

export async function createContrato(
  payload: BlufinContratoInsert,
  productos: Omit<BlufinProductoInsert, 'contrato_id'>[],
): Promise<BlufinContrato> {
  const { data: contrato, error } = await supabase
    .from('blufin_contratos')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  if (productos.length > 0) {
    const lineas = productos.map((p, idx) => ({
      ...p,
      contrato_id: contrato.id,
      orden: idx,
    }));
    const { error: linErr } = await supabase.from('blufin_contrato_productos').insert(lineas);
    if (linErr) throw linErr;
  }

  return contrato as BlufinContrato;
}

/**
 * Editar un contrato a mano: actualiza la cabecera y REEMPLAZA los renglones de
 * producto (borra los existentes e inserta los nuevos con su orden). No toca
 * pagos, forwards, NCs ni recepción (esos referencian al contrato, no a las
 * líneas). El recálculo de flags (anticipo/saldo pagado) lo hace el caller con
 * `recalcFlagsContrato` por si cambió el total/anticipo/saldo.
 */
export async function updateContrato(
  id: string,
  payload: Database['crm']['Tables']['blufin_contratos']['Update'],
  productos: Omit<BlufinProductoInsert, 'contrato_id'>[],
): Promise<void> {
  const { error: uErr } = await supabase.from('blufin_contratos').update(payload).eq('id', id);
  if (uErr) throw uErr;

  const { error: dErr } = await supabase
    .from('blufin_contrato_productos')
    .delete()
    .eq('contrato_id', id);
  if (dErr) throw dErr;

  if (productos.length > 0) {
    const lineas = productos.map((p, idx) => ({ ...p, contrato_id: id, orden: idx }));
    const { error: iErr } = await supabase.from('blufin_contrato_productos').insert(lineas);
    if (iErr) throw iErr;
  }
}

export type ContratoDetalle = {
  contrato: BlufinContratoConProductos;
  pagos: {
    id: string;
    tipo: string;
    monto_usd: number;
    tc: number;
    monto_mxn: number | null;
    fecha: string;
    referencia: string | null;
    banco: string | null;
  }[];
  forwards: {
    id: string;
    asociado_a: string | null;
    monto_usd: number | null;
    tc_forward: number | null;
    status: string | null;
    fecha_entrega: string | null;
  }[];
  recepcion: {
    fecha_recepcion: string;
    bodega: string | null;
    entrada_intelisis: string | null;
    presentacion_recibida: string | null;
    lineas: { descripcion: string; kg_contratados: number; kg_recibidos: number; diferencia: number | null }[];
  } | null;
  ncs: {
    id: string;
    folio_interno: string;
    razon: string;
    status: string | null;
    monto_usd: number;
    saldo_pendiente_usd: number | null;
  }[];
  pagado: number;
  ncAplicado: number;
};

/** Toda la info de un contrato para la ficha de detalle: productos, pagos,
 *  forwards, recepción, NCs y el resumen de saldo. */
export async function fetchContratoDetalle(contratoId: string): Promise<ContratoDetalle | null> {
  const [
    { data: contrato, error: cErr },
    { data: pagos, error: pErr },
    { data: forwards, error: fErr },
    { data: recepciones, error: rErr },
    { data: ncs, error: nErr },
    { data: ncAps },
  ] = await Promise.all([
    supabase
      .from('blufin_contratos')
      .select('*, productos:blufin_contrato_productos(*)')
      .eq('id', contratoId)
      .maybeSingle(),
    supabase
      .from('blufin_pagos')
      .select('id, tipo, monto_usd, tc, monto_mxn, fecha, referencia, banco:bancos(nombre)')
      .eq('contrato_id', contratoId)
      .order('fecha', { ascending: true }),
    supabase
      .from('blufin_forwards')
      .select('id, asociado_a, monto_usd, tc_forward, status, fecha_entrega')
      .eq('contrato_id', contratoId),
    supabase
      .from('blufin_recepciones')
      .select(
        'fecha_recepcion, entrada_intelisis, presentacion_recibida, bodega:bodegas(nombre), ' +
          'lineas:blufin_recepcion_lineas(kg_contratados, kg_recibidos, diferencia, sku:catalogo_sku(descripcion))',
      )
      .eq('contrato_id', contratoId)
      .maybeSingle(),
    supabase
      .from('blufin_notas_credito')
      .select('id, folio_interno, razon, status, monto_usd, saldo_pendiente_usd')
      .eq('contrato_origen_id', contratoId),
    supabase.from('blufin_nc_aplicaciones').select('monto_usd').eq('contrato_destino_id', contratoId),
  ]);
  if (cErr) throw cErr;
  if (pErr) throw pErr;
  if (fErr) throw fErr;
  if (rErr) throw rErr;
  if (nErr) throw nErr;
  if (!contrato) return null;

  const rec = recepciones as unknown as {
    fecha_recepcion: string;
    entrada_intelisis: string | null;
    presentacion_recibida: string | null;
    bodega?: { nombre: string } | null;
    lineas?: { kg_contratados: number; kg_recibidos: number; diferencia: number | null; sku?: { descripcion: string } | null }[];
  } | null;

  return {
    contrato: contrato as unknown as BlufinContratoConProductos,
    pagos: (pagos ?? []).map((p) => ({
      id: p.id as string,
      tipo: p.tipo as string,
      monto_usd: Number(p.monto_usd),
      tc: Number(p.tc),
      monto_mxn: p.monto_mxn == null ? null : Number(p.monto_mxn),
      fecha: p.fecha as string,
      referencia: (p.referencia as string | null) ?? null,
      banco: (p.banco as unknown as { nombre: string } | null)?.nombre ?? null,
    })),
    forwards: (forwards ?? []).map((f) => ({
      id: f.id as string,
      asociado_a: (f.asociado_a as string | null) ?? null,
      monto_usd: f.monto_usd == null ? null : Number(f.monto_usd),
      tc_forward: f.tc_forward == null ? null : Number(f.tc_forward),
      status: (f.status as string | null) ?? null,
      fecha_entrega: (f.fecha_entrega as string | null) ?? null,
    })),
    recepcion: rec
      ? {
          fecha_recepcion: rec.fecha_recepcion,
          bodega: rec.bodega?.nombre ?? null,
          entrada_intelisis: rec.entrada_intelisis,
          presentacion_recibida: rec.presentacion_recibida,
          lineas: (rec.lineas ?? []).map((l) => ({
            descripcion: l.sku?.descripcion ?? '—',
            kg_contratados: Number(l.kg_contratados),
            kg_recibidos: Number(l.kg_recibidos),
            diferencia: l.diferencia == null ? null : Number(l.diferencia),
          })),
        }
      : null,
    ncs: (ncs ?? []).map((n) => ({
      id: n.id as string,
      folio_interno: n.folio_interno as string,
      razon: n.razon as string,
      status: (n.status as string | null) ?? null,
      monto_usd: Number(n.monto_usd),
      saldo_pendiente_usd: n.saldo_pendiente_usd == null ? null : Number(n.saldo_pendiente_usd),
    })),
    pagado: (pagos ?? []).reduce((s, p) => s + Number(p.monto_usd), 0),
    ncAplicado: (ncAps ?? []).reduce((s, a) => s + Number(a.monto_usd), 0),
  };
}

export async function fetchCatalogos(empresaId: string): Promise<{
  skus: CatalogoSku[];
  navieras: Naviera[];
  bodegas: Bodega[];
  bancos: Banco[];
}> {
  const [skus, navieras, bodegas, bancos] = await Promise.all([
    supabase
      .from('catalogo_sku')
      .select('*')
      .eq('proveedor', 'blufin')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .order('code'),
    supabase.from('navieras').select('*').order('nombre'),
    supabase.from('bodegas').select('*').eq('empresa_id', empresaId).eq('activo', true).order('nombre'),
    supabase.from('bancos').select('*').order('nombre'),
  ]);
  if (skus.error) throw skus.error;
  if (navieras.error) throw navieras.error;
  if (bodegas.error) throw bodegas.error;
  if (bancos.error) throw bancos.error;
  return {
    skus: skus.data ?? [],
    navieras: navieras.data ?? [],
    bodegas: bodegas.data ?? [],
    bancos: bancos.data ?? [],
  };
}
