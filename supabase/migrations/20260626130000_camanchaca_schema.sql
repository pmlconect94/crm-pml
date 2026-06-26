-- ─────────────────────────────────────────────────────────────────────────────
-- Salmones Camanchaca — SA (importación USD, Chile) + México (compras MXN)
-- Folio interno compartido CAM-001..N: impares = SA, pares = MX (secuencia).
-- Reglas de negocio en CLAUDE.md §7. Mismo patrón que Blufin: RLS auth_all.
-- ─────────────────────────────────────────────────────────────────────────────

create sequence if not exists crm.cam_folio_seq start 1;

create or replace function crm.next_cam_folio() returns text as $$
  select 'CAM-' || lpad(nextval('crm.cam_folio_seq')::text, 3, '0')
$$ language sql;

-- ── Órdenes planeadas (calendario de Felipe vía WhatsApp) ──────────────────────
create table if not exists crm.cam_ordenes_planeadas (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       text references crm.empresas(id),
  oc_proveedor     text not null,
  descripcion      text,
  kg_estimados     numeric(12,3),
  llegada_estimada text,
  status           text not null default 'planeado',  -- planeado | confirmado | cancelado
  folio_interno    text,
  capturado_por    uuid references crm.usuarios(id),
  created_at       timestamptz default now()
);

-- ── SA: Contenedores (importación USD) ─────────────────────────────────────────
create table if not exists crm.cam_contenedores_sa (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            text references crm.empresas(id),
  folio_interno         text unique not null default crm.next_cam_folio(),
  orden_planeada_id     uuid references crm.cam_ordenes_planeadas(id),
  oc_proveedor          text,
  factura               text,
  fecha_factura         date,
  fecha_vencimiento     date,
  status                text not null default 'Planeado',
    -- Planeado | En tránsito | En Manzanillo | Entregado
  eta_manzanillo        date,
  eta_bodega            date,                          -- = eta_manzanillo + 7d (editable)
  eta_bodega_confirmada boolean not null default false,
  naviera_id            int references crm.navieras(id),
  naviera               text,
  contenedor            text,
  lote                  text,
  presentacion          text,
  bodega_destino        text,
  llegada_real          date,
  entrada_intelisis     text,
  total_usd             numeric(14,2),
  total_kg              numeric(12,3),
  observaciones         text,
  capturado_por         uuid references crm.usuarios(id),
  created_at            timestamptz default now()
);

create table if not exists crm.cam_productos_sa (
  id            uuid primary key default gen_random_uuid(),
  contenedor_id uuid references crm.cam_contenedores_sa(id) on delete cascade,
  sku_id        uuid references crm.catalogo_sku(id),
  descripcion   text,
  marca         text,
  pct           text,
  talla         text,
  kg_caja       numeric(8,3),
  cajas         int,
  kg            numeric(12,3),
  precio_usd    numeric(10,4),
  total_usd     numeric(14,2),
  orden         int
);

-- Pagos SA (sin anticipos — completo o abonos). TC por pago = costo promedio.
create table if not exists crm.cam_pagos_sa (
  id            uuid primary key default gen_random_uuid(),
  contenedor_id uuid references crm.cam_contenedores_sa(id),
  tipo          text not null,  -- completo | abono
  monto_usd     numeric(14,2) not null,
  tc            numeric(10,4) not null,
  monto_mxn     numeric(16,2),
  fecha         date not null,
  banco_id      int references crm.bancos(id),
  referencia    text,
  capturado_por uuid references crm.usuarios(id),
  created_at    timestamptz default now()
);

create table if not exists crm.cam_forwards_sa (
  id            uuid primary key default gen_random_uuid(),
  contenedor_id uuid references crm.cam_contenedores_sa(id),
  monto_usd     numeric(14,2) not null,
  tc_forward    numeric(10,4) not null,
  monto_mxn     numeric(16,2),
  fecha_cierre  date,
  fecha_entrega date,
  banco_id      int references crm.bancos(id),
  status        text default 'Pendiente',  -- Pendiente | Ejecutado | Liberado
  capturado_por uuid references crm.usuarios(id),
  created_at    timestamptz default now()
);

