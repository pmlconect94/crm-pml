-- Cambio de proveedor de vales de despensa: TOKA/EasyVale -> Efectivale
-- (decisión del usuario 2026-08-28). Se renombra la columna en vez de agregar
-- una nueva: los números de Toka ya no sirven para nada, y dejar las dos daría
-- pie a que alguien exporte con la equivocada.
--
-- ⚠️ Rompe la app VIEJA de nómina (nomina-empresa.vercel.app) si todavía
-- estuviera en uso: comparte esta misma base. El usuario lo aceptó
-- explícitamente al elegir el alcance completo.
alter table nomina.empleados rename column id_toka to id_efectivale;

comment on column nomina.empleados.id_efectivale is
  'Número de empleado en Efectivale (vales de despensa). Antes id_toka; el proveedor cambió en agosto 2026.';
