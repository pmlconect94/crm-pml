-- ============================================
-- Catálogo de motivos de nómina (horas extra, bonos, destinos de viaje)
-- ============================================
-- OJO: esta migración toca el schema NOMINA (no crm) — es la primera tabla de
-- ese schema versionada en este repo (el resto lo administra la app de nómina
-- legada). Aplicada vía MCP el 2026-07-17.
--
-- Pedido del usuario: que los motivos/destinos se SELECCIONEN en vez de
-- teclearse (el histórico tiene el mismo destino escrito de 5 formas distintas:
-- León/Leon/leon/león…). Listas SEPARADAS por empresa (PML/MARLIN) y por tipo
-- ('horas_extra' | 'bono' | 'viaje' — viaje solo lo usa PML). Solo la etiqueta,
-- sin monto sugerido. Administrable en RH → Catálogos.

create table if not exists nomina.catalogo_motivos (
  id         uuid primary key default gen_random_uuid(),
  empresa    text not null check (empresa in ('PML','MARLIN')),
  tipo       text not null check (tipo in ('horas_extra','bono','viaje')),
  nombre     text not null,
  activo     boolean not null default true,
  created_at timestamptz default now(),
  -- Candado anti-duplicados (misma filosofía de la auditoría 2026-07-17)
  unique (empresa, tipo, nombre)
);

-- RLS: mismo patrón que las demás tablas de nomina (lec_/esc_ con get_user_rol)
alter table nomina.catalogo_motivos enable row level security;
create policy lec_catalogo_motivos on nomina.catalogo_motivos
  for select using (auth.role() = 'authenticated');
create policy esc_catalogo_motivos on nomina.catalogo_motivos
  for all using (get_user_rol() = any (array['admin'::text, 'editor'::text]));

grant all on nomina.catalogo_motivos to authenticated, service_role;

-- ── Semillas ──
-- Horas extra: la lista hardcodeada previa (MOTIVOS_TE de lib/nomina/calc.ts),
-- sembrada para ambas empresas (cada una puede desactivar/agregar después).
insert into nomina.catalogo_motivos (empresa, tipo, nombre)
select e, 'horas_extra', m
from unnest(array['PML','MARLIN']) e,
     unnest(array['Inventario','Descarga','Entregas local','Entregas 34','Entregas Higuerillas',
                  'Frigoríficos','Acomodo cámaras','Facturación','Junta','Planta','Desayuno']) m
on conflict do nothing;

-- Bonos PML (histórico depurado)
insert into nomina.catalogo_motivos (empresa, tipo, nombre)
select 'PML', 'bono', m from unnest(array[
  'Productividad mensual','Ventas','Horario caja','Líder remisión'
]) m on conflict do nothing;

-- Bonos MARLIN (histórico depurado: unificados typos y variantes)
insert into nomina.catalogo_motivos (empresa, tipo, nombre)
select 'MARLIN', 'bono', m from unnest(array[
  'Productividad mensual','Jefe de área','Jefe de almacén','Bono de fileteado',
  'Bono fileteado salmón','Líder de fileteado','Líder inyección','Auxiliar inyección',
  'Subida de tambos','Subida de tambos y descongelación','Lavado de parrillas','Parrillas',
  'Jefe de horneado','Auxiliar horneado','Bono de hornos','Líder salmón','Auxiliar administración'
]) m on conflict do nothing;

-- Destinos de viaje (solo PML; histórico depurado)
insert into nomina.catalogo_motivos (empresa, tipo, nombre)
select 'PML', 'viaje', m from unnest(array[
  'Aguascalientes','Atotonilco','Autlán','Capilla de Guadalupe','Celaya','Ciudad Guzmán',
  'Cocula','Colima','El Grullo','Guanajuato','Irapuato','La Angostura','León',
  'Loma de Zempoala','Magdalena','Monterrey','Morelia','Puerto Vallarta','Sahuayo',
  'Silao','Tepatitlán','Uruapan','Zapotlanejo'
]) m on conflict do nothing;
