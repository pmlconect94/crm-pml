-- Corrección (2026-06-13): el `pct` NO es "limpieza" sino el PESO NETO del
-- producto (producto real vs glaseo). Por eso el 100% SÍ debe mostrarse en
-- la descripción — es un dato del producto, no un valor por defecto.
-- Nuevo formato: PRODUCTO - MARCA - PESO NETO - TALLA (omite solo vacíos).
update crm.catalogo_sku
set descripcion = array_to_string(
  array_remove(array[
    nullif(btrim(producto), ''),
    nullif(btrim(marca), ''),
    nullif(btrim(pct), ''),
    nullif(btrim(talla), '')
  ], null),
  ' - '
)
where proveedor = 'blufin';
