// ============================================================
// Lógica de cálculo de nómina (portada del sistema anterior).
// NOTA: hallazgos pendientes de revisión (ver CLAUDE.md → "Revisión de cálculos"):
//  - Retardos: hoy usa salario diario en vez de por-hora.
//  - Quincenal: usa matemática semanal (÷7 y séptimo min(,6)/6).
// Se corregirán en la fase F6.
// ============================================================

export const CODIGOS_ASISTENCIA = ['A', 'F', 'D', 'V', 'PSG', 'PCG', 'TXT', 'SUS', 'INC'];
export const MOTIVOS_TE = ['Inventario', 'Descarga', 'Entregas local', 'Entregas 34', 'Entregas Higuerillas', 'Frigoríficos', 'Acomodo cámaras', 'Facturación', 'Junta', 'Planta', 'Desayuno'];
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
// Tabulador de incentivos por tramo de hora de llegada (4 tramos):
//  0: 7am-3pm · 1: 3pm-7pm · 2: 7pm-11pm · 3: 11pm-7am.
export const TAB_CHOFER = [200, 400, 500, 600];
export const TAB_ACOMP = [100, 200, 300, 400];
export const DORMIR_EXTRA = 100; // "se quedó a dormir" suma $100 al último tabular

export function getTramo(horaStr?: string | null): number | null {
  if (!horaStr) return null;
  const [h, m] = horaStr.split(':').map(Number);
  const t = h * 60 + m;
  if (t >= 7 * 60 && t < 15 * 60) return 0;   // 7:00am – 3:00pm
  if (t >= 15 * 60 && t < 19 * 60) return 1;  // 3:00pm – 7:00pm
  if (t >= 19 * 60 && t < 23 * 60) return 2;  // 7:00pm – 11:00pm
  return 3;                                    // 11:00pm – 7:00am
}

export function calcIncentivos(horaLlegada?: string | null, dormir?: boolean) {
  const t = getTramo(horaLlegada);
  if (dormir) {
    // "Se quedó a dormir" = último tabular + $100 (tope) + el tabular de la HORA DE LLEGADA del
    // día siguiente. Ej.: tope (600+100)/(400+100) + (500/300 si llega 8pm) = 1200/800.
    const baseC = TAB_CHOFER[TAB_CHOFER.length - 1] + DORMIR_EXTRA;
    const baseA = TAB_ACOMP[TAB_ACOMP.length - 1] + DORMIR_EXTRA;
    const sigC = t !== null ? TAB_CHOFER[t] : 0;
    const sigA = t !== null ? TAB_ACOMP[t] : 0;
    return { chofer: baseC + sigC, acomp: baseA + sigA };
  }
  if (t === null) return { chofer: 0, acomp: 0 };
  return { chofer: TAB_CHOFER[t], acomp: TAB_ACOMP[t] };
}

export function descuentoPrestamoMonto(monto: number, _tipo?: string): number {
  // Descuento por nómina = 10% del monto, tanto semanal como quincenal.
  return monto * 0.1;
}

