import { supabase } from '@/lib/supabase';
import { recalcFlagsContrato } from '@/features/blufin/pagos-queries';
import type { BlufinNotaCreditoEnriquecida } from '@/types/database';

export type NcRazon = 'presentacion' | 'descuento' | 'faltante';

export const NC_RAZON_META: Record<
  NcRazon,
  { label: string; short: string; desc: string; color: string; bg: string; text: string }
> = {
  presentacion: {
    label: 'Presentación pactada',
    short: 'Presentación',
    desc: 'El contrato pactó una presentación pero llegó otra (p. ej. Paletizado → Granel)',
    color: 'var(--amber-500)',
    bg: 'color-mix(in srgb, var(--amber-500) 12%, white)',
    text: '#92400E',
  },
  descuento: {
    label: 'Descuento de producto',
    short: 'Descuento',
    desc: 'Descuento acordado sobre la mercancía recibida',
    color: 'var(--green-500)',
    bg: 'color-mix(in srgb, var(--green-500) 12%, white)',
    text: '#065F46',
  },
  faltante: {
    label: 'Mercancía faltante',
    short: 'Faltante',
    desc: 'Llegaron menos kg de los facturados',
    color: 'var(--red-500)',
    bg: 'color-mix(in srgb, var(--red-500) 12%, white)',
    text: '#991B1B',
  },
};

export const NC_STATUS_META: Record<string, { bg: string; text: string; dot: string }> = {
  'Sin monto': { bg: 'var(--ink-100)', text: 'var(--ink-600)', dot: 'var(--ink-400)' },
  Pendiente: { bg: 'color-mix(in srgb, var(--amber-500) 14%, white)', text: '#92400E', dot: 'var(--amber-500)' },
  Parcial: { bg: 'color-mix(in srgb, var(--blue-500) 12%, white)', text: '#1E40AF', dot: 'var(--blue-500)' },
  Aplicada: { bg: 'color-mix(in srgb, var(--green-500) 14%, white)', text: '#065F46', dot: 'var(--green-500)' },
};

const EPS = 0.01;

export async function fetchNotasCredito(empresaId: string): Promise<BlufinNotaCreditoEnriquecida[]> {
  const { data, error } = await supabase
    .from('blufin_notas_credito')
    .select(
      '*, contrato_origen:blufin_contratos(folio), ' +
        'aplicaciones:blufin_nc_aplicaciones(*, contrato_destino:blufin_contratos(folio))',
    )
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BlufinNotaCreditoEnriquecida[];
}

export type NuevaNCParams = {
  empresaId: string;
  razon: NcRazon;
  contrato_origen_id: string;
  folio_timbrado: string | null;
  fecha: string;
  nota: string | null;
  monto_usd: number | null; // null/0 → "Sin monto"
  tc: number | null;
};

export async function createNotaCredito(p: NuevaNCParams): Promise<void> {
  if (!p.contrato_origen_id) throw new Error('Selecciona el contrato origen');
  const sinMonto = p.monto_usd == null || p.monto_usd <= 0;
  const monto = sinMonto ? 0 : (p.monto_usd as number);
  const tc = p.tc ?? null;
  const { error } = await supabase.from('blufin_notas_credito').insert({
    empresa_id: p.empresaId,
    razon: p.razon,
    contrato_origen_id: p.contrato_origen_id,
    folio_timbrado: p.folio_timbrado,
    fecha: p.fecha,
    nota: p.nota,
    monto_usd: monto,
    tc,
    monto_mxn: tc != null ? monto * tc : null,
    status: sinMonto ? 'Sin monto' : 'Pendiente',
    saldo_pendiente_usd: monto,
  });
  if (error) throw error;
}

/** Capturar el monto de una NC que estaba "Sin monto". */
export async function capturarMontoNC(ncId: string, monto_usd: number, tc: number | null): Promise<void> {
  if (monto_usd <= 0) throw new Error('Captura un monto mayor a 0');
  const { data: aps, error: apErr } = await supabase
    .from('blufin_nc_aplicaciones')
    .select('monto_usd')
    .eq('nc_id', ncId);
  if (apErr) throw apErr;
  const aplicado = (aps ?? []).reduce((s, a) => s + Number(a.monto_usd), 0);
  const saldo = Math.max(0, monto_usd - aplicado);
  const status = saldo <= EPS ? 'Aplicada' : aplicado > 0 ? 'Parcial' : 'Pendiente';
  const { error } = await supabase
    .from('blufin_notas_credito')
    .update({
      monto_usd,
      tc,
      monto_mxn: tc != null ? monto_usd * tc : null,
      saldo_pendiente_usd: saldo,
      status,
    })
    .eq('id', ncId);
  if (error) throw error;
}

