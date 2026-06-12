-- "Lo que es" del SKU (Filete Basa, Tilapia Entera, Camaron...) como campo
-- estructurado. La descripción deja de capturarse: se genera en frontend
-- como producto + marca + talla + % (omitiendo vacíos y 100%).
alter table crm.catalogo_sku
  add column if not exists producto text;
