-- Recepción Blufin: campos del prototipo que faltaban en la tabla base.
-- entrada_intelisis: número de entrada de compra en el ERP Intelisis
-- presentacion_recibida: presentación real del contenedor al recibir
--   (se compara contra blufin_contratos.presentacion para detectar diferencia)
alter table crm.blufin_recepciones
  add column if not exists entrada_intelisis text,
  add column if not exists presentacion_recibida text;
