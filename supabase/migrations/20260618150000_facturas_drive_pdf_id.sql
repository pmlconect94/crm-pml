-- Id del archivo PDF en Google Drive, para facturas que llegan por correo y se
-- guardan en Drive. El botón "Ver PDF" lo abre directo desde Drive cuando no hay
-- copia en Supabase Storage (storage_path). Aditivo.
alter table crm.blufin_facturas
  add column if not exists drive_pdf_id text;
