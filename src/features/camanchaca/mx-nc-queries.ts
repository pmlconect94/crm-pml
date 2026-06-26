import { supabase } from '@/lib/supabase';
import { recalcSaldoCompraMX } from '@/features/camanchaca/mx-queries';
import type { CamNcMxInsert } from '@/types/database';

/**
 * NC por descuento de Camanchaca México (§7b): simplificada — monto en MXN +
 * motivo (sin CFDI, sin flujo de aplicación múltiple). Reduce el saldo de la
 * compra directamente. Status default 'Aplicada'.
 */

/** NC MX enriquecida con folio/factura de la compra. */
export type CamNcMxEnriquecida = {
  id: string;
  compra_id: string | null;
  monto_mxn: number;
  motivo: string;
  fecha: string;
  status: string | null;
  created_at: string | null;
  compra?: { folio_interno: string; factura_num: string; total_mxn: number } | null;
};

/** Todas las NCs MX, más recientes primero. */
export async function fetchNotasCreditoMX(empresaId: string): Promise<CamNcMxEnriquecida[]> {
  const { data, error } = await supabase
    .from('cam_nc_mx')
    .select(
      'id, compra_id, monto_mxn, motivo, fecha, status, created_at, ' +
        'compra:cam_compras_mx!inner(folio_interno, factura_num, total_mxn, empresa_id)',
    )
    .eq('compra.empresa_id', empresaId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CamNcMxEnriquecida[];
}

export type NuevaNcMxParams = {
  compra_id: string;
  monto_mxn: number;
  motivo: string;
  fecha: string;
};

/** Crear una NC por descuento (MXN) + recalcular el saldo de la compra. */
export async function createNotaCreditoMX(p: NuevaNcMxParams): Promise<void> {
  if (!p.compra_id) throw new Error('Selecciona la compra');
  if (p.monto_mxn <= 0) throw new Error('El monto debe ser mayor a 0');
  if (!p.motivo.trim()) throw new Error('Captura el motivo de la nota de crédito');

  const { data: compra, error: cErr } = await supabase
    .from('cam_compras_mx')
    .select('saldo_pendiente, total_mxn')
    .eq('id', p.compra_id)
    .single();
  if (cErr) throw cErr;
  const saldo = Number(compra.saldo_pendiente ?? compra.total_mxn ?? 0);
  if (p.monto_mxn > saldo + 0.01) {
    throw new Error('El monto de la NC excede el saldo pendiente de la compra.');
  }

  const payload: CamNcMxInsert = {
    compra_id: p.compra_id,
    monto_mxn: p.monto_mxn,
    motivo: p.motivo.trim(),
    fecha: p.fecha,
    status: 'Aplicada',
  };
  const { error } = await supabase.from('cam_nc_mx').insert(payload);
  if (error) throw error;

  await recalcSaldoCompraMX(p.compra_id);
}

/** Eliminar una NC MX + recalcular el saldo de su compra (el saldo vuelve a subir). */
export async function deleteNotaCreditoMX(id: string): Promise<void> {
  const { data: nc, error: rErr } = await supabase
    .from('cam_nc_mx')
    .select('compra_id')
    .eq('id', id)
    .single();
  if (rErr) throw rErr;

  const { error } = await supabase.from('cam_nc_mx').delete().eq('id', id);
  if (error) throw error;

  if (nc?.compra_id) await recalcSaldoCompraMX(nc.compra_id);
}
