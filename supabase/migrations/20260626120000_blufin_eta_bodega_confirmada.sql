-- ─────────────────────────────────────────────────────────────────────────────
-- crm.blufin_contratos.eta_bodega_confirmada
--
-- Hasta ahora "¿la ETA bodega es oficial o estimada?" se inferia comparando
-- fechas: si eta_bodega == eta_puerto + 7d se trataba como ESTIMADA (auto +7d),
-- y si no, como OFICIAL (ya programada). El problema: si el usuario programa la
-- llegada para el MISMO dia que el estimado (+7d), se confunde con el estimado
-- y el contenedor nunca se marca como "llegada programada" (no se pinta verde
-- ni se deshabilita el boton "Programar llegada").
--
-- Se agrega una bandera explicita que pone en true "Programar llegada".
-- Backfill: marcar como confirmada toda eta_bodega que HOY se consideraba
-- oficial (tiene eta_bodega y NO coincide con eta_puerto + 7d), para preservar
-- el comportamiento actual sin re-programar nada a mano.
-- ─────────────────────────────────────────────────────────────────────────────

alter table crm.blufin_contratos
  add column if not exists eta_bodega_confirmada boolean not null default false;

update crm.blufin_contratos
set eta_bodega_confirmada = true
where eta_bodega is not null
  and not (eta_puerto is not null and eta_bodega = eta_puerto + 7);
