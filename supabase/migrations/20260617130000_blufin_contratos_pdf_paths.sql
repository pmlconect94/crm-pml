-- Rutas en Storage de los PDFs descargables de cada contrato:
--   contrato_pdf_path: el PDF de la orden de compra (bucket documentos-importacion)
--   factura_pdf_path:  el PDF de la factura del proveedor (bucket facturas-pdf)
-- Se muestran como 2 botones de descarga en la ficha del contrato (ContratoDetalleModal).
alter table crm.blufin_contratos
  add column if not exists contrato_pdf_path text,
  add column if not exists factura_pdf_path text;

notify pgrst, 'reload schema';