-- Costo de importación (pagos MXN a agencias aduanales — múltiples por contenedor)
create table if not exists crm.cam_costo_importacion (
  id            uuid primary key default gen_random_uuid(),
  contenedor_id uuid references crm.cam_contenedores_sa(id),
  agencia_id    int references crm.agencias_importadoras(id),
  concepto      text,
  monto_mxn     numeric(14,2) not null,
  pagado        boolean default false,
  fecha         date,
  observaciones text,
  created_at    timestamptz default now()
);

create table if not exists crm.cam_recepcion_sa (
  id            uuid primary key default gen_random_uuid(),
  contenedor_id uuid references crm.cam_contenedores_sa(id) unique,
  fecha         date not null,
  bodega_id     int references crm.bodegas(id),
  entrada_intelisis text,
  presentacion_recibida text,
  observaciones text,
  capturado_por uuid references crm.usuarios(id),
  created_at    timestamptz default now()
);

create table if not exists crm.cam_recepcion_sa_lineas (
  id             uuid primary key default gen_random_uuid(),
  recepcion_id   uuid references crm.cam_recepcion_sa(id) on delete cascade,
  sku_id         uuid references crm.catalogo_sku(id),
  kg_contratados numeric(12,3) not null,
  kg_recibidos   numeric(12,3) not null,
  diferencia     numeric(12,3) generated always as (kg_recibidos - kg_contratados) stored,
  observaciones  text
);

-- NC por descuento SA (simplificada — monto USD + motivo, sin CFDI)
create table if not exists crm.cam_nc_sa (
  id            uuid primary key default gen_random_uuid(),
  contenedor_id uuid references crm.cam_contenedores_sa(id),
  monto_usd     numeric(14,2) not null,
  motivo        text not null,
  fecha         date not null,
  status        text default 'Aplicada',
  created_at    timestamptz default now()
);

-- ── MX: Compras (facturas en MXN, crédito 30 días) ─────────────────────────────
create table if not exists crm.cam_compras_mx (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        text references crm.empresas(id),
  folio_interno     text unique not null default crm.next_cam_folio(),
  factura_num       text not null,
  entrada_intelisis text,
  fecha_factura     date not null,
  fecha_vencimiento date,                              -- = fecha_factura + 30d
  status            text default 'Pendiente',          -- Pendiente | Parcial | Liquidada
  total_mxn         numeric(16,2) not null,
  saldo_pendiente   numeric(16,2),
  observaciones     text,
  capturado_por     uuid references crm.usuarios(id),
  created_at        timestamptz default now()
);

create table if not exists crm.cam_productos_mx (
  id         uuid primary key default gen_random_uuid(),
  compra_id  uuid references crm.cam_compras_mx(id) on delete cascade,
  sku_id     uuid references crm.catalogo_sku(id),
  descripcion text,
  marca      text,
  pct        text,
  talla      text,
  kg_caja    numeric(8,3),
  cajas      int,
  kg         numeric(12,3),
  precio_mxn numeric(10,4),
  total_mxn  numeric(16,2),
  orden      int
);

create table if not exists crm.cam_pagos_mx (
  id         uuid primary key default gen_random_uuid(),
  compra_id  uuid references crm.cam_compras_mx(id),
  monto      numeric(16,2) not null,
  fecha      date not null,
  banco_id   int references crm.bancos(id),
  referencia text,
  capturado_por uuid references crm.usuarios(id),
  created_at timestamptz default now()
);

create table if not exists crm.cam_nc_mx (
  id        uuid primary key default gen_random_uuid(),
  compra_id uuid references crm.cam_compras_mx(id),
  monto_mxn numeric(16,2) not null,
  motivo    text not null,
  fecha     date not null,
  status    text default 'Aplicada',
  created_at timestamptz default now()
);

-- ── RLS auth_all (solo authenticated) en todas las tablas nuevas ───────────────
do $$
declare t text;
begin
  foreach t in array array[
    'cam_ordenes_planeadas','cam_contenedores_sa','cam_productos_sa','cam_pagos_sa',
    'cam_forwards_sa','cam_costo_importacion','cam_recepcion_sa','cam_recepcion_sa_lineas',
    'cam_nc_sa','cam_compras_mx','cam_productos_mx','cam_pagos_mx','cam_nc_mx'
  ] loop
    execute format('alter table crm.%I enable row level security', t);
    execute format('drop policy if exists "auth_all" on crm.%I', t);
    execute format('create policy "auth_all" on crm.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
