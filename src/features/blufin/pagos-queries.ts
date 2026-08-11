import { supabase } from '@/lib/supabase';
import type {
  BlufinPagoInsert,
  BlufinPagoEnriquecido,
  BlufinForwardInsert,
  BlufinForwardEnriquecido,
} from '@/types/database';

/**
 * Lista todos los pagos del módulo Blufin con info del contrato y banco asociados.
 * Ordenados del más reciente al más viejo (por fecha).
 */
export async function fetchPagos(empresaId: string): Promise<BlufinPagoEnriquecido[]> {
  const { data, error } = await supabase
    .from('blufin_pagos')
    .select(
      'id, contrato_id, tipo, monto_usd, tc, monto_mxn, fecha, banco_id, referencia, capturado_por, created_at, ' +
        'contrato:blufin_contratos!inner(folio, empresa_id, total_usd, anticipo_usd, saldo_usd), ' +
        'banco:bancos(nombre)',
    )
    .eq('contrato.empresa_id', empresaId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BlufinPagoEnriquecido[];
}

/**
 * Forwards cambiarios — uno por contrato puede asociarse a anticipo o saldo.
 */
export async function fetchForwards(empresaId: string): Promise<BlufinForwardEnriquecido[]> {
  const { data, error } = await supabase
    .from('blufin_forwards')
    .select(
      'id, contrato_id, asociado_a, monto_usd, tc_forward, monto_mxn, fecha_cierre, fecha_entrega, banco_id, status, capturado_por, created_at, ' +
        'contrato:blufin_contratos!inner(folio, empresa_id), ' +
        'banco:bancos(nombre)',
    )
    .eq('contrato.empresa_id', empresaId)
    .order('fecha_entrega', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as BlufinForwardEnriquecido[];
}

/**
 * Recalcula AMBOS flags del contrato a partir de los pagos registrados.
 * Única fuente de verdad — la usan create/delete/forward/pago múltiple.
 *
 * Regla de negocio: si el saldo quedó liquidado, el anticipo ya no está
 * pendiente aunque nunca se haya pagado por separado (se pagó directo
 * junto con el saldo).
 */
export async function recalcFlagsContrato(contratoId: string): Promise<void> {
  const estado = await leerEstadoPago(contratoId);
  if (!estado) return;
  const { saldoCubierto, anticipoCubierto } = cubiertos(estado);
  const { error } = await supabase
    .from('blufin_contratos')
    .update({ anticipo_pagado: anticipoCubierto, saldo_pagado: saldoCubierto })
    .eq('id', contratoId);
  if (error) throw error;
}

const EPS = 0.01;

/**
 * Vocabulario de `blufin_forwards.status`. La columna es `text` libre (sin CHECK
 * en BD), así que ESTA es la única fuente de verdad.
 *
 *  - `Pendiente`  cerrado con el banco y asignado a un contenedor; se puede ejecutar.
 *  - `Ejecutado`  ya se convirtió en pago; no se toca.
 *  - `Remanente`  sobró al ejecutarlo contra un saldo menor. Sigue vivo con el banco
 *                 y se puede asignar a otro contenedor.
 *  - `Liberado`   el contenedor se pagó spot, así que dejó de estar asignado.
 *  - `Usado en …` se aplicó fuera de Blufin (Camanchaca SA / Neptuno).
 */
export const FORWARDS_ASIGNABLES = new Set(['Pendiente', 'Liberado', 'Remanente']);

/** Motivo por el que un forward NO se puede mover (null = sí se puede). */
function porQueNoSeAsigna(status: string | null, folio?: string | null): string | null {
  if (FORWARDS_ASIGNABLES.has(status ?? '')) return null;
  if (status === 'Ejecutado') {
    return `Este forward ya se ejecutó y generó un pago${folio ? ` en ${folio}` : ''}. Para moverlo, primero elimina ese pago desde Realizados.`;
  }
  if (status?.startsWith('Usado en')) {
    return `Este forward está marcado como "${status}".`;
  }
  return `No se puede mover un forward en estado "${status ?? '—'}".`;
}

/**
 * Estado de pago de un contrato: targets de anticipo/saldo/total y lo
 * acumulado por tipo. Una sola lectura, reutilizable para validar y liberar.
 */
type EstadoPago = {
  anticipo_usd: number;
  saldo_usd: number;
  total_usd: number;
  acumAnticipo: number;
  acumSaldo: number;
  acumTotal: number;
  ncAplicado: number; // NCs aplicadas a este contrato — reducen lo que se debe
};

async function leerEstadoPago(contratoId: string): Promise<EstadoPago | null> {
  const [
    { data: c, error: cErr },
    { data: pagos, error: pErr },
    { data: ncAps, error: nErr },
  ] = await Promise.all([
    supabase
      .from('blufin_contratos')
      .select('anticipo_usd, saldo_usd, total_usd')
      .eq('id', contratoId)
      .single(),
    supabase.from('blufin_pagos').select('tipo, monto_usd').eq('contrato_id', contratoId),
    supabase.from('blufin_nc_aplicaciones').select('monto_usd').eq('contrato_destino_id', contratoId),
  ]);
  if (cErr) throw cErr;
  if (pErr) throw pErr;
  if (nErr) throw nErr;
  if (!c) return null;
  const acum = (tipo: string) =>
    (pagos ?? []).filter((p) => p.tipo === tipo).reduce((s, p) => s + Number(p.monto_usd), 0);
  return {
    anticipo_usd: Number(c.anticipo_usd ?? 0),
    saldo_usd: Number(c.saldo_usd ?? 0),
    total_usd: Number(c.total_usd ?? 0),
    acumAnticipo: acum('anticipo'),
    acumSaldo: acum('saldo'),
    acumTotal: (pagos ?? []).reduce((s, p) => s + Number(p.monto_usd), 0),
    ncAplicado: (ncAps ?? []).reduce((s, a) => s + Number(a.monto_usd), 0),
  };
}

// Criterio de "cubierto". Reglas:
//  - Las NCs reducen lo que se debe imputándose al saldo (no implican que el
//    anticipo esté pagado).
//  - El saldo cubierto POR PAGOS sí implica anticipo saldado (regla de negocio:
//    el pago del saldo suele incluir el anticipo, feedback 2026-06-11).
//  - El contrato está saldado cuando pagos + NCs cubren el total.
function cubiertos(e: EstadoPago) {
  const saldoCubiertoPorPagos = e.saldo_usd > 0 && e.acumSaldo >= e.saldo_usd - EPS;
  const totalCubierto = e.total_usd > 0 && e.acumTotal + e.ncAplicado >= e.total_usd - EPS;
  const saldoCubierto =
    (e.saldo_usd > 0 && e.acumSaldo + e.ncAplicado >= e.saldo_usd - EPS) || totalCubierto;
  const anticipoCubierto =
    (e.anticipo_usd > 0 && e.acumAnticipo >= e.anticipo_usd - EPS) ||
    saldoCubiertoPorPagos ||
    totalCubierto;
  const contratoSaldado = (saldoCubierto && anticipoCubierto) || totalCubierto;
  return { saldoCubierto, anticipoCubierto, contratoSaldado };
}

/**
 * Lo que REALMENTE falta por pagar de un tipo: total − pagado − NCs. Es la misma
 * convención que ya usan Pendientes y PagoModal, para que el monto que se paga
 * al ejecutar un forward sea el mismo que el usuario ve en pantalla.
 * Pagar el "saldo" liquida el contrato, así que su faltante es el del contrato
 * completo; el del anticipo va topado por el propio anticipo.
 */
function faltantePorTipo(e: EstadoPago, tipo: 'anticipo' | 'saldo'): number {
  const target = e.total_usd > 0 ? e.total_usd : e.anticipo_usd + e.saldo_usd;
  const faltanteContrato = Math.max(0, target - e.acumTotal - e.ncAplicado);
  if (tipo === 'saldo') return faltanteContrato;
  return Math.min(Math.max(0, e.anticipo_usd - e.acumAnticipo), faltanteContrato);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Suma de pagos + NCs aplicadas por contrato (para mostrar el saldo restante). */
export type SaldoContrato = { pagado: number; ncAplicado: number };

export async function fetchSaldosPorContrato(
  empresaId: string,
): Promise<Map<string, SaldoContrato>> {
  const [{ data: pagos, error: pErr }, { data: ncAps, error: nErr }] = await Promise.all([
    supabase
      .from('blufin_pagos')
      .select('contrato_id, monto_usd, contrato:blufin_contratos!inner(empresa_id)')
      .eq('contrato.empresa_id', empresaId),
    supabase
      .from('blufin_nc_aplicaciones')
      .select('contrato_destino_id, monto_usd, contrato:blufin_contratos!inner(empresa_id)')
      .eq('contrato.empresa_id', empresaId),
  ]);
  if (pErr) throw pErr;
  if (nErr) throw nErr;

  const map = new Map<string, SaldoContrato>();
  const get = (id: string) => {
    let v = map.get(id);
    if (!v) {
      v = { pagado: 0, ncAplicado: 0 };
      map.set(id, v);
    }
    return v;
  };
  for (const p of pagos ?? []) {
    if (p.contrato_id) get(p.contrato_id as string).pagado += Number(p.monto_usd);
  }
  for (const a of ncAps ?? []) {
    if (a.contrato_destino_id) get(a.contrato_destino_id as string).ncAplicado += Number(a.monto_usd);
  }
  return map;
}

/**
 * Valida que un nuevo pago no caiga sobre algo ya saldado (evita dobles pagos).
 * Lanza con mensaje claro; `folio` lo antepone (útil en pago múltiple).
 */
function validarNuevoPago(
  estado: EstadoPago,
  tipo: 'anticipo' | 'saldo' | 'abono',
  folio?: string,
): void {
  const { saldoCubierto, anticipoCubierto, contratoSaldado } = cubiertos(estado);
  const f = folio ? `${folio}: ` : '';
  if (contratoSaldado) {
    throw new Error(`${f}El contrato ya está saldado por completo — no se puede registrar otro pago.`);
  }
  if (tipo === 'anticipo' && anticipoCubierto) {
    throw new Error(`${f}El anticipo de este contrato ya está cubierto.`);
  }
  if (tipo === 'saldo' && saldoCubierto) {
    throw new Error(`${f}El saldo de este contrato ya está cubierto.`);
  }
}

/**
 * Tras un pago spot que cubre un tipo, libera los forwards Pendientes de ese
 * tipo: quedan cerrados con el banco pero ya NO asignados al contenedor
 * (status 'Liberado'), así no generan un doble pago si después se "ejecutan".
 */
async function liberarForwardsCubiertos(contratoId: string): Promise<void> {
  const estado = await leerEstadoPago(contratoId);
  if (!estado) return;
  const { saldoCubierto, anticipoCubierto } = cubiertos(estado);
  const tipos: ('anticipo' | 'saldo')[] = [];
  if (anticipoCubierto) tipos.push('anticipo');
  if (saldoCubierto) tipos.push('saldo');
  if (tipos.length === 0) return;
  const { error } = await supabase
    .from('blufin_forwards')
    .update({ status: 'Liberado' })
    .eq('contrato_id', contratoId)
    .in('asociado_a', tipos)
    .eq('status', 'Pendiente');
  if (error) throw error;
}

/**
 * Crear un pago + recalcular los flags del contrato.
 * Antes de insertar valida que no sea un doble pago sobre algo ya saldado.
 * Si el pago spot cubre el tipo, libera el forward pendiente de ese tipo.
 * La lógica vive en cliente para mantener la mutation visible/testeable
 * (no requiere trigger SQL todavía, ver §17).
 */
export async function createPago(payload: BlufinPagoInsert): Promise<void> {
  if (payload.contrato_id) {
    const estado = await leerEstadoPago(payload.contrato_id);
    if (estado) {
      validarNuevoPago(estado, payload.tipo as 'anticipo' | 'saldo' | 'abono');
    }
  }

  const monto_mxn = (payload.monto_usd ?? 0) * (payload.tc ?? 0);

  const { error: pagoErr } = await supabase
    .from('blufin_pagos')
    .insert({ ...payload, monto_mxn });
  if (pagoErr) throw pagoErr;

  if (payload.contrato_id) {
    await recalcFlagsContrato(payload.contrato_id);
    await liberarForwardsCubiertos(payload.contrato_id);
  }
}

/**
 * Eliminar un pago + recalcular flags (si el acumulado tras borrar ya no
 * cubre el target, el flag regresa a false).
 */
export async function deletePago(id: string): Promise<void> {
  const { data: pago, error: rErr } = await supabase
    .from('blufin_pagos')
    .select('contrato_id')
    .eq('id', id)
    .single();
  if (rErr) throw rErr;

  const { error: dErr } = await supabase.from('blufin_pagos').delete().eq('id', id);
  if (dErr) throw dErr;

  if (pago?.contrato_id) await recalcFlagsContrato(pago.contrato_id);
}

/**
 * Eliminar un forward.
 */
export async function deleteForward(id: string): Promise<void> {
  // Un forward Ejecutado ya generó un pago: borrarlo lo dejaría huérfano y el
  // contrato seguiría con su flag puesto (el delete debe ser simétrico al create).
  const { data: actual, error: fErr } = await supabase
    .from('blufin_forwards')
    .select('status, contrato:blufin_contratos(folio)')
    .eq('id', id)
    .single();
  if (fErr) throw fErr;
  if (actual.status === 'Ejecutado') {
    const folio = (actual as { contrato?: { folio?: string } | null })?.contrato?.folio;
    throw new Error(
      `Este forward ya generó un pago${folio ? ` en ${folio}` : ''}. Elimina primero ese pago desde Realizados.`,
    );
  }

  const { error } = await supabase.from('blufin_forwards').delete().eq('id', id);
  if (error) throw error;
}

/** Qué va a pasar al ejecutar un forward. Lo consumen el modal de confirmación
 *  y `executeForward`, para que la previsualización no pueda mentir. */
export type PlanForward = {
  folio: string;
  contratoId: string;
  asociadoA: 'anticipo' | 'saldo';
  montoForward: number;
  tcForward: number;
  montoMxnForward: number;
  /** Lo que realmente falta por pagar del destino (total − pagado − NCs). */
  faltante: number;
  /** Lo que se va a pagar = min(forward, faltante). */
  aplicar: number;
  /** Lo que sobra y queda vivo con el banco. */
  remanente: number;
  /** El forward no alcanza a cubrir el faltante → se registra como abono. */
  esAbono: boolean;
  /** El forward excede el faltante → quedará un Remanente asignable. */
  excede: boolean;
};

async function leerForwardEjecutable(id: string) {
  const { data: forward, error } = await supabase
    .from('blufin_forwards')
    .select('contrato_id, asociado_a, monto_usd, tc_forward, monto_mxn, fecha_entrega, banco_id, status')
    .eq('id', id)
    .single();
  if (error) throw error;

  if (forward.status === 'Ejecutado') {
    throw new Error('Este forward ya fue ejecutado');
  }
  if (forward.status === 'Liberado') {
    throw new Error('Este forward fue liberado (el contenedor ya se pagó spot) — asígnalo a un contenedor antes de ejecutarlo.');
  }
  if (forward.status === 'Remanente') {
    throw new Error('Este forward es un remanente sin asignar — asígnalo a un contenedor antes de ejecutarlo.');
  }
  if (forward.status !== 'Pendiente') {
    throw new Error(`No se puede ejecutar un forward en estado "${forward.status}".`);
  }
  if (!forward.contrato_id || !forward.asociado_a || forward.monto_usd == null || forward.tc_forward == null) {
    throw new Error('Forward incompleto — no se puede ejecutar');
  }
  return forward;
}

/**
 * Calcula (sin escribir nada) qué pasaría al ejecutar el forward.
 */
export async function planForward(id: string): Promise<PlanForward> {
  const forward = await leerForwardEjecutable(id);
  const contratoId = forward.contrato_id as string;
  const asociadoA = forward.asociado_a as 'anticipo' | 'saldo';

  const { data: c } = await supabase
    .from('blufin_contratos')
    .select('folio')
    .eq('id', contratoId)
    .single();

  const estado = await leerEstadoPago(contratoId);
  if (!estado) throw new Error('No se pudo leer el estado de pago del contrato.');

  // Defensa contra doble pago: si el tipo ya quedó cubierto (p. ej. se pagó
  // spot), ejecutar el forward duplicaría el pago.
  const { saldoCubierto, anticipoCubierto } = cubiertos(estado);
  const yaCubierto = asociadoA === 'anticipo' ? anticipoCubierto : saldoCubierto;
  if (yaCubierto) {
    throw new Error(
      `El ${asociadoA} de este contrato ya está cubierto — el forward ya no aplica. Muévelo a otro contenedor o elimínalo.`,
    );
  }

  const montoForward = r2(Number(forward.monto_usd));
  const tcForward = Number(forward.tc_forward);
  const montoMxnForward = forward.monto_mxn != null ? Number(forward.monto_mxn) : r2(montoForward * tcForward);
  const faltante = r2(faltantePorTipo(estado, asociadoA));
  if (faltante <= EPS) {
    throw new Error(
      `Este contrato ya no tiene ${asociadoA} pendiente — el forward ya no aplica. Muévelo a otro contenedor o elimínalo.`,
    );
  }
  const aplicar = r2(Math.min(montoForward, faltante));
  const remanente = r2(Math.max(0, montoForward - aplicar));

  return {
    folio: c?.folio ?? '—',
    contratoId,
    asociadoA,
    montoForward,
    tcForward,
    montoMxnForward,
    faltante,
    aplicar,
    remanente,
    esAbono: aplicar < faltante - EPS,
    excede: remanente > EPS,
  };
}

/**
 * Ejecutar un forward — lo convierte en pago real por `min(forward, faltante)`:
 *   1. Inserta blufin_pagos con el TC pactado. Si no alcanza a cubrir el
 *      faltante, el pago va como 'abono' (no marca el saldo como cubierto).
 *   2. Si sobró, el forward NO se cierra: se encoge al remanente y queda
 *      'Remanente', vivo con el banco y asignable a otro contenedor. Si se
 *      consumió completo, pasa a 'Ejecutado'.
 *   3. Recalcula flags anticipo_pagado / saldo_pagado del contrato.
 *
 * No hay transacción, así que la referencia del pago lleva `fwd:<id>` y sirve de
 * clave de idempotencia: si el insert pasó y el update falló, reintentar RETOMA
 * en vez de duplicar el pago.
 */
export async function executeForward(id: string): Promise<PlanForward> {
  const forward = await leerForwardEjecutable(id);
  const plan = await planForward(id);

  const fechaPago = forward.fecha_entrega ?? new Date().toISOString().slice(0, 10);
  const marca = `fwd:${id.slice(0, 8)}`;
  const referencia =
    `FORWARD ${plan.excede || plan.esAbono ? `${plan.montoForward.toFixed(2)} · aplicado ${plan.aplicar.toFixed(2)}` : 'ejecutado'}` +
    `${plan.excede ? ` · remanente ${plan.remanente.toFixed(2)}` : ''} · ${fechaPago} · ${marca}`;

  // ¿Ya existe el pago de este forward? (reintento tras un fallo a medias)
  const { data: previos, error: prevErr } = await supabase
    .from('blufin_pagos')
    .select('id')
    .eq('contrato_id', plan.contratoId)
    .like('referencia', `%${marca}%`);
  if (prevErr) throw prevErr;

  if (!previos?.length) {
    const { error: pagoErr } = await supabase.from('blufin_pagos').insert({
      contrato_id: plan.contratoId,
      // Si no cubre el faltante va como 'abono': así no marca el saldo como
      // cubierto (acumSaldo solo suma pagos tipo 'saldo'), pero sí cuenta para
      // el total, que es lo que liquida el contrato cuando llegue el resto.
      tipo: plan.esAbono ? 'abono' : plan.asociadoA,
      monto_usd: plan.aplicar,
      tc: plan.tcForward,
      monto_mxn: r2(plan.aplicar * plan.tcForward),
      fecha: fechaPago,
      banco_id: forward.banco_id,
      referencia,
    });
    if (pagoErr) throw pagoErr;
  }

  // El MXN del remanente por RESTA, no multiplicando: con redondeo a centavos
  // round(a·tc) + round(b·tc) puede diferir de round((a+b)·tc), y lo comprometido
  // con el banco no debe cambiar al partir el forward.
  const patch = plan.excede
    ? {
        status: 'Remanente',
        monto_usd: plan.remanente,
        monto_mxn: r2(plan.montoMxnForward - r2(plan.aplicar * plan.tcForward)),
      }
    : { status: 'Ejecutado' };

  const { error: updErr } = await supabase
    .from('blufin_forwards')
    .update(patch)
    .eq('id', id)
    .eq('status', 'Pendiente'); // evita que un doble clic aplique dos veces
  if (updErr) throw updErr;

  await recalcFlagsContrato(plan.contratoId);
  return plan;
}

/**
 * Marcar un forward como usado FUERA de Blufin (Camanchaca SA / Neptuno). Solo
 * lo saca del circuito de Blufin y deja registro; el pago se captura en el
 * módulo que corresponda — todavía no hay cruce automático entre módulos.
 */
export async function marcarForwardUsadoFuera(
  id: string,
  destino: 'Camanchaca SA' | 'Neptuno',
): Promise<void> {
  const { data: actual, error: fErr } = await supabase
    .from('blufin_forwards')
    .select('status')
    .eq('id', id)
    .single();
  if (fErr) throw fErr;
  const motivo = porQueNoSeAsigna(actual.status);
  if (motivo) throw new Error(motivo);

  // Solo cambia el status: `contrato_id` se conserva como referencia de dónde se
  // cerró. Dejarlo en NULL lo haría DESAPARECER de la lista, porque fetchForwards
  // trae el contrato con `!inner`.
  const { data: hechos, error } = await supabase
    .from('blufin_forwards')
    .update({ status: `Usado en ${destino}` })
    .eq('id', id)
    .in('status', [...FORWARDS_ASIGNABLES])
    .select('id');
  if (error) throw error;
  if (!hechos?.length) {
    throw new Error('El forward cambió de estado — vuelve a cargar la página.');
  }
}

/**
 * Eliminar un contrato. NO permite borrar si tiene pagos o forwards asociados:
 * primero hay que eliminar esos registros (auditoría preservada).
 * Cascade en BD borra productos / líneas, NCs y aplicaciones.
 */
export async function deleteContrato(id: string): Promise<void> {
  // 1) Verificar que no haya pagos
  const { count: pagosCount, error: pagosErr } = await supabase
    .from('blufin_pagos')
    .select('id', { count: 'exact', head: true })
    .eq('contrato_id', id);
  if (pagosErr) throw pagosErr;

  // 2) Verificar que no haya forwards
  const { count: forwardsCount, error: forwardsErr } = await supabase
    .from('blufin_forwards')
    .select('id', { count: 'exact', head: true })
    .eq('contrato_id', id);
  if (forwardsErr) throw forwardsErr;

  const bloqueos: string[] = [];
  if ((pagosCount ?? 0) > 0) {
    bloqueos.push(`${pagosCount} pago${pagosCount === 1 ? '' : 's'}`);
  }
  if ((forwardsCount ?? 0) > 0) {
    bloqueos.push(`${forwardsCount} forward${forwardsCount === 1 ? '' : 's'}`);
  }

  if (bloqueos.length > 0) {
    const plural = (pagosCount ?? 0) + (forwardsCount ?? 0) > 1;
    throw new Error(
      `No se puede eliminar: el contrato tiene ${bloqueos.join(' y ')} asociado${plural ? 's' : ''}. Elimina${plural ? 'los' : 'lo'} primero.`,
    );
  }

  const { error } = await supabase.from('blufin_contratos').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Crear un forward cambiario. Solo permite un forward Pendiente por
 * (contrato_id, asociado_a). Si el contrato ya tiene un forward activo para
 * ese tipo, lanza error.
 */
export async function createForward(payload: BlufinForwardInsert): Promise<void> {
  if (!payload.contrato_id || !payload.asociado_a) {
    throw new Error('Falta contrato o tipo asociado');
  }

  const { data: existentes, error: chkErr } = await supabase
    .from('blufin_forwards')
    .select('id, status')
    .eq('contrato_id', payload.contrato_id)
    .eq('asociado_a', payload.asociado_a);
  if (chkErr) throw chkErr;

  const yaActivo = (existentes ?? []).some((f) => f.status === 'Pendiente');
  if (yaActivo) {
    throw new Error(
      `Este contrato ya tiene un forward pendiente para ${payload.asociado_a}. Ejecútalo o elimínalo antes de crear uno nuevo.`,
    );
  }

  const monto_mxn = (payload.monto_usd ?? 0) * (payload.tc_forward ?? 0);
  const { error } = await supabase
    .from('blufin_forwards')
    .insert({ ...payload, monto_mxn });
  if (error) throw error;
}

/**
 * Mover un forward a otro contenedor: como ya está pactado con el banco y de
 * todos modos se tiene que pagar, queda Pendiente apuntando al nuevo contrato +
 * tipo. Aplica a los tres status asignables (ver FORWARDS_ASIGNABLES):
 *   - `Pendiente`  se cerró para un contenedor pero se usó en otro.
 *   - `Remanente`  sobró al ejecutarlo y se aplica a otro.
 *   - `Liberado`   el contenedor original se pagó spot.
 * Valida que el destino no esté ya cubierto ni tenga otro forward Pendiente.
 */
export async function reassignForward(
  forwardId: string,
  contratoId: string,
  asociadoA: 'anticipo' | 'saldo',
): Promise<void> {
  // El forward debe poder moverse. CRÍTICO con uno ya Ejecutado: mover su
  // contrato_id dejaría el pago huérfano en el contenedor viejo y un forward
  // ejecutable en el nuevo (doble pago).
  const { data: actual, error: fErr } = await supabase
    .from('blufin_forwards')
    .select('status, contrato:blufin_contratos(folio)')
    .eq('id', forwardId)
    .single();
  if (fErr) throw fErr;
  const folioActual = (actual as { contrato?: { folio?: string } | null })?.contrato?.folio ?? null;
  const motivo = porQueNoSeAsigna(actual.status, folioActual);
  if (motivo) throw new Error(motivo);

  // El tipo destino no debe estar ya cubierto
  const estado = await leerEstadoPago(contratoId);
  if (estado) {
    const { saldoCubierto, anticipoCubierto } = cubiertos(estado);
    const yaCubierto = asociadoA === 'anticipo' ? anticipoCubierto : saldoCubierto;
    if (yaCubierto) {
      throw new Error(`El ${asociadoA} de ese contrato ya está cubierto — no necesita forward.`);
    }
  }

  // No debe existir ya un forward Pendiente para ese (contrato, tipo)
  const { data: existentes, error: chkErr } = await supabase
    .from('blufin_forwards')
    .select('id, status')
    .eq('contrato_id', contratoId)
    .eq('asociado_a', asociadoA);
  if (chkErr) throw chkErr;
  if ((existentes ?? []).some((f) => f.status === 'Pendiente')) {
    throw new Error(`Ese contrato ya tiene un forward pendiente para ${asociadoA}.`);
  }

  // El `.in('status', …)` cierra la carrera entre dos pestañas: si mientras
  // tanto alguien lo ejecutó, el UPDATE no encuentra fila y no pisa nada.
  const { data: movidos, error } = await supabase
    .from('blufin_forwards')
    .update({ contrato_id: contratoId, asociado_a: asociadoA, status: 'Pendiente' })
    .eq('id', forwardId)
    .in('status', [...FORWARDS_ASIGNABLES])
    .select('id');
  if (error) throw error;
  if (!movidos?.length) {
    throw new Error('El forward cambió de estado mientras lo movías — vuelve a cargar la página.');
  }
}

/**
 * Retorna los forwards Pendientes con info para badge.
 * Usado por el modal para deshabilitar opciones y por Pendientes para mostrar
 * "FORWARD CERRADO PARA <fecha entrega>".
 */
export type ForwardActivo = {
  id: string;
  contrato_id: string;
  asociado_a: 'anticipo' | 'saldo';
  fecha_cierre: string | null;
  fecha_entrega: string | null;
  tc_forward: number | null;
};

export async function fetchForwardsActivos(empresaId: string): Promise<ForwardActivo[]> {
  const { data, error } = await supabase
    .from('blufin_forwards')
    .select(
      'id, contrato_id, asociado_a, status, fecha_cierre, fecha_entrega, tc_forward, contrato:blufin_contratos!inner(empresa_id)',
    )
    .eq('contrato.empresa_id', empresaId)
    .eq('status', 'Pendiente');
  if (error) throw error;
  return (data ?? [])
    .filter((r) => r.asociado_a === 'anticipo' || r.asociado_a === 'saldo')
    .map((r) => ({
      id: r.id as string,
      contrato_id: r.contrato_id as string,
      asociado_a: r.asociado_a as 'anticipo' | 'saldo',
      fecha_cierre: (r.fecha_cierre as string | null) ?? null,
      fecha_entrega: (r.fecha_entrega as string | null) ?? null,
      tc_forward: r.tc_forward == null ? null : Number(r.tc_forward),
    }));
}

/**
 * Pago múltiple: inserta N pagos con TC/banco/fecha compartidos y luego
 * recalcula flags de cada contrato afectado. Si algún insert falla,
 * todo el batch falla.
 */
export type PagoMultipleItem = {
  contrato_id: string;
  tipo: 'anticipo' | 'saldo' | 'abono';
  monto_usd: number;
};

export type PagoMultipleParams = {
  tc: number;
  fecha: string;
  banco_id: number;
  referencia: string | null;
  items: PagoMultipleItem[];
};

export async function createPagosMultiples(params: PagoMultipleParams): Promise<number> {
  if (params.items.length === 0) throw new Error('No hay pagos para registrar');

  const contratosAfectados = Array.from(new Set(params.items.map((i) => i.contrato_id)));

  // 0) Validar cada ítem contra el estado actual (evita dobles pagos). Si algún
  //    contrato ya está saldado, todo el batch falla con mensaje claro.
  const estados = new Map<string, EstadoPago>();
  await Promise.all(
    contratosAfectados.map(async (id) => {
      const e = await leerEstadoPago(id);
      if (e) estados.set(id, e);
    }),
  );
  for (const it of params.items) {
    const estado = estados.get(it.contrato_id);
    if (!estado) continue;
    const { data: c } = await supabase
      .from('blufin_contratos')
      .select('folio')
      .eq('id', it.contrato_id)
      .single();
    validarNuevoPago(estado, it.tipo, c?.folio);
  }

  // 1) Insert masivo de los pagos
  const rows: BlufinPagoInsert[] = params.items.map((it) => ({
    contrato_id: it.contrato_id,
    tipo: it.tipo,
    monto_usd: it.monto_usd,
    tc: params.tc,
    monto_mxn: it.monto_usd * params.tc,
    fecha: params.fecha,
    banco_id: params.banco_id,
    referencia: params.referencia,
  }));

  const { error: insertErr } = await supabase.from('blufin_pagos').insert(rows);
  if (insertErr) throw insertErr;

  // 2) Recalcular flags y liberar forwards cubiertos de cada contrato afectado
  await Promise.all(
    contratosAfectados.map(async (id) => {
      await recalcFlagsContrato(id);
      await liberarForwardsCubiertos(id);
    }),
  );

  return params.items.length;
}

/**
 * Contratos con saldo o anticipo pendiente — usado para sugerir nuevo pago / forward.
 */
export type ContratoConPendiente = {
  id: string;
  folio: string;
  fecha: string | null;
  anticipo_usd: number | null;
  anticipo_fecha: string | null;
  anticipo_pagado: boolean | null;
  saldo_usd: number | null;
  saldo_fecha: string | null;
  saldo_pagado: boolean | null;
  total_usd: number | null;
  total_kg: number | null;
  status: string;
  contenedor: string | null;
  factura_pdf_path: string | null;
  factura_drive_pdf_id: string | null;
  /** Renglones del contrato — para mostrar de qué es el contenedor en Pendientes
   *  y alimentar el `SkusContratoModal` al picar el folio (igual que Llegadas). */
  productos: {
    descripcion: string | null;
    marca: string | null;
    talla: string | null;
    kg: number | null;
    cajas: number | null;
  }[];
};

export async function fetchContratosConPendiente(
  empresaId: string,
): Promise<ContratoConPendiente[]> {
  const { data, error } = await supabase
    .from('blufin_contratos')
    .select(
      'id, folio, fecha, anticipo_usd, anticipo_fecha, anticipo_pagado, saldo_usd, saldo_fecha, saldo_pagado, total_usd, total_kg, status, contenedor, factura_pdf_path, factura_drive_pdf_id, productos:blufin_contrato_productos(*)',
    )
    .eq('empresa_id', empresaId)
    .or('anticipo_pagado.is.false,saldo_pagado.is.false')
    .order('fecha', { ascending: false });
  if (error) throw error;
  // `as unknown as` igual que fetchContratos: los tipos manuales de database.ts no
  // declaran la relación con blufin_contrato_productos, así que el embed no se infiere.
  return (data ?? []) as unknown as ContratoConPendiente[];
}
