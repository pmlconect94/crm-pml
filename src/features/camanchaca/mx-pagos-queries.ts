import { supabase } from '@/lib/supabase';
import { recalcSaldoCompraMX } from '@/features/camanchaca/mx-queries';
import type { CamPagoMXInsert } from '@/types/database';

const EPS = 0.01;

/** Pago MX enriquecido con folio/factura de la compra y nombre del banco. */
export type CamPagoMXEnriquecido = {
  id: string;
  compra_id: string | null;
  monto: number;
  fecha: string;
  banco_id: number | null;
  referencia: string | null;
  created_at: string | null;
  compra?: { folio_interno: string; factura_num: string; total_mxn: number } | null;
  banco?: { nombre: string } | null;
};

/** Compra MX con saldo pendiente — para sugerir pagos y poblar el selector. */
export type CompraMXConPendiente = {
  id: string;
  folio_interno: string;
  factura_num: string;
  fecha_factura: string;
  fecha_vencimiento: string | null;
  total_mxn: number;
  saldo_pendiente: number | null;
  status: string | null;
};

/** Todos los pagos MX, más recientes primero. */
export async function fetchPagosMX(empresaId: string): Promise<CamPagoMXEnriquecido[]> {
  const { data, error } = await supabase
    .from('cam_pagos_mx')
    .select(
      'id, compra_id, monto, fecha, banco_id, referencia, created_at, ' +
        'compra:cam_compras_mx!inner(folio_interno, factura_num, total_mxn, empresa_id), ' +
        'banco:bancos(nombre)',
    )
    .eq('compra.empresa_id', empresaId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CamPagoMXEnriquecido[];
}

/** Compras con saldo pendiente (status != Liquidada), por vencimiento ASC. */
export async function fetchComprasConPendienteMX(
  empresaId: string,
): Promise<CompraMXConPendiente[]> {
  const { data, error } = await supabase
    .from('cam_compras_mx')
    .select('id, folio_interno, factura_num, fecha_factura, fecha_vencimiento, total_mxn, saldo_pendiente, status')
    .eq('empresa_id', empresaId)
    .neq('status', 'Liquidada')
    .order('fecha_vencimiento', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as CompraMXConPendiente[];
}

/** Lo pagado por compra (suma de pagos) — para mostrar el restante en la lista. */
export async function fetchPagadoPorCompraMX(empresaId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('cam_pagos_mx')
    .select('compra_id, monto, compra:cam_compras_mx!inner(empresa_id)')
    .eq('compra.empresa_id', empresaId);
  if (error) throw error;
  const map = new Map<string, number>();
  for (const p of data ?? []) {
    if (p.compra_id) map.set(p.compra_id as string, (map.get(p.compra_id as string) ?? 0) + Number(p.monto));
  }
  return map;
}

/**
 * Crear un pago (abono) MX + recalcular el saldo de la compra. Valida que la
 * compra no esté ya liquidada y que el monto no sea mayor a lo que falta.
 */
export async function createPagoMX(payload: CamPagoMXInsert): Promise<void> {
  if (!payload.compra_id) throw new Error('Falta la compra');
  if (payload.monto <= 0) throw new Error('El monto debe ser mayor a 0');

  const { data: compra, error: cErr } = await supabase
    .from('cam_compras_mx')
    .select('saldo_pendiente, status, total_mxn')
    .eq('id', payload.compra_id)
    .single();
  if (cErr) throw cErr;
  if (compra.status === 'Liquidada') {
    throw new Error('La compra ya está liquidada — no se puede registrar otro pago.');
  }
  const saldo = Number(compra.saldo_pendiente ?? compra.total_mxn ?? 0);
  if (payload.monto > saldo + EPS) {
    throw new Error('El monto excede el saldo pendiente de la compra.');
  }

  const { error } = await supabase.from('cam_pagos_mx').insert(payload);
  if (error) throw error;

  await recalcSaldoCompraMX(payload.compra_id);
}

/** Eliminar un pago MX + recalcular el saldo de su compra. */
export async function deletePagoMX(id: string): Promise<void> {
  const { data: pago, error: rErr } = await supabase
    .from('cam_pagos_mx')
    .select('compra_id')
    .eq('id', id)
    .single();
  if (rErr) throw rErr;

  const { error } = await supabase.from('cam_pagos_mx').delete().eq('id', id);
  if (error) throw error;

  if (pago?.compra_id) await recalcSaldoCompraMX(pago.compra_id);
}
