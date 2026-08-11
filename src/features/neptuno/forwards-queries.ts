/**
 * Forwards cambiarios de Neptuno (tabla `crm.nep_forwards`, migración
 * 20260811130000). En Neptuno el forward cuelga de la FACTURA, que es el
 * identificador del módulo.
 *
 * `factura_id` NULL = forward **por asignar**: normalmente llegó movido desde
 * otro módulo (Blufin) y todavía no se decide a qué factura se aplica. Por eso
 * la factura se trae SIN `!inner` y la empresa se filtra por la columna propia
 * del forward.
 */
import { supabase } from '@/lib/supabase';
import { recalcFactura } from '@/features/neptuno/queries';
import type { NepForward, NepForwardInsert } from '@/types/database';

const EPS = 0.01;

export type NepForwardEnriquecido = NepForward & {
  factura?: { factura_num: string; total_usd: number | null } | null;
  banco?: { nombre: string } | null;
};

export async function fetchForwardsNep(empresaId: string): Promise<NepForwardEnriquecido[]> {
  const { data, error } = await supabase
    .from('nep_forwards')
    .select(
      'id, empresa_id, factura_id, monto_usd, tc_forward, monto_mxn, fecha_cierre, fecha_entrega, banco_id, status, origen_modulo, origen_ref, capturado_por, created_at, ' +
        'factura:nep_facturas(factura_num, total_usd), ' +
        'banco:bancos(nombre)',
    )
    .eq('empresa_id', empresaId)
    .order('fecha_entrega', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as NepForwardEnriquecido[];
}

/** Lo que falta por pagar de una factura: total − pagos − NCs. */
async function faltanteFactura(facturaId: string): Promise<number> {
  const [{ data: f }, { data: pagos }, { data: ncs }] = await Promise.all([
    supabase.from('nep_facturas').select('total_usd').eq('id', facturaId).single(),
    supabase.from('nep_pagos').select('monto_usd').eq('factura_id', facturaId),
    supabase.from('nep_notas_credito').select('monto_usd').eq('factura_id', facturaId),
  ]);
  const total = Number(f?.total_usd ?? 0);
  const pagado = (pagos ?? []).reduce((s, p) => s + Number(p.monto_usd), 0);
  const nc = (ncs ?? []).reduce((s, n) => s + Number(n.monto_usd), 0);
  return Math.max(0, total - pagado - nc);
}

export async function createForwardNep(payload: NepForwardInsert): Promise<void> {
  if (payload.factura_id) {
    const { data: existentes, error: chkErr } = await supabase
      .from('nep_forwards')
      .select('id, status')
      .eq('factura_id', payload.factura_id);
    if (chkErr) throw chkErr;
    if ((existentes ?? []).some((f) => f.status === 'Pendiente')) {
      throw new Error('Esta factura ya tiene un forward pendiente. Ejecútalo o elimínalo antes de crear otro.');
    }
  }
  const monto_mxn = (payload.monto_usd ?? 0) * (payload.tc_forward ?? 0);
  const { error } = await supabase.from('nep_forwards').insert({ ...payload, monto_mxn });
  if (error) throw error;
}

/** Asignar a una factura un forward que llegó "Por asignar". */
export async function asignarForwardNep(id: string, facturaId: string): Promise<void> {
  const { data: existentes, error: chkErr } = await supabase
    .from('nep_forwards')
    .select('id, status')
    .eq('factura_id', facturaId);
  if (chkErr) throw chkErr;
  if ((existentes ?? []).some((f) => f.status === 'Pendiente')) {
    throw new Error('Esa factura ya tiene un forward pendiente.');
  }
  const { data: hechos, error } = await supabase
    .from('nep_forwards')
    .update({ factura_id: facturaId, status: 'Pendiente' })
    .eq('id', id)
    .neq('status', 'Ejecutado')
    .select('id');
  if (error) throw error;
  if (!hechos?.length) throw new Error('El forward ya fue ejecutado — no se puede reasignar.');
}

export async function deleteForwardNep(id: string): Promise<void> {
  const { data: f, error: rErr } = await supabase
    .from('nep_forwards')
    .select('status')
    .eq('id', id)
    .single();
  if (rErr) throw rErr;
  if (f.status === 'Ejecutado') {
    throw new Error('Este forward ya generó un pago. Elimina primero el pago desde Realizados.');
  }
  const { error } = await supabase.from('nep_forwards').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Ejecutar: paga min(forward, faltante de la factura) al TC pactado. Si sobra,
 * el forward se encoge y queda como `Remanente` — mismo criterio que Blufin.
 */
export async function executeForwardNep(id: string): Promise<{ aplicar: number; remanente: number }> {
  const { data: f, error: rErr } = await supabase
    .from('nep_forwards')
    .select('factura_id, monto_usd, tc_forward, monto_mxn, fecha_entrega, banco_id, status')
    .eq('id', id)
    .single();
  if (rErr) throw rErr;
  if (f.status === 'Ejecutado') throw new Error('Este forward ya fue ejecutado');
  if (f.status !== 'Pendiente') throw new Error(`No se puede ejecutar un forward en estado "${f.status}".`);
  if (!f.factura_id) throw new Error('Forward sin factura — asígnalo antes de ejecutarlo.');

  const faltante = await faltanteFactura(f.factura_id);
  if (faltante <= EPS) {
    throw new Error('Esa factura ya está liquidada — el forward ya no aplica. Asígnalo a otra o elimínalo.');
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const monto = r2(Number(f.monto_usd));
  const tc = Number(f.tc_forward);
  const mxnFwd = f.monto_mxn != null ? Number(f.monto_mxn) : r2(monto * tc);
  const aplicar = r2(Math.min(monto, faltante));
  const remanente = r2(Math.max(0, monto - aplicar));
  const fechaPago = f.fecha_entrega ?? new Date().toISOString().slice(0, 10);
  const marca = `fwd:${id.slice(0, 8)}`;

  // Idempotencia: si el pago ya existe (reintento tras un fallo a medias), no
  // se duplica; solo se completa el cambio de status.
  const { data: previos } = await supabase
    .from('nep_pagos')
    .select('id')
    .eq('factura_id', f.factura_id)
    .like('referencia', `%${marca}%`);

  if (!previos?.length) {
    const { error: pagoErr } = await supabase.from('nep_pagos').insert({
      factura_id: f.factura_id,
      tipo: aplicar < faltante - EPS ? 'abono' : 'completo',
      monto_usd: aplicar,
      tc,
      monto_mxn: r2(aplicar * tc),
      fecha: fechaPago,
      banco_id: f.banco_id,
      referencia: `FORWARD ejecutado ${fechaPago} · ${marca}`,
    });
    if (pagoErr) throw pagoErr;
  }

  const patch =
    remanente > EPS
      ? { status: 'Remanente', monto_usd: remanente, monto_mxn: r2(mxnFwd - r2(aplicar * tc)), factura_id: null }
      : { status: 'Ejecutado' };
  const { error: updErr } = await supabase
    .from('nep_forwards')
    .update(patch)
    .eq('id', id)
    .eq('status', 'Pendiente');
  if (updErr) throw updErr;

  await recalcFactura(f.factura_id);
  return { aplicar, remanente };
}
