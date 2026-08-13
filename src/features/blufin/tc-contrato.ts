/**
 * ¿A qué tipo de cambio está un contenedor?
 *
 * Un contenedor se va "cerrando" en pesos por pedazos, no de golpe:
 *
 *   1. Cada **pago** ya hecho fijó su parte al TC del día en que se pagó.
 *   2. Cada **forward pendiente** fija su parte al TC pactado con el banco —
 *      todavía no se ejecuta, pero el precio ya está asegurado y no se va a
 *      mover. Es exactamente para eso que se contrata un forward.
 *   3. Lo que no cubre ninguno de los dos sigue expuesto: eso, y solo eso, se
 *      estima con el TC del día.
 *
 * Antes se pedía que el contenedor estuviera LIQUIDADO para dar un TC real, y
 * si no, se estimaba el total completo con el TC del día. Eso hacía que un
 * contenedor con el saldo ya cerrado por forward mostrara un precio que no era
 * el suyo (feedback del usuario 2026-08-13: "si con el forward ya lo estamos
 * asegurando"). El caso que lo destapó, MCO-CV-003627: anticipo de $7,786.10 a
 * 17.5813 + forward de $70,074.90 a 17.1381 = **cero exposición**, y aun así
 * salía estimado a 17.0534, unos $10 mil abajo de lo que de verdad va a costar.
 *
 * El TC que devuelve es el promedio ponderado por USD de esas tres fuentes, así
 * que un contenedor a medio cerrar da un número mucho más cercano a la realidad
 * que estimarlo todo — y sigue marcado como estimado mientras quede algo suelto.
 */

const EPS = 0.01;

export type OrigenTc = 'pagos' | 'forward' | 'mixto' | 'dia' | 'ponderado' | 'ninguno';

export type TcContrato = {
  /** Promedio ponderado por USD de pagos + forwards + (lo expuesto al TC del día). */
  tc: number | null;
  /** USD que todavía dependen del tipo de cambio. 0 = el costo ya no se mueve. */
  usdExpuesto: number;
  /** USD del contenedor asegurados con forwards pendientes. */
  usdForward: number;
  /** USD ya pagados. */
  usdPagado: number;
  /** true mientras quede algo expuesto: el total en pesos todavía puede cambiar. */
  estimado: boolean;
  origen: OrigenTc;
};

export type PagoTc = { monto_usd: number; tc: number };
/** Solo los forwards en status `Pendiente`: un `Ejecutado` ya se convirtió en
 *  pago (contarlo sería duplicarlo) y un `Remanente`/`Liberado`/`Movido a …` ya
 *  no asegura a este contenedor aunque siga apuntando a él. */
export type ForwardTc = { monto_usd: number | null; tc_forward: number | null };

export function tcContrato({
  totalUsd,
  ncAplicadoUsd = 0,
  pagos,
  forwardsPendientes,
  tcDia,
  tcPonderado = null,
}: {
  totalUsd: number;
  ncAplicadoUsd?: number;
  pagos: PagoTc[];
  forwardsPendientes: ForwardTc[];
  tcDia: number | null;
  tcPonderado?: number | null;
}): TcContrato {
  const usdPagado = pagos.reduce((s, p) => s + Number(p.monto_usd || 0), 0);
  const sumProdPagos = pagos.reduce((s, p) => s + Number(p.tc || 0) * Number(p.monto_usd || 0), 0);

  // Lo que de verdad hay que convertir a pesos: el total menos lo que una nota
  // de crédito ya perdonó (esos dólares nunca se cambian).
  const porCubrir = Math.max(0, totalUsd - ncAplicadoUsd);
  let restante = Math.max(0, porCubrir - usdPagado);

  // Un forward asegura como mucho lo que falta: si se pactó de más, el excedente
  // es de otro contenedor (o queda como remanente) y no abarata a este.
  let usdForward = 0;
  let sumProdForward = 0;
  for (const f of forwardsPendientes) {
    if (restante <= EPS) break;
    const tcF = Number(f.tc_forward ?? 0);
    if (!(tcF > 0)) continue;
    const usa = Math.min(Number(f.monto_usd || 0), restante);
    if (usa <= 0) continue;
    usdForward += usa;
    sumProdForward += tcF * usa;
    restante -= usa;
  }

  const usdExpuesto = Math.max(0, restante);
  const estimado = usdExpuesto > EPS;
  const base = { usdExpuesto, usdForward, usdPagado, estimado };

  // Nada fijado y sin TC del día: no hay con qué inventar un precio en pesos.
  if (usdPagado <= EPS && usdForward <= EPS) {
    if (tcDia != null) return { ...base, tc: tcDia, origen: 'dia' };
    if (tcPonderado != null) return { ...base, tc: Number(tcPonderado), origen: 'ponderado' };
    return { ...base, tc: null, origen: 'ninguno' };
  }

  // Hay parte fijada pero falta el TC del día para valuar el resto: se pondera
  // solo lo fijado. Sigue marcado como estimado — el resto no está resuelto.
  const denomFijado = usdPagado + usdForward;
  if (estimado && tcDia == null) {
    return { ...base, tc: (sumProdPagos + sumProdForward) / denomFijado, origen: 'mixto' };
  }

  const denom = denomFijado + usdExpuesto;
  const tc = (sumProdPagos + sumProdForward + usdExpuesto * (tcDia ?? 0)) / denom;

  let origen: OrigenTc;
  if (estimado) origen = 'mixto';
  else if (usdForward <= EPS) origen = 'pagos';
  else if (usdPagado <= EPS) origen = 'forward';
  else origen = 'mixto';

  return { ...base, tc, origen };
}

/** Texto corto que explica de dónde salió el TC, para el pie del total en pesos. */
export function explicaTc(r: TcContrato, fechaTcDia?: string | null): string {
  const dia = `TC del día${fechaTcDia ? ` ${fechaTcDia}` : ''}`;
  switch (r.origen) {
    case 'pagos':
      return 'promedio ponderado de pagos · liquidado';
    case 'forward':
      return 'TC del forward · asegurado con el banco';
    case 'mixto':
      return r.estimado
        ? `pagos y forwards + ${dia} para lo que falta · estimado`
        : 'pagos + forward · asegurado, ya no se mueve';
    case 'ponderado':
      return 'TC ponderado del contrato · estimado';
    case 'dia':
      return `${dia} · estimado hasta asegurar`;
    default:
      return '';
  }
}