// retroactivo = incentivo de VIAJES retroactivos.
// horasExtraRetro = horas extra retroactivas (su monto se suma a la columna RETROACTIVO,
//   junto con el incentivo de viajes retro; NO a las horas extra normales).
export function calcularNomina(empleado: any, nomina: any, asistencias: any[], incentivosViaje: number, descuentoPrestamo: number, tipo: string = 'semanal', descuentoProducto: number = 0, bono: number = 0, retroactivo: number = 0, horasExtraRetro: number = 0) {
  const sdFiscal = empleado.sd_fiscal || 0; // semanal-equivalente (diario × 7)
  const sdReal = empleado.sd_real || 0;
  const dDR = sdReal / 7;   // sueldo diario real
  const dDF = sdFiscal / 7; // sueldo diario fiscal
  // SOLO MARLIN con el switch APAGADO (usar_sueldo_real=false): asistencia/séptimo/HE/retardos
  // se calculan con el sueldo FISCAL en vez del real. PML siempre usa el real.
  const esMarlin = empleado?.empresa === 'MARLIN';
  const usaFiscalBase = esMarlin && empleado?.usar_sueldo_real === false;
  const dBase = usaFiscalBase ? dDF : dDR; // diario base para asistencia/séptimo/HE/retardos
  // Montos del PERIODO (semana=7, quincena=15 días de sueldo).
  const divisorPeriodo = tipo === 'quincenal' ? 15 : 7;
  const sueldoFiscalPeriodo = dDF * divisorPeriodo;
  const sueldoRealPeriodo = dDR * divisorPeriodo;
  // Sin Alta IMSS: no hay parte fiscal (todo se paga en efectivo).
  const altaImss = empleado.alta_imss === true;
  // Montos BASE del periodo (lo que se pagaría con asistencia completa). Si no se capturaron, 10% del fiscal.
  // MARLIN con switch FISCAL: vales/previsión SIEMPRE se contemplan (aunque no tenga Alta IMSS → en efectivo).
  // PML / Marlin REAL: solo con Alta IMSS (si no, 0) y van en la PARTE FISCAL (no en el neto).
  const conVales = usaFiscalBase || altaImss;
  const valesBase = !conVales ? 0 : ((empleado.vales || 0) > 0 ? empleado.vales : sueldoFiscalPeriodo * 0.1);
  const prevBase = !conVales ? 0 : ((empleado.prevision_social || 0) > 0 ? empleado.prevision_social : sueldoFiscalPeriodo * 0.1);

  const dias = asistencias || [];
  // Trato de pago por incidencia (regla del usuario):
  //  NO restan → trato ASISTENCIA (se pagan): A, D, V, PCG, TXT.
  //  Restan    → trato FALTA (no se pagan):   F, PSG, SUS.
  //  El Descanso (D) se paga vía el SÉPTIMO día, por eso no entra en asistMonto (no se duplica).
  const COD_PAGA = ['A', 'V', 'PCG', 'TXT']; // pagan a tarifa diaria + cuentan para el séptimo
  const COD_FALTA = ['F', 'PSG', 'SUS', 'INC']; // restan (no se pagan): falta, permiso s/goce, suspensión, incapacidad
  const diasCuentan = dias.filter((d) => COD_PAGA.includes(d.codigo)).length;
  const diasA = diasCuentan;                 // días pagados como asistencia
  const diasV = dias.filter((d) => d.codigo === 'V').length;
  const diasD = dias.filter((d) => d.codigo === 'D').length;
  const diasF = dias.filter((d) => COD_FALTA.includes(d.codigo)).length;
  // Desglose de TODAS las incidencias capturadas (para KPIs). El detalle por día vive en `asistencias`.
  const incidencias = CODIGOS_ASISTENCIA.reduce((acc, c) => { acc[c] = dias.filter((d) => d.codigo === c).length; return acc; }, {} as Record<string, number>);
  const totalTEHrs = dias.reduce((s, d) => s + (parseFloat(d.te_horas) || 0), 0);
  // El retardo se captura directamente en HORAS (no minutos).
  const totalRetHrs = dias.reduce((s, d) => s + (parseFloat(d.retardo_min) || 0), 0);

  const asistMonto = diasCuentan * dBase;
  // Descansos pagados según el esquema y la EMPRESA (días de descanso por día trabajado):
  //  - QUINCENAL (PML y MARLIN IGUAL): 13 trabajo + 2 descanso = 15 → factor 2/13.
  //  - PML semanal:    6 trabajo + 1 descanso  → factor 1/6.
  //  - MARLIN semanal 5+2: 5 trabajo + 2 descanso → factor 2/5 (default).
  //  - MARLIN semanal 6+1: 6 trabajo + 1 descanso → factor 1/6 (empleado.dias_trabajo = 6).
  const descansoFactor = tipo === 'quincenal'
    ? (2 / 13)
    : (empleado?.empresa === 'MARLIN'
        ? (Number(empleado?.dias_trabajo) === 6 ? (1 / 6) : (2 / 5))
        : (1 / 6));
  // FACTOR del séptimo (días de descanso pagados) = días que cuentan × factor de descanso,
  // TOPADO para que (asistencia + séptimo) nunca pase los días del periodo (7 semana / 15 quincena).
  // Así, si alguien trabajó más días de su jornada (p. ej. en su descanso), el séptimo no infla el pago.
  // Ej. quincena, 14 días trabajados → 14×2/13=2.15, pero topado a 15−14=1 → total 15 días.
  const septimoDiasCalc = Math.max(0, Math.min(diasCuentan * descansoFactor, divisorPeriodo - diasCuentan));
  // El séptimo se puede corregir a mano en Fiscal: se captura el FACTOR (días), no el monto.
  const tieneSeptimoCorr = nomina?.septimo_corregido !== null && nomina?.septimo_corregido !== undefined && nomina?.septimo_corregido !== '';
  const septimoDias = tieneSeptimoCorr ? parseFloat(nomina.septimo_corregido) : septimoDiasCalc; // factor usado
  const septimo = dBase * septimoDias;                     // monto = sueldo diario × factor
  // Versión FISCAL de asistencia + séptimo (para el DEPÓSITO al banco). El depósito refleja el
  // sueldo FISCAL aunque el switch sea Real; así la diferencia real−fiscal cae al efectivo (como PML).
  const asistMontoFiscal = diasCuentan * dDF;
  const septimoFiscal = dDF * septimoDias;
  // Asistencias pagadas (en días) = días que cuentan + el factor de séptimo USADO (incluye la
  // corrección manual del séptimo). Con asistencia completa: 5+2 → 5+2=7, 6+1 → 6+1=7.
  const asistenciasPagadas = diasCuentan + septimoDias;
  // Vales y previsión se PRORRATEAN IGUAL QUE EL SUELDO: (base / díasPeriodo) × asistencias pagadas
  // = (base/7) × (días asistencia + factor séptimo). Lo que RESTA baja los vales/previsión.
  // Tope del 100% para que una sobre-captura no infle por encima del monto base.
  // Ej. incapacidad toda la semana → factor 0 → vales y previsión 0.
  const factorProrrateo = Math.min(1, asistenciasPagadas / divisorPeriodo);
  const vales = valesBase * factorProrrateo;
  const prevSocial = prevBase * factorProrrateo;
  const te = totalTEHrs * (dBase / 8) * 2;
  // Horas extra retroactivas: mismo cálculo (horas × valor hora × 2), pero cuenta en Retroactivo.
  const teRetroHrs = horasExtraRetro || 0;
  const teRetro = teRetroHrs * (dBase / 8) * 2;
  const primaFiscal = diasV > 0 ? dDF * diasV * 0.25 : 0;
  const primaEfectivo = diasV > 0 ? dDR * diasV * 0.25 : 0;
  const incentivos = incentivosViaje || 0;
  const retardoMonto = totalRetHrs * (dDR / 8); // SIEMPRE sobre el sueldo REAL (aunque el switch sea Fiscal); por hora (jornada 8h)
  const prestDesc = descuentoPrestamo || 0;

  const totalPerc = asistMonto + septimo + te + teRetro + incentivos + (bono || 0) + (retroactivo || 0)
    + (nomina?.comisiones || 0) + (nomina?.retroactivos || 0) + (nomina?.evaluacion || 0);

  const infonavit = parseFloat(nomina?.infonavit || empleado.infonavit || 0);
  const comedor = parseFloat(nomina?.comedor || 0);
  const totalDed = infonavit + comedor + retardoMonto + prestDesc + (descuentoProducto || 0);

  // --- Parte fiscal ---
  const isr = parseFloat(nomina?.isr || 0);
  const imss = parseFloat(nomina?.imss || 0);
  // Todas las deducciones (las del neto + ISR e IMSS). Sirve para el NETO (modelo fiscal).
  const dedTotalesFiscal = totalDed + isr + imss;
  // COMEDOR en el DEPÓSITO fiscal — depende de la EMPRESA (decisión del usuario 2026-07-16):
  //  - PML: el comedor SÍ baja el depósito fiscal (deducción normal al banco). Así el depósito
  //    del Resumen coincide con el que muestra la pestaña Fiscal (que ya lo restaba).
  //  - MARLIN: queda como estaba → el comedor NO baja el depósito, cae al EFECTIVO (el depósito
  //    no lo absorbe; el efectivo baja lo mismo, el neto total no cambia).
  const dedDeposito = esMarlin ? (dedTotalesFiscal - comedor) : dedTotalesFiscal;

  // NETO A PAGAR — depende del SWITCH (Marlin) / empresa:
  //  - Modo PML / Marlin REAL: percepciones − deducciones (vales/previsión y ISR/IMSS NO entran al
  //    neto; quedan intactos en la parte fiscal). Usa el sueldo REAL.
  //  - Modo Marlin FISCAL (usaFiscalBase): percepciones + vales + previsión − deducciones − ISR − IMSS
  //    (TODO entra al neto). Usa el sueldo FISCAL.
  // EL SWITCH Real/Fiscal (usaFiscalBase) MANDA TODO EL MODELO (solo Marlin):
  //  - FISCAL (prendido): vales + previsión SUMAN al neto y se restan ISR + IMSS. Usa sueldo fiscal.
  //    El Alta IMSS solo cambia la distribución: ON → depósito (banco+vales) + efectivo; OFF → todo efectivo.
  //  - REAL (apagado) / PML: modelo PML → neto = percepciones − deducciones (vales/prev/ISR/IMSS NO
  //    entran al neto; quedan en la PARTE FISCAL). Usa sueldo real; el depósito usa el fiscal completo.
  const modeloMarlin = usaFiscalBase && altaImss; // Marlin FISCAL + Alta IMSS ON: parte el depósito (banco+vales)
  const neto = usaFiscalBase
    ? (totalPerc + vales + prevSocial - dedTotalesFiscal)
    : (totalPerc - totalDed);
  // DEPÓSITO FISCAL (calculado) = sueldo + vales + previsión − todas las deducciones.
  //  - Marlin Alta IMSS: el sueldo del depósito es POR DÍAS TRABAJADOS en FISCAL (asistencia + séptimo
  //    fiscales), así BAJA con las faltas y NO usa el real → el efectivo absorbe la diferencia real−fiscal.
  //  - PML / Marlin sin Alta IMSS: usa el sueldo fiscal del periodo COMPLETO (las faltas no lo reducen).
  const sueldoDeposito = usaFiscalBase ? (asistMontoFiscal + septimoFiscal) : sueldoFiscalPeriodo;
  const depositoFiscal = altaImss ? (sueldoDeposito + vales + prevSocial - dedDeposito) : 0;
  // DEPÓSITO CORREGIDO: si se capturó un valor manual se usa ese; si no, el fiscal calculado.
  const tieneCorregido = nomina?.deposito_corregido !== null && nomina?.deposito_corregido !== undefined && nomina?.deposito_corregido !== '';
  const depositoCorregido = altaImss ? (tieneCorregido ? parseFloat(nomina.deposito_corregido) : depositoFiscal) : 0;

  // Si el Depósito corregido se pone en 0 (o menos) a mano → esta nómina va TODO EN EFECTIVO:
  // no se dispersan vales ni depósito a banco; el neto completo se paga en efectivo.
  const puroEfectivo = altaImss && tieneCorregido && depositoCorregido <= 0;
  // Distribución del pago. Sin Alta IMSS o puro efectivo: todo en efectivo (sin depósito ni vales).
  const depositoBanco = (!altaImss || puroEfectivo) ? 0 : (depositoCorregido - vales);
  const efectivo = altaImss ? (neto - depositoCorregido) : neto;

  return {
    dDR, dDF, dBase, usaFiscalBase, vales, prevSocial, valesBase, prevBase, sueldoFiscalPeriodo, sueldoRealPeriodo, altaImss,
    diasA, diasCuentan, diasV, diasD, diasF, septimoDias, septimoDiasCalc, asistenciasPagadas, incidencias, totalTEHrs, totalRetHrs,
    asistMonto, septimo, asistMontoFiscal, septimoFiscal, tieneSeptimoCorr, te, teRetro, teRetroHrs, primaFiscal, primaEfectivo,
    incentivos, retardoMonto, prestDesc, descuentoProducto: descuentoProducto || 0, bono: bono || 0,
    retroactivo: retroactivo || 0, retroactivoTotal: (retroactivo || 0) + teRetro,
    totalPerc, totalDed, neto, esMarlin, modeloMarlin,
    depositoFiscal, depositoCorregido, tieneCorregido,
    deposito: depositoCorregido, // compat: "depósito total" = el corregido (o el fiscal por defecto)
    depositoBanco, efectivo, puroEfectivo,
    valesPago: (altaImss && !puroEfectivo) ? vales : 0, // vales dispersados en tarjeta (0 si todo va en efectivo)
    infonavit, comedor, isr, imss,
    comisiones: parseFloat(nomina?.comisiones || 0),
    retroactivos: parseFloat(nomina?.retroactivos || 0),
  };
}

