/**
 * Catálogos compartidos de Importaciones: navieras y bodegas de destino.
 *
 * Los usan Blufin, Camanchaca y Neptuno, por eso viven fuera de cualquier módulo
 * de proveedor. **Nunca se borran**: los contratos y contenedores históricos los
 * referencian por FK, así que retirar uno es apagar su `activo` — desaparece de
 * los formularios de captura y el historial sigue intacto.
 */
import { supabase } from '@/lib/supabase';
import type { Naviera, Bodega } from '@/types/database';

export async function fetchNavierasTodas(): Promise<Naviera[]> {
  const { data, error } = await supabase.from('navieras').select('*').order('nombre');
  if (error) throw error;
  return data ?? [];
}

export async function fetchBodegasTodas(empresaId: string): Promise<Bodega[]> {
  const { data, error } = await supabase
    .from('bodegas')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nombre');
  if (error) throw error;
  return data ?? [];
}

/** Cuántos embarques usan cada catálogo — para avisar antes de desactivar. */
export async function fetchUsoCatalogos(): Promise<{ navieras: Map<number, number> }> {
  const [{ data: blufin }, { data: cam }] = await Promise.all([
    supabase.from('blufin_contratos').select('naviera_id'),
    supabase.from('cam_contenedores_sa').select('naviera_id'),
  ]);
  const navieras = new Map<number, number>();
  for (const fila of [...(blufin ?? []), ...(cam ?? [])]) {
    const id = (fila as { naviera_id: number | null }).naviera_id;
    if (id != null) navieras.set(id, (navieras.get(id) ?? 0) + 1);
  }
  return { navieras };
}

const YA_EXISTE = '23505';

export async function crearNaviera(nombre: string): Promise<void> {
  const { error } = await supabase.from('navieras').insert({ nombre: nombre.trim() });
  if (error?.code === YA_EXISTE) throw new Error(`La naviera "${nombre}" ya existe.`);
  if (error) throw error;
}

export async function renombrarNaviera(id: number, nombre: string): Promise<void> {
  const { error } = await supabase.from('navieras').update({ nombre: nombre.trim() }).eq('id', id);
  if (error?.code === YA_EXISTE) throw new Error(`Ya hay otra naviera llamada "${nombre}".`);
  if (error) throw error;
}

export async function toggleNaviera(id: number, activo: boolean): Promise<void> {
  const { error } = await supabase.from('navieras').update({ activo }).eq('id', id);
  if (error) throw error;
}

export async function crearBodega(empresaId: string, nombre: string, ciudad: string): Promise<void> {
  const { error } = await supabase
    .from('bodegas')
    .insert({ empresa_id: empresaId, nombre: nombre.trim(), ciudad: ciudad.trim() || null, activo: true });
  if (error) throw error;
}

export async function actualizarBodega(
  id: number,
  patch: { nombre?: string; ciudad?: string | null; activo?: boolean },
): Promise<void> {
  const { error } = await supabase.from('bodegas').update(patch).eq('id', id);
  if (error) throw error;
}
