-- Facturas por correo: origen, identificadores de CFDI y mapeo de SKU por línea.
-- Soporta el flujo de auto-subida de facturas de Menita desde el correo
-- (facturacion@menita.com.mx) y la regla "aprobar = la factura reescribe el contrato".
-- Aditivo y no destructivo.

alter table crm.blufin_facturas
  add column if not exists origen text not null default 'manual',   -- 'manual' | 'correo'
  add column if not exists factura_num text,                        -- folio CFDI, ej. 'C4000'
  add column if not exists xml_path text,                           -- ruta del XML (CFDI) en Storage
  add column if not exists email_message_id text;                   -- idempotencia: no reprocesar el mismo correo

-- Un mensaje de correo solo puede generar una factura (evita duplicados al re-correr la rutina).
create unique index if not exists blufin_facturas_email_msg_uniq
  on crm.blufin_facturas (email_message_id) where email_message_id is not null;

alter table crm.blufin_factura_lineas
  add column if not exists sku_id uuid references crm.catalogo_sku(id),  -- SKU del catálogo al que mapea la línea de la factura
  add column if not exists confianza text;                              -- 'alta' | 'media' | 'baja' | 'sin_match'
