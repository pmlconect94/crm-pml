import type { BlufinContrato } from '@/types/database';

export type StatusContrato = 'Entregado' | 'En puerto' | 'En tránsito' | 'Contratado';

const hoyISO = () => new Date().toISOString().slice(0, 10);

/**
 * Status EFECTIVO del contrato — se calcula, no se guarda (depende de la fecha
 * de hoy: el contenedor pasa de tránsito a puerto solo conforme vence su ETA).
 * El campo `status` guardado solo se usa para detectar "Entregado" (= recepción
 * registrada; la invariante Entregado ⟺ recepción la mantiene createRecepcion).
 *
 * Reglas (feedback 2026-06-17):
 *  - Entregado:   ya tiene recepción.
 *  - En puerto:   tiene contenedor + naviera y su ETA puerto YA pasó (hoy > ETA).
 *  - En tránsito: tiene contenedor + naviera y su ETA puerto es FUTURA (hoy ≤ ETA).
 *  - Contratado:  aún no tiene contenedor ni naviera (la ETA es estimada).
 */
export function statusContrato(
  c: Pick<BlufinContrato, 'status' | 'contenedor' | 'naviera' | 'eta_puerto'>,
  hoy: string = hoyISO(),
): StatusContrato {
  if (c.status === 'Entregado') return 'Entregado';
  const tieneVapor = !!(c.contenedor && c.naviera);
  if (!tieneVapor) return 'Contratado';
  if (c.eta_puerto && c.eta_puerto < hoy) return 'En puerto';
  return 'En tránsito';
}
