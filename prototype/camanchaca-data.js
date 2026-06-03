// ============================================================
// Camanchaca — Datos mock
// ...
// ============================================================

// Helper global para notificar cambios de datos a los componentes React
window.camRefresh = () => window.dispatchEvent(new CustomEvent('cam-data-changed'));

window.CAMANCHACA_DATA = {

  suppliers: {
    sa: {
      nombre:   "Salmones Camanchaca, S.A.",
      pais:     "Chile",
      ciudad:   "Diego Portales 2000, Puerto Montt, Los Lagos, Chile",
      vendedor: "Felipe Rodríguez Aránguiz",
      email:    "felipe.rodriguez@camanchaca.cl",
      moneda:   "USD",
    },
    mx: {
      nombre:      "Camanchaca México, S.A. de C.V.",
      rfc:         "CME190315XY2",
      ciudad:      "Ciudad de México",
      moneda:      "MXN",
      creditoDias: 30,
    },
  },

  // ── Catálogos ────────────────────────────────────────────────────────────────
  skus: [
    { code: "401005", categoria: "Salmón Reserva", desc: "Salmon Reserva Posta Nacional",        kgCaja: 10.00 },
    { code: "401004", categoria: "Salmón Premium", desc: "Salmon Premium Posta Nacional",        kgCaja: 14.00 },
    { code: "401003", categoria: "Salmón Premium", desc: "Salmon Premium Posta Nacional 15kg",   kgCaja: 15.00 },
    { code: "401002", categoria: "Salmón Café", desc: "Salmon cafe Posta Nacional 14kg",      kgCaja: 14.00 },
    { code: "401001", categoria: "Salmón Café", desc: "Salmon cafe Posta Nacional 15kg",      kgCaja: 15.00 },
    { code: "301017", categoria: "Ahumados", desc: "Salmon Ahumado CERMAQ Lonja",          kgCaja:  9.00 },
    { code: "202013", categoria: "Salmón Reserva", desc: "Salmon Reserva Posta Origen S/L",      kgCaja:  5.00 },
    { code: "202008", categoria: "Salmón Reserva", desc: "Salmon Reserva Posta Origen",          kgCaja:  5.00 },
    { code: "202007", categoria: "Salmón Reserva", desc: "Salmon Reserva 3/4",                   kgCaja: 10.00 },
    { code: "202006", categoria: "Salmón Premium", desc: "Salmon Premium Posta Origen",          kgCaja:  5.00 },
    { code: "202005", categoria: "Salmón Premium", desc: "Salmon Premium 4/5",                   kgCaja: 15.00 },
    { code: "202004", categoria: "Salmón Premium", desc: "Salmon Premium 3/4",                   kgCaja: 15.00 },
    { code: "202003", categoria: "Salmón Café", desc: "Salmon lonja cafe 4/5",                kgCaja: 15.00 },
    { code: "202002", categoria: "Salmón Café", desc: "Salmon lonja cafe 3/4",                kgCaja: 15.00 },
    { code: "202001", categoria: "Salmón Café", desc: "Salmon lonja cafe 2/3",                kgCaja: 15.00 },
  ],

  // Agencias importadoras que se contratan para gestionar la importación en Manzanillo
  importadoras: ["LTP IMPORTACIONES", "MAFA", "AGENCIA ADUANAL PACIFICO", "GLOBAL CUSTOMS MX"],
  bancos:       ["MONEX", "SANTANDER"],
  tcDelDia:     18.435,   // ← mock; integrar con Banxico / ExchangeRate-API en producción

  // ── SA: Órdenes planeadas ─────────────────────────────────────────────────
  // El vendedor en Chile manda un calendario vía WhatsApp con:
  //   OC (número de referencia que viene en factura), descripción estimada, kg estimados, llegada estimada
  // Esto se captura aquí ANTES de que llegue la factura real.
  // Cuando llega la factura, el status cambia a "confirmado" y se vincula con el folioInterno.
  ordenesPlaneadas: [
    { id: "OP-2026-001", ocProveedor: "63847", desc: "Salmon lonja premium",          kgEst: 15000, llegadaEst: "mediados febrero 2026", status: "confirmado", folioInterno: "CAM-001" },
    { id: "OP-2026-003", ocProveedor: "64102", desc: "Salmon Premium Posta",          kgEst: 22000, llegadaEst: "inicio abril 2026",      status: "confirmado", folioInterno: "CAM-003" },
    { id: "OP-2026-005", ocProveedor: "64578", desc: "Salmon lonja cafe",             kgEst: 18000, llegadaEst: "finales mayo 2026",       status: "confirmado", folioInterno: "CAM-005" },
    { id: "OP-2026-007", ocProveedor: "64612", desc: "Salmon Premium Posta Origen",   kgEst: 12000, llegadaEst: "mediados junio 2026",     status: "planeado",   folioInterno: null },
    { id: "OP-2026-009", ocProveedor: "64645", desc: "Salmon Reserva mixto",          kgEst:  8000, llegadaEst: "inicio julio 2026",       status: "planeado",   folioInterno: null },
  ],

  // ── SA: Contenedores con factura ─────────────────────────────────────────
  // Cada contenedor tiene:
  //   - folioInterno: asignado por PML (CAM-001, CAM-003, etc.)
  //   - ocProveedor:  referencia OC de Camanchaca Chile (viene en la factura)
  //   - factura:      número de factura del proveedor (null si solo planeado)
  //   - pagos:        uno o varios pagos en USD al proveedor (completo o abonos)
  //   - forwards:     cobertura cambiaria (TC fijo a futuro)
  //   - costoImportacion: pagos en MXN a agencias aduanales (LTP, MAFA, etc.)
  //                       Se suman al costo FOB para obtener el COSTO TOTAL INTERNADO
  //   - descuento:    NC simplificada (solo monto + motivo, sin flujo complejo)
  //
  // Fórmula costo total:
  //   tcEfectivo     = promedio ponderado de pagos reales | tcForward | tcDelDia
  //   costoFOBmxn    = totalUSD × tcEfectivo
  //   costoImpMXN    = Σ(costoImportacion[].montoMXN)
  //   costoTotalMXN  = costoFOBmxn + costoImpMXN
  //   costoKgMXN     = costoTotalMXN / totalKg
  contenedoresSA: [
    {
      folioInterno:   "CAM-001",
      ocProveedor:    "63847",
      factura:        "36512",
      fechaFactura:   "2026-01-15",
      status:         "Entregado",
      etaManzanillo:  "2026-02-10",
      etaBodega:      "2026-02-18",
      naviera:        "CSAV",
      totalUSD:        68450.00,
      totalKg:         15000,
      fechaVencimiento:"2026-03-10",
      productos: [
        { code: "202004", desc: "Salmon Premium 3/4",  kgCaja: 15.00, cajas: 600, kg:  9000, precioUSD: 4.850, totalUSD: 43650.00 },
        { code: "202007", desc: "Salmon Reserva 3/4",  kgCaja: 10.00, cajas: 600, kg:  6000, precioUSD: 4.133, totalUSD: 24800.00 },
      ],
      pagos: [
        { id: "CPAG-SA-001", monto: 68450, tc: 17.65, montoMXN: 1208124, fecha: "2026-02-20", banco: "MONEX", referencia: "TRF-76231", tipo: "completo" },
      ],
      forwards: [],
      costoImportacion: [
        { id: "IMP-001", razonSocial: "LTP IMPORTACIONES", montoMXN:  45000, pagado: true, fecha: "2026-02-16" },
        { id: "IMP-002", razonSocial: "MAFA",              montoMXN:  82000, pagado: true, fecha: "2026-02-16" },
      ],
      descuento: null,
      recepcion: {
        fecha: "2026-02-19", bodega: "FRIOMEX",
        lineas: [
          { code: "202004", kgContratados: 9000, kgRecibidos: 8975, diferencia: -25 },
          { code: "202007", kgContratados: 6000, kgRecibidos: 6000, diferencia:   0 },
        ],
      },
    },
    {
      folioInterno:   "CAM-003",
      ocProveedor:    "64102",
      factura:        "36768",
      fechaFactura:   "2026-03-08",
      status:         "Entregado",
      etaManzanillo:  "2026-04-02",
      etaBodega:      "2026-04-10",
      naviera:        "HAPAG-LLOYD",
      totalUSD:        112800.00,
      totalKg:         22000,
      fechaVencimiento:"2026-05-28",
      productos: [
        { code: "202004", desc: "Salmon Premium 3/4",           kgCaja: 15.00, cajas:  800, kg: 12000, precioUSD: 4.900, totalUSD:  58800.00 },
        { code: "401004", desc: "Salmon Premium Posta Nacional", kgCaja: 14.00, cajas:  500, kg:  7000, precioUSD: 7.711, totalUSD:  53977.00 },
        { code: "202013", desc: "Salmon Reserva Posta Origen S/L",kgCaja: 5.00, cajas: 600, kg:  3000, precioUSD: 0.008, totalUSD:     24.00 },
      ],
      pagos: [
        { id: "CPAG-SA-002", monto:  62000, tc: 17.92, montoMXN: 1111040, fecha: "2026-04-12", banco: "MONEX",     referencia: "TRF-89100", tipo: "abono" },
        { id: "CPAG-SA-003", monto:  50800, tc: 17.88, montoMXN:  908304, fecha: "2026-04-28", banco: "SANTANDER", referencia: "TRF-89234", tipo: "abono" },
      ],
      forwards: [],
      costoImportacion: [
        // Factura 36768: LTP $50,000 + MAFA $100,000 = $150,000 total importación
        { id: "IMP-003", razonSocial: "LTP IMPORTACIONES", montoMXN:  50000, pagado: true, fecha: "2026-04-08" },
        { id: "IMP-004", razonSocial: "MAFA",              montoMXN: 100000, pagado: true, fecha: "2026-04-08" },
      ],
      descuento: { montoUSD: 800, motivo: "Merma por temperatura en tránsito", fecha: "2026-04-15" },
      nc: [{ id:"NC-CAM-001", montoUSD: 800, motivo:"Merma por temperatura en tránsito", fecha:"2026-04-15", status:"Aplicada" }],
      recepcion: {
        fecha: "2026-04-11", bodega: "FRIOMEX",
        lineas: [
          { code: "202004", kgContratados: 12000, kgRecibidos: 11960, diferencia: -40 },
          { code: "401004", kgContratados:  7000, kgRecibidos:  7000, diferencia:   0 },
          { code: "202013", kgContratados:  3000, kgRecibidos:  3000, diferencia:   0 },
        ],
      },
    },
    {
      folioInterno:   "CAM-005",
      ocProveedor:    "64578",
      factura:        "36921",
      fechaFactura:   "2026-04-28",
      status:         "En tránsito",
      etaManzanillo:  "2026-05-28",
      etaBodega:      "2026-06-05",
      naviera:        "COSCO",
      totalUSD:        98640.00,
      totalKg:         18000,
      fechaVencimiento:"2026-07-05",
      productos: [
        { code: "202003", desc: "Salmon lonja cafe 4/5",    kgCaja: 15.00, cajas:  700, kg: 10500, precioUSD: 5.200, totalUSD: 54600.00 },
        { code: "202006", desc: "Salmon Premium Posta Origen",kgCaja: 5.00, cajas: 1500, kg:  7500, precioUSD: 5.872, totalUSD: 44040.00 },
      ],
      pagos: [],
      forwards: [
        { id: "FWD-CAM-001", montoUSD: 98640, tcForward: 17.75, montoMXN: 1750860, fechaCierre: "2026-04-30", fechaEntrega: "2026-06-10", banco: "MONEX", status: "Pendiente" },
      ],
      costoImportacion: [
        { id: "IMP-005", razonSocial: "LTP IMPORTACIONES", montoMXN:  52000, pagado: false, fecha: null },
        { id: "IMP-006", razonSocial: "MAFA",              montoMXN: 108000, pagado: false, fecha: null },
      ],
      descuento: null,
      nc: [],
      recepcion: null,
    },
    {
      folioInterno:   "CAM-007",
      ocProveedor:    "64612",
      factura:        null,   // planeado, sin factura aún
      fechaFactura:   null,
      status:         "Planeado",
      etaManzanillo:  "2026-06-15",
      etaBodega:      "2026-06-22",
      naviera:        null,
      totalUSD:       null,
      totalKg:        12000,  // estimado
      productos:      [],
      pagos:          [],
      forwards:       [],
      costoImportacion: [],
      descuento:      null,
      recepcion:      null,
    },
  ],

  // ── MX: Compras locales (facturas en MXN) ────────────────────────────────
  // Camanchaca México nos vende directamente con factura en MXN.
  // No hay planeación previa ni contrato — llega la factura, se captura.
  // Campos clave:
  //   entradaIntelisis: número de entrada de compra en el ERP Intelisis
  //   facturaNum:       folio de la factura del proveedor
  //   fechaVencimiento: fechaFactura + 30 días (crédito estándar)
  //   saldoPendiente:   totalMXN - Σ(pagos[].monto)
  //   pagos:            uno o varios abonos en MXN
  comprasMX: [
    {
      folioInterno:     "CAM-002",
      facturaNum:       "MX-8841",
      entradaIntelisis: "EI-2026-0234",
      fechaFactura:     "2026-01-20",
      fechaVencimiento: "2026-02-19",
      status:           "Liquidada",
      totalMXN:          284500,
      saldoPendiente:         0,
      productos: [
        { code: "401005", desc: "Salmon Reserva Posta Nacional",   kgCaja: 10.00, cajas: 120, kg: 1200, precioMXN: 148.75, totalMXN: 178500 },
        { code: "401001", desc: "Salmon cafe Posta Nacional 15kg", kgCaja: 15.00, cajas: 140, kg: 2100, precioMXN:  50.48, totalMXN: 106000 },
      ],
      pagos: [
        { id: "MX-PAG-001", monto: 200000, fecha: "2026-02-05", banco: "SANTANDER", referencia: "TRF-11234" },
        { id: "MX-PAG-002", monto:  84500, fecha: "2026-02-18", banco: "SANTANDER", referencia: "TRF-11456" },
      ],
    },
    {
      folioInterno:     "CAM-004",
      facturaNum:       "MX-9102",
      entradaIntelisis: "EI-2026-0412",
      fechaFactura:     "2026-03-15",
      fechaVencimiento: "2026-04-14",
      status:           "Liquidada",
      totalMXN:          196800,
      saldoPendiente:         0,
      productos: [
        { code: "401004", desc: "Salmon Premium Posta Nacional", kgCaja: 14.00, cajas: 200, kg: 2800, precioMXN: 70.29, totalMXN: 196800 },
      ],
      pagos: [
        { id: "MX-PAG-003", monto: 196800, fecha: "2026-04-10", banco: "MONEX", referencia: "TRF-22890" },
      ],
      nc: [],
    },
    {
      folioInterno:     "CAM-006",
      facturaNum:       "MX-9487",
      entradaIntelisis: "EI-2026-0589",
      fechaFactura:     "2026-04-22",
      fechaVencimiento: "2026-05-22",
      status:           "Parcial",
      totalMXN:          342000,
      saldoPendiente:    142000,
      productos: [
        { code: "401005", desc: "Salmon Reserva Posta Nacional", kgCaja: 10.00, cajas: 300, kg: 3000, precioMXN: 152.00, totalMXN: 228000 },
        { code: "301017", desc: "Salmon Ahumado CERMAQ Lonja",   kgCaja:  9.00, cajas: 200, kg: 1800, precioMXN:  63.33, totalMXN: 114000 },
      ],
      pagos: [
        { id: "MX-PAG-004", monto: 200000, fecha: "2026-05-10", banco: "SANTANDER", referencia: "TRF-33021" },
      ],
      nc: [],
    },
    {
      folioInterno:     "CAM-008",
      facturaNum:       "MX-9721",
      entradaIntelisis: "EI-2026-0712",
      fechaFactura:     "2026-05-18",
      fechaVencimiento: "2026-06-17",
      status:           "Pendiente",
      totalMXN:          185500,
      saldoPendiente:    185500,
      productos: [
        { code: "202004", desc: "Salmon Premium 3/4", kgCaja: 15.00, cajas: 370, kg: 5550, precioMXN: 33.42, totalMXN: 185500 },
      ],
      pagos: [],
      nc: [],
    },
  ],
};
