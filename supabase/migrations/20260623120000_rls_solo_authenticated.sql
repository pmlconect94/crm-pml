-- Endurecer RLS antes de salir a producción (Vercel): de dev_open (public/anon)
-- a SOLO usuarios autenticados (Supabase Auth). La anon key sola (sin sesión)
-- ya NO puede leer ni escribir. Las Edge Functions y el MCP usan la service_role
-- (bypass RLS); los scripts locales deben usar SUPABASE_SERVICE_ROLE_KEY.
do $$
declare t record;
begin
  for t in (select tablename from pg_tables where schemaname = 'crm') loop
    execute format('alter table crm.%I enable row level security', t.tablename);
    execute format('drop policy if exists "dev_open" on crm.%I', t.tablename);
    execute format('drop policy if exists "auth_all" on crm.%I', t.tablename);
    execute format('create policy "auth_all" on crm.%I for all to authenticated using (true) with check (true)', t.tablename);
  end loop;
end $$;

-- Storage: buckets privados accesibles solo con sesión.
drop policy if exists "facturas_pdf_dev_open" on storage.objects;
drop policy if exists "documentos_importacion_dev_open" on storage.objects;
drop policy if exists "facturas_pdf_auth" on storage.objects;
drop policy if exists "documentos_importacion_auth" on storage.objects;
create policy "facturas_pdf_auth" on storage.objects for all to authenticated
  using (bucket_id = 'facturas-pdf') with check (bucket_id = 'facturas-pdf');
create policy "documentos_importacion_auth" on storage.objects for all to authenticated
  using (bucket_id = 'documentos-importacion') with check (bucket_id = 'documentos-importacion');

notify pgrst, 'reload schema';
