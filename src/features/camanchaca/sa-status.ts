import type { CamContenedorSA } from '@/types/database';

export type StatusContenedorSA = 'Entregado' | 'En Manzanillo' | 'En tránsito' | 'Planeado';

// Fecha de HOY en zona local del navegador (no UTC) en formato 'YYYY-MM-DD'.
// (Mismo criterio que Blufin: toISOString() daría UTC y en CST se adelantaría.)
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Status EFECTIVO del contenedor SA — se calcula, no se confía del campo guardado
 * (depende de la fecha de hoy: pasa de tránsito a Manzanillo conforme vence su ETA).
 * El campo `status` guardado solo se usa para detectar "Entregado" (= recepción
 * registrada; la invariante Entregado ⟺ recepción la mantiene createRecepcion).
 *
 * Reglas (paralelas a Blufin, ETA == hoy ya cuenta como "en puerto"):
 *  - Entregado:      ya tiene recepción.
 *  - En Manzanillo:  tiene factura y su ETA Manzanillo ya llegó (hoy ≥ ETA).
 *  - En tránsito:    tiene factura y ETA Manzanillo futura (hoy < ETA).
 *  - Planeado:       aún sin factura (solo planeación o alta sin confirmar).
 */
export function statusContenedorSA(
  c: Pick<CamContenedorSA, 'status' | 'factura' | 'eta_manzanillo'>,
  hoy: string = hoyISO(),
): StatusContenedorSA {
  if (c.status === 'Entregado') return 'Entregado';
  if (!c.factura) return 'Planeado';
  if (c.eta_manzanillo && c.eta_manzanillo <= hoy) return 'En Manzanillo';
  return 'En tránsito';
}

/** ETA bodega automática = ETA Manzanillo + 7 días (estimado, editable). */
export function etaBodegaAutoSA(etaManzanillo: string | null): string | null {
  if (!etaManzanillo) return null;
  const d = new Date(etaManzanillo + 'T12:00:00');
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export const CAM_SA_STATUS_OPTS: StatusContenedorSA[] = [
  'Planeado',
  'En tránsito',
  'En Manzanillo',
  'Entregado',
];
