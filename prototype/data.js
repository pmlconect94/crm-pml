// ============================================
// CRM Lizárraga — Mock data
// Business model:
//   PML (distribuidora): importa y compra producto del mar + compra maquila a Marlin,
//                        lo vende a clientes (retail, mayoristas, HORECA, export).
//   Marlin (productora): planta procesadora de pescado. Maquila EXCLUSIVAMENTE para PML.
//                        Su único cliente es PML.
// ============================================

window.CRM_DATA = {
  user: {
    name: "Carlos Lizárraga",
    email: "carlos@lizarraga.mx",
    initials: "CL",
    roles: {
      pml: ["administracion", "logistica", "rh"],
      marlin: ["administracion", "logistica", "rh"],
    },
  },

  companies: [
    {
      id: "pml",
      name: "Productos Marinos Lizárraga",
      short: "PML",
      tipo: "Distribuidora",
      tagline: "Importación, compra y distribución de productos del mar",
      color: "#0073E6",
      foundedYear: 1987,
      employees: 142,
      stats: {
        contenedoresMes: 18,
        ventasMes: "$48.2M",
        clientes: 312,
      },
    },
    {
      id: "marlin",
      name: "Marlin Lizárraga",
      short: "Marlin",
      tipo: "Productora — Planta de proceso",
      tagline: "Procesamiento y maquila de pescado — cliente único: PML",
      color: "#00A3FF",
      foundedYear: 2004,
      employees: 87,
      stats: {
        produccionMes: "412 ton",
        facturacionPML: "$26.8M",
        ordenesMaquila: 22,
      },
    },
  ],

  // ============================================
  // PML — Distribuidora
  // Flujos: importación de contenedores + compra local + compra de maquila a Marlin
  // ============================================

  // Contenedores que llegan a PML desde proveedores internacionales
  contenedores: {
    pml: [
      { id: "MSKU-7842199", naviera: "Maersk", producto: "Camarón blanco congelado", proveedor: "Promarisco (EC)", origen: "Guayaquil, EC", destino: "Manzanillo", eta: "2026-04-26", dias: 3, status: "En tránsito", peso: "26,400 kg", temp: "-18°C", progreso: 78, valor: "$412,800 USD" },
      { id: "HLXU-4458201", naviera: "Hapag-Lloyd", producto: "Atún aleta amarilla", proveedor: "Tuna Ecuador", origen: "Manta, EC", destino: "Manzanillo", eta: "2026-04-28", dias: 5, status: "En tránsito", peso: "24,100 kg", temp: "-20°C", progreso: 62, valor: "$388,200 USD" },
      { id: "CMAU-9923441", naviera: "CMA CGM", producto: "Langostino tigre", proveedor: "Minh Phu (VN)", origen: "Ho Chi Minh, VN", destino: "Lázaro Cárdenas", eta: "2026-05-02", dias: 9, status: "En tránsito", peso: "28,800 kg", temp: "-22°C", progreso: 38, valor: "$524,400 USD" },
      { id: "MSCU-3371008", naviera: "MSC", producto: "Camarón pacotilla", proveedor: "Pesquera Diamante (PE)", origen: "Lima, PE", destino: "Manzanillo", eta: "2026-05-04", dias: 11, status: "En tránsito", peso: "25,600 kg", temp: "-18°C", progreso: 25, valor: "$298,100 USD" },
      { id: "OOLU-8890112", naviera: "OOCL", producto: "Pulpo maya", proveedor: "Grupo Pinsa (MX)", origen: "Progreso, MX", destino: "Manzanillo", eta: "2026-05-07", dias: 14, status: "Zarpado", peso: "22,000 kg", temp: "-18°C", progreso: 12, valor: "$441,000 USD" },
      { id: "EGLV-2245677", naviera: "Evergreen", producto: "Calamar gigante", proveedor: "Dongwon (KR)", origen: "Busan, KR", destino: "Manzanillo", eta: "2026-05-12", dias: 19, status: "Zarpado", peso: "29,400 kg", temp: "-22°C", progreso: 5, valor: "$362,800 USD" },
    ],
    // Marlin no recibe contenedores de importación — compra pesca local de flotas mexicanas
    marlin: [],
  },

  // ============================================
  // Marlin — Productora
  // Recibe materia prima (pesca local) y procesa. Única salida: maquila a PML.
  // ============================================

  // Órdenes de maquila activas (Marlin → PML)
  ordenesMaquila: [
    { id: "OM-2026-042", producto: "Filete de marlín azul", presentacion: "Porciones 200g empacadas al vacío", cantidad: "8,400 kg", status: "En proceso", avance: 72, fechaEntrega: "2026-04-27", cliente: "PML — Centro de distribución CDMX" },
    { id: "OM-2026-041", producto: "Dorado HG", presentacion: "Entero eviscerado, 1.5-2 kg", cantidad: "12,200 kg", status: "En proceso", avance: 45, fechaEntrega: "2026-04-29", cliente: "PML — Almacén Manzanillo" },
    { id: "OM-2026-040", producto: "Pez vela ahumado", presentacion: "Rebanado en empaque premium 250g", cantidad: "3,600 kg", status: "Empaque", avance: 88, fechaEntrega: "2026-04-25", cliente: "PML — Export LA" },
    { id: "OM-2026-039", producto: "Atún aleta amarilla loin", presentacion: "Loin sashimi grade congelado", cantidad: "6,800 kg", status: "Programada", avance: 0, fechaEntrega: "2026-05-03", cliente: "PML — Export Tokio" },
    { id: "OM-2026-038", producto: "Marlín rayado", presentacion: "Filete porcionado 180g", cantidad: "5,200 kg", status: "Terminada", avance: 100, fechaEntrega: "2026-04-22", cliente: "PML — CDMX" },
  ],

  // Materia prima recibida en planta Mazatlán (de flotas pesqueras)
  materiaPrima: [
    { fecha: "2026-04-23", especie: "Marlín azul", kg: "4,200", proveedor: "Flota Pesquera Cortés", embarcacion: "Mar Azul III", calidad: "A" },
    { fecha: "2026-04-23", especie: "Dorado", kg: "6,800", proveedor: "Pesca del Pacífico", embarcacion: "Capitán Luis", calidad: "A" },
    { fecha: "2026-04-22", especie: "Atún aleta amarilla", kg: "3,400", proveedor: "Flota Pesquera Cortés", embarcacion: "Triton", calidad: "Sashimi" },
    { fecha: "2026-04-22", especie: "Pez vela", kg: "2,100", proveedor: "Cooperativa Mazatlán", embarcacion: "El Huracán", calidad: "A" },
    { fecha: "2026-04-21", especie: "Marlín rayado", kg: "3,800", proveedor: "Pesca del Pacífico", embarcacion: "Neptuno", calidad: "B" },
  ],

  // Embarques (Marlin solo envía a PML; PML despacha a clientes)
  embarques: {
    pml: [
      { id: "EMB-2841", ruta: "Manzanillo → CDMX", transportista: "Fletes del Pacífico", tipo: "Refrigerado", status: "En ruta", eta: "2026-04-24 14:00", carga: "18 tarimas — Camarón importado" },
      { id: "EMB-2840", ruta: "Manzanillo → Guadalajara", transportista: "TransMar", tipo: "Refrigerado", status: "En ruta", eta: "2026-04-24 09:30", carga: "12 tarimas — Atún" },
      { id: "EMB-2839", ruta: "Manzanillo → Monterrey", transportista: "Fletes del Pacífico", tipo: "Refrigerado", status: "Cargando", eta: "2026-04-25 11:00", carga: "20 tarimas — Langostino" },
      { id: "EMB-2838", ruta: "CDMX → Puebla", transportista: "LogiFresh", tipo: "Refrigerado", status: "Entregado", eta: "2026-04-23 08:00", carga: "8 tarimas — Pulpo" },
      { id: "EMB-MRL-IN-88", ruta: "Mazatlán (Marlin) → CDMX", transportista: "TransMar", tipo: "Refrigerado", status: "En ruta", eta: "2026-04-25 06:00", carga: "10 tarimas — Maquila OM-2026-041" },
    ],
    marlin: [
      { id: "MRL-OUT-2102", ruta: "Planta Mazatlán → PML CDMX", transportista: "TransMar", tipo: "Refrigerado", status: "En ruta", eta: "2026-04-25 06:00", carga: "OM-2026-041 · 12,200 kg Dorado HG" },
      { id: "MRL-OUT-2101", ruta: "Planta Mazatlán → PML Manzanillo", transportista: "Fletes del Pacífico", tipo: "Congelado", status: "En ruta", eta: "2026-04-24 18:00", carga: "OM-2026-042 · 8,400 kg Marlín porcionado" },
      { id: "MRL-OUT-2100", ruta: "Planta Mazatlán → PML Export LA", transportista: "LogiFresh", tipo: "Refrigerado", status: "Cargando", eta: "2026-04-25 10:00", carga: "OM-2026-040 · 3,600 kg Pez vela ahumado" },
    ],
  },

  almacenes: {
    pml: [
      { nombre: "Almacén Central — Manzanillo", tipo: "Frigorífico -25°C", ocupacion: 78, capacidad: "1,200 tarimas", entradas: 142, salidas: 98 },
      { nombre: "Almacén CDMX — Vallejo", tipo: "Refrigerado 0-4°C", ocupacion: 64, capacidad: "420 tarimas", entradas: 58, salidas: 71 },
      { nombre: "Almacén Guadalajara", tipo: "Refrigerado 0-4°C", ocupacion: 52, capacidad: "380 tarimas", entradas: 44, salidas: 39 },
      { nombre: "Almacén Monterrey", tipo: "Frigorífico -18°C", ocupacion: 41, capacidad: "510 tarimas", entradas: 33, salidas: 28 },
    ],
    marlin: [
      { nombre: "Cámara producto terminado", tipo: "Frigorífico -22°C", ocupacion: 69, capacidad: "860 tarimas", entradas: 88, salidas: 74 },
      { nombre: "Cámara materia prima", tipo: "Refrigerado 0-4°C", ocupacion: 55, capacidad: "340 tarimas", entradas: 42, salidas: 51 },
      { nombre: "Túneles de congelación", tipo: "Blast -35°C", ocupacion: 38, capacidad: "8 túneles", entradas: 22, salidas: 19 },
    ],
  },

  // ============================================
  // KPIs por empresa — diferenciados por modelo de negocio
  // ============================================
  adminKpis: {
    pml: [
      { label: "Ventas del mes", value: "$48.2M", delta: "+12.4%", up: true },
      { label: "Contenedores activos", value: "14", delta: "+3", up: true },
      { label: "Órdenes de venta abiertas", value: "87", delta: "-5", up: false },
      { label: "Clientes activos", value: "312", delta: "+8", up: true },
    ],
    marlin: [
      { label: "Producción del mes", value: "412 ton", delta: "+6.2%", up: true },
      { label: "Órdenes de maquila activas", value: "4", delta: "+1", up: true },
      { label: "Rendimiento de planta", value: "78%", delta: "+2.1pts", up: true },
      { label: "Facturación a PML", value: "$26.8M", delta: "+8.1%", up: true },
    ],
  },

  bancos: {
    pml: [
      { banco: "BBVA", cuenta: "MXN **** 2841", saldo: "$4,218,340.22", movimiento: "+$820,100", mov_up: true },
      { banco: "Banorte", cuenta: "USD **** 1902", saldo: "$612,400.00", movimiento: "-$48,200", mov_up: false },
      { banco: "Santander", cuenta: "MXN **** 7781", saldo: "$1,984,220.10", movimiento: "+$312,800", mov_up: true },
      { banco: "HSBC", cuenta: "USD **** 3349", saldo: "$228,910.00", movimiento: "+$64,400", mov_up: true },
    ],
    marlin: [
      { banco: "BBVA", cuenta: "MXN **** 5520", saldo: "$2,104,880.75", movimiento: "+$418,200", mov_up: true },
      { banco: "Banorte", cuenta: "MXN **** 7702", saldo: "$384,600.00", movimiento: "+$88,100", mov_up: true },
      { banco: "Santander", cuenta: "MXN **** 4412", saldo: "$894,220.00", movimiento: "-$120,400", mov_up: false },
    ],
  },

  eventos: {
    pml: [
      { hora: "08:12", titulo: "Llegada confirmada MSKU-7842199", detalle: "Camarón blanco — Manzanillo", tipo: "logistica" },
      { hora: "09:45", titulo: "Factura A-28411 liberada", detalle: "Mariscos del Mar S.A. — $284,100", tipo: "finanzas" },
      { hora: "10:20", titulo: "Nuevo cliente registrado", detalle: "Distribuidora La Perla (Tijuana)", tipo: "ventas" },
      { hora: "11:08", titulo: "Alta de empleado", detalle: "Ana Rivera — Coordinadora logística", tipo: "rh" },
      { hora: "13:30", titulo: "Pedido #8821 despachado", detalle: "20 tarimas — Grupo Pesquero Norte", tipo: "logistica" },
      { hora: "15:15", titulo: "Pago recibido", detalle: "Fresh Seafood Co. — $412,800", tipo: "finanzas" },
    ],
    marlin: [
      { hora: "06:30", titulo: "Recepción de materia prima", detalle: "Mar Azul III — 4,200 kg Marlín azul", tipo: "logistica" },
      { hora: "08:00", titulo: "Inicio OM-2026-042", detalle: "Filete de marlín — 8,400 kg programados", tipo: "produccion" },
      { hora: "10:50", titulo: "Producción del día cerrada", detalle: "Planta Mazatlán — 14,200 kg procesados", tipo: "produccion" },
      { hora: "12:05", titulo: "Factura M-1182 emitida a PML", detalle: "OM-2026-040 liberada — $412,800", tipo: "finanzas" },
      { hora: "14:22", titulo: "Embarque MRL-OUT-2102 salió", detalle: "12,200 kg Dorado → PML CDMX", tipo: "logistica" },
    ],
  },

  // ============================================
  // RH
  // ============================================
  rh: {
    pml: {
      headcount: 142,
      nuevos: 4,
      bajas: 1,
      porDepartamento: [
        { depto: "Logística", count: 54 },
        { depto: "Administración", count: 18 },
        { depto: "Ventas", count: 22 },
        { depto: "Cobranza", count: 9 },
        { depto: "Contabilidad", count: 12 },
        { depto: "RH", count: 6 },
        { depto: "Compras / Importación", count: 21 },
      ],
      pendientes: [
        { tipo: "Vacaciones", quien: "Luis Montoya", depto: "Logística", fecha: "28 abr – 5 may" },
        { tipo: "Incapacidad", quien: "María Gómez", depto: "Administración", fecha: "24 abr" },
        { tipo: "Permiso", quien: "Roberto Cázares", depto: "Ventas", fecha: "26 abr" },
        { tipo: "Contratación", quien: "Ana Rivera", depto: "Logística", fecha: "pendiente firma" },
      ],
      cumpleanios: [
        { nombre: "Fernanda López", depto: "Cobranza", fecha: "Hoy" },
        { nombre: "Daniel Quiroz", depto: "Logística", fecha: "Mañana" },
        { nombre: "Paola Esquivel", depto: "Ventas", fecha: "26 abr" },
      ],
    },
    marlin: {
      headcount: 87,
      nuevos: 2,
      bajas: 0,
      porDepartamento: [
        { depto: "Planta — Proceso", count: 38 },
        { depto: "Planta — Empaque", count: 14 },
        { depto: "Logística", count: 9 },
        { depto: "Administración", count: 8 },
        { depto: "Calidad / SQF", count: 6 },
        { depto: "Contabilidad", count: 5 },
        { depto: "RH", count: 3 },
        { depto: "Mantenimiento", count: 4 },
      ],
      pendientes: [
        { tipo: "Vacaciones", quien: "Jorge Beltrán", depto: "Planta — Proceso", fecha: "30 abr – 7 may" },
        { tipo: "Contratación", quien: "Elena Paredes", depto: "Calidad / SQF", fecha: "firma 25 abr" },
      ],
      cumpleanios: [
        { nombre: "Ricardo Núñez", depto: "Planta — Proceso", fecha: "Hoy" },
        { nombre: "Sofía Herrera", depto: "Administración", fecha: "27 abr" },
      ],
    },
  },
};
