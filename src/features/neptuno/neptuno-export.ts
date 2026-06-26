/**
 * Exportaciones a Excel del módulo Neptuno.
 * Usa el generador sin dependencias src/lib/excel.ts.
 */
import { downloadXlsx, type XlsxCell } from '@/lib/excel';
import type { CatalogoSku } from '@/types/database';

const hoy = () => new Date().toISOString().slice(0, 10);
const num = (n: number | null | undefined): XlsxCell => (n == null ? '' : Number(n));

/** Catálogo completo de SKUs Neptuno (activos e inactivos). */
export function exportProductos(skus: CatalogoSku[]) {
  const rows: XlsxCell[][] = [
    ['Código', 'Producto', 'Descripción', 'Marca', '% Peso neto', 'Talla', 'Kg por caja', 'Status'],
    ...skus.map((s) => [
      s.code,
      s.producto ?? '',
      s.descripcion,
      s.marca ?? '',
      s.pct ?? '',
      s.talla ?? '',
      num(s.kg_caja),
      s.activo === false ? 'Inactivo' : 'Activo',
    ]),
  ];
  downloadXlsx(`Catalogo_productos_Neptuno_${hoy()}`, [{ name: 'Productos', rows }]);
}
