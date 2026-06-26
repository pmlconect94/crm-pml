import { supabase } from '@/lib/supabase';
import { recalcFactura } from '@/features/neptuno/queries';
import type { NepPago, NepPagoInsert } from '@/types/database';

const EPS = 0.01;

// Pago enriquecido con datos de la factura y banco (denormalizado para la lista).
export type NepPagoEnriquecido = NepPago & {
  factura?: { factura_num: string; total_usd: number | null; saldo_usd: number | null } | null;
  banco?: { nombre: string } | null;
};

export async function fetchPagos(empresaId: string): Promise<NepPagoEnriquecido[]> {
  const { data, error } = await supabase
    .from('nep_pagos')
    .select(
      'id, factura_id, tipo, monto_usd, tc, monto_mxn, fecha, banco_id, referencia, capturado_por, created_at, ' +
        'factura:nep_facturas!inner(factura_num, empresa_id, total_usd, saldo_usd), ' +
        'banco:bancos(nombre)',
    )
    .eq('factura.empresa_id', empresaId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as NepPagoEnriquecido[];
}

/**
 * Lee el estado de pago de una factura: total y lo acumulado (pagos + NCs).
 * Una sola lectura, reutilizable para validar antes de insertar.
 */
type EstadoPago = {
  total_usd: number;
  pagado: number;
  ncAplicado: number;
};

async function leerEstadoPago(facturaId: string): Promise<EstadoPago | null> {
  const [
    { data: f, error: fErr },
    { data: pagos, error: pErr },
    { data: ncs, error: nErr },
  ] = await Promise.all([
    supabase.from('nep_facturas').select('total_usd, factura_num').eq('id', facturaId).single(),
    supabase.from('nep_pagos').select('monto_usd').eq('factura_id', facturaId),
    supabase.from('nep_notas_credito').select('monto_usd').eq('factura_id', facturaId),
  ]);
  if (fErr) throw fErr;
  if (pErr) throw pErr;
  if (nErr) throw nErr;
  if (!f) return null;
  return {
    total_usd: Number(f.total_usd ?? 0),
    pagado: (pagos ?? []).reduce((s, p) => s + Number(p.monto_usd), 0),
    ncAplicado: (ncs ?? []).reduce((s, n) => s + Number(n.monto_usd), 0),
  };
}

/**
 * Crear un pago + recalcular saldo/status de la factura.
 * Valida que la factura no esté ya liquidada (evita pagos de más).
 */
export async function createPago(payload: NepPagoInsert): Promise<void> {
  if (payload.factura_id) {
    const estado = await leerEstadoPago(payload.factura_id);
    if (estado) {
      const saldo = estado.total_usd - estado.pagado - estado.ncAplicado;
      if (estado.total_usd > 0 && saldo <= EPS) {
        throw new Error('La factura ya está liquidada por completo — no se puede registrar otro pago.');
      }
    }
  }

  const monto_mxn = (payload.monto_usd ?? 0) * (payload.tc ?? 0);
  const { error } = await supabase.from('nep_pagos').insert({ ...payload, monto_mxn });
  if (error) throw error;

  if (payload.factura_id) await recalcFactura(payload.factura_id);
}

/** Eliminar un pago + recalcular saldo/status de la factura. */
export async function deletePago(id: string): Promise<void> {
  const { data: pago, error: rErr } = await supabase
    .from('nep_pagos')
    .select('factura_id')
    .eq('id', id)
    .single();
  if (rErr) throw rErr;

  const { error: dErr } = await supabase.from('nep_pagos').delete().eq('id', id);
  if (dErr) throw dErr;

  if (pago?.factura_id) await recalcFactura(pago.factura_id);
}
