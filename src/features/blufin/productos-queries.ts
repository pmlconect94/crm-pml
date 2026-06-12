import { supabase } from '@/lib/supabase';
import type { CatalogoSku } from '@/types/database';

export const CATEGORIAS_BLUFIN = ['Tilapia Filete', 'Tilapia Entera', 'Camarón', 'Basa', 'Otros'];

/**
 * Catálogo completo del proveedor (incluye inactivos — la página filtra).
 * Este catálogo es el master: se referencia en contratos, recepciones y costos,
 * y servirá para mapear los productos al leer contratos PDF (carga masiva).
 */
export async function fetchSkusBlufin(empresaId: string): Promise<CatalogoSku[]> {
  const { data, error } = await supabase
    .from('catalogo_sku')
    .select('*')
    .eq('proveedor', 'blufin')
    .eq('empresa_id', empresaId)
    .order('code');
  if (error) throw error;
  return data ?? [];
}

export type SkuParams = {
  code: string;
  descripcion: string;
  categoria: string | null;
  kg_caja: number;
  cajas_tipo: string | null;
};

export async function createSku(empresaId: string, params: SkuParams): Promise<void> {
  const { error } = await supabase.from('catalogo_sku').insert({
    empresa_id: empresaId,
    proveedor: 'blufin',
    ...params,
    activo: true,
  });
  if (error) {
    if (error.code === '23505') {
      throw new Error(`Ya existe un SKU con el código ${params.code} para Blufin`);
    }
    throw error;
  }
}

export async function updateSku(id: string, params: SkuParams): Promise<void> {
  const { error } = await supabase.from('catalogo_sku').update(params).eq('id', id);
  if (error) {
    if (error.code === '23505') {
      throw new Error(`Ya existe un SKU con el código ${params.code} para Blufin`);
    }
    throw error;
  }
}

/**
 * Activar/desactivar — no hay hard delete: los SKUs se referencian desde
 * contratos y recepciones. Desactivar lo oculta de los formularios de captura.
 */
export async function toggleSkuActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase.from('catalogo_sku').update({ activo }).eq('id', id);
  if (error) throw error;
}
