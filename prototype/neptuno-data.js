// ============================================================
// Neptuno Seafood — Datos mock
// Proveedor: Neptuno Seafood, S.L. — Vigo, España
//
// Diferencias clave vs Camanchaca SA:
//   - Sin folio interno — la FACTURA es el identificador
//   - Sin planeación previa ni OC de referencia
//   - Se da de alta directo cuando llega la factura
//   - Todo en USD (sin importación separada — costo directo a bodega)
//   - Notas de crédito por descuento (simplificadas)
//
// ⚠️ Eliminar antes de producción — datos mock
// ============================================================

window.neptunoRefresh = () => window.dispatchEvent(new CustomEvent('nep-data-changed'));

window.NEPTUNO_DATA = {

  supplier: {
    nombre:      "Neptuno Seafood, S.L.",
    pais:        "México",
    ciudad:      "Av. de Todos los Santos 9105, Pacífico, Tijuana, Baja California",
    contacto:    "Rodrigo Fernández",
    email:       "rfernandez@neptunosfl.es",
    moneda:      "USD",
    web:         "neptunosfl.es",
  },

  skus: [
    { code: "NEP-001", desc: "Pez Espada Loin IQF",             kgCaja: 10.00, categoria: "Pez Espada" },
    { code: "NEP-002", desc: "Merluza Filete S/P IQF",          kgCaja: 10.00, categoria: "Merluza" },
    { code: "NEP-003", desc: "Merluza Entera Eviscerada IQF",   kgCaja: 15.00, categoria: "Merluza" },
    { code: "NEP-004", desc: "Bacalao Desalado Listo IQF",      kgCaja:  5.00, categoria: "Bacalao" },
    { code: "NEP-005", desc: "Bacalao Salado Tradicional",      kgCaja: 25.00, categoria: "Bacalao" },
    { code: "NEP-006", desc: "Pulpo Cocido Troceado IQF",       kgCaja: 10.00, categoria: "Pulpo" },
    { code: "NEP-007", desc: "Pulpo Entero Limpio IQF",         kgCaja: 15.00, categoria: "Pulpo" },
    { code: "NEP-008", desc: "Calamar Tubo Limpio IQF",         kgCaja: 10.00, categoria: "Calamar" },
    { code: "NEP-009", desc: "Calamar Anilla IQF",              kgCaja: 10.00, categoria: "Calamar" },
    { code: "NEP-010", desc: "Rape Cola IQF",                   kgCaja:  5.00, categoria: "Otros" },
  ],

  bancos: ["MONEX", "SANTANDER"],
  tcDelDia: 18.435, // ← mock; integrar Banxico en producción

  // ── Facturas ────────────────────────────────────────────────────────────────
  // Se crean directamente cuando llega la factura del proveedor.
  // No hay OC, folio interno ni planeación previa.
  // La factura# es el identificador único.
  //
  // status: "Pendiente" | "Parcial" | "Liquidada"
  // pagos:  uno o varios pagos en USD (completo o abonos)
  // nc:     notas de crédito por descuento (monto USD + motivo + fecha)
  facturas: [
    {
      facturaNum:       "NEP-2026-001",
      fechaFactura:     "2026-01-10",
      fechaVencimiento: "2026-02-09",
      status:           "Liquidada",
      totalUSD:         42800.00,
      totalKg:          8000,
      productos: [
        { code: "NEP-001", desc: "Pez Espada Loin IQF",    kgCaja: 10.00, cajas: 400, kg: 4000, precioUSD: 6.200, totalUSD: 24800.00 },
        { code: "NEP-006", desc: "Pulpo Cocido Troceado IQF", kgCaja: 10.00, cajas: 400, kg: 4000, precioUSD: 4.500, totalUSD: 18000.00 },
      ],
      pagos: [
        { id: "NPAG-001", monto: 42800, tc: 17.52, montoMXN: 749856, fecha: "2026-02-08", banco: "MONEX",     referencia: "TRF-NEP-001", tipo: "completo" },
      ],
      nc: [],
    },
    {
      facturaNum:       "NEP-2026-002",
      fechaFactura:     "2026-02-18",
      fechaVencimiento: "2026-03-20",
      status:           "Liquidada",
      totalUSD:         68400.00,
      totalKg:          12000,
      productos: [
        { code: "NEP-002", desc: "Merluza Filete S/P IQF",    kgCaja: 10.00, cajas:  600, kg:  6000, precioUSD: 5.800, totalUSD: 34800.00 },
        { code: "NEP-004", desc: "Bacalao Desalado Listo IQF", kgCaja:  5.00, cajas: 1000, kg:  5000, precioUSD: 6.720, totalUSD: 33600.00 },
        { code: "NEP-009", desc: "Calamar Anilla IQF",         kgCaja: 10.00, cajas:  100, kg:  1000, precioUSD: 0.000, totalUSD:     0.00 },
      ],
      pagos: [
        { id: "NPAG-002", monto: 38000, tc: 17.88, montoMXN: 679440, fecha: "2026-03-10", banco: "SANTANDER", referencia: "TRF-NEP-002", tipo: "abono" },
        { id: "NPAG-003", monto: 30400, tc: 17.90, montoMXN: 544160, fecha: "2026-03-19", banco: "SANTANDER", referencia: "TRF-NEP-003", tipo: "abono" },
      ],
      nc: [
        { id: "NC-NEP-001", montoUSD: 1200, motivo: "Merluza con presencia de hueso — descuento acordado", fecha: "2026-03-25", status: "Aplicada" },
      ],
    },
    {
      facturaNum:       "NEP-2026-003",
      fechaFactura:     "2026-03-29",
      fechaVencimiento: "2026-04-28",
      status:           "Liquidada",
      totalUSD:         54600.00,
      totalKg:          10000,
      productos: [
        { code: "NEP-007", desc: "Pulpo Entero Limpio IQF", kgCaja: 15.00, cajas: 400, kg: 6000, precioUSD: 5.100, totalUSD: 30600.00 },
        { code: "NEP-010", desc: "Rape Cola IQF",           kgCaja:  5.00, cajas: 800, kg: 4000, precioUSD: 6.000, totalUSD: 24000.00 },
      ],
      pagos: [
        { id: "NPAG-004", monto: 54600, tc: 18.05, montoMXN: 985530, fecha: "2026-04-27", banco: "MONEX", referencia: "TRF-NEP-004", tipo: "completo" },
      ],
      nc: [],
    },
    {
      facturaNum:       "NEP-2026-004",
      fechaFactura:     "2026-04-25",
      fechaVencimiento: "2026-05-25",
      status:           "Parcial",
      totalUSD:         89300.00,
      totalKg:          16000,
      productos: [
        { code: "NEP-001", desc: "Pez Espada Loin IQF",      kgCaja: 10.00, cajas:  500, kg:  5000, precioUSD: 6.400, totalUSD: 32000.00 },
        { code: "NEP-002", desc: "Merluza Filete S/P IQF",   kgCaja: 10.00, cajas:  600, kg:  6000, precioUSD: 6.100, totalUSD: 36600.00 },
        { code: "NEP-008", desc: "Calamar Tubo Limpio IQF",  kgCaja: 10.00, cajas:  500, kg:  5000, precioUSD: 4.140, totalUSD: 20700.00 },
      ],
      pagos: [
        { id: "NPAG-005", monto: 50000, tc: 18.43, montoMXN: 921500, fecha: "2026-05-20", banco: "MONEX", referencia: "TRF-NEP-005", tipo: "abono" },
      ],
      nc: [],
    },
    {
      facturaNum:       "NEP-2026-005",
      fechaFactura:     "2026-05-20",
      fechaVencimiento: "2026-06-19",
      status:           "Pendiente",
      totalUSD:         61200.00,
      totalKg:          11000,
      productos: [
        { code: "NEP-005", desc: "Bacalao Salado Tradicional", kgCaja: 25.00, cajas: 200, kg: 5000, precioUSD: 7.200, totalUSD: 36000.00 },
        { code: "NEP-006", desc: "Pulpo Cocido Troceado IQF",  kgCaja: 10.00, cajas: 600, kg: 6000, precioUSD: 4.200, totalUSD: 25200.00 },
      ],
      pagos: [],
      nc: [],
    },
  ],
};