// ---- Utilidades de antigüedad / vacaciones (LFT 2023), para fase F4 ----
export function antiguedadAnios(fechaIngreso?: string | null): number {
  if (!fechaIngreso) return 0;
  const ing = new Date(fechaIngreso + 'T12:00:00');
  if (isNaN(ing.getTime())) return 0;
  const hoy = new Date();
  let a = hoy.getFullYear() - ing.getFullYear();
  const m = hoy.getMonth() - ing.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < ing.getDate())) a--;
  return Math.max(0, a);
}

// Días de vacaciones por año cumplido según LFT (reforma 2023).
export function diasVacacionesLFT(aniosCumplidos: number): number {
  if (aniosCumplidos < 1) return 12; // tabla nueva: 12 desde el primer año
  if (aniosCumplidos === 1) return 12;
  if (aniosCumplidos <= 5) return 12 + (aniosCumplidos - 1) * 2; // 14,16,18,20
  // a partir del 6º: +2 por cada bloque de 5 años
  return 20 + Math.floor((aniosCumplidos - 1) / 5) * 2;
}

// Factor de integración IMSS: (365 + aguinaldo(15) + díasVac*primaVac(25%)) / 365.
export function factorIntegracionSDI(aniosCumplidos: number): number {
  const diasVac = diasVacacionesLFT(aniosCumplidos);
  const aguinaldo = 15;
  const primaVac = 0.25;
  return Math.round(((365 + aguinaldo + diasVac * primaVac) / 365) * 10000) / 10000;
}

// SDI a partir del sueldo diario fiscal y la antigüedad.
export function calcSDI(sueldoDiarioFiscal: number, aniosCumplidos: number): number {
  return Math.round(sueldoDiarioFiscal * factorIntegracionSDI(aniosCumplidos) * 100) / 100;
}
