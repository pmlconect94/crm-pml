import { supabase } from '@/lib/supabase';
import type { CatalogoSku } from '@/types/database';

// Sugerencias para la ficha del SKU (datalist — aceptan texto libre).
// Derivadas de LISTA PRODUCTOS IMPORTACION.xlsx del usuario (2026-06-12).
export const PRODUCTOS_BLUFIN = [
  'Filete Basa', 'Filete Basa Rosa', 'Posta Basa', 'Filete Tilapia', 'Tilapia Entera',
  'Camaron', 'Atun lomo', 'Atun medallon', 'Aros de calamar', 'Tubo de calamar',
  'Tubo y tentaculo de calamar', 'Callo de almeja', 'Callo de hacha',
  'Sopa de mariscos', 'Surimi',
];
export const MARCAS_BLUFIN = [
  'Blufin', 'Blufin Eco.', 'Blufin Sanpez', 'Bulk Blufin', 'Chiapaneco', 'Kayfish',
  'Mediterraneo', 'Mekong', 'Panga Sanpez', 'Pangabay', 'PML', 'Selecta',
  'Tamarindo', 'Tiburon de Oro',
];
export const TALLAS_BLUFIN = [
  '2/3 oz', '3/5 oz', '5/7 oz', '7/9 oz', '3/7 oz', '150/250 g', '350/550 g',
  '550/750 g', '750/1000 g', '500 g', '2.0/4.0 kg', '31/35', '41/50', '61/70', 'U10',
];
export const PORCENTAJES_BLUFIN = ['45%', '50%', '70%', '85%', '100%'];

/**
 * Atajo para autocompletar la descripción ("Generar de la ficha" en el modal):
 * arma PRODUCTO - MARCA - PESO NETO - TALLA. La descripción del SKU es EDITABLE
 * (2026-06-18) y debe coincidir con Intelisis; esto es solo un punto de partida.
 */
export function composeDescripcion(
  producto: string,
  marca: string,
  talla: string,
  pct: string,
): string {
  return [producto.trim(), marca.trim(), pct.trim(), talla.trim()]
    .filter(Boolean)
    .join(' - ');
}

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
  producto: string;
  descripcion: string; // editable (alineada con Intelisis); composeDescripcion = atajo
  marca: string | null;
  pct: string | null;
  talla: string | null;
  kg_caja: number;
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
