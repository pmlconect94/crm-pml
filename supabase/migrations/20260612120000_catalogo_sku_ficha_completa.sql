-- Ficha completa de producto en el catálogo: marca, % de limpieza y talla
-- se vuelven datos estructurados del SKU (antes iban embebidos en la
-- descripción y se re-capturaban en cada línea de contrato).
alter table crm.catalogo_sku
  add column if not exists marca text,
  add column if not exists pct   text,
  add column if not exists talla text;

-- Normalizar categoría inconsistente capturada en vivo (BASA → Basa)
update crm.catalogo_sku set categoria = 'Basa' where categoria = 'BASA';
