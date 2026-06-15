import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { Combobox } from '@/components/Combobox';
import { useAuth } from '@/lib/auth';
import { fmtUSD } from '@/lib/format';
import { fetchContratosConPendiente } from '@/features/blufin/pagos-queries';
import { aplicarNC, NC_RAZON_META, type NcRazon } from '@/features/blufin/nc-queries';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';
import type { BlufinNotaCreditoEnriquecida } from '@/types/database';

const hoyISO = () => new Date().toISOString().slice(0, 10);
const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
};

export function AplicarNCModal({
  nc,
  onClose,
}: {
  nc: BlufinNotaCreditoEnriquecida | null;
  onClose: () => void;
}) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const backdrop = useBackdropDismiss(onClose);

  // Solo contratos con saldo pendiente: una NC no se aplica a lo ya pagado.
  const { data: contratos = [] } = useQuery({
    queryKey: ['blufin_contratos_pendientes', empresaId],
    queryFn: () => fetchContratosConPendiente(empresaId),
    enabled: !!nc,
  });

  const [destinoId, setDestinoId] = useState('');
  const [montoAplicar, setMontoAplicar] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [nota, setNota] = useState('');

  const saldo = nc ? Number(nc.saldo_pendiente_usd ?? 0) : 0;

  useEffect(() => {
    if (nc) {
      setDestinoId('');
      setMontoAplicar(saldo > 0 ? saldo.toFixed(2) : '');
      setFecha(hoyISO());
      setNota('');
    }
  }, [nc?.id]);

  // Prefill al contrato origen solo si todavía tiene saldo pendiente
  useEffect(() => {
    if (nc && contratos.length > 0 && !destinoId) {
      const origenPendiente = contratos.some((c) => c.id === nc.contrato_origen_id);
      if (origenPendiente) setDestinoId(nc.contrato_origen_id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratos, nc?.id]);

  const meta = nc ? NC_RAZON_META[nc.razon as NcRazon] : null;
  const monto = toNum(montoAplicar);
  const excede = monto > saldo + 0.01;
  const saldoRestante = Math.max(0, saldo - monto);
  const destinoFolio = useMemo(
    () => contratos.find((c) => c.id === destinoId)?.folio,
    [contratos, destinoId],
  );
  const esMismo = destinoId === nc?.contrato_origen_id;

  const mutation = useMutation({
    mutationFn: () =>
      aplicarNC({
        ncId: nc!.id,
        contrato_destino_id: destinoId,
        monto_usd: monto,
        fecha,
        nota: nota.trim() || null,
      }),
    onSuccess: () => {
      toast.success(`NC aplicada por ${fmtUSD(monto)}`);
      qc.invalidateQueries({ queryKey: ['blufin_notas_credito'] });
      // La NC bajó el saldo del contrato → refrescar Pagos, contenedores y pendientes
      qc.invalidateQueries({ queryKey: ['blufin_contratos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos_pendientes'] });
      qc.invalidateQueries({ queryKey: ['blufin_pagos'] });
      qc.invalidateQueries({ queryKey: ['blufin_saldos'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = !!destinoId && monto > 0 && !excede && !!fecha;

  return (
    <AnimatePresence>
      {nc && meta && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          {...backdrop}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 37, 64, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 110,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={SPRING.snappy}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-xl)',
              maxWidth: 520,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid var(--ink-100)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              <div>
                <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
                  <span className="mono fw-700 text-sm">{nc.folio_interno}</span>
                  <span className="badge" style={{ background: meta.bg, color: meta.text }}>
                    {meta.short}
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Aplicar nota de crédito</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                <Icon name="x" size={14} />
              </button>
            </div>

            {/* Resumen */}
            <div
              style={{
                padding: '12px 22px',
                background: meta.bg,
                borderBottom: '1px solid ' + meta.color,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 12,
              }}
            >
              <div>
                <div className="text-xs" style={{ color: meta.text, opacity: 0.8 }}>
                  Contrato origen
                </div>
                <div className="mono fw-700" style={{ color: meta.text }}>
                  {nc.contrato_origen?.folio ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: meta.text, opacity: 0.8 }}>
                  Monto total NC
                </div>
                <div className="mono fw-700" style={{ color: 'var(--red-500)' }}>
                  −{fmtUSD(nc.monto_usd)}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: meta.text, opacity: 0.8 }}>
                  Saldo disponible
                </div>
                <div className="mono fw-700" style={{ color: meta.text }}>
                  {fmtUSD(saldo)}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 22px', display: 'grid', gap: 12 }}>
              <div>
                <label className="field-label">¿A qué contrato aplicar?</label>
                {contratos.length === 0 ? (
                  <div
                    className="text-sm muted"
                    style={{
                      padding: 12,
                      background: 'var(--ink-50)',
                      borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--ink-200)',
                    }}
                  >
                    No hay contratos con saldo pendiente. Una NC solo se aplica a contenedores que
                    aún deban — los ya pagados por completo no la pueden recibir.
                  </div>
                ) : (
                  <>
                    <Combobox
                      options={contratos.map((c) => ({
                        id: c.id,
                        label: `${c.folio} · ${fmtUSD(c.total_usd)} · ${c.status}${c.id === nc.contrato_origen_id ? ' (origen)' : ''}`,
                      }))}
                      value={destinoId || null}
                      onChange={(id) => setDestinoId(id ?? '')}
                      placeholder="Escribe el número de contrato…"
                    />
                    {destinoFolio && (
                      <div className="text-xs muted" style={{ marginTop: 4 }}>
                        Se descuenta en <span className="mono fw-600">{destinoFolio}</span>{' '}
                        <span className={`badge ${esMismo ? 'badge-gray' : 'badge-blue'}`} style={{ fontSize: 10 }}>
                          {esMismo ? 'mismo contrato' : 'otro contrato'}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="field-label" style={{ margin: 0 }}>
                    Monto a aplicar USD *
                  </label>
                  <button
                    className="text-xs fw-600"
                    style={{ color: 'var(--blue-500)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    onClick={() => setMontoAplicar(saldo.toFixed(2))}
                  >
                    Todo: {fmtUSD(saldo)}
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  className="field-input mono"
                  value={montoAplicar}
                  onChange={(e) => setMontoAplicar(e.target.value)}
                  style={{ borderColor: excede ? 'var(--red-500)' : undefined }}
                />
                {excede && (
                  <div className="text-xs fw-600" style={{ color: 'var(--red-500)', marginTop: 4 }}>
                    Excede el saldo disponible
                  </div>
                )}
              </div>

              {monto > 0 && !excede && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 'var(--r-sm)',
                    background:
                      saldoRestante === 0
                        ? 'color-mix(in srgb, var(--green-500) 8%, white)'
                        : 'color-mix(in srgb, var(--amber-500) 8%, white)',
                    border:
                      '1px solid ' +
                      (saldoRestante === 0
                        ? 'color-mix(in srgb, var(--green-500) 28%, white)'
                        : 'color-mix(in srgb, var(--amber-500) 28%, white)'),
                    display: 'grid',
                    gridTemplateColumns: '1fr 20px 1fr',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div className="text-xs muted">Saldo actual</div>
                    <div className="mono fw-700" style={{ color: 'var(--amber-500)' }}>
                      {fmtUSD(saldo)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', color: 'var(--ink-400)' }}>→</div>
                  <div>
                    <div className="text-xs muted">Saldo restante</div>
                    <div
                      className="mono fw-700"
                      style={{ color: saldoRestante === 0 ? 'var(--green-500)' : 'var(--amber-500)' }}
                    >
                      {saldoRestante === 0 ? 'NC liquidada' : fmtUSD(saldoRestante)}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Fecha de aplicación</label>
                  <input type="date" className="field-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Nota (opcional)</label>
                  <input className="field-input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Referencia…" />
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid var(--ink-100)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                background: 'var(--ink-50)',
                borderRadius: '0 0 var(--r-lg) var(--r-lg)',
              }}
            >
              <button className="btn btn-ghost btn-sm" onClick={onClose}>
                Cancelar
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!valid || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? (
                  <div className="spinner" style={{ width: 12, height: 12 }} />
                ) : (
                  <Icon name="check" size={13} />
                )}
                Aplicar {monto > 0 && !excede ? fmtUSD(monto) : ''}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
