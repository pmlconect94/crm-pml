/**
 * Catálogo de motivos de nómina (nomina.catalogo_motivos): motivos de horas
 * extra, motivos de bono y destinos de viaje (viaje = solo PML). Listas
 * separadas por empresa; solo la etiqueta, sin monto. Se administra en
 * RH → Catálogos y las pestañas de captura lo consumen como <select>.
 */
import { dbNomina } from './db';

export type TipoMotivo = 'horas_extra' | 'bono' | 'viaje';
export type EmpresaCatalogo = 'PML' | 'MARLIN';

export type Motivo = {
  id: string;
  empresa: EmpresaCatalogo;
  tipo: TipoMotivo;
  nombre: string;
  activo: boolean;
};

export const TIPO_LABEL: Record<TipoMotivo, string> = {
  horas_extra: 'Motivos de horas extra',
  bono: 'Motivos de bono',
  viaje: 'Destinos de viaje',
};

/** Lista completa (activos e inactivos) de una empresa, para la página de Catálogos. */
export async function fetchCatalogoMotivos(empresa: EmpresaCatalogo): Promise<Motivo[]> {
  const { data, error } = await dbNomina
    .from('catalogo_motivos')
    .select('*')
    .eq('empresa', empresa)
    .order('tipo')
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as Motivo[];
}

/** Solo los nombres ACTIVOS de un tipo, para los <select> de captura. */
export async function fetchMotivosActivos(
  empresa: EmpresaCatalogo,
  tipo: TipoMotivo,
): Promise<string[]> {
  const { data, error } = await dbNomina
    .from('catalogo_motivos')
    .select('nombre')
    .eq('empresa', empresa)
    .eq('tipo', tipo)
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return (data ?? []).map((m: any) => m.nombre as string);
}

export async function crearMotivo(empresa: EmpresaCatalogo, tipo: TipoMotivo, nombre: string) {
  const { error } = await dbNomina
    .from('catalogo_motivos')
    .insert({ empresa, tipo, nombre: nombre.trim() });
  if (error) {
    // 23505 = ya existe (unique empresa+tipo+nombre)
    if ((error as any).code === '23505') throw new Error('Ese motivo ya existe en la lista.');
    throw error;
  }
}

export async function toggleMotivoActivo(id: string, activo: boolean) {
  const { error } = await dbNomina.from('catalogo_motivos').update({ activo }).eq('id', id);
  if (error) throw error;
}
