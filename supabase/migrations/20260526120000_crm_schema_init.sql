-- ============================================
-- CRM Grupo Lizárraga — schema separado
-- Todas las tablas del CRM viven en schema `crm` para no colisionar
-- con otros sistemas que vivan en `public`.
-- ============================================

create schema if not exists crm;

-- ─── Empresas del grupo ──────────────────────────────────────────────
create table crm.empresas (
  id       text primary key,
  nombre   text not null,
  rfc      text,
  tipo     text,
  ciudad   text,
  activo   boolean default true
);

insert into crm.empresas values
  ('pml',    'Productos Marinos Lizárraga, S. de R.L. de C.V.', 'PML123456789', 'Distribuidora', 'Zapopan, Jalisco', true),
  ('marlin', 'Marlin Lizárraga, S. de R.L. de C.V.',           'MAR987654321', 'Productora',    'Zapopan, Jalisco', false);

-- ─── Usuarios ────────────────────────────────────────────────────────
create table crm.usuarios (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid references auth.users(id) on delete cascade,
  nombre        text not null,
  email         text unique not null,
  rol           text not null default 'vendedor',
  empresa_id    text references crm.empresas(id),
  activo        boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── Catálogo maestro de SKUs ────────────────────────────────────────
create table crm.catalogo_sku (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  text references crm.empresas(id),
  proveedor   text not null,
  code        text not null,
  descripcion text not null,
  categoria   text,
  kg_caja     numeric(8,3) not null,
  cajas_tipo  text,
  activo      boolean default true,
  created_at  timestamptz default now(),
  unique(empresa_id, proveedor, code)
);

-- ─── Catálogos de referencia ─────────────────────────────────────────
create table crm.bancos (
  id     serial primary key,
  nombre text not null unique
);
insert into crm.bancos (nombre) values ('MONEX'),('SANTANDER'),('BBVA'),('BANORTE'),('BANBAJIO'),('HSBC');

create table crm.agencias_importadoras (
  id           serial primary key,
  razon_social text not null,
  rfc          text,
  ciudad       text,
  activo       boolean default true
);
insert into crm.agencias_importadoras (razon_social, rfc) values
  ('LTP IMPORTACIONES', null),
  ('MAFA', null),
  ('AGENCIA ADUANAL PACIFICO', null),
  ('GLOBAL CUSTOMS MX', null);

create table crm.navieras (
  id     serial primary key,
  nombre text not null unique
);
insert into crm.navieras (nombre) values
  ('COSCO'),('HAPAG-LLOYD'),('MSC'),('MAERSK'),('EVERGREEN'),('CMA CGM'),('OOCL'),('CSAV');

create table crm.bodegas (
  id         serial primary key,
  nombre     text not null,
  ciudad     text,
  empresa_id text references crm.empresas(id)
);
insert into crm.bodegas (nombre, ciudad, empresa_id) values
  ('FRIOMEX',  'Guadalajara', 'pml'),
  ('JALNAY',   'Guadalajara', 'pml'),
  ('FRIZAJAL', 'Guadalajara', 'pml'),
  ('VASOKADI', 'Guadalajara', 'pml'),
  ('VIÑA DEL MAR', 'Guadalajara', 'pml'),
  ('ALMACEN GENERAL', 'Guadalajara', 'pml');
