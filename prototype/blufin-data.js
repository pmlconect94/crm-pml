// ============================================
// Blufin Seafood — Mock data
// Proveedor: Menita Comercial Oceánica (RFC MCO060711537)
// Contratos = órdenes de compra individuales (MCO-CV-XXXXXX)
// ============================================

window.BLUFIN_DATA = {
  supplier: {
    nombre: "Menita Comercial Oceánica",
    nombreInterno: "Blufin Seafood",
    rfc: "MCO060711537",
    domicilio: "Priv. Pino Suárez Bodegas No. 14, 15 y 20, Col. El Vigía, Zapopan, Jalisco, CP 45140",
    representante: "José Luis Aroche Martínez",
    emailFact: "facturacion@menita.com.mx",
    emailRep: "joseluis@menita.com.mx",
    cuentaUSD: "145320334710002023",
    swift: "BBSEMXMX",
    bancoUSD: "Banco Base SA",
    cuentaMXN: "646180228807100007",
    bancoMXN: "STP",
  },

  // Catálogos cerrados
  // Catálogo de SKUs del proveedor
  skus: [
    { code: "BLF-T001", desc: "TILAPIA FILLET 95% IQF",            kgCaja: 10.00, categoria: "Tilapia Filete" },
    { code: "BLF-T002", desc: "TILAPIA FILLET 5-7",                 kgCaja: 10.00, categoria: "Tilapia Filete" },
    { code: "BLF-T003", desc: "TILAPIA FILLET 3-5",                 kgCaja: 10.00, categoria: "Tilapia Filete" },
    { code: "BLF-T004", desc: "TILAPIA FILLET 2-3",                 kgCaja: 10.00, categoria: "Tilapia Filete" },
    { code: "BLF-T005", desc: "TILAPIA FILLET 7-9",                 kgCaja: 10.00, categoria: "Tilapia Filete" },
    { code: "BLF-T006", desc: "TILAPIA FILLET 3-5 GLAZE 60%",       kgCaja: 10.00, categoria: "Tilapia Filete" },
    { code: "BLF-W001", desc: "TILAPIA WHOLE FISH 350-550",          kgCaja: 10.00, categoria: "Tilapia Entera" },
    { code: "BLF-W002", desc: "TILAPIA WHOLE FISH 550-750",          kgCaja: 10.00, categoria: "Tilapia Entera" },
    { code: "BLF-W003", desc: "TILAPIA WHOLE FISH 100-200",          kgCaja: 10.00, categoria: "Tilapia Entera" },
    { code: "BLF-S001", desc: "VANNAMEI SHRIMP CPUD 41-50",          kgCaja:  5.00, categoria: "Camarón" },
    { code: "BLF-S002", desc: "FROZEN VANNAMEI SHRIMP CPUD",         kgCaja:  5.00, categoria: "Camarón" },
  ],

  catalogos: {
    marcasPropiasActivas: [
      "BLUFIN", "PML", "PANGABAY", "SELECTA", "MEKONG", "MEDITERRANEO",
      "TAMARINDO", "TIBURON DE ORO", "BLUFIN SANPEZ", "KAYFISH",
      "PANGA SANPEZ", "CHIAPANECO", "TIBURON"
    ],
    marcasTerceros: ["HUASTECA", "AQUAFISH", "MUZA", "LUV"],
    tallas: ["2-3", "3-5", "5-7", "7-9", "9-11", "100-200", "150-250", "200-300", "250-350", "350-550", "550-750"],
    porcentajes: ["40%", "60%", "70%", "80%", "85%", "90%", "95%", "100%"],
    bodegas: ["FRIOMEX", "JALNAY", "FRIZAJAL", "VASOKADI", "VIÑA DEL MAR"],
    presentaciones: ["Paletizado", "Granel"],
  },

  // Contratos existentes en el sistema (ya capturados previamente)
  contratos: [
    {
      folio: "MCO-CV-003542",
      fecha: "2026-04-08",
      lote: "L-2026-018",
      status: "Entregado",
      etaPuerto: "2026-05-04",
      etaBodega: "2026-05-11",
      llegadaReal: "2026-05-05",
      presentacion: "Paletizado",
      bodegaDestino: "FRIOMEX",
      contenedor: "TGHU-7782199",
      naviera: "COSCO",
      totalUSD: 68420.50,
      totalKg: 24000,
      anticipoUSD: 6842.05,
      anticipoFecha: "2026-04-15",
      anticipoPagado: true,
      saldoUSD: 61578.45,
      saldoFecha: "2026-04-29",
      saldoPagado: true,
      tcPonderado: 17.842,
      productos: [
        { desc: "FROZEN TILAPIA WHOLE FISH", marca: "BLUFIN", pct: "90%", talla: "350-550", kg: 12000, kgCaja: 10, cajas: 1200, precio: 2.030, total: 24360 },
        { desc: "FROZEN TILAPIA WHOLE FISH", marca: "BLUFIN", pct: "90%", talla: "550-750", kg: 12000, kgCaja: 10, cajas: 1200, precio: 2.090, total: 25080 },
      ],
    },
    {
      folio: "MCO-CV-003545",
      fecha: "2026-04-15",
      lote: "L-2026-019",
      status: "En tránsito",
      etaPuerto: "2026-05-22",
      etaBodega: "2026-05-29",
      presentacion: "Paletizado",
      bodegaDestino: "JALNAY",
      contenedor: "MSKU-8841033",
      naviera: "MAERSK",
      totalUSD: 78996.00,
      totalKg: 22700,
      anticipoUSD: 7899.60,
      anticipoFecha: "2026-04-22",
      anticipoPagado: true,
      saldoUSD: 71096.40,
      saldoFecha: "2026-06-05",
      saldoPagado: false,
      productos: [
        { desc: "FROZEN TILAPIA FILLET", marca: "BLUFIN", pct: "95%", talla: "5-7", kg: 17728.7, kgCaja: 4.54, cajas: 3905, precio: 3.480, total: 61695.88 },
        { desc: "FROZEN TILAPIA FILLET", marca: "BLUFIN", pct: "95%", talla: "3-5", kg: 4971.3, kgCaja: 4.54, cajas: 1095, precio: 3.480, total: 17300.12 },
      ],
      alertaFecha: { cambio: "+5 días", anterior: "2026-05-17" },
    },
    {
      folio: "MCO-CV-003547",
      fecha: "2026-04-22",
      lote: "L-2026-020",
      status: "En puerto",
      etaPuerto: "2026-05-18",
      etaBodega: "2026-05-25",
      llegadaReal: "2026-05-17",
      presentacion: "Paletizado",
      bodegaDestino: "FRIZAJAL",
      contenedor: "OOLU-3349221",
      naviera: "OOCL",
      totalUSD: 72898.10,
      totalKg: 22700,
      anticipoUSD: 7289.81,
      anticipoFecha: "2026-04-29",
      anticipoPagado: true,
      saldoUSD: 65608.29,
      saldoFecha: "2026-05-13",
      saldoPagado: false,
      productos: [
        { desc: "FROZEN TILAPIA FILLET", marca: "KAYFISH", pct: "90%", talla: "5-7", kg: 18001.1, kgCaja: 4.54, cajas: 3965, precio: 3.230, total: 58143.55 },
        { desc: "FROZEN TILAPIA FILLET", marca: "KAYFISH", pct: "90%", talla: "3-5", kg: 4698.9, kgCaja: 4.54, cajas: 1035, precio: 3.140, total: 14754.55 },
      ],
    },
    // ── TEST DATA — 5 contenedores para verificar cálculo de costo promedio ──
    // Producto: "TILAPIA FILLET 95% IQF" · BLUFIN · 5-7
    // Orden cronológico: TST-005 (más viejo) → TST-001 (más nuevo)
    //
    // Cont | kg     | USD/kg | TC     | MXN/kg
    // 001  | 10,000 | 3.5000 | 18.000 | 63.000  ← MÁS NUEVO
    // 002  |  8,000 | 3.4500 | 17.900 | 61.755
    // 003  | 12,000 | 3.4000 | 17.800 | 60.520
    // 004  | 15,000 | 3.3500 | 17.700 | 59.295
    // 005  | 10,000 | 3.3000 | 17.600 | 58.080  ← MÁS VIEJO
    // Total: 55,000 kg
    //
    // Ejemplos para verificar (nuevo → viejo):
    // 10,000 kg → solo cont 001 → $3.5000 · TC 18.0000 · $63.0000 MXN/kg
    // 18,000 kg → cont 001(10k) + cont 002(8k)
    //   avgUSD = (35,000+27,600)/18,000 = $3.4778 · avgTC = (180,000+143,200)/18,000 = 17.9556
    // 25,000 kg → cont 001(10k) + cont 002(8k) + cont 003(7k)
    //   avgUSD = (35,000+27,600+23,800)/25,000 = $3.4560 · avgTC = (180,000+143,200+124,600)/25,000 = 17.9120
    {
      folio: "TST-CV-001", fecha: "2026-05-15", lote: "L-TEST-001", status: "Entregado",
      etaPuerto: "2026-05-18", etaBodega: "2026-05-20",
      contenedor: "TEST-CONT-001", naviera: "COSCO",
      totalUSD: 35000, totalKg: 10000, tcPonderado: 18.000,
      anticipoUSD: 3500, anticipoFecha: "2026-05-15", anticipoPagado: true,
      saldoUSD: 31500, saldoFecha: "2026-05-20", saldoPagado: true,
      productos: [{ desc: "TILAPIA FILLET 95% IQF", marca: "BLUFIN", pct: "95%", talla: "5-7", kg: 10000, precio: 3.500, total: 35000 }],
    },
    {
      folio: "TST-CV-002", fecha: "2026-04-01", lote: "L-TEST-002", status: "Entregado",
      etaPuerto: "2026-04-08", etaBodega: "2026-04-10",
      contenedor: "TEST-CONT-002", naviera: "MAERSK",
      totalUSD: 27600, totalKg: 8000, tcPonderado: 17.900,
      anticipoUSD: 2760, anticipoFecha: "2026-04-01", anticipoPagado: true,
      saldoUSD: 24840, saldoFecha: "2026-04-10", saldoPagado: true,
      productos: [{ desc: "TILAPIA FILLET 95% IQF", marca: "BLUFIN", pct: "95%", talla: "5-7", kg: 8000, precio: 3.450, total: 27600 }],
    },
    {
      folio: "TST-CV-003", fecha: "2026-03-01", lote: "L-TEST-003", status: "Entregado",
      etaPuerto: "2026-03-03", etaBodega: "2026-03-05",
      contenedor: "TEST-CONT-003", naviera: "OOCL",
      totalUSD: 40800, totalKg: 12000, tcPonderado: 17.800,
      anticipoUSD: 4080, anticipoFecha: "2026-03-01", anticipoPagado: true,
      saldoUSD: 36720, saldoFecha: "2026-03-05", saldoPagado: true,
      productos: [{ desc: "TILAPIA FILLET 95% IQF", marca: "BLUFIN", pct: "95%", talla: "5-7", kg: 12000, precio: 3.400, total: 40800 }],
    },
    {
      folio: "TST-CV-004", fecha: "2026-01-28", lote: "L-TEST-004", status: "Entregado",
      etaPuerto: "2026-01-30", etaBodega: "2026-02-01",
      contenedor: "TEST-CONT-004", naviera: "EVERGREEN",
      totalUSD: 50250, totalKg: 15000, tcPonderado: 17.700,
      anticipoUSD: 5025, anticipoFecha: "2026-01-28", anticipoPagado: true,
      saldoUSD: 45225, saldoFecha: "2026-02-01", saldoPagado: true,
      productos: [{ desc: "TILAPIA FILLET 95% IQF", marca: "BLUFIN", pct: "95%", talla: "5-7", kg: 15000, precio: 3.350, total: 50250 }],
    },
    {
      folio: "TST-CV-005", fecha: "2026-01-07", lote: "L-TEST-005", status: "Entregado",
      etaPuerto: "2026-01-08", etaBodega: "2026-01-10",
      contenedor: "TEST-CONT-005", naviera: "MSC",
      totalUSD: 33000, totalKg: 10000, tcPonderado: 17.600,
      anticipoUSD: 3300, anticipoFecha: "2026-01-07", anticipoPagado: true,
      saldoUSD: 29700, saldoFecha: "2026-01-10", saldoPagado: true,
      productos: [{ desc: "TILAPIA FILLET 95% IQF", marca: "BLUFIN", pct: "95%", talla: "5-7", kg: 10000, precio: 3.300, total: 33000 }],
    },
    // ── FIN TEST DATA ─────────────────────────────────────────────────────────
    {
      folio: "MCO-CV-003548",
      fecha: "2026-04-28",
      lote: "L-2026-021",
      status: "Contratado",
      etaPuerto: "2026-06-15",
      etaBodega: "2026-06-22",
      presentacion: "Paletizado",
      bodegaDestino: "VASOKADI",
      contenedor: null,
      naviera: null,
      totalUSD: 132600.00,
      totalKg: 20000,
      anticipoUSD: 13260.00,
      anticipoFecha: "2026-05-05",
      anticipoPagado: true,
      saldoUSD: 119340.00,
      saldoFecha: "2026-06-30",
      saldoPagado: false,
      productos: [
        { desc: "FROZEN VANNAMEI SHRIMP CPUD", marca: "CHIAPANECO", pct: "70%", talla: "41-50", kg: 20000, kgCaja: 10, cajas: 2000, precio: 6.630, total: 132600 },
      ],
    },
  ],

  // Contratos extraídos del PDF subido (para flujo de carga masiva)
  // Reflejan el PDF real con 17 órdenes
  contratosExtraidos: [
    { folio: "MCO-CV-003549", fecha: "2026-05-12", etaPuerto: "2026-06-27", totalKg: 24000, totalUSD: 49440.00, anticipo: 4944.00, anticipoFecha: "2026-05-06", saldoFecha: "2026-06-22", domicilio: "ENTREGA GDL CON PALLETS", confidence: 0.98, productos: [{ desc: "TILAPIA WHOLE FISH 350-550", marca: "BLUFIN", talla: "350-550", kg: 12000, precio: 2.030, conf: 1.0 }, { desc: "TILAPIA WHOLE FISH 550-750", marca: "BLUFIN", talla: "550-750", kg: 12000, precio: 2.090, conf: 1.0 }] },
    { folio: "MCO-CV-003550", fecha: "2026-05-12", etaPuerto: "2026-06-22", totalKg: 22700, totalUSD: 75818.00, anticipo: 7581.80, anticipoFecha: "2026-05-08", saldoFecha: "2026-07-07", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.95, productos: [{ desc: "TILAPIA FILLET 5-7", marca: "PML", talla: "5-7", kg: 18001.1, precio: 3.340, conf: 1.0 }, { desc: "TILAPIA FILLET 3-5", marca: "PML", talla: "3-5", kg: 4698.9, precio: 3.340, conf: 1.0 }] },
    { folio: "MCO-CV-003551", fecha: "2026-05-12", etaPuerto: "2026-06-29", totalKg: 22700, totalUSD: 75818.00, anticipo: 7581.80, anticipoFecha: "2026-05-15", saldoFecha: "2026-07-14", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.96, productos: [{ desc: "TILAPIA FILLET 5-7", marca: "PML", talla: "5-7", kg: 18001.1, precio: 3.340, conf: 1.0 }, { desc: "TILAPIA FILLET 3-5", marca: "PML", talla: "3-5", kg: 4698.9, precio: 3.340, conf: 1.0 }] },
    { folio: "MCO-CV-003552", fecha: "2026-05-12", etaPuerto: "2026-06-22", totalKg: 22700, totalUSD: 78996.00, anticipo: 7899.60, anticipoFecha: "2026-05-08", saldoFecha: "2026-07-07", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.97, productos: [{ desc: "TILAPIA FILLET 5-7", marca: "BLUFIN", talla: "5-7", kg: 17728.7, precio: 3.480, conf: 1.0 }, { desc: "TILAPIA FILLET 3-5", marca: "BLUFIN", talla: "3-5", kg: 4971.3, precio: 3.480, conf: 1.0 }] },
    { folio: "MCO-CV-003553", fecha: "2026-05-12", etaPuerto: "2026-07-06", totalKg: 22700, totalUSD: 78996.00, anticipo: 7899.60, anticipoFecha: "2026-05-22", saldoFecha: "2026-07-21", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.94, productos: [{ desc: "TILAPIA FILLET 5-7", marca: "BLUFIN", talla: "5-7", kg: 17728.7, precio: 3.480, conf: 1.0 }, { desc: "TILAPIA FILLET 3-5", marca: "BLUFIN", talla: "3-5", kg: 4971.3, precio: 3.480, conf: 1.0 }] },
    // Esta tiene baja confianza para mostrar UX de campos amarillos/rojos
    { folio: "MCO-CV-003554", fecha: "2026-05-12", etaPuerto: "2026-06-29", totalKg: 24989.2, totalUSD: 68559.91, anticipo: 6855.99, anticipoFecha: "2026-05-08", saldoFecha: "2026-07-07", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.72, lowFields: ["productos.1.precio", "productos.1.kg"], productos: [
      { desc: "TILAPIA FILLET 2-3", marca: "BLUFIN", talla: "2-3", kg: 12000, precio: 3.190, conf: 1.0 },
      { desc: "TILAPIA FILLET 3-5 GLAZE 60%", marca: "BLUFIN", talla: "3-5", kg: 8989.2, precio: 1.860, conf: 0.62 },
      { desc: "TILAPIA FILLET 3-5", marca: "BLUFIN", talla: "3-5", kg: 4000, precio: 3.390, conf: 1.0 },
    ] },
    { folio: "MCO-CV-003555", fecha: "2026-05-12", etaPuerto: "2026-06-30", totalKg: 22700, totalUSD: 72898.10, anticipo: 7289.81, anticipoFecha: "2026-05-06", saldoFecha: "2026-06-25", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.99, productos: [{ desc: "TILAPIA FILLET 5-7", marca: "KAYFISH", talla: "5-7", kg: 18001.1, precio: 3.230, conf: 1.0 }, { desc: "TILAPIA FILLET 3-5", marca: "KAYFISH", talla: "3-5", kg: 4698.9, precio: 3.140, conf: 1.0 }] },
    { folio: "MCO-CV-003556", fecha: "2026-05-12", etaPuerto: "2026-07-06", totalKg: 22700, totalUSD: 72898.10, anticipo: 7289.81, anticipoFecha: "2026-05-22", saldoFecha: "2026-07-01", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.99, productos: [{ desc: "TILAPIA FILLET 5-7", marca: "KAYFISH", talla: "5-7", kg: 18001.1, precio: 3.230, conf: 1.0 }, { desc: "TILAPIA FILLET 3-5", marca: "KAYFISH", talla: "3-5", kg: 4698.9, precio: 3.140, conf: 1.0 }] },
    { folio: "MCO-CV-003558", fecha: "2026-05-12", etaPuerto: "2026-07-14", totalKg: 20000, totalUSD: 132600.00, anticipo: 13260.00, anticipoFecha: "2026-05-22", saldoFecha: "2026-07-29", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.96, productos: [{ desc: "VANNAMEI SHRIMP CPUD 41-50", marca: "EL CHIAPANECO", talla: "41-50", kg: 20000, precio: 6.630, conf: 1.0 }] },
    // Folio duplicado simulado (ya existe en sistema)
    { folio: "MCO-CV-003547", fecha: "2026-05-12", etaPuerto: "2026-06-15", totalKg: 22700, totalUSD: 72898.10, anticipo: 7289.81, anticipoFecha: "2026-05-22", saldoFecha: "2026-07-01", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.91, duplicate: true, productos: [{ desc: "TILAPIA FILLET 5-7", marca: "KAYFISH", talla: "5-7", kg: 18001.1, precio: 3.230, conf: 1.0 }, { desc: "TILAPIA FILLET 3-5", marca: "KAYFISH", talla: "3-5", kg: 4698.9, precio: 3.140, conf: 1.0 }] },
    { folio: "MCO-CV-003559", fecha: "2026-05-12", etaPuerto: "2026-07-20", totalKg: 24000, totalUSD: 50880.00, anticipo: 5088.00, anticipoFecha: "2026-05-25", saldoFecha: "2026-07-15", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.93, productos: [{ desc: "TILAPIA WHOLE FISH 350-550", marca: "BLUFIN SANPEZ", talla: "350-550", kg: 12000, precio: 2.080, conf: 1.0 }, { desc: "TILAPIA WHOLE FISH 550-750", marca: "BLUFIN SANPEZ", talla: "550-750", kg: 12000, precio: 2.160, conf: 1.0 }] },
    { folio: "MCO-CV-003560", fecha: "2026-05-12", etaPuerto: "2026-07-22", totalKg: 26000, totalUSD: 88400.00, anticipo: 8840.00, anticipoFecha: "2026-05-29", saldoFecha: "2026-07-29", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.97, productos: [{ desc: "TILAPIA FILLET 7-9", marca: "MEKONG", talla: "7-9", kg: 26000, precio: 3.400, conf: 1.0 }] },
    { folio: "MCO-CV-003561", fecha: "2026-05-12", etaPuerto: "2026-07-25", totalKg: 22000, totalUSD: 74360.00, anticipo: 7436.00, anticipoFecha: "2026-06-01", saldoFecha: "2026-08-02", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.95, productos: [{ desc: "TILAPIA FILLET 5-7", marca: "SELECTA", talla: "5-7", kg: 22000, precio: 3.380, conf: 1.0 }] },
    // Otra con baja confianza
    { folio: "MCO-CV-003562", fecha: "2026-05-12", etaPuerto: "2026-07-28", totalKg: 23800, totalUSD: 80920.00, anticipo: 8092.00, anticipoFecha: "2026-06-03", saldoFecha: "2026-08-05", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.78, lowFields: ["folio", "totalUSD"], productos: [{ desc: "TILAPIA FILLET 3-5", marca: "BLUFIN", talla: "3-5", kg: 23800, precio: 3.400, conf: 0.84 }] },
    { folio: "MCO-CV-003563", fecha: "2026-05-12", etaPuerto: "2026-08-01", totalKg: 20000, totalUSD: 67800.00, anticipo: 6780.00, anticipoFecha: "2026-06-08", saldoFecha: "2026-08-09", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.98, productos: [{ desc: "TILAPIA FILLET 5-7", marca: "MEDITERRANEO", talla: "5-7", kg: 20000, precio: 3.390, conf: 1.0 }] },
    { folio: "MCO-CV-003564", fecha: "2026-05-12", etaPuerto: "2026-08-03", totalKg: 18000, totalUSD: 30420.00, anticipo: 3042.00, anticipoFecha: "2026-06-10", saldoFecha: "2026-08-11", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.96, productos: [{ desc: "TILAPIA WHOLE FISH 100-200", marca: "TAMARINDO", talla: "100-200", kg: 18000, precio: 1.690, conf: 1.0 }] },
    { folio: "MCO-CV-003565", fecha: "2026-05-12", etaPuerto: "2026-08-08", totalKg: 24000, totalUSD: 81360.00, anticipo: 8136.00, anticipoFecha: "2026-06-15", saldoFecha: "2026-08-16", domicilio: "ZAPOPAN — MERCADO DEL MAR", confidence: 0.99, productos: [{ desc: "TILAPIA FILLET 5-7", marca: "TIBURON DE ORO", talla: "5-7", kg: 24000, precio: 3.390, conf: 1.0 }] },
  ],

  // KPIs del módulo
  kpis: [
    { label: "Contratos activos", value: "12", delta: "+3", up: true },
    { label: "Kg en tránsito", value: "284,400", delta: "+18%", up: true },
    { label: "USD comprometido", value: "$978,420", delta: "+$142K", up: true },
    { label: "Saldos por pagar", value: "$316,540", delta: "esta semana", up: false },
  ],

  // ============================================
  // PAGOS realizados — anticipos y saldos
  // ============================================
  pagos: [
    {
      id: "P-2026-0089",
      contrato: "MCO-CV-003542",
      tipo: "anticipo",
      montoUSD: 6842.05,
      tc: 17.420,
      montoMXN: 119189.71,
      fecha: "2026-04-15",
      banco: "MONEX",
      referencia: "TRF-88412",
      capturadoPor: "Ricardo Núñez",
    },
    {
      id: "P-2026-0094",
      contrato: "MCO-CV-003542",
      tipo: "saldo",
      montoUSD: 61578.45,
      tc: 18.040,
      montoMXN: 1110875.24,
      fecha: "2026-04-29",
      banco: "SANTANDER",
      referencia: "TRF-88712",
      capturadoPor: "Ricardo Núñez",
    },
    {
      id: "P-2026-0098",
      contrato: "MCO-CV-003545",
      tipo: "anticipo",
      montoUSD: 7899.60,
      tc: 17.820,
      montoMXN: 140771.07,
      fecha: "2026-04-22",
      banco: "MONEX",
      referencia: "TRF-89001",
      capturadoPor: "Ricardo Núñez",
    },
    {
      id: "P-2026-0103",
      contrato: "MCO-CV-003547",
      tipo: "anticipo",
      montoUSD: 7289.81,
      tc: 17.910,
      montoMXN: 130560.40,
      fecha: "2026-04-29",
      banco: "SANTANDER",
      referencia: "TRF-89205",
      capturadoPor: "Ricardo Núñez",
    },
    {
      id: "P-2026-0107",
      contrato: "MCO-CV-003548",
      tipo: "anticipo",
      montoUSD: 13260.00,
      tc: 18.120,
      montoMXN: 240271.20,
      fecha: "2026-05-05",
      banco: "MONEX",
      referencia: "TRF-89488",
      capturadoPor: "Ricardo Núñez",
    },
  ],

  // ============================================
  // FORWARDS — cierres de dólares para fecha futura
  // ============================================
  forwards: [
    {
      id: "FWD-2026-0012",
      contrato: "MCO-CV-003545",
      asociadoA: "saldo",
      montoUSD: 71096.40,
      tcForward: 18.250,
      montoMXN: 1297508.10,
      fechaCierre: "2026-05-12",
      fechaEntrega: "2026-06-05",
      banco: "MONEX",
      status: "Pendiente",
      capturadoPor: "Ricardo Núñez",
    },
    {
      id: "FWD-2026-0013",
      contrato: "MCO-CV-003547",
      asociadoA: "saldo",
      montoUSD: 65608.29,
      tcForward: 18.380,
      montoMXN: 1205880.37,
      fechaCierre: "2026-05-14",
      fechaEntrega: "2026-05-25",
      banco: "SANTANDER",
      status: "Pendiente",
      capturadoPor: "Ricardo Núñez",
    },
    {
      id: "FWD-2026-0014",
      contrato: "MCO-CV-003548",
      asociadoA: "saldo",
      montoUSD: 119340.00,
      tcForward: 18.420,
      montoMXN: 2198042.80,
      fechaCierre: "2026-05-19",
      fechaEntrega: "2026-06-15",
      banco: "MONEX",
      status: "Pendiente",
      capturadoPor: "Ricardo Núñez",
    },
    {
      id: "FWD-2026-0009",
      contrato: "MCO-CV-003542",
      asociadoA: "saldo",
      montoUSD: 61578.45,
      tcForward: 18.040,
      montoMXN: 1110875.24,
      fechaCierre: "2026-04-22",
      fechaEntrega: "2026-04-29",
      banco: "SANTANDER",
      status: "Ejecutado",
      ejecutadoPagoId: "P-2026-0094",
      capturadoPor: "Ricardo Núñez",
    },
  ],

  // ============================================
  // RECEPCIONES DE MERCANCÍA
  // ============================================
  recepciones: [
    {
      id: "REC-2026-001",
      contrato: "MCO-CV-003542",
      fechaRecepcion: "2026-05-05",
      bodega: "FRIOMEX",
      entradaIntelisis: "EC-2026-4521",
      facturaRef: null,
      lineas: [
        {
          sku: "TWF-350-BLF",
          desc: "FROZEN TILAPIA WHOLE FISH · BLUFIN · 350-550",
          kgContratados: 12000,
          kgRecibidos: 12000,
          presentacionPactada: "Paletizado",
          presentacionRecibida: "Granel",
          diferencia: 0,
          observaciones: "Llegó a granel",
        },
        {
          sku: "TWF-550-BLF",
          desc: "FROZEN TILAPIA WHOLE FISH · BLUFIN · 550-750",
          kgContratados: 12000,
          kgRecibidos: 12000,
          presentacionPactada: "Paletizado",
          presentacionRecibida: "Granel",
          diferencia: 0,
          observaciones: "Llegó a granel",
        },
      ],
      ncGeneradas: ["NC-2026-001"],
      observacionesGenerales: "Contenedor TGHU-7782199 — ambos SKUs llegaron a granel.",
      capturadoPor: "Ricardo Núñez",
      createdAt: "2026-05-05T14:30:00",
    },
  ],

  // ============================================
  // NOTAS DE CRÉDITO
  // razones: presentacion | descuento | faltante
  // ============================================
  notasCredito: [
    {
      id: "NC-2026-001",
      folioInterno: "NC-0001",
      folioTimbrado: null,
      fechaEmision: "2026-05-05",
      razon: "presentacion",
      presentacionPactada: "Paletizado",
      presentacionRecibida: "Granel",
      descripcionDescuento: null,
      kgFacturados: null, kgRecibidos: null, kgFaltantes: null, precioPromedioUSD: null,
      contratoOrigen: "MCO-CV-003542",
      recepcionOrigen: "REC-2026-001",
      skuOrigen: "TWF-BLF",
      montoUSD: 850.00,
      tc: 18.040,
      montoMXN: 15334.00,
      status: "Pendiente",
      aplicaciones: [],
      saldoPendienteUSD: 850.00,
      nota: "Contenedor TGHU-7782199 llegó a granel a FRIOMEX. Contrato pactaba entrega paletizada. Generada automáticamente en recepción.",
      capturadoPor: "Ricardo Núñez",
      createdAt: "2026-05-05T14:32:00",
    },

    {
      id: "NC-2026-003",
      folioInterno: "NC-0002",
      folioTimbrado: "FBTF-A-0134-2026-00123",
      fechaEmision: "2026-04-30",
      razon: "descuento",
      presentacionPactada: null, presentacionRecibida: null,
      descripcionDescuento: "Descuento por volumen acumulado — acuerdo mayo 2026 con Menita Comercial",
      kgFacturados: null, kgRecibidos: null, kgFaltantes: null, precioPromedioUSD: null,
      contratoOrigen: "MCO-CV-003545",
      recepcionOrigen: null,
      skuOrigen: null,
      montoUSD: 500.00,
      tc: 17.820,
      montoMXN: 8910.00,
      status: "Aplicada",
      aplicaciones: [
        { id: "APL-001", contratoDestino: "MCO-CV-003545", montoUSD: 500.00, fecha: "2026-05-02", nota: "Descontado del saldo pendiente del mismo contrato", capturadoPor: "Ricardo Núñez", createdAt: "2026-05-02T10:15:00" },
      ],
      saldoPendienteUSD: 0,
      nota: "Acuerdo directo con José Luis Aroche — descuento por cierre de volumen mayo.",
      capturadoPor: "Ricardo Núñez",
      createdAt: "2026-04-30T11:00:00",
    },
  ],

  // ============================================
  // FACTURAS DEL PROVEEDOR
  // ============================================
  facturas: [
    {
      id: "FAC-2026-001",
      contratoAsociado: "MCO-CV-003545",
      fechaSubida: "2026-05-20",
      nombreArchivo: "factura_menita_MCO3545_may2026.pdf",
      proveedor: "Menita Comercial Oceánica",
      fechaFactura: "2026-05-18",
      folioFactura: "A-0134-2026-0008821",
      lineas: [
        {
          id: "LF-001",
          sku_factura: "TF-5/7-IQF-BLF-90",
          descripcion_factura: "TILAPIA FILLET IQF 5-7 OZ BLUFIN 90% GLAZE",
          kg_factura: 17728.7,
          precio_factura: 3.450,
          total_factura: 61134.02,
          sku_contrato: "TF5-7-BLF",
          descripcion_contrato: "FROZEN TILAPIA FILLET · BLUFIN · 95% · 5-7",
          kg_contrato: 17728.7,
          precio_contrato: 3.480,
          total_contrato: 61695.88,
          match: "diferente",
          diferencias: [
            { campo: "precio_usd_kg", valorContrato: 3.480, valorFactura: 3.450, delta: -0.030, tipo: "precio" },
            { campo: "descripcion", valorContrato: "FROZEN TILAPIA FILLET · BLUFIN · 95%", valorFactura: "TILAPIA FILLET IQF BLUFIN 90% GLAZE", tipo: "descripcion" },
          ],
          aceptado: null,
          notaRevision: "",
        },
        {
          id: "LF-002",
          sku_factura: "TF-3/5-IQF-BLF-90",
          descripcion_factura: "TILAPIA FILLET IQF 3-5 OZ BLUFIN 90% GLAZE",
          kg_factura: 4971.3,
          precio_factura: 3.480,
          total_factura: 17260.12,
          sku_contrato: "TF3-5-BLF",
          descripcion_contrato: "FROZEN TILAPIA FILLET · BLUFIN · 95% · 3-5",
          kg_contrato: 4971.3,
          precio_contrato: 3.480,
          total_contrato: 17300.12,
          match: "diferente",
          diferencias: [
            { campo: "descripcion", valorContrato: "FROZEN TILAPIA FILLET · BLUFIN · 95%", valorFactura: "TILAPIA FILLET IQF BLUFIN 90% GLAZE", tipo: "descripcion" },
          ],
          aceptado: true,
          notaRevision: "SKU renombrado por proveedor — mismo producto",
        },
      ],
      status: "Pendiente revisión",
      totalContrato: 78996.00,
      totalFactura: 78394.14,
      diferenciaMonto: -601.86,
      capturadoPor: "Ricardo Núñez",
      createdAt: "2026-05-20T09:15:00",
    },
  ],

  bancos: ["MONEX", "SANTANDER"],

  // TC de referencia del día (mock — vendría de API ExchangeRate-API)
  tcDelDia: 18.435,
};
