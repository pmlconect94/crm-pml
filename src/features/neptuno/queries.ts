import { supabase } from '@/lib/supabase';
import type {
  NepFactura,
  NepFacturaConProductos,
  NepFacturaInsert,
  NepFacturaProductoInsert,
  CatalogoSku,
  Banco,
} from '@/types/database';

/**
 * Neptuno Seafood — el número de factura ES el identificador. Sin folio interno,
 * sin planeación, sin naviera, sin recepción separada (las cantidades de la
 * factura SON el inventario). Moneda USD.
 */

const EPS = 0.01;

export async function fetchFacturas(empresaId: string): Promise<NepFacturaConProductos[]> {
  const { data, error } = await supabase
    .from('nep_facturas')
    .select('*, productos:nep_factura_productos(*)')
    .eq('empresa_id', empresaId)
    .order('fecha_factura', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as NepFacturaConProductos[];
}

export type FacturaDetalle = {
  factura: NepFacturaConProductos;
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
  ncs: {
    id: string;
    monto_usd: number;
    motivo: string;
    fecha: string;
    status: string | null;
  }[];
  pagado: number;
  ncAplicado: number;
};

/** Toda la info de una factura para la ficha de detalle: productos, pagos, NCs
 *  y el resumen de saldo. */
export async function fetchFacturaDetalle(facturaId: string): Promise<FacturaDetalle | null> {
  const [
    { data: factura, error: fErr },
    { data: pagos, error: pErr },
    { data: ncs, error: nErr },
  ] = await Promise.all([
    supabase
      .from('nep_facturas')
      .select('*, productos:nep_factura_productos(*)')
      .eq('id', facturaId)
      .maybeSingle(),
    supabase
      .from('nep_pagos')
      .select('id, tipo, monto_usd, tc, monto_mxn, fecha, referencia, banco:bancos(nombre)')
      .eq('factura_id', facturaId)
      .order('fecha', { ascending: true }),
    supabase
      .from('nep_notas_credito')
      .select('id, monto_usd, motivo, fecha, status')
      .eq('factura_id', facturaId)
      .order('fecha', { ascending: true }),
  ]);
  if (fErr) throw fErr;
  if (pErr) throw pErr;
  if (nErr) throw nErr;
  if (!factura) return null;

  return {
    factura: factura as unknown as NepFacturaConProductos,
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
    ncs: (ncs ?? []).map((n) => ({
      id: n.id as string,
      monto_usd: Number(n.monto_usd),
      motivo: n.motivo as string,
      fecha: n.fecha as string,
      status: (n.status as string | null) ?? null,
    })),
    pagado: (pagos ?? []).reduce((s, p) => s + Number(p.monto_usd), 0),
    ncAplicado: (ncs ?? []).reduce((s, n) => s + Number(n.monto_usd), 0),
  };
}

export async function createFactura(
  payload: NepFacturaInsert,
  productos: Omit<NepFacturaProductoInsert, 'factura_id'>[],
): Promise<NepFactura> {
  const { data: factura, error } = await supabase
    .from('nep_facturas')
    .insert(payload)
    .select()
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new Error(`Ya existe la factura ${payload.factura_num} para Neptuno`);
    }
    throw error;
  }

  if (productos.length > 0) {
    const lineas = productos.map((p, idx) => ({
      ...p,
      factura_id: factura.id,
      orden: idx,
    }));
    const { error: linErr } = await supabase.from('nep_factura_productos').insert(lineas);
    if (linErr) throw linErr;
  }

  return factura as NepFactura;
}

/**
 * Eliminar una factura. NO permite borrar si tiene pagos o NCs asociados:
 * primero hay que eliminar esos registros (auditoría preservada).
 * Cascade en BD borra los productos.
 */
export async function deleteFactura(id: string): Promise<void> {
  const [{ count: pagosCount, error: pErr }, { count: ncCount, error: nErr }] = await Promise.all([
    supabase.from('nep_pagos').select('id', { count: 'exact', head: true }).eq('factura_id', id),
    supabase
      .from('nep_notas_credito')
      .select('id', { count: 'exact', head: true })
      .eq('factura_id', id),
  ]);
  if (pErr) throw pErr;
  if (nErr) throw nErr;

  const bloqueos: string[] = [];
  if ((pagosCount ?? 0) > 0) bloqueos.push(`${pagosCount} pago${pagosCount === 1 ? '' : 's'}`);
  if ((ncCount ?? 0) > 0) bloqueos.push(`${ncCount} nota${ncCount === 1 ? '' : 's'} de crédito`);
  if (bloqueos.length > 0) {
    const plural = (pagosCount ?? 0) + (ncCount ?? 0) > 1;
    throw new Error(
      `No se puede eliminar: la factura tiene ${bloqueos.join(' y ')} asociado${plural ? 's' : ''}. Elimina${plural ? 'los' : 'lo'} primero.`,
    );
  }

  const { error } = await supabase.from('nep_facturas').delete().eq('id', id);
  if (error) throw error;
}

