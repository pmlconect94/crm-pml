/**
 * Nueva nota de crédito por descuento de Camanchaca México (§7b).
 * Simplificada: monto MXN + motivo, sin CFDI. Reduce el saldo de la compra.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { Combobox } from '@/components/Combobox';
import { useAuth } from '@/lib/auth';
import { fmtMXN } from '@/lib/format';
import { fetchComprasConPendienteMX, type CompraMXConPendiente } from '@/features/camanchaca/mx-pagos-queries';
import { createNotaCreditoMX } from '@/features/camanchaca/mx-nc-queries';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';

const hoyISO = () => new Date().toISOString().slice(0, 10);
const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
};

export function CamMXNuevaNCModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const backdrop = useBackdropDismiss(onClose);

  const { data: compras = [] } = useQuery({
    queryKey: ['cam_mx_compras_pendientes', empresaId],
    queryFn: () => fetchComprasConPendienteMX(empresaId),
    enabled: open,
  });

  const [compraId, setCompraId] = useState('');
  const [montoMxn, setMontoMxn] = useState('');
  const [motivo, setMotivo] = useState('');
  const [fecha, setFecha] = useState(hoyISO());

  useEffect(() => {
    if (!open) return;
    setCompraId('');
    setMontoMxn('');
    setMotivo('');
    setFecha(hoyISO());
  }, [open]);

  const compra: CompraMXConPendiente | undefined = useMemo(
    () => compras.find((c) => c.id === compraId),
    [compras, compraId],
  );
  const saldoPendiente = compra ? Number(compra.saldo_pendiente ?? compra.total_mxn ?? 0) : 0;
  const monto = toNum(montoMxn);
  const valid = !!compraId && monto > 0 && motivo.trim() !== '' && !!fecha;

  const mutation = useMutation({
    mutationFn: () =>
      createNotaCreditoMX({
        compra_id: compraId,
        monto_mxn: monto,
        motivo: motivo.trim(),
        fecha,
      }),
    onSuccess: () => {
      toast.success('Nota de crédito registrada');
      qc.invalidateQueries({ queryKey: ['cam_mx_notas_credito'] });
      qc.invalidateQueries({ queryKey: ['cam_mx_compras'] });
      qc.invalidateQueries({ queryKey: ['cam_mx_compras_pendientes'] });
      qc.invalidateQueries({ queryKey: ['cam_mx_pagado'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AnimatePresence>
      {open && (
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
            zIndex: 100,
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
              maxWidth: 560,
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
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Nueva nota de crédito
                </h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  Descuento sobre una compra. Reduce su saldo pendiente.
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                <Icon name="x" size={14} />
              </button>
            </div>

            <div style={{ padding: '16px 22px', display: 'grid', gap: 14 }}>
              <div>
                <label className="field-label">Compra * (escribe el folio o la factura)</label>
                <Combobox
                  options={compras.map((c) => ({
                    id: c.id,
                    label: `${c.folio_interno} · ${c.factura_num} · ${fmtMXN(c.total_mxn)}`,
                  }))}
                  value={compraId || null}
                  onChange={(id) => setCompraId(id ?? '')}
                  placeholder="CAM-002 · MX-8841…"
                />
                {compra && (
                  <div
                    className="text-xs"
                    style={{
                      marginTop: 6,
                      padding: '7px 10px',
                      background: 'var(--ink-50)',
                      borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--ink-200)',
                      color: 'var(--ink-700)',
                      display: 'flex',
                      gap: 16,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      Total: <span className="mono fw-600">{fmtMXN(compra.total_mxn)}</span>
                    </span>
                    <span>
                      Saldo pendiente:{' '}
                      <span className="mono fw-700" style={{ color: 'var(--amber-500)' }}>
                        {fmtMXN(saldoPendiente)}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Monto NC MXN *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="field-input mono"
                    value={montoMxn}
                    onChange={(e) => setMontoMxn(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="field-label">Fecha *</label>
                  <input type="date" className="field-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
              </div>

              {monto > 0 && (
                <div className="text-xs" style={{ color: 'var(--ink-700)' }}>
                  NC por <span className="mono fw-700" style={{ color: 'var(--red-500)' }}>−{fmtMXN(monto)}</span>
                </div>
              )}

              <div>
                <label className="field-label">Motivo *</label>
                <textarea
                  className="field-input"
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej. Descuento por calidad / faltante en la entrega"
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid var(--ink-100)',
                display: 'flex',
                background: 'var(--ink-50)',
                borderRadius: '0 0 var(--r-lg) var(--r-lg)',
              }}
            >
              <div className="hstack" style={{ gap: 8, marginLeft: 'auto' }}>
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
                  Registrar NC
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
