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
  const [{ data: pagos, error: pErr }, { data: contrato, error: cErr }] = await Promise.all([
    supabase.from('blufin_pagos').select('tipo, monto_usd').eq('contrato_id', contratoId),
    supabase
      .from('blufin_contratos')
      .select('anticipo_usd, saldo_usd')
      .eq('id', contratoId)
      .single(),
  ]);
  if (pErr) throw pErr;
  if (cErr) throw cErr;
  if (!contrato) return;

  const acum = (tipo: string) =>
    (pagos ?? [])
      .filter((p) => p.tipo === tipo)
      .reduce((s, p) => s + Number(p.monto_usd), 0);

  const anticipoTarget = Number(contrato.anticipo_usd ?? 0);
  const saldoTarget = Number(contrato.saldo_usd ?? 0);

  const saldoCubierto = saldoTarget > 0 && acum('saldo') >= saldoTarget - 0.01;
  const anticipoCubierto =
    (anticipoTarget > 0 && acum('anticipo') >= anticipoTarget - 0.01) || saldoCubierto;

  const { error: uErr } = await supabase
    .from('blufin_contratos')
    .update({ anticipo_pagado: anticipoCubierto, saldo_pagado: saldoCubierto })
    .eq('id', contratoId);
  if (uErr) throw uErr;
}

const EPS = 0.01;

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
};

async function leerEstadoPago(contratoId: string): Promise<EstadoPago | null> {
  const [{ data: c, error: cErr }, { data: pagos, error: pErr }] = await Promise.all([
    supabase
      .from('blufin_contratos')
      .select('anticipo_usd, saldo_usd, total_usd')
      .eq('id', contratoId)
      .single(),
    supabase.from('blufin_pagos').select('tipo, monto_usd').eq('contrato_id', contratoId),
  ]);
  if (cErr) throw cErr;
  if (pErr) throw pErr;
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
  };
}

// Mismo criterio de "cubierto" que recalcFlagsContrato: si el saldo está
// cubierto, el anticipo se considera saldado aunque no se haya pagado aparte.
function cubiertos(e: EstadoPago) {
  const saldoCubierto = e.saldo_usd > 0 && e.acumSaldo >= e.saldo_usd - EPS;
  const anticipoCubierto =
    (e.anticipo_usd > 0 && e.acumAnticipo >= e.anticipo_usd - EPS) || saldoCubierto;
  const totalCubierto = e.total_usd > 0 && e.acumTotal >= e.total_usd - EPS;
  const contratoSaldado = (saldoCubierto && anticipoCubierto) || totalCubierto;
  return { saldoCubierto, anticipoCubierto, contratoSaldado };
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
  const { error } = await supabase.from('blufin_forwards').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Ejecutar un forward — lo convierte en pago real:
 *   1. Inserta blufin_pagos con TC pactado del forward, tipo = asociado_a,
 *      banco = forward.banco_id, fecha = forward.fecha_entrega, referencia
 *      identifica que vino de forward
 *   2. Cambia el forward.status = 'Ejecutado'
 *   3. Recalcula flag anticipo_pagado / saldo_pagado del contrato
 */
export async function executeForward(id: string): Promise<void> {
  // 1) Leer forward
  const { data: forward, error: rErr } = await supabase
    .from('blufin_forwards')
    .select('contrato_id, asociado_a, monto_usd, tc_forward, fecha_entrega, banco_id, status')
    .eq('id', id)
    .single();
  if (rErr) throw rErr;

  if (forward.status === 'Ejecutado') {
    throw new Error('Este forward ya fue ejecutado');
  }
  if (forward.status === 'Liberado') {
    throw new Error('Este forward fue liberado (el contenedor ya se pagó spot) — ya no se ejecuta.');
  }
  if (forward.status !== 'Pendiente') {
    throw new Error(`No se puede ejecutar un forward en estado "${forward.status}".`);
  }
  if (!forward.contrato_id || !forward.asociado_a || forward.monto_usd == null || forward.tc_forward == null) {
    throw new Error('Forward incompleto — no se puede ejecutar');
  }

  // Defensa contra doble pago: si el tipo ya quedó cubierto (p. ej. se pagó
  // spot), ejecutar el forward duplicaría el pago.
  const estado = await leerEstadoPago(forward.contrato_id);
  if (estado) {
    const { saldoCubierto, anticipoCubierto } = cubiertos(estado);
    const yaCubierto = forward.asociado_a === 'anticipo' ? anticipoCubierto : saldoCubierto;
    if (yaCubierto) {
      throw new Error(
        `El ${forward.asociado_a} de este contrato ya está cubierto — el forward ya no aplica. Libéralo o elimínalo.`,
      );
    }
  }

  // 2) Insertar pago con referencia que identifica que vino de forward
  const fechaPago = forward.fecha_entrega ?? new Date().toISOString().slice(0, 10);
  const monto_mxn = Number(forward.monto_usd) * Number(forward.tc_forward);

  const { error: pagoErr } = await supabase.from('blufin_pagos').insert({
    contrato_id: forward.contrato_id,
    tipo: forward.asociado_a,
    monto_usd: Number(forward.monto_usd),
    tc: Number(forward.tc_forward),
    monto_mxn,
    fecha: fechaPago,
    banco_id: forward.banco_id,
    referencia: `FORWARD ejecutado ${fechaPago}`,
  });
  if (pagoErr) throw pagoErr;

  // 3) Cambiar status del forward
  const { error: updErr } = await supabase
    .from('blufin_forwards')
    .update({ status: 'Ejecutado' })
    .eq('id', id);
  if (updErr) throw updErr;

  // 4) Recalcular flags del contrato
  await recalcFlagsContrato(forward.contrato_id);
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
};

export async function fetchContratosConPendiente(
  empresaId: string,
): Promise<ContratoConPendiente[]> {
  const { data, error } = await supabase
    .from('blufin_contratos')
    .select(
      'id, folio, fecha, anticipo_usd, anticipo_fecha, anticipo_pagado, saldo_usd, saldo_fecha, saldo_pagado, total_usd, total_kg, status',
    )
    .eq('empresa_id', empresaId)
    .or('anticipo_pagado.is.false,saldo_pagado.is.false')
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContratoConPendiente[];
}
