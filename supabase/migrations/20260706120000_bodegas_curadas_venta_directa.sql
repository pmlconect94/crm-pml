-- ─────────────────────────────────────────────────────────────────────────────
-- Curar la lista de almacenes de PML a solo 5 + soporte de "Venta directa".
-- El usuario quiere que en Recepción solo se puedan elegir: MERCADO (default),
-- FRIZAJAL, JALNAY, VASOKADI y VENTA DIRECTA. Las demás bodegas se conservan
-- (las recepciones históricas las referencian por FK) pero se marcan activo=false
-- para que NO aparezcan en los dropdowns (fetchCatalogos filtra activo=true).
--
-- VENTA DIRECTA es un "destino" especial: cuando se elige, se captura a qué
-- cliente se vendió y la ciudad donde llegó (columnas nuevas en la recepción).
-- ─────────────────────────────────────────────────────────────────────────────

alter table crm.bodegas add column if not exists activo boolean not null default true;

-- Asegurar VENTA DIRECTA (MERCADO/FRIZAJAL/JALNAY/VASOKADI ya existen)
insert into crm.bodegas (nombre, ciudad, empresa_id, activo)
select 'VENTA DIRECTA', null, 'pml', true
where not exists (
  select 1 from crm.bodegas where empresa_id = 'pml' and nombre = 'VENTA DIRECTA'
);

-- Dejar activas solo las 5 (para pml); el resto se ocultan de los dropdowns.
update crm.bodegas
set activo = (nombre in ('MERCADO', 'FRIZAJAL', 'JALNAY', 'VASOKADI', 'VENTA DIRECTA'))
where empresa_id = 'pml';

-- Recepción: datos de venta directa (cliente + ciudad donde llegó)
alter table crm.blufin_recepciones add column if not exists venta_cliente text;
alter table crm.blufin_recepciones add column if not exists venta_ciudad text;

notify pgrst, 'reload schema';
