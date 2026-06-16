-- Bucket de Storage para los PDFs (o fotos) de facturas del proveedor Blufin.
-- Las tablas crm.blufin_facturas / crm.blufin_factura_lineas ya existen
-- (schema_blufin). Esto solo agrega el almacenamiento de archivos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'facturas-pdf',
  'facturas-pdf',
  false,
  20971520, -- 20 MB
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Política dev_open (rol public = anon + authenticated) mientras no haya auth real.
-- Endurecer junto con el resto de RLS al integrar Supabase Auth (infra #3/#4).
drop policy if exists "facturas_pdf_dev_open" on storage.objects;
create policy "facturas_pdf_dev_open"
  on storage.objects
  for all
  to public
  using (bucket_id = 'facturas-pdf')
  with check (bucket_id = 'facturas-pdf');
