-- `navieras` no tenía forma de retirar una sin borrarla, y borrarla rompería la
-- FK de los contratos/contenedores históricos que la referencian. Mismo patrón
-- que `bodegas.activo` (migración 20260706120000): se desactiva, no se borra.
alter table crm.navieras
  add column if not exists activo boolean not null default true;

comment on column crm.navieras.activo is
  'false = no se ofrece en los formularios de captura, pero se conserva por la FK de los embarques históricos.';
