-- Alinea la descripción "snapshot" de los productos de cada contrato con la del
-- catálogo (Intelisis, migración 20260618120000). El usuario pidió que la nueva
-- descripción salga en TODOS lados, no solo en el catálogo de Productos.
-- SOLO se toca la descripción; kg, kg_caja, cajas, precio_usd, total_usd, marca,
-- pct y talla del snapshot quedan intactos (son el registro real del contrato).
-- Nota: rompe a propósito la inmutabilidad del snapshot de descripción para que
-- la ficha del contrato y el export coincidan con el ERP. Los contratos nuevos ya
-- copian la descripción actual del catálogo al crearse. Si el catálogo se vuelve a
-- editar, re-aplicar este UPDATE (o usar scripts/regenerar_seed_catalogo.py + sync).
update crm.blufin_contrato_productos p
set descripcion = c.descripcion
from crm.catalogo_sku c
where c.id = p.sku_id
  and p.descripcion is distinct from c.descripcion;
