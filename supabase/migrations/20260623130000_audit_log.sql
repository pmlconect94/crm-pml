-- Bitácora de auditoría: cada INSERT/UPDATE/DELETE de las tablas de movimiento
-- queda registrado con QUIÉN lo hizo (auth.uid() del usuario logueado, del JWT —
-- no se puede falsear desde el frontend), qué tabla, qué operación, el id del
-- registro y un snapshot de los datos.
create table if not exists crm.audit_log (
  id            bigint generated always as identity primary key,
  tabla         text not null,
  operacion     text not null,          -- INSERT | UPDATE | DELETE
  registro_id   text,
  usuario_id    uuid,                   -- auth.uid() (null si lo hizo un script/service_role)
  usuario_email text,
  datos         jsonb,                  -- NEW (insert/update) u OLD (delete)
  created_at    timestamptz not null default now()
);
create index if not exists idx_audit_log_tabla   on crm.audit_log (tabla, created_at desc);
create index if not exists idx_audit_log_usuario on crm.audit_log (usuario_id, created_at desc);

alter table crm.audit_log enable row level security;
drop policy if exists "auth_all" on crm.audit_log;
create policy "auth_all" on crm.audit_log for all to authenticated using (true) with check (true);

-- Función del trigger (security definer: escribe la bitácora sin importar el RLS
-- del que disparó el cambio).
create or replace function crm.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
declare
  v_email text;
  v_row   jsonb;
begin
  begin
    v_email := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email';
  exception when others then v_email := null;
  end;
  if (tg_op = 'DELETE') then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;

  insert into crm.audit_log (tabla, operacion, registro_id, usuario_id, usuario_email, datos)
  values (tg_table_name, tg_op, v_row ->> 'id', auth.uid(), v_email, v_row);

  if (tg_op = 'DELETE') then return old; else return new; end if;
end;
$$;

-- Atar el trigger a las tablas de movimiento de Blufin + catálogo.
do $$
declare t text;
declare tablas text[] := array[
  'blufin_contratos','blufin_contrato_productos','blufin_pagos','blufin_forwards',
  'blufin_recepciones','blufin_recepcion_lineas','blufin_notas_credito','blufin_nc_aplicaciones',
  'blufin_facturas','blufin_factura_lineas','catalogo_sku'
];
begin
  foreach t in array tablas loop
    execute format('drop trigger if exists trg_audit on crm.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on crm.%I for each row execute function crm.fn_audit()', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
