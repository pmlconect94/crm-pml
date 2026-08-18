/**
 * "Basa Pangabay 100% 5/7 · +2 más" — resumen de UNA línea de qué es un
 * contenedor, para ponerlo en letra chica junto al folio sin crecer la fila
 * (patrón de Pagos → Pendientes, feedback 2026-08-06: el span se recorta con
 * ellipsis y minWidth:0 para no mover las proporciones de la tabla).
 */
export function resumenProductos(
  productos?: { descripcion?: string | null; marca?: string | null; talla?: string | null }[] | null,
): string {
  const p = productos?.[0];
  if (!p) return '';
  const base = (p.descripcion ?? '').replace('FROZEN ', '').trim() || (p.marca ?? '');
  const partes = [base];
  if (p.talla) partes.push(p.talla);
  const extra = (productos?.length ?? 0) - 1;
  if (extra > 0) partes.push(`+${extra} más`);
  return partes.filter(Boolean).join(' · ');
}
