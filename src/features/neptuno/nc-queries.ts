import { supabase } from '@/lib/supabase';
import { recalcFactura } from '@/features/neptuno/queries';
import type { NepNotaCredito } from '@/types/database';

/**
 * Notas de crédito de Neptuno — simplificadas: monto_usd + motivo, sin CFDI ni
 * aplicaciones múltiples. Se ligan a una factura, reducen su saldo directamente.
 */

export type NepNotaCreditoEnriquecida = NepNotaCredito & {
  factura?: { factura_num: string; total_usd: number | null } | null;
};

export async function fetchNotasCredito(empresaId: string): Promise<NepNotaCreditoEnriquecida[]> {
  const { data, error } = await supabase
    .from('nep_notas_credito')
    .select('*, factura:nep_facturas!inner(factura_num, empresa_id, total_usd)')
    .eq('factura.empresa_id', empresaId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as NepNotaCreditoEnriquecida[];
}

export type NuevaNCParams = {
  factura_id: string;
  monto_usd: number;
  motivo: string;
  fecha: string;
};

export async function createNotaCredito(p: NuevaNCParams): Promise<void> {
  if (!p.factura_id) throw new Error('Selecciona la factura');
  if (p.monto_usd <= 0) throw new Error('Captura un monto mayor a 0');
  if (!p.motivo.trim()) throw new Error('Captura el motivo de la nota de crédito');

  const { error } = await supabase.from('nep_notas_credito').insert({
    factura_id: p.factura_id,
    monto_usd: p.monto_usd,
    motivo: p.motivo.trim(),
    fecha: p.fecha,
    status: 'Aplicada',
  });
  if (error) throw error;

  // La NC reduce el saldo de la factura → recalcular saldo/status.
  await recalcFactura(p.factura_id);
}

/** Eliminar una NC (delete con PIN). Revierte el saldo de la factura. */
export async function deleteNotaCredito(id: string): Promise<void> {
  const { data: nc, error: rErr } = await supabase
    .from('nep_notas_credito')
    .select('factura_id')
    .eq('id', id)
    .single();
  if (rErr) throw rErr;

  const { error: dErr } = await supabase.from('nep_notas_credito').delete().eq('id', id);
  if (dErr) throw dErr;

  if (nc?.factura_id) await recalcFactura(nc.factura_id);
}
