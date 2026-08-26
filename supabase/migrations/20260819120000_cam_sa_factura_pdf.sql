-- PDF de la factura del proveedor, subido desde la ficha del contenedor.
-- Mismo patrón que Blufin (`blufin_contratos.factura_pdf_path`): se guarda el
-- path dentro del bucket privado `documentos-importacion` y se lee con URL
-- firmada, nunca público.
alter table crm.cam_contenedores_sa
  add column if not exists factura_pdf_path text;

comment on column crm.cam_contenedores_sa.factura_pdf_path is
  'Path en el bucket documentos-importacion (camanchaca-sa/<folio>.pdf). Null = sin PDF subido.';