/** Aplicar una NC a un contrato destino (consume saldo, recalcula status). */
export async function aplicarNC(params: {
  ncId: string;
  contrato_destino_id: string;
  monto_usd: number;
  fecha: string;
  nota: string | null;
}): Promise<void> {
  const { data: nc, error: ncErr } = await supabase
    .from('blufin_notas_credito')
    .select('monto_usd, saldo_pendiente_usd, status')
    .eq('id', params.ncId)
    .single();
  if (ncErr) throw ncErr;
  if (nc.status === 'Sin monto') throw new Error('Captura primero el monto de la NC.');
  const saldo = Number(nc.saldo_pendiente_usd ?? 0);
  if (params.monto_usd <= 0) throw new Error('El monto a aplicar debe ser mayor a 0');
  if (params.monto_usd > saldo + EPS) {
    throw new Error('El monto excede el saldo disponible de la NC.');
  }

  // Solo se aplica a contratos con saldo pendiente: lo ya pagado no recibe NC.
  const { data: dest, error: dErr } = await supabase
    .from('blufin_contratos')
    .select('folio, anticipo_pagado, saldo_pagado')
    .eq('id', params.contrato_destino_id)
    .single();
  if (dErr) throw dErr;
  if (dest.anticipo_pagado && dest.saldo_pagado) {
    throw new Error(
      `El contrato ${dest.folio} ya está pagado por completo — no se le puede aplicar la NC.`,
    );
  }

  const { error: insErr } = await supabase.from('blufin_nc_aplicaciones').insert({
    nc_id: params.ncId,
    contrato_destino_id: params.contrato_destino_id,
    monto_usd: params.monto_usd,
    fecha: params.fecha,
    nota: params.nota,
  });
  if (insErr) throw insErr;

  const { data: aps } = await supabase
    .from('blufin_nc_aplicaciones')
    .select('monto_usd')
    .eq('nc_id', params.ncId);
  const aplicado = (aps ?? []).reduce((s, a) => s + Number(a.monto_usd), 0);
  const nuevoSaldo = Math.max(0, Number(nc.monto_usd) - aplicado);
  const status = nuevoSaldo <= EPS ? 'Aplicada' : 'Parcial';
  const { error: updErr } = await supabase
    .from('blufin_notas_credito')
    .update({ saldo_pendiente_usd: nuevoSaldo, status })
    .eq('id', params.ncId);
  if (updErr) throw updErr;

  // La NC reduce el saldo del contrato destino → recalcular sus flags de pago
  // para que se refleje en Pagos, contenedores y pendientes.
  await recalcFlagsContrato(params.contrato_destino_id);
}

export async function setFolioTimbrado(ncId: string, folio: string): Promise<void> {
  const { error } = await supabase
    .from('blufin_notas_credito')
    .update({ folio_timbrado: folio.trim() || null })
    .eq('id', ncId);
  if (error) throw error;
}

/** Eliminar una NC + sus aplicaciones (delete con PIN). Revierte el saldo de
 * los contratos donde estaba aplicada (recalcula sus flags). */
export async function deleteNotaCredito(ncId: string): Promise<void> {
  // Contratos afectados por las aplicaciones, para recalcular tras borrar
  const { data: aps } = await supabase
    .from('blufin_nc_aplicaciones')
    .select('contrato_destino_id')
    .eq('nc_id', ncId);
  const afectados = Array.from(
    new Set((aps ?? []).map((a) => a.contrato_destino_id).filter(Boolean) as string[]),
  );

  const { error: apErr } = await supabase.from('blufin_nc_aplicaciones').delete().eq('nc_id', ncId);
  if (apErr) throw apErr;
  const { error } = await supabase.from('blufin_notas_credito').delete().eq('id', ncId);
  if (error) throw error;

  await Promise.all(afectados.map((id) => recalcFlagsContrato(id)));
}
