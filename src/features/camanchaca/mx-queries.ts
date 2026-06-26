import { supabase } from '@/lib/supabase';
import type {
  CamCompraMX,
  CamCompraMXConProductos,
  CamCompraMXInsert,
  CamProductoMXInsert,
  CatalogoSku,
  Bodega,
  Banco,
} from '@/types/database';

const EPS = 0.01;

/**
 * Crédito de Camanchaca México (§7b): la factura vence a los 30 días de su fecha.
 */
export function vencimientoMX(fechaFactura: string): string {
  const d = new Date(fechaFactura + 'T12:00:00');
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

/** Lista las compras MX con sus productos, más recientes primero. */
export async function fetchComprasMX(empresaId: string): Promise<CamCompraMXConProductos[]> {
  const { data, error } = await supabase
    .from('cam_compras_mx')
    .select('*, productos:cam_productos_mx(*)')
    .eq('empresa_id', empresaId)
    .order('fecha_factura', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CamCompraMXConProductos[];
}

/**
 * Crear una compra MX (folio_interno lo genera la BD por default
 * crm.next_cam_folio() — NO se manda desde el frontend) + sus líneas.
 * saldo_pendiente inicial = total_mxn (sin pagos ni NCs todavía).
 */
export async function createCompraMX(
  payload: Omit<CamCompraMXInsert, 'folio_interno'>,
  productos: Omit<CamProductoMXInsert, 'compra_id'>[],
): Promise<CamCompraMX> {
  const { data: compra, error } = await supabase
    .from('cam_compras_mx')
    .insert({ ...payload, saldo_pendiente: payload.total_mxn, status: 'Pendiente' })
    .select()
    .single();
  if (error) throw error;

  if (productos.length > 0) {
    const lineas = productos.map((p, idx) => ({
      ...p,
      compra_id: compra.id,
      orden: idx,
    }));
    const { error: linErr } = await supabase.from('cam_productos_mx').insert(lineas);
    if (linErr) throw linErr;
  }

  return compra as CamCompraMX;
}

/**
 * Recalcula saldo_pendiente y status de una compra MX a partir de pagos y NCs.
 * Única fuente de verdad — la usan create/delete de pagos y NCs. La lógica vive
 * en cliente (visible/testeable) como en Blufin (§17).
 *   saldo = total − Σpagos − Σnc
 *   status: Liquidada (saldo≈0) · Parcial (hay pagos/nc) · Pendiente
 */
export async function recalcSaldoCompraMX(compraId: string): Promise<void> {
  const [
    { data: compra, error: cErr },
    { data: pagos, error: pErr },
    { data: ncs, error: nErr },
  ] = await Promise.all([
    supabase.from('cam_compras_mx').select('total_mxn').eq('id', compraId).single(),
    supabase.from('cam_pagos_mx').select('monto').eq('compra_id', compraId),
    supabase.from('cam_nc_mx').select('monto_mxn').eq('compra_id', compraId),
  ]);
  if (cErr) throw cErr;
  if (pErr) throw pErr;
  if (nErr) throw nErr;
  if (!compra) return;

  const total = Number(compra.total_mxn ?? 0);
  const sumPagos = (pagos ?? []).reduce((s, p) => s + Number(p.monto), 0);
  const sumNc = (ncs ?? []).reduce((s, n) => s + Number(n.monto_mxn), 0);
  const saldo = Math.max(0, total - sumPagos - sumNc);
  const status =
    saldo <= EPS ? 'Liquidada' : sumPagos > 0 || sumNc > 0 ? 'Parcial' : 'Pendiente';

  const { error } = await supabase
    .from('cam_compras_mx')
    .update({ saldo_pendiente: saldo, status })
    .eq('id', compraId);
  if (error) throw error;
}

/**
 * Eliminar una compra MX. Bloquea si tiene pagos o NCs (la auditoría se
 * preserva — primero hay que borrar esos registros). Las líneas caen en cascada.
 */
export async function deleteCompraMX(id: string): Promise<void> {
  const [{ count: pagosCount, error: pErr }, { count: ncCount, error: nErr }] = await Promise.all([
    supabase.from('cam_pagos_mx').select('id', { count: 'exact', head: true }).eq('compra_id', id),
    supabase.from('cam_nc_mx').select('id', { count: 'exact', head: true }).eq('compra_id', id),
  ]);
  if (pErr) throw pErr;
  if (nErr) throw nErr;

  const bloqueos: string[] = [];
  if ((pagosCount ?? 0) > 0) bloqueos.push(`${pagosCount} pago${pagosCount === 1 ? '' : 's'}`);
  if ((ncCount ?? 0) > 0) bloqueos.push(`${ncCount} nota${ncCount === 1 ? '' : 's'} de crédito`);
  if (bloqueos.length > 0) {
    const plural = (pagosCount ?? 0) + (ncCount ?? 0) > 1;
    throw new Error(
      `No se puede eliminar: la compra tiene ${bloqueos.join(' y ')} asociado${plural ? 's' : ''}. Elimína${plural ? 'los' : 'lo'} primero.`,
    );
  }

  const { error } = await supabase.from('cam_compras_mx').delete().eq('id', id);
  if (error) throw error;
}

/** Detalle completo de una compra para la ficha: productos, pagos, NCs y resumen. */
export type CompraMXDetalle = {
  compra: CamCompraMXConProductos;
  pagos: {
    id: string;
    monto: number;
    fecha: string;
    referencia: string | null;
    banco: string | null;
  }[];
  ncs: { id: string; monto_mxn: number; motivo: string; fecha: string; status: string | null }[];
  pagado: number;
  ncAplicado: number;
};

export async function fetchCompraMXDetalle(compraId: string): Promise<CompraMXDetalle | null> {
  const [
    { data: compra, error: cErr },
    { data: pagos, error: pErr },
    { data: ncs, error: nErr },
  ] = await Promise.all([
    supabase
      .from('cam_compras_mx')
      .select('*, productos:cam_productos_mx(*)')
      .eq('id', compraId)
      .maybeSingle(),
    supabase
      .from('cam_pagos_mx')
      .select('id, monto, fecha, referencia, banco:bancos(nombre)')
      .eq('compra_id', compraId)
      .order('fecha', { ascending: true }),
    supabase
      .from('cam_nc_mx')
      .select('id, monto_mxn, motivo, fecha, status')
      .eq('compra_id', compraId)
      .order('fecha', { ascending: true }),
  ]);
  if (cErr) throw cErr;
  if (pErr) throw pErr;
  if (nErr) throw nErr;
  if (!compra) return null;

  const pagosArr = (pagos ?? []).map((p) => ({
    id: p.id as string,
    monto: Number(p.monto),
    fecha: p.fecha as string,
    referencia: (p.referencia as string | null) ?? null,
    banco: (p.banco as unknown as { nombre: string } | null)?.nombre ?? null,
  }));
  const ncsArr = (ncs ?? []).map((n) => ({
    id: n.id as string,
    monto_mxn: Number(n.monto_mxn),
    motivo: n.motivo as string,
    fecha: n.fecha as string,
    status: (n.status as string | null) ?? null,
  }));

  return {
    compra: compra as unknown as CamCompraMXConProductos,
    pagos: pagosArr,
    ncs: ncsArr,
    pagado: pagosArr.reduce((s, p) => s + p.monto, 0),
    ncAplicado: ncsArr.reduce((s, n) => s + n.monto_mxn, 0),
  };
}

/**
 * Catálogos para los formularios MX: SKUs del proveedor 'camanchaca' (catálogo
 * COMPARTIDO con la entidad SA), bodegas y bancos.
 */
export async function fetchCatalogosMX(empresaId: string): Promise<{
  skus: CatalogoSku[];
  bodegas: Bodega[];
  bancos: Banco[];
}> {
  const [skus, bodegas, bancos] = await Promise.all([
    supabase
      .from('catalogo_sku')
      .select('*')
      .eq('proveedor', 'camanchaca')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .order('code'),
    supabase.from('bodegas').select('*').eq('empresa_id', empresaId).order('nombre'),
    supabase.from('bancos').select('*').order('nombre'),
  ]);
  if (skus.error) throw skus.error;
  if (bodegas.error) throw bodegas.error;
  if (bancos.error) throw bancos.error;
  return {
    skus: skus.data ?? [],
    bodegas: bodegas.data ?? [],
    bancos: bancos.data ?? [],
  };
}