/** Lo pagado + NCs aplicadas por factura (para mostrar el saldo restante). */
export type SaldoFactura = { pagado: number; ncAplicado: number };

export async function fetchSaldosPorFactura(empresaId: string): Promise<Map<string, SaldoFactura>> {
  const [{ data: pagos, error: pErr }, { data: ncs, error: nErr }] = await Promise.all([
    supabase
      .from('nep_pagos')
      .select('factura_id, monto_usd, factura:nep_facturas!inner(empresa_id)')
      .eq('factura.empresa_id', empresaId),
    supabase
      .from('nep_notas_credito')
      .select('factura_id, monto_usd, factura:nep_facturas!inner(empresa_id)')
      .eq('factura.empresa_id', empresaId),
  ]);
  if (pErr) throw pErr;
  if (nErr) throw nErr;

  const map = new Map<string, SaldoFactura>();
  const get = (id: string) => {
    let v = map.get(id);
    if (!v) {
      v = { pagado: 0, ncAplicado: 0 };
      map.set(id, v);
    }
    return v;
  };
  for (const p of pagos ?? []) {
    if (p.factura_id) get(p.factura_id as string).pagado += Number(p.monto_usd);
  }
  for (const n of ncs ?? []) {
    if (n.factura_id) get(n.factura_id as string).ncAplicado += Number(n.monto_usd);
  }
  return map;
}

/**
 * Recalcula saldo_usd y status de una factura a partir de sus pagos y NCs.
 * Única fuente de verdad — la usan create/delete de pagos y NCs.
 * saldo = total − Σpagos − Σnc; status: Pendiente / Parcial / Liquidada.
 * La lógica vive en cliente para mantenerla visible/testeable (sin trigger SQL
 * todavía, ver §17).
 */
export async function recalcFactura(facturaId: string): Promise<void> {
  const [
    { data: f, error: fErr },
    { data: pagos, error: pErr },
    { data: ncs, error: nErr },
  ] = await Promise.all([
    supabase.from('nep_facturas').select('total_usd').eq('id', facturaId).single(),
    supabase.from('nep_pagos').select('monto_usd').eq('factura_id', facturaId),
    supabase.from('nep_notas_credito').select('monto_usd').eq('factura_id', facturaId),
  ]);
  if (fErr) throw fErr;
  if (pErr) throw pErr;
  if (nErr) throw nErr;
  if (!f) return;

  const total = Number(f.total_usd ?? 0);
  const pagado = (pagos ?? []).reduce((s, p) => s + Number(p.monto_usd), 0);
  const ncAplicado = (ncs ?? []).reduce((s, n) => s + Number(n.monto_usd), 0);
  const saldo = Math.max(0, total - pagado - ncAplicado);
  const algoCubierto = pagado + ncAplicado > EPS;
  const status = saldo <= EPS && total > 0 ? 'Liquidada' : algoCubierto ? 'Parcial' : 'Pendiente';

  const { error } = await supabase
    .from('nep_facturas')
    .update({ saldo_usd: saldo, status })
    .eq('id', facturaId);
  if (error) throw error;
}

/** Facturas con saldo pendiente — usado para sugerir pago / NC. */
export type FacturaConPendiente = {
  id: string;
  factura_num: string;
  fecha_factura: string;
  fecha_vencimiento: string | null;
  status: string | null;
  total_usd: number;
  total_kg: number | null;
  saldo_usd: number | null;
};

export async function fetchFacturasConPendiente(empresaId: string): Promise<FacturaConPendiente[]> {
  const { data, error } = await supabase
    .from('nep_facturas')
    .select(
      'id, factura_num, fecha_factura, fecha_vencimiento, status, total_usd, total_kg, saldo_usd',
    )
    .eq('empresa_id', empresaId)
    .neq('status', 'Liquidada')
    .order('fecha_vencimiento', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as FacturaConPendiente[];
}

export async function fetchCatalogos(empresaId: string): Promise<{
  skus: CatalogoSku[];
  bancos: Banco[];
}> {
  const [skus, bancos] = await Promise.all([
    supabase
      .from('catalogo_sku')
      .select('*')
      .eq('proveedor', 'neptuno')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .order('code'),
    supabase.from('bancos').select('*').order('nombre'),
  ]);
  if (skus.error) throw skus.error;
  if (bancos.error) throw bancos.error;
  return {
    skus: skus.data ?? [],
    bancos: bancos.data ?? [],
  };
}
