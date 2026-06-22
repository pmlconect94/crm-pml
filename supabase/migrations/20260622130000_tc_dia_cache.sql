-- TC del día (USD->MXN) cacheado por fecha. Lo llena la Edge Function `tc-del-dia`
-- desde una API de tipo de cambio en vivo (frankfurter / open-er-api) y lo lee
-- Central de Costos para prellenar el "TC del día estimado". Una fila por día.
create table if not exists crm.tc_dia (
  fecha      date primary key,
  tc         numeric(10,4) not null,
  fuente     text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table crm.tc_dia enable row level security;
drop policy if exists "dev_open" on crm.tc_dia;
create policy "dev_open" on crm.tc_dia for all using (true) with check (true);

notify pgrst, 'reload schema';
