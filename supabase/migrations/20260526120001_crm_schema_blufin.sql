-- ============================================
-- Módulo Blufin Seafood (schema crm)
-- ============================================

create table crm.blufin_contratos (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       text references crm.empresas(id),
  folio            text unique not null,
  fecha            date,
  lote             text,
  status           text not null default 'Contratado',
  eta_puerto       date,
  eta_bodega       date,
  llegada_real     date,
  presentacion     text,
  bodega_destino   text,
  contenedor       text,
  naviera          text,
  total_usd        numeric(14,2),
  total_kg         numeric(12,3),
  anticipo_usd     numeric(14,2),
  anticipo_fecha   date,
  anticipo_pagado  boolean default false,
  saldo_usd        numeric(14,2),
  saldo_fecha      date,
  saldo_pagado     boolean default false,
  tc_ponderado     numeric(10,4),
  observaciones    text,
  created_at       timestamptz default now(),
  created_by       uuid references crm.usuarios(id),
  updated_at       timestamptz default now()
);

create index idx_crm_blufin_contratos_empresa    on crm.blufin_contratos(empresa_id);
create index idx_crm_blufin_contratos_status     on crm.blufin_contratos(status);
create index idx_crm_blufin_contratos_eta_bodega on crm.blufin_contratos(eta_bodega desc);

create table crm.blufin_contrato_productos (
  id           uuid primary key default gen_random_uuid(),
  contrato_id  uuid references crm.blufin_contratos(id) on delete cascade,
  sku_id       uuid references crm.catalogo_sku(id),
  descripcion  text,
  marca        text,
  pct          text,
  talla        text,
  kg           numeric(12,3),
  kg_caja      numeric(8,3),
  cajas        int,
  precio_usd   numeric(10,4),
  total_usd    numeric(14,2),
  orden        int default 0
);

create table crm.blufin_pagos (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid references crm.blufin_contratos(id),
  tipo          text not null,
  monto_usd     numeric(14,2) not null,
  tc            numeric(10,4) not null,
  monto_mxn     numeric(16,2),
  fecha         date not null,
  banco_id      int references crm.bancos(id),
  referencia    text,
  capturado_por uuid references crm.usuarios(id),
  created_at    timestamptz default now()
);

create table crm.blufin_forwards (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid references crm.blufin_contratos(id),
  asociado_a    text,
  monto_usd     numeric(14,2),
  tc_forward    numeric(10,4),
  monto_mxn     numeric(16,2),
  fecha_cierre  date,
  fecha_entrega date,
  banco_id      int references crm.bancos(id),
  status        text default 'Pendiente',
  capturado_por uuid references crm.usuarios(id),
  created_at    timestamptz default now()
);

create table crm.blufin_recepciones (
  id              uuid primary key default gen_random_uuid(),
  contrato_id     uuid references crm.blufin_contratos(id),
  fecha_recepcion date not null,
  bodega_id       int references crm.bodegas(id),
  observaciones   text,
  capturado_por   uuid references crm.usuarios(id),
  created_at      timestamptz default now()
);

create table crm.blufin_recepcion_lineas (
  id             uuid primary key default gen_random_uuid(),
  recepcion_id   uuid references crm.blufin_recepciones(id) on delete cascade,
  sku_id         uuid references crm.catalogo_sku(id),
  kg_contratados numeric(12,3) not null,
  kg_recibidos   numeric(12,3) not null,
  diferencia     numeric(12,3) generated always as (kg_recibidos - kg_contratados) stored,
  observaciones  text
);

create table crm.blufin_notas_credito (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          text references crm.empresas(id),
  folio_interno       text not null,
  folio_timbrado      text,
  razon               text not null,
  contrato_origen_id  uuid references crm.blufin_contratos(id),
  recepcion_origen_id uuid references crm.blufin_recepciones(id),
  monto_usd           numeric(14,2) not null,
  tc                  numeric(10,4),
  monto_mxn           numeric(16,2),
  status              text default 'Pendiente',
  saldo_pendiente_usd numeric(14,2),
  created_at          timestamptz default now()
);

create table crm.blufin_nc_aplicaciones (
  id                  uuid primary key default gen_random_uuid(),
  nc_id               uuid references crm.blufin_notas_credito(id),
  contrato_destino_id uuid references crm.blufin_contratos(id),
  monto_usd           numeric(14,2) not null,
  fecha               date not null,
  created_at          timestamptz default now()
);

create table crm.blufin_facturas (
  id               uuid primary key default gen_random_uuid(),
  contrato_id      uuid references crm.blufin_contratos(id),
  fecha_subida     date,
  nombre_archivo   text,
  storage_path     text,
  status           text default 'Pendiente revisión',
  total_contrato   numeric(14,2),
  total_factura    numeric(14,2),
  diferencia_monto numeric(14,2) generated always as (total_factura - total_contrato) stored,
  revisado_por     uuid references crm.usuarios(id),
  created_at       timestamptz default now()
);

create table crm.blufin_factura_lineas (
  id                   uuid primary key default gen_random_uuid(),
  factura_id           uuid references crm.blufin_facturas(id) on delete cascade,
  sku_factura          text,
  descripcion_factura  text,
  kg_factura           numeric(12,3),
  precio_factura       numeric(10,4),
  total_factura        numeric(14,2),
  sku_contrato         text,
  descripcion_contrato text,
  kg_contrato          numeric(12,3),
  precio_contrato      numeric(10,4),
  total_contrato       numeric(14,2),
  match                text,
  diferencias          jsonb,
  aceptado             boolean,
  nota_revision        text
);

create or replace function crm.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_crm_blufin_contratos_updated_at
before update on crm.blufin_contratos
for each row execute function crm.set_updated_at();

-- Seed SKUs Blufin
insert into crm.catalogo_sku (empresa_id, proveedor, code, descripcion, categoria, kg_caja) values
  ('pml', 'blufin', 'BLF-T001', 'TILAPIA FILLET 95% IQF',         'Tilapia Filete', 10.00),
  ('pml', 'blufin', 'BLF-T002', 'TILAPIA FILLET 5-7',             'Tilapia Filete', 10.00),
  ('pml', 'blufin', 'BLF-T003', 'TILAPIA FILLET 3-5',             'Tilapia Filete', 10.00),
  ('pml', 'blufin', 'BLF-T004', 'TILAPIA FILLET 2-3',             'Tilapia Filete', 10.00),
  ('pml', 'blufin', 'BLF-T005', 'TILAPIA FILLET 7-9',             'Tilapia Filete', 10.00),
  ('pml', 'blufin', 'BLF-T006', 'TILAPIA FILLET 3-5 GLAZE 60%',   'Tilapia Filete', 10.00),
  ('pml', 'blufin', 'BLF-W001', 'TILAPIA WHOLE FISH 350-550',     'Tilapia Entera', 10.00),
  ('pml', 'blufin', 'BLF-W002', 'TILAPIA WHOLE FISH 550-750',     'Tilapia Entera', 10.00),
  ('pml', 'blufin', 'BLF-W003', 'TILAPIA WHOLE FISH 100-200',     'Tilapia Entera', 10.00),
  ('pml', 'blufin', 'BLF-S001', 'VANNAMEI SHRIMP CPUD 41-50',     'Camarón',         5.00),
  ('pml', 'blufin', 'BLF-S002', 'FROZEN VANNAMEI SHRIMP CPUD',    'Camarón',         5.00);
