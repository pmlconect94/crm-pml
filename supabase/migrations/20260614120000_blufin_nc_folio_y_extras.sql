-- Notas de crédito: folio interno auto-consecutivo (NC-0001…) + columnas
-- de contexto (fecha de emisión y nota libre).
create sequence if not exists crm.blufin_nc_folio_seq;

create or replace function crm.next_blufin_nc_folio() returns text
  language sql as $$
  select 'NC-' || lpad(nextval('crm.blufin_nc_folio_seq')::text, 4, '0')
$$;

alter table crm.blufin_notas_credito
  alter column folio_interno set default crm.next_blufin_nc_folio(),
  add column if not exists fecha date,
  add column if not exists nota text;

alter table crm.blufin_nc_aplicaciones
  add column if not exists nota text;
