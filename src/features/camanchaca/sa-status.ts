import type { CamContenedorSA } from '@/types/database';

export type StatusContenedorSA = 'Entregado' | 'En Manzanillo' | 'En tránsito' | 'Planeado';

// Fecha de HOY en zona local del navegador (no UTC) en formato 'YYYY-MM-DD'.
// (Mismo criterio que Blufin: toISOString() daría UTC y en CST se adelantaría.)
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Status EFECTIVO del contenedor SA — se CALCULA siempre, nunca se captura ni se
 * confía del campo guardado (depende de la fecha de hoy, así que un valor
 * guardado envejece solo).
 *
 * Reglas (decisión del usuario 2026-08-19):
 *  - Entregado:      la recepción ya registró la llegada (`llegada_real`).
 *  - En Manzanillo:  hoy ya alcanzó su ETA Manzanillo (hoy ≥ ETA, el día del ETA cuenta).
 *  - En tránsito:    ETA Manzanillo todavía en el futuro (hoy < ETA).
 *  - Planeado:       aún sin factura ni ETA (solo planeación).
 *
 * Ojo: "Entregado" se toma de `llegada_real`, que es lo que escribe
 * `createRecepcionSA` — NO del campo `status`. Antes se leía `status ===
 * 'Entregado'`, que dependía de que alguien lo hubiera puesto a mano y podía
 * mentir en las dos direcciones (marcar entregado sin recepción, o quedarse en
 * tránsito con la mercancía ya en bodega).
 */
export function statusContenedorSA(
  c: Pick<CamContenedorSA, 'status' | 'factura' | 'eta_manzanillo'> & { llegada_real?: string | null },
  hoy: string = hoyISO(),
): StatusContenedorSA {
  if (c.llegada_real) return 'Entregado';
  if (!c.factura && !c.eta_manzanillo) return 'Planeado';
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
