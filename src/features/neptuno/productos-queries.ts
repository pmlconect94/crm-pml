import { supabase } from '@/lib/supabase';
import type { CatalogoSku } from '@/types/database';

// Sugerencias para la ficha del SKU (datalist — aceptan texto libre).
// SKUs sugeridos de §8: Neptuno trabaja pescados blancos y mariscos.
export const PRODUCTOS_NEPTUNO = [
  'Pez Espada Loin', 'Merluza Filete', 'Bacalao', 'Pulpo', 'Calamar', 'Rape',
];
export const MARCAS_NEPTUNO = ['Neptuno'];
export const TALLAS_NEPTUNO = [
  '2/4 lb', '4/6 lb', '6/8 lb', '8 oz up', '100/200 g', '200/400 g', '400/600 g', 'U10', '16/20',
];
export const PORCENTAJES_NEPTUNO = ['80%', '85%', '90%', '100%'];

/**
 * Atajo para autocompletar la descripción ("Generar de la ficha" en el modal):
 * arma PRODUCTO - MARCA - PESO NETO - TALLA. La descripción del SKU es EDITABLE
 * y debe coincidir con Intelisis; esto es solo un punto de partida.
 */
export function composeDescripcion(
  producto: string,
  marca: string,
  talla: string,
  pct: string,
): string {
  return [producto.trim(), marca.trim(), pct.trim(), talla.trim()].filter(Boolean).join(' - ');
}

/**
 * Catálogo completo del proveedor (incluye inactivos — la página filtra).
 * Master de productos: se referencia en facturas y costos.
 */
export async function fetchSkusNeptuno(empresaId: string): Promise<CatalogoSku[]> {
  const { data, error } = await supabase
    .from('catalogo_sku')
    .select('*')
    .eq('proveedor', 'neptuno')
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
    proveedor: 'neptuno',
    ...params,
    activo: true,
  });
  if (error) {
    if (error.code === '23505') {
      throw new Error(`Ya existe un SKU con el código ${params.code} para Neptuno`);
    }
    throw error;
  }
}

export async function updateSku(id: string, params: SkuParams): Promise<void> {
  const { error } = await supabase.from('catalogo_sku').update(params).eq('id', id);
  if (error) {
    if (error.code === '23505') {
      throw new Error(`Ya existe un SKU con el código ${params.code} para Neptuno`);
    }
    throw error;
  }
}

/**
 * Activar/desactivar — no hay hard delete: los SKUs se referencian desde
 * facturas. Desactivar lo oculta de los formularios de captura.
 */
export async function toggleSkuActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase.from('catalogo_sku').update({ activo }).eq('id', id);
  if (error) throw error;
}
