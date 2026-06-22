-- Id del PDF de la factura del proveedor en Google Drive, ligado al contrato al
-- aprobar la factura. Permite que la lista de contratos muestre el indicador
-- "tiene factura" y que se pueda descargar la factura desde el contrato, sin
-- copiar el binario a Storage. Coexiste con factura_pdf_path (facturas históricas
-- ya copiadas al bucket documentos-importacion). Aditivo.
alter table crm.blufin_contratos
  add column if not exists factura_drive_pdf_id text;
