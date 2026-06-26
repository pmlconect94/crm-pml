import { supabase } from '@/lib/supabase';
import type { CamNcSa, CamNcSaInsert } from '@/types/database';

/**
 * NC por descuento SA (simplificada — monto USD + motivo, sin CFDI ni
 * aplicaciones múltiples). Se liga a un contenedor y reduce lo que se le debe.
 */
export type CamNcSaEnriquecida = CamNcSa & {
  contenedor?: { folio_interno: string; total_usd: number | null } | null;
};

export async function fetchNcSA(empresaId: string): Promise<CamNcSaEnriquecida[]> {
  const { data, error } = await supabase
    .from('cam_nc_sa')
    .select(
      'id, contenedor_id, monto_usd, motivo, fecha, status, created_at, ' +
        'contenedor:cam_contenedores_sa!inner(folio_interno, empresa_id, total_usd)',
    )
    .eq('contenedor.empresa_id', empresaId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CamNcSaEnriquecida[];
}

export async function createNcSA(payload: CamNcSaInsert): Promise<void> {
  if (!payload.contenedor_id) throw new Error('Selecciona el contenedor');
  if (!(payload.monto_usd > 0)) throw new Error('Captura un monto mayor a 0');
  if (!payload.motivo?.trim()) throw new Error('Captura el motivo de la NC');
  const { error } = await supabase.from('cam_nc_sa').insert(payload);
  if (error) throw error;
}

export async function deleteNcSA(id: string): Promise<void> {
  const { error } = await supabase.from('cam_nc_sa').delete().eq('id', id);
  if (error) throw error;
}
