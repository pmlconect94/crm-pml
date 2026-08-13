-- Verificación real del estatus de un CFDI contra el SAT.
--
-- Hasta ahora `estatus_sat` era una CONSTANTE: el conector solo pide al SAT
-- comprobantes VIGENTES (descarga.py) y el extractor lo escribía a mano
-- ("estatus_sat": "vigente"), así que el semáforo Vigente/Cancelado de la app
-- nunca podía pintarse en rojo. Una factura que el proveedor cancela DESPUÉS de
-- descargada se quedaba marcada vigente para siempre.
--
-- Estas columnas guardan lo que contesta el servicio público de consulta del SAT
-- (ConsultaCFDIService, el mismo que hay detrás del QR de cualquier factura; no
-- requiere e.firma).
alter table crm.cont_facturas
  add column if not exists estatus_codigo        text,        -- CodigoEstatus crudo de la última consulta
  add column if not exists estatus_cancelacion   text,        -- EstatusCancelacion: 'Cancelado sin aceptación', 'En proceso'…
  add column if not exists es_cancelable         text,        -- EsCancelable: 'Cancelable sin aceptación' | 'No cancelable'…
  add column if not exists validacion_efos       text,        -- '200' = emisor NO está en la lista negra de EFOS
  add column if not exists estatus_verificado_at timestamptz; -- cuándo se le preguntó al SAT por última vez

comment on column crm.cont_facturas.estatus_sat is
  'vigente | cancelado. Solo lo cambia la verificación contra el SAT (sat_connector/estatus.py); el sync de descarga siempre nace vigente porque solo pide comprobantes vigentes.';
comment on column crm.cont_facturas.validacion_efos is
  '200 = el RFC del emisor no aparece en el listado definitivo de EFOS (art. 69-B CFF). Cualquier otro valor = factura en riesgo de no ser deducible.';

-- Rotación del verificador: primero las que nunca se han revisado, luego las más
-- rancias. Sin este índice cada corrida haría un seq scan de 15 mil filas.
create index if not exists cont_facturas_verificacion_idx
  on crm.cont_facturas (empresa_id, estatus_verificado_at nulls first);

-- Índice parcial para las alertas de la app (canceladas / EFOS): son pocas filas
-- entre miles, un índice completo sería desperdicio.
create index if not exists cont_facturas_no_vigentes_idx
  on crm.cont_facturas (empresa_id, fecha_emision desc)
  where estatus_sat <> 'vigente';
