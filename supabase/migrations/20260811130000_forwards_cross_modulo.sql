-- ════════════════════════════════════════════════════════════════════════════
-- Mover un forward cambiario de un módulo a otro (2026-08-11)
--
-- Un forward es dinero pactado con el BANCO, no una propiedad del contenedor:
-- puede cerrarse pensando en Blufin y terminar usándose en Camanchaca o Neptuno.
-- Para que al moverlo aparezca del otro lado "por asignar" hacen falta 2 cosas:
--
--  1. `cam_forwards_sa` necesita `empresa_id` propio. Hoy la empresa se deriva
--     del contenedor con un INNER JOIN, así que un forward sin contenedor
--     asignado sería INVISIBLE en la pantalla.
--  2. Neptuno no tenía forwards. Se crea `nep_forwards` calcando el modelo de
--     Camanchaca, colgando de la factura (en Neptuno la factura ES el
--     identificador), con `factura_id` NULL = "por asignar".
--
-- Migración ADITIVA: no borra ni renombra nada. Rollback = drop de lo agregado.
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. Camanchaca SA: empresa propia + rastro de origen
-- ─────────────────────────────────────────────────────────────────────
alter table crm.cam_forwards_sa
  add column if not exists empresa_id    text references crm.empresas(id),
  -- De dónde llegó, si vino movido de otro módulo ('blufin' + folio del contrato).
  add column if not exists origen_modulo text,
  add column if not exists origen_ref    text;

-- Backfill: la empresa que ya tenía por el contenedor.
update crm.cam_forwards_sa f
set empresa_id = c.empresa_id
from crm.cam_contenedores_sa c
where c.id = f.contenedor_id and f.empresa_id is null;

-- Los que no tengan contenedor (no debería haber hoy) quedan en PML.
update crm.cam_forwards_sa set empresa_id = 'pml' where empresa_id is null;

-- Se deja NULLABLE a propósito: si algún insert viejo no manda empresa_id,
-- preferimos una fila con empresa vacía (rescatable) que un error en producción.
create index if not exists idx_cam_forwards_sa_empresa on crm.cam_forwards_sa (empresa_id, status);

comment on column crm.cam_forwards_sa.contenedor_id is
  'NULL = forward por asignar (normalmente movido desde otro módulo).';

-- ─────────────────────────────────────────────────────────────────────
-- 2. Neptuno: tabla de forwards (no existía)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists crm.nep_forwards (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    text references crm.empresas(id),
  -- NULL = por asignar. En Neptuno el forward cuelga de la FACTURA.
  factura_id    uuid references crm.nep_facturas(id),
  monto_usd     numeric(14,2) not null,
  tc_forward    numeric(10,4) not null,
  monto_mxn     numeric(16,2),
  fecha_cierre  date,
  fecha_entrega date,
  banco_id      int references crm.bancos(id),
  status        text default 'Pendiente',
  origen_modulo text,
  origen_ref    text,
  capturado_por uuid,
  created_at    timestamptz default now()
);

create index if not exists idx_nep_forwards_empresa on crm.nep_forwards (empresa_id, status);
create index if not exists idx_nep_forwards_factura on crm.nep_forwards (factura_id);

comment on column crm.nep_forwards.factura_id is
  'NULL = forward por asignar (normalmente movido desde otro módulo).';

alter table crm.nep_forwards enable row level security;
drop policy if exists "auth_all" on crm.nep_forwards;
create policy "auth_all" on crm.nep_forwards
  for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────
-- 3. Bitácora: mover dinero entre módulos tiene que quedar registrado
-- ─────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['nep_forwards', 'cam_forwards_sa'] loop
    execute format('drop trigger if exists trg_audit on crm.%I', t);
    execute format(
      'create trigger trg_audit after insert or update or delete on crm.%I for each row execute function crm.fn_audit()',
      t);
  end loop;
end $$;

notify pgrst, 'reload schema';
