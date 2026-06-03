import { supabase } from '@/lib/supabase';
import type {
  BlufinContrato,
  BlufinContratoConProductos,
  BlufinContratoInsert,
  BlufinProductoInsert,
  CatalogoSku,
  Naviera,
  Bodega,
  Banco,
} from '@/types/database';

export async function fetchContratos(empresaId: string): Promise<BlufinContratoConProductos[]> {
  const { data, error } = await supabase
    .from('blufin_contratos')
    .select('*, productos:blufin_contrato_productos(*)')
    .eq('empresa_id', empresaId)
    .order('fecha', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BlufinContratoConProductos[];
}

export async function fetchContratoByFolio(folio: string): Promise<BlufinContratoConProductos | null> {
  const { data, error } = await supabase
    .from('blufin_contratos')
    .select('*, productos:blufin_contrato_productos(*)')
    .eq('folio', folio)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as BlufinContratoConProductos | null;
}

export async function createContrato(
  payload: BlufinContratoInsert,
  productos: Omit<BlufinProductoInsert, 'contrato_id'>[],
): Promise<BlufinContrato> {
  const { data: contrato, error } = await supabase
    .from('blufin_contratos')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  if (productos.length > 0) {
    const lineas = productos.map((p, idx) => ({
      ...p,
      contrato_id: contrato.id,
      orden: idx,
    }));
    const { error: linErr } = await supabase.from('blufin_contrato_productos').insert(lineas);
    if (linErr) throw linErr;
  }

  return contrato as BlufinContrato;
}

export async function fetchCatalogos(empresaId: string): Promise<{
  skus: CatalogoSku[];
  navieras: Naviera[];
  bodegas: Bodega[];
  bancos: Banco[];
}> {
  const [skus, navieras, bodegas, bancos] = await Promise.all([
    supabase
      .from('catalogo_sku')
      .select('*')
      .eq('proveedor', 'blufin')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .order('code'),
    supabase.from('navieras').select('*').order('nombre'),
    supabase.from('bodegas').select('*').eq('empresa_id', empresaId).order('nombre'),
    supabase.from('bancos').select('*').order('nombre'),
  ]);
  if (skus.error) throw skus.error;
  if (navieras.error) throw navieras.error;
  if (bodegas.error) throw bodegas.error;
  if (bancos.error) throw bancos.error;
  return {
    skus: skus.data ?? [],
    navieras: navieras.data ?? [],
    bodegas: bodegas.data ?? [],
    bancos: bancos.data ?? [],
  };
}
