-- ============================================
-- Carga masiva de contratos Blufin — zona de STAGING
-- ============================================
-- Flujo (decidido 2026-06-17): los PDFs de órdenes de compra de Menita se leen
-- y extraen en Cowork (sin costo de API extra), se cargan a estas tablas de
-- staging, el usuario los revisa/corrige en la pantalla "Carga masiva" del CRM
-- (tabla editable + buscador de SKU + badges de confianza/duplicado) y al
-- confirmar se PROMUEVEN a las tablas reales (blufin_contratos + productos).
-- Nada toca las tablas reales hasta que el usuario confirma.

-- Un lote = una carga (uno o varios PDFs procesados juntos)
create table if not exists crm.blufin_import_lotes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      text references crm.empresas(id),
  nombre          text not null,                 -- ej. "Carga 17-jun" o el nombre del PDF
  fuente          text,                          -- archivo(s) PDF de origen
  total_contratos int default 0,
  status          text not null default 'pendiente',  -- 'pendiente' | 'importado' | 'descartado'
  created_at      timestamptz default now()
);

-- Cada contrato (orden de compra) extraído del PDF, editable antes de importar
create table if not exists crm.blufin_import_contratos (
  id              uuid primary key default gen_random_uuid(),
  lote_id         uuid references crm.blufin_import_lotes(id) on delete cascade,
  empresa_id      text references crm.empresas(id),
  folio           text not null,
  fecha           date,
  eta_puerto      date,
  eta_bodega      date,                          -- = eta_puerto + 7d (estimada, editable)
  bodega_destino  text,                          -- texto libre del PDF (mapeable a crm.bodegas)
  presentacion    text default 'Paletizado',     -- 'Paletizado' | 'Granel'
  contenedor      text,                          -- normalmente null (viene del Calendario, no de la OC)
  total_usd       numeric(14,2),
  total_kg        numeric(12,3),
  anticipo_usd    numeric(14,2),
  anticipo_fecha  date,
  saldo_usd       numeric(14,2),
  saldo_fecha     date,
  observaciones   text,
  pdf_path        text,                          -- path del PDF individual en Storage (bucket documentos-importacion)
  duplicado       boolean default false,         -- true si el folio ya existe en crm.blufin_contratos
  status          text not null default 'pendiente',  -- 'pendiente' | 'importado' | 'omitido'
  contrato_id     uuid references crm.blufin_contratos(id),  -- contrato real creado al importar
  created_at      timestamptz default now()
);

create index if not exists idx_blufin_import_contratos_lote
  on crm.blufin_import_contratos(lote_id);

-- Renglones de producto de cada contrato extraído. Guarda los valores CRUDOS del
-- PDF (en inglés) + el SKU sugerido del catálogo (editable por el usuario).
create table if not exists crm.blufin_import_lineas (
  id                  uuid primary key default gen_random_uuid(),
  import_contrato_id  uuid references crm.blufin_import_contratos(id) on delete cascade,
  orden               int default 0,
  -- crudo del PDF
  descripcion_pdf     text,
  marca_pdf           text,
  talla_pdf           text,
  pct_pdf             text,
  kg_caja             numeric(8,3),
  kg                  numeric(12,3),
  cajas               int,
  precio_usd          numeric(10,4),
  total_usd           numeric(14,2),
  -- match contra el catálogo (sugerido por el parser, editable)
  sku_id              uuid references crm.catalogo_sku(id),
  match_confianza     text default 'sin_match',  -- 'alta' | 'media' | 'baja' | 'sin_match'
  created_at          timestamptz default now()
);

create index if not exists idx_blufin_import_lineas_contrato
  on crm.blufin_import_lineas(import_contrato_id);

-- Permisos (mismos roles que el resto del schema crm)
grant all on crm.blufin_import_lotes     to anon, authenticated, service_role;
grant all on crm.blufin_import_contratos to anon, authenticated, service_role;
grant all on crm.blufin_import_lineas    to anon, authenticated, service_role;

-- RLS + políticas dev_open (endurecer al integrar Supabase Auth, infra #3/#4)
alter table crm.blufin_import_lotes     enable row level security;
alter table crm.blufin_import_contratos enable row level security;
alter table crm.blufin_import_lineas    enable row level security;

create policy "dev_open" on crm.blufin_import_lotes     for all using (true) with check (true);
create policy "dev_open" on crm.blufin_import_contratos for all using (true) with check (true);
create policy "dev_open" on crm.blufin_import_lineas    for all using (true) with check (true);

-- Bucket de Storage para los PDFs individuales (un PDF por orden de compra).
-- Privado; se lee con URL firmada. Política dev_open mientras no haya auth real.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-importacion',
  'documentos-importacion',
  false,
  20971520, -- 20 MB
  array['application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "documentos_importacion_dev_open" on storage.objects;
create policy "documentos_importacion_dev_open"
  on storage.objects
  for all
  to public
  using (bucket_id = 'documentos-importacion')
  with check (bucket_id = 'documentos-importacion');

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
