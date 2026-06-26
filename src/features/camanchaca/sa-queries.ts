import { supabase } from '@/lib/supabase';
import type {
  CamContenedorSA,
  CamContenedorSAConProductos,
  CamContenedorSAInsert,
  CamProductoSAInsert,
  CamOrdenPlaneada,
  CamOrdenPlaneadaInsert,
  CatalogoSku,
  Naviera,
  Bodega,
  Banco,
} from '@/types/database';

// ─── Catálogos (SKUs Camanchaca + navieras + bodegas + bancos + agencias) ───────
export type AgenciaImportadora = { id: number; razon_social: string };

export async function fetchCatalogosSA(empresaId: string): Promise<{
  skus: CatalogoSku[];
  navieras: Naviera[];
  bodegas: Bodega[];
  bancos: Banco[];
  agencias: AgenciaImportadora[];
}> {
  const [skus, navieras, bodegas, bancos, agencias] = await Promise.all([
    supabase
      .from('catalogo_sku')
      .select('*')
      .eq('proveedor', 'camanchaca')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .order('code'),
    supabase.from('navieras').select('*').order('nombre'),
    supabase.from('bodegas').select('*').eq('empresa_id', empresaId).order('nombre'),
    supabase.from('bancos').select('*').order('nombre'),
    supabase.from('agencias_importadoras').select('id, razon_social').eq('activo', true).order('razon_social'),
  ]);
  if (skus.error) throw skus.error;
  if (navieras.error) throw navieras.error;
  if (bodegas.error) throw bodegas.error;
  if (bancos.error) throw bancos.error;
  if (agencias.error) throw agencias.error;
  return {
    skus: skus.data ?? [],
    navieras: navieras.data ?? [],
    bodegas: bodegas.data ?? [],
    bancos: bancos.data ?? [],
    agencias: (agencias.data ?? []) as AgenciaImportadora[],
  };
}

