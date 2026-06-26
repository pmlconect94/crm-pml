import { supabase } from '@/lib/supabase';
import type { CatalogoSku } from '@/types/database';

// Sugerencias para la ficha del SKU Camanchaca (datalist — aceptan texto libre).
// Camanchaca = salmón chileno; Neptuno reutilizará el mismo proveedor de catálogo
// más adelante. Lista base editable conforme el usuario capture productos reales.
export const PRODUCTOS_CAMANCHACA = [
  'Salmón lonja', 'Salmón porción', 'Salmón filete', 'Salmón HG', 'Salmón entero',
  'Trucha filete', 'Trucha porción', 'Pez espada loin', 'Merluza filete', 'Bacalao',
];
export const MARCAS_CAMANCHACA = ['Camanchaca', 'Neptuno', 'PML'];
export const TALLAS_CAMANCHACA = [
  '1/2 lb', '2/3 lb', '3/4 lb', '4/5 lb', '5/6 lb', '6/up lb',
  '150/250 g', '200 g', '250 g', '500 g', '2/3 kg', '3/4 kg', '4/5 kg', '5/6 kg', '6/7 kg',
];
export const PORCENTAJES_CAMANCHACA = ['100%', '90%', '85%'];

/** Atajo de descripción: PRODUCTO - MARCA - PESO NETO - TALLA (editable). */
export function composeDescripcionCam(
  producto: string,
  marca: string,
  talla: string,
  pct: string,
): string {
  return [producto.trim(), marca.trim(), pct.trim(), talla.trim()].filter(Boolean).join(' - ');
}

/** Catálogo completo Camanchaca (incluye inactivos — la página filtra). */
export async function fetchSkusCamanchaca(empresaId: string): Promise<CatalogoSku[]> {
  const { data, error } = await supabase
    .from('catalogo_sku')
    .select('*')
    .eq('proveedor', 'camanchaca')
    .eq('empresa_id', empresaId)
    .order('code');
  if (error) throw error;
  return data ?? [];
}

export type SkuParamsCam = {
  code: string;
  producto: string;
  descripcion: string;
  marca: string | null;
  pct: string | null;
  talla: string | null;
  kg_caja: number;
};

export async function createSkuCam(empresaId: string, params: SkuParamsCam): Promise<void> {
  const { error } = await supabase.from('catalogo_sku').insert({
    empresa_id: empresaId,
    proveedor: 'camanchaca',
    ...params,
    activo: true,
  });
  if (error) {
    if (error.code === '23505') {
      throw new Error(`Ya existe un SKU con el código ${params.code} para Camanchaca`);
    }
    throw error;
  }
}

export async function updateSkuCam(id: string, params: SkuParamsCam): Promise<void> {
  const { error } = await supabase.from('catalogo_sku').update(params).eq('id', id);
  if (error) {
    if (error.code === '23505') {
      throw new Error(`Ya existe un SKU con el código ${params.code} para Camanchaca`);
    }
    throw error;
  }
}

export async function toggleSkuActivoCam(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase.from('catalogo_sku').update({ activo }).eq('id', id);
  if (error) throw error;
}
