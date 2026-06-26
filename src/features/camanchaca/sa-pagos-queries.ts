import { supabase } from '@/lib/supabase';
import type {
  CamPagoSA,
  CamPagoSAInsert,
  CamForwardSA,
  CamForwardSAInsert,
  CamCostoImportacion,
  CamCostoImportacionInsert,
} from '@/types/database';

const EPS = 0.01;

// ─── Pagos al proveedor (USD) — SIN anticipos: 'completo' | 'abono' ─────────
export type CamPagoSAEnriquecido = CamPagoSA & {
  contenedor?: { folio_interno: string; total_usd: number | null } | null;
  banco?: { nombre: string } | null;
};

export async function fetchPagosSA(empresaId: string): Promise<CamPagoSAEnriquecido[]> {
  const { data, error } = await supabase
    .from('cam_pagos_sa')
    .select(
      'id, contenedor_id, tipo, monto_usd, tc, monto_mxn, fecha, banco_id, referencia, capturado_por, created_at, ' +
        'contenedor:cam_contenedores_sa!inner(folio_interno, empresa_id, total_usd), ' +
        'banco:bancos(nombre)',
    )
    .eq('contenedor.empresa_id', empresaId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CamPagoSAEnriquecido[];
}

/**
 * Estado de pago de un contenedor: total + acumulado de pagos + NCs aplicadas.
 * Las NCs (descuento) reducen lo que se debe.
 */
type EstadoPagoSA = { total_usd: number; acumPagado: number; ncAplicado: number };

async function leerEstadoSA(contenedorId: string): Promise<EstadoPagoSA | null> {
  const [{ data: c, error: cErr }, { data: pagos, error: pErr }, { data: ncs, error: nErr }] =
    await Promise.all([
      supabase.from('cam_contenedores_sa').select('total_usd').eq('id', contenedorId).single(),
      supabase.from('cam_pagos_sa').select('monto_usd').eq('contenedor_id', contenedorId),
      supabase.from('cam_nc_sa').select('monto_usd').eq('contenedor_id', contenedorId),
    ]);
  if (cErr) throw cErr;
  if (pErr) throw pErr;
  if (nErr) throw nErr;
  if (!c) return null;
  return {
    total_usd: Number(c.total_usd ?? 0),
    acumPagado: (pagos ?? []).reduce((s, p) => s + Number(p.monto_usd), 0),
    ncAplicado: (ncs ?? []).reduce((s, n) => s + Number(n.monto_usd), 0),
  };
}

/**
 * Tras un pago spot que liquida el contenedor, libera los forwards Pendientes
 * (quedan cerrados con el banco pero ya no asignados — status 'Liberado').
 */
async function liberarForwardsCubiertosSA(contenedorId: string): Promise<void> {
  const estado = await leerEstadoSA(contenedorId);
  if (!estado) return;
  const liquidado = estado.total_usd > 0 && estado.acumPagado + estado.ncAplicado >= estado.total_usd - EPS;
  if (!liquidado) return;
  const { error } = await supabase
    .from('cam_forwards_sa')
    .update({ status: 'Liberado' })
    .eq('contenedor_id', contenedorId)
    .eq('status', 'Pendiente');
  if (error) throw error;
}

export async function createPagoSA(payload: CamPagoSAInsert): Promise<void> {
  if (payload.contenedor_id) {
    const estado = await leerEstadoSA(payload.contenedor_id);
    if (estado) {
      const liquidado =
        estado.total_usd > 0 && estado.acumPagado + estado.ncAplicado >= estado.total_usd - EPS;
      if (liquidado) {
        throw new Error('El contenedor ya está liquidado por completo — no se puede registrar otro pago.');
      }
    }
  }
  const monto_mxn = (payload.monto_usd ?? 0) * (payload.tc ?? 0);
  const { error } = await supabase.from('cam_pagos_sa').insert({ ...payload, monto_mxn });
  if (error) throw error;
  if (payload.contenedor_id) await liberarForwardsCubiertosSA(payload.contenedor_id);
}

export async function deletePagoSA(id: string): Promise<void> {
  const { error } = await supabase.from('cam_pagos_sa').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Pago múltiple SA: inserta N pagos con TC/banco/fecha compartidos.
 */
export type PagoMultipleItemSA = { contenedor_id: string; tipo: 'completo' | 'abono'; monto_usd: number };
export type PagoMultipleParamsSA = {
  tc: number;
  fecha: string;
  banco_id: number;
  referencia: string | null;
  items: PagoMultipleItemSA[];
};

export async function createPagosMultiplesSA(params: PagoMultipleParamsSA): Promise<number> {
  if (params.items.length === 0) throw new Error('No hay pagos para registrar');
  const rows: CamPagoSAInsert[] = params.items.map((it) => ({
    contenedor_id: it.contenedor_id,
    tipo: it.tipo,
    monto_usd: it.monto_usd,
    tc: params.tc,
    monto_mxn: it.monto_usd * params.tc,
    fecha: params.fecha,
    banco_id: params.banco_id,
    referencia: params.referencia,
  }));
  const { error } = await supabase.from('cam_pagos_sa').insert(rows);
  if (error) throw error;
  const afectados = Array.from(new Set(params.items.map((i) => i.contenedor_id)));
  await Promise.all(afectados.map((id) => liberarForwardsCubiertosSA(id)));
  return params.items.length;
}

// ─── Forwards SA ────────────────────────────────────────────────────────────
export type CamForwardSAEnriquecido = CamForwardSA & {
  contenedor?: { folio_interno: string } | null;
  banco?: { nombre: string } | null;
};

export async function fetchForwardsSA(empresaId: string): Promise<CamForwardSAEnriquecido[]> {
  const { data, error } = await supabase
    .from('cam_forwards_sa')
    .select(
      'id, contenedor_id, monto_usd, tc_forward, monto_mxn, fecha_cierre, fecha_entrega, banco_id, status, capturado_por, created_at, ' +
        'contenedor:cam_contenedores_sa!inner(folio_interno, empresa_id), ' +
        'banco:bancos(nombre)',
    )
    .eq('contenedor.empresa_id', empresaId)
    .order('fecha_entrega', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CamForwardSAEnriquecido[];
}

export async function createForwardSA(payload: CamForwardSAInsert): Promise<void> {
  if (!payload.contenedor_id) throw new Error('Falta el contenedor');
  // Solo un forward Pendiente por contenedor
  const { data: existentes, error: chkErr } = await supabase
    .from('cam_forwards_sa')
    .select('id, status')
    .eq('contenedor_id', payload.contenedor_id);
  if (chkErr) throw chkErr;
  if ((existentes ?? []).some((f) => f.status === 'Pendiente')) {
    throw new Error('Este contenedor ya tiene un forward pendiente. Ejecútalo o elimínalo antes de crear otro.');
  }
  const monto_mxn = (payload.monto_usd ?? 0) * (payload.tc_forward ?? 0);
  const { error } = await supabase.from('cam_forwards_sa').insert({ ...payload, monto_mxn });
  if (error) throw error;
}

export async function deleteForwardSA(id: string): Promise<void> {
  const { error } = await supabase.from('cam_forwards_sa').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Ejecutar un forward — lo convierte en pago real (tipo 'completo') con el TC
 * pactado y cambia su status a 'Ejecutado'.
 */
export async function executeForwardSA(id: string): Promise<void> {
  const { data: f, error: rErr } = await supabase
    .from('cam_forwards_sa')
    .select('contenedor_id, monto_usd, tc_forward, fecha_entrega, banco_id, status')
    .eq('id', id)
    .single();
  if (rErr) throw rErr;
  if (f.status === 'Ejecutado') throw new Error('Este forward ya fue ejecutado');
  if (f.status === 'Liberado') throw new Error('Este forward fue liberado (ya se pagó spot) — ya no se ejecuta.');
  if (f.status !== 'Pendiente') throw new Error(`No se puede ejecutar un forward en estado "${f.status}".`);
  if (!f.contenedor_id) throw new Error('Forward sin contenedor — no se puede ejecutar');

  const estado = await leerEstadoSA(f.contenedor_id);
  if (estado) {
    const liquidado = estado.total_usd > 0 && estado.acumPagado + estado.ncAplicado >= estado.total_usd - EPS;
    if (liquidado) throw new Error('El contenedor ya está liquidado — el forward ya no aplica. Libéralo o elimínalo.');
  }

  const fechaPago = f.fecha_entrega ?? new Date().toISOString().slice(0, 10);
  const monto_mxn = Number(f.monto_usd) * Number(f.tc_forward);
  const { error: pagoErr } = await supabase.from('cam_pagos_sa').insert({
    contenedor_id: f.contenedor_id,
    tipo: 'completo',
    monto_usd: Number(f.monto_usd),
    tc: Number(f.tc_forward),
    monto_mxn,
    fecha: fechaPago,
    banco_id: f.banco_id,
    referencia: `FORWARD ejecutado ${fechaPago}`,
  });
  if (pagoErr) throw pagoErr;
  const { error: updErr } = await supabase.from('cam_forwards_sa').update({ status: 'Ejecutado' }).eq('id', id);
  if (updErr) throw updErr;
}

// ─── Costo de importación (MXN a agencias aduanales) ────────────────────────
export type CamCostoImportacionEnriquecido = CamCostoImportacion & {
  contenedor?: { folio_interno: string } | null;
  agencia?: { razon_social: string } | null;
};

export async function fetchCostosImportacionSA(
  empresaId: string,
): Promise<CamCostoImportacionEnriquecido[]> {
  const { data, error } = await supabase
    .from('cam_costo_importacion')
    .select(
      'id, contenedor_id, agencia_id, concepto, monto_mxn, pagado, fecha, observaciones, created_at, ' +
        'contenedor:cam_contenedores_sa!inner(folio_interno, empresa_id), ' +
        'agencia:agencias_importadoras(razon_social)',
    )
    .eq('contenedor.empresa_id', empresaId)
    .order('fecha', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CamCostoImportacionEnriquecido[];
}

export async function createCostoImportacionSA(payload: CamCostoImportacionInsert): Promise<void> {
  const { error } = await supabase.from('cam_costo_importacion').insert(payload);
  if (error) throw error;
}

export async function deleteCostoImportacionSA(id: string): Promise<void> {
  const { error } = await supabase.from('cam_costo_importacion').delete().eq('id', id);
  if (error) throw error;
}