// ─── Contenedores SA ────────────────────────────────────────────────────────
export async function fetchContenedoresSA(empresaId: string): Promise<CamContenedorSAConProductos[]> {
  const { data, error } = await supabase
    .from('cam_contenedores_sa')
    .select('*, productos:cam_productos_sa(*)')
    .eq('empresa_id', empresaId)
    .order('fecha_factura', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CamContenedorSAConProductos[];
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

/**
 * Crea el contenedor + sus líneas. El folio interno lo asigna la BD
 * (default crm.next_cam_folio() — NO se genera en frontend).
 */
export async function createContenedorSA(
  payload: CamContenedorSAInsert,
  productos: Omit<CamProductoSAInsert, 'contenedor_id'>[],
): Promise<CamContenedorSA> {
  const { data: contenedor, error } = await supabase
    .from('cam_contenedores_sa')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  if (productos.length > 0) {
    const lineas = productos.map((p, idx) => ({ ...p, contenedor_id: contenedor.id, orden: idx }));
    const { error: linErr } = await supabase.from('cam_productos_sa').insert(lineas);
    if (linErr) throw linErr;
  }
  return contenedor as CamContenedorSA;
}

/**
 * Eliminar contenedor. No permite si tiene pagos, forwards, costos de importación
 * o recepción (auditoría preservada). Cascade en BD borra productos.
 */
export async function deleteContenedorSA(id: string): Promise<void> {
  const [{ count: pagos }, { count: fwds }, { count: costos }, { count: rec }] = await Promise.all([
    supabase.from('cam_pagos_sa').select('id', { count: 'exact', head: true }).eq('contenedor_id', id),
    supabase.from('cam_forwards_sa').select('id', { count: 'exact', head: true }).eq('contenedor_id', id),
    supabase.from('cam_costo_importacion').select('id', { count: 'exact', head: true }).eq('contenedor_id', id),
    supabase.from('cam_recepcion_sa').select('id', { count: 'exact', head: true }).eq('contenedor_id', id),
  ]);
  const bloqueos: string[] = [];
  if ((pagos ?? 0) > 0) bloqueos.push(`${pagos} pago${pagos === 1 ? '' : 's'}`);
  if ((fwds ?? 0) > 0) bloqueos.push(`${fwds} forward${fwds === 1 ? '' : 's'}`);
  if ((costos ?? 0) > 0) bloqueos.push(`${costos} costo${costos === 1 ? '' : 's'} de importación`);
  if ((rec ?? 0) > 0) bloqueos.push('una recepción');
  if (bloqueos.length > 0) {
    throw new Error(
      `No se puede eliminar: el contenedor tiene ${bloqueos.join(', ')} asociado(s). Elimínalos primero.`,
    );
  }
  const { error } = await supabase.from('cam_contenedores_sa').delete().eq('id', id);
  if (error) throw error;
}

// ─── Saldos por contenedor (lo pagado USD + NCs aplicadas) ──────────────────
export type SaldoContenedor = { pagado: number; ncAplicado: number };

export async function fetchSaldosSA(empresaId: string): Promise<Map<string, SaldoContenedor>> {
  const [{ data: pagos, error: pErr }, { data: ncs, error: nErr }] = await Promise.all([
    supabase
      .from('cam_pagos_sa')
      .select('contenedor_id, monto_usd, contenedor:cam_contenedores_sa!inner(empresa_id)')
      .eq('contenedor.empresa_id', empresaId),
    supabase
      .from('cam_nc_sa')
      .select('contenedor_id, monto_usd, contenedor:cam_contenedores_sa!inner(empresa_id)')
      .eq('contenedor.empresa_id', empresaId),
  ]);
  if (pErr) throw pErr;
  if (nErr) throw nErr;

  const map = new Map<string, SaldoContenedor>();
  const get = (id: string) => {
    let v = map.get(id);
    if (!v) {
      v = { pagado: 0, ncAplicado: 0 };
      map.set(id, v);
    }
    return v;
  };
  for (const p of pagos ?? []) {
    if (p.contenedor_id) get(p.contenedor_id as string).pagado += Number(p.monto_usd);
  }
  for (const n of ncs ?? []) {
    if (n.contenedor_id) get(n.contenedor_id as string).ncAplicado += Number(n.monto_usd);
  }
  return map;
}

// ─── Detalle de un contenedor para la ficha ─────────────────────────────────
export type ContenedorSADetalle = {
  contenedor: CamContenedorSAConProductos;
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
    monto_usd: number;
    tc_forward: number;
    status: string | null;
    fecha_entrega: string | null;
  }[];
  costos: {
    id: string;
    agencia: string | null;
    concepto: string | null;
    monto_mxn: number;
    pagado: boolean | null;
    fecha: string | null;
  }[];
  recepcion: {
    fecha: string;
    bodega: string | null;
    entrada_intelisis: string | null;
    presentacion_recibida: string | null;
    lineas: { descripcion: string; kg_contratados: number; kg_recibidos: number; diferencia: number | null }[];
  } | null;
  ncs: { id: string; monto_usd: number; motivo: string; fecha: string; status: string | null }[];
  pagado: number;
  ncAplicado: number;
  costoImportacionMxn: number;
};

export async function fetchContenedorSADetalle(id: string): Promise<ContenedorSADetalle | null> {
  const [
    { data: cont, error: cErr },
    { data: pagos, error: pErr },
    { data: forwards, error: fErr },
    { data: costos, error: coErr },
    { data: recepcion, error: rErr },
    { data: ncs, error: nErr },
  ] = await Promise.all([
    supabase
      .from('cam_contenedores_sa')
      .select('*, productos:cam_productos_sa(*)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('cam_pagos_sa')
      .select('id, tipo, monto_usd, tc, monto_mxn, fecha, referencia, banco:bancos(nombre)')
      .eq('contenedor_id', id)
      .order('fecha', { ascending: true }),
    supabase
      .from('cam_forwards_sa')
      .select('id, monto_usd, tc_forward, status, fecha_entrega')
      .eq('contenedor_id', id),
    supabase
      .from('cam_costo_importacion')
      .select('id, concepto, monto_mxn, pagado, fecha, agencia:agencias_importadoras(razon_social)')
      .eq('contenedor_id', id)
      .order('fecha', { ascending: true }),
    supabase
      .from('cam_recepcion_sa')
      .select(
        'fecha, entrada_intelisis, presentacion_recibida, bodega:bodegas(nombre), ' +
          'lineas:cam_recepcion_sa_lineas(kg_contratados, kg_recibidos, diferencia, sku:catalogo_sku(descripcion))',
      )
      .eq('contenedor_id', id)
      .maybeSingle(),
    supabase
      .from('cam_nc_sa')
      .select('id, monto_usd, motivo, fecha, status')
      .eq('contenedor_id', id),
  ]);
  if (cErr) throw cErr;
  if (pErr) throw pErr;
  if (fErr) throw fErr;
  if (coErr) throw coErr;
  if (rErr) throw rErr;
  if (nErr) throw nErr;
  if (!cont) return null;

  const rec = recepcion as unknown as {
    fecha: string;
    entrada_intelisis: string | null;
    presentacion_recibida: string | null;
    bodega?: { nombre: string } | null;
    lineas?: { kg_contratados: number; kg_recibidos: number; diferencia: number | null; sku?: { descripcion: string } | null }[];
  } | null;

  return {
    contenedor: cont as unknown as CamContenedorSAConProductos,
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
      monto_usd: Number(f.monto_usd),
      tc_forward: Number(f.tc_forward),
      status: (f.status as string | null) ?? null,
      fecha_entrega: (f.fecha_entrega as string | null) ?? null,
    })),
    costos: (costos ?? []).map((c) => ({
      id: c.id as string,
      agencia: (c.agencia as unknown as { razon_social: string } | null)?.razon_social ?? null,
      concepto: (c.concepto as string | null) ?? null,
      monto_mxn: Number(c.monto_mxn),
      pagado: (c.pagado as boolean | null) ?? null,
      fecha: (c.fecha as string | null) ?? null,
    })),
    recepcion: rec
      ? {
          fecha: rec.fecha,
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
      monto_usd: Number(n.monto_usd),
      motivo: n.motivo as string,
      fecha: n.fecha as string,
      status: (n.status as string | null) ?? null,
    })),
    pagado: (pagos ?? []).reduce((s, p) => s + Number(p.monto_usd), 0),
    ncAplicado: (ncs ?? []).reduce((s, n) => s + Number(n.monto_usd), 0),
    costoImportacionMxn: (costos ?? []).reduce((s, c) => s + Number(c.monto_mxn), 0),
  };
}

