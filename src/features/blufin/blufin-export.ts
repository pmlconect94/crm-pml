/**
 * Exportaciones a Excel del módulo Blufin.
 * Usa el generador sin dependencias src/lib/excel.ts.
 */
import { downloadXlsx, type XlsxCell } from '@/lib/excel';
import type { CatalogoSku, BlufinContratoConProductos, BlufinProducto } from '@/types/database';
import { statusContrato } from '@/features/blufin/status';

const hoy = () => new Date().toISOString().slice(0, 10);
/** Número como número (Excel lo suma); null/undefined → celda vacía. */
const num = (n: number | null | undefined): XlsxCell => (n == null ? '' : Number(n));
/** Fecha ISO tal cual (YYYY-MM-DD): ordena bien y es inequívoca. */
const fecha = (s: string | null | undefined): XlsxCell => s ?? '';
const siNo = (b: boolean | null | undefined) => (b ? 'Sí' : 'No');

/** Catálogo completo de SKUs Blufin (activos e inactivos). */
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
  downloadXlsx(`Catalogo_productos_Blufin_${hoy()}`, [{ name: 'Productos', rows }]);
}

/** Lista de contratos con totales, fechas de llegada y estado de pago. */
export function exportContratos(
  contratos: BlufinContratoConProductos[],
  saldoDe?: (c: BlufinContratoConProductos) => number,
) {
  const rows: XlsxCell[][] = [
    [
      'Folio', 'Fecha', 'Status', 'Lote', 'Contenedor', 'Naviera', 'Presentación',
      'ETA puerto', 'ETA bodega', 'Llegada real', 'Bodega destino',
      'Total kg', 'Total USD', 'Anticipo USD', 'Anticipo pagado',
      'Saldo USD', 'Saldo pagado', 'Saldo pendiente USD', '# Productos',
    ],
    ...contratos.map((c) => [
      c.folio,
      fecha(c.fecha),
      statusContrato(c),
      c.lote ?? '',
      c.contenedor ?? '',
      c.naviera ?? '',
      c.presentacion ?? '',
      fecha(c.eta_puerto),
      fecha(c.eta_bodega),
      fecha(c.llegada_real),
      c.bodega_destino ?? '',
      num(c.total_kg),
      num(c.total_usd),
      num(c.anticipo_usd),
      siNo(c.anticipo_pagado),
      num(c.saldo_usd),
      siNo(c.saldo_pagado),
      saldoDe ? Number(saldoDe(c).toFixed(2)) : '',
      c.productos?.length ?? 0,
    ]),
  ];
  downloadXlsx(`Contratos_Blufin_${hoy()}`, [{ name: 'Contratos', rows }]);
}

/**
 * Cada producto en su propia fila con el contrato del que viene y sus fechas
 * de llegada. Ordenado por fecha de llegada a bodega (los próximos primero).
 */
export function exportProductosPorContrato(contratos: BlufinContratoConProductos[]) {
  const flat: { c: BlufinContratoConProductos; p: BlufinProducto }[] = [];
  for (const c of contratos) {
    for (const p of c.productos ?? []) flat.push({ c, p });
  }
  const llegada = (c: BlufinContratoConProductos) => c.eta_bodega ?? c.eta_puerto ?? '9999-99-99';
  flat.sort(
    (a, b) =>
      llegada(a.c).localeCompare(llegada(b.c)) ||
      a.c.folio.localeCompare(b.c.folio) ||
      (a.p.orden ?? 0) - (b.p.orden ?? 0),
  );

  const rows: XlsxCell[][] = [
    [
      'Folio contrato', 'Status', 'ETA puerto', 'ETA bodega', 'Llegada real',
      'Contenedor', 'Naviera', 'Producto', 'Marca', 'Talla', '% Neto',
      'Kg', 'Cajas', 'Precio USD', 'Total USD',
    ],
    ...flat.map(({ c, p }) => [
      c.folio,
      statusContrato(c),
      fecha(c.eta_puerto),
      fecha(c.eta_bodega),
      fecha(c.llegada_real),
      c.contenedor ?? '',
      c.naviera ?? '',
      p.descripcion ?? '',
      p.marca ?? '',
      p.talla ?? '',
      p.pct ?? '',
      num(p.kg),
      num(p.cajas),
      num(p.precio_usd),
      num(p.total_usd),
    ]),
  ];
  downloadXlsx(`Productos_por_contrato_Blufin_${hoy()}`, [{ name: 'Productos x contrato', rows }]);
}
