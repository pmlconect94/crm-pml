-- Decisión del usuario (2026-06-13):
--  1. La descripción se genera con formato PRODUCTO - MARCA - LIMPIEZA - TALLA
--     (separador " - ", omite campos vacíos y omite el 100% de limpieza).
--  2. Se elimina `categoria`: la clasificación se hace por `producto` (es lo mismo).
--  3. Se elimina `cajas_tipo`.

update crm.catalogo_sku
set descripcion = array_to_string(
  array_remove(array[
    nullif(btrim(producto), ''),
    nullif(btrim(marca), ''),
    case when btrim(pct) = '100%' then null else nullif(btrim(pct), '') end,
    nullif(btrim(talla), '')
  ], null),
  ' - '
)
where proveedor = 'blufin';

alter table crm.catalogo_sku drop column if exists categoria;
alter table crm.catalogo_sku drop column if exists cajas_tipo;