// ─── Contenedores con pendiente de pago (para sugerir pago / forward) ───────
export type ContenedorConPendiente = {
  id: string;
  folio_interno: string;
  factura: string | null;
  fecha_vencimiento: string | null;
  total_usd: number | null;
  total_kg: number | null;
  status: string;
  contenedor: string | null;
  pagado: number;
  ncAplicado: number;
};

export async function fetchContenedoresConPendienteSA(
  empresaId: string,
): Promise<ContenedorConPendiente[]> {
  const [contenedores, saldos] = await Promise.all([
    fetchContenedoresSA(empresaId),
    fetchSaldosSA(empresaId),
  ]);
  const EPS = 0.01;
  return contenedores
    .map((c) => {
      const s = saldos.get(c.id) ?? { pagado: 0, ncAplicado: 0 };
      return {
        id: c.id,
        folio_interno: c.folio_interno,
        factura: c.factura,
        fecha_vencimiento: c.fecha_vencimiento,
        total_usd: c.total_usd,
        total_kg: c.total_kg,
        status: c.status,
        contenedor: c.contenedor,
        pagado: s.pagado,
        ncAplicado: s.ncAplicado,
      };
    })
    .filter((c) => Number(c.total_usd ?? 0) - c.pagado - c.ncAplicado > EPS);
}

// ─── Órdenes planeadas ──────────────────────────────────────────────────────
export async function fetchOrdenesPlaneadas(empresaId: string): Promise<CamOrdenPlaneada[]> {
  const { data, error } = await supabase
    .from('cam_ordenes_planeadas')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createOrdenPlaneada(payload: CamOrdenPlaneadaInsert): Promise<void> {
  const { error } = await supabase.from('cam_ordenes_planeadas').insert(payload);
  if (error) throw error;
}

export async function updateOrdenPlaneada(
  id: string,
  patch: { oc_proveedor?: string; descripcion?: string | null; kg_estimados?: number | null; llegada_estimada?: string | null; status?: string },
): Promise<void> {
  const { error } = await supabase.from('cam_ordenes_planeadas').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteOrdenPlaneada(id: string): Promise<void> {
  const { error } = await supabase.from('cam_ordenes_planeadas').delete().eq('id', id);
  if (error) throw error;
}
