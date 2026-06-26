-- ─────────────────────────────────────────────────────────────────────────────
-- Neptuno Seafood (Tijuana, USD). El NÚMERO DE FACTURA es el identificador:
-- sin folio interno, sin planeación, sin naviera, con entrada Intelisis.
-- Reglas en CLAUDE.md §8. Mismo patrón que Blufin: RLS auth_all.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists crm.nep_facturas (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        text references crm.empresas(id),
  factura_num       text not null,
  entrada_intelisis text,
  fecha_factura     date not null,
  fecha_vencimiento date,
  status            text default 'Pendiente',   -- Pendiente | Parcial | Liquidada
  total_usd         numeric(14,2) not null,
  total_kg          numeric(12,3),
  saldo_usd         numeric(14,2),
  observaciones     text,
  capturado_por     uuid references crm.usuarios(id),
  created_at        timestamptz default now(),
  unique(empresa_id, factura_num)
);

create table if not exists crm.nep_factura_productos (
  id          uuid primary key default gen_random_uuid(),
  factura_id  uuid references crm.nep_facturas(id) on delete cascade,
  sku_id      uuid references crm.catalogo_sku(id),
  descripcion text,
  marca       text,
  pct         text,
  talla       text,
  kg_caja     numeric(8,3),
  cajas       int,
  kg          numeric(12,3),
  precio_usd  numeric(10,4),
  total_usd   numeric(14,2),
  orden       int
);

create table if not exists crm.nep_pagos (
  id            uuid primary key default gen_random_uuid(),
  factura_id    uuid references crm.nep_facturas(id),
  tipo          text not null,   -- completo | abono
  monto_usd     numeric(14,2) not null,
  tc            numeric(10,4) not null,
  monto_mxn     numeric(16,2),
  fecha         date not null,
  banco_id      int references crm.bancos(id),
  referencia    text,
  capturado_por uuid references crm.usuarios(id),
  created_at    timestamptz default now()
);

create table if not exists crm.nep_notas_credito (
  id         uuid primary key default gen_random_uuid(),
  factura_id uuid references crm.nep_facturas(id),
  monto_usd  numeric(14,2) not null,
  motivo     text not null,
  fecha      date not null,
  status     text default 'Aplicada',
  created_at timestamptz default now()
);

do $$
declare t text;
begin
  foreach t in array array[
    'nep_facturas','nep_factura_productos','nep_pagos','nep_notas_credito'
  ] loop
    execute format('alter table crm.%I enable row level security', t);
    execute format('drop policy if exists "auth_all" on crm.%I', t);
    execute format('create policy "auth_all" on crm.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
