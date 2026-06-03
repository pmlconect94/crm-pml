-- ============================================
-- Exponer schema `crm` vía PostgREST + permisos + RLS dev
-- ============================================

-- Permisos para roles del Supabase (anon, authenticated, service_role)
grant usage on schema crm to anon, authenticated, service_role;
grant all on all tables    in schema crm to anon, authenticated, service_role;
grant all on all sequences in schema crm to anon, authenticated, service_role;
grant all on all functions in schema crm to anon, authenticated, service_role;
alter default privileges in schema crm grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema crm grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema crm grant all on functions to anon, authenticated, service_role;

-- Exponer schema en PostgREST. IMPORTANTE: revisar después en
-- Dashboard → Settings → API → "Exposed schemas" que `crm` aparezca.
alter role authenticator set pgrst.db_schemas = 'public,crm,storage,graphql_public';

-- RLS habilitado en todas las tablas del schema crm
alter table crm.empresas              enable row level security;
alter table crm.usuarios              enable row level security;
alter table crm.catalogo_sku          enable row level security;
alter table crm.bancos                enable row level security;
alter table crm.navieras              enable row level security;
alter table crm.bodegas               enable row level security;
alter table crm.agencias_importadoras enable row level security;
alter table crm.blufin_contratos          enable row level security;
alter table crm.blufin_contrato_productos enable row level security;
alter table crm.blufin_pagos              enable row level security;
alter table crm.blufin_forwards           enable row level security;
alter table crm.blufin_recepciones        enable row level security;
alter table crm.blufin_recepcion_lineas   enable row level security;
alter table crm.blufin_notas_credito      enable row level security;
alter table crm.blufin_nc_aplicaciones    enable row level security;
alter table crm.blufin_facturas           enable row level security;
alter table crm.blufin_factura_lineas     enable row level security;

-- Políticas abiertas DEV (endurecer cuando integremos auth real con Supabase Auth)
create policy "dev_open" on crm.empresas               for all using (true) with check (true);
create policy "dev_open" on crm.usuarios               for all using (true) with check (true);
create policy "dev_open" on crm.catalogo_sku           for all using (true) with check (true);
create policy "dev_open" on crm.bancos                 for all using (true) with check (true);
create policy "dev_open" on crm.navieras               for all using (true) with check (true);
create policy "dev_open" on crm.bodegas                for all using (true) with check (true);
create policy "dev_open" on crm.agencias_importadoras  for all using (true) with check (true);
create policy "dev_open" on crm.blufin_contratos           for all using (true) with check (true);
create policy "dev_open" on crm.blufin_contrato_productos for all using (true) with check (true);
create policy "dev_open" on crm.blufin_pagos               for all using (true) with check (true);
create policy "dev_open" on crm.blufin_forwards            for all using (true) with check (true);
create policy "dev_open" on crm.blufin_recepciones         for all using (true) with check (true);
create policy "dev_open" on crm.blufin_recepcion_lineas    for all using (true) with check (true);
create policy "dev_open" on crm.blufin_notas_credito       for all using (true) with check (true);
create policy "dev_open" on crm.blufin_nc_aplicaciones     for all using (true) with check (true);
create policy "dev_open" on crm.blufin_facturas            for all using (true) with check (true);
create policy "dev_open" on crm.blufin_factura_lineas      for all using (true) with check (true);

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
