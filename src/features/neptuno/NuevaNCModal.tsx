/**
 * Nota de crédito de Neptuno — simplificada: factura + monto USD + motivo.
 * Sin CFDI. Al crearse reduce el saldo de la factura.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { Combobox } from '@/components/Combobox';
import { useAuth } from '@/lib/auth';
import { fmtUSD } from '@/lib/format';
import { fetchFacturasConPendiente } from '@/features/neptuno/queries';
import { createNotaCredito } from '@/features/neptuno/nc-queries';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';

const hoyISO = () => new Date().toISOString().slice(0, 10);
const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
};

export function NuevaNCModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const backdrop = useBackdropDismiss(onClose);

  const { data: facturas = [] } = useQuery({
    queryKey: ['neptuno_facturas_pendientes', empresaId],
    queryFn: () => fetchFacturasConPendiente(empresaId),
    enabled: open,
  });

  const [facturaId, setFacturaId] = useState('');
  const [montoUsd, setMontoUsd] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!open) return;
    setFacturaId('');
    setMontoUsd('');
    setFecha(hoyISO());
    setMotivo('');
  }, [open]);

  const factura = useMemo(() => facturas.find((f) => f.id === facturaId), [facturas, facturaId]);

  const monto = toNum(montoUsd);
  const valid = !!facturaId && monto > 0 && motivo.trim() !== '';

  const mutation = useMutation({
    mutationFn: () =>
      createNotaCredito({
        factura_id: facturaId,
        monto_usd: monto,
        motivo: motivo.trim(),
        fecha,
      }),
    onSuccess: () => {
      toast.success('Nota de crédito registrada');
      qc.invalidateQueries({ queryKey: ['neptuno_notas_credito'] });
      qc.invalidateQueries({ queryKey: ['neptuno_facturas'] });
      qc.invalidateQueries({ queryKey: ['neptuno_facturas_pendientes'] });
      qc.invalidateQueries({ queryKey: ['neptuno_saldos'] });
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
          style={overlay}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={SPRING.snappy}
            onClick={(e) => e.stopPropagation()}
            style={{ ...sheet, maxWidth: 560 }}
          >
            <div style={header}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Nueva nota de crédito
                </h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  Descuento sobre una factura — reduce su saldo
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                <Icon name="x" size={14} />
              </button>
            </div>

            <div style={{ padding: '16px 22px', display: 'grid', gap: 14 }}>
              <div>
                <label className="field-label">Factura * (escribe el número)</label>
                <Combobox
                  options={facturas.map((f) => ({
                    id: f.id,
                    label: `${f.factura_num} · ${fmtUSD(f.total_usd)} · ${f.status ?? 'Pendiente'}`,
                  }))}
                  value={facturaId || null}
                  onChange={(id) => setFacturaId(id ?? '')}
                  placeholder="NEP-2026-001…"
                />
                {factura && (
                  <div
                    className="text-xs"
                    style={{
                      marginTop: 5,
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
                      Total: <span className="mono fw-600">{fmtUSD(factura.total_usd)}</span>
                    </span>
                    <span>
                      Saldo: <span className="mono fw-600">{fmtUSD(factura.saldo_usd ?? factura.total_usd)}</span>
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Monto NC USD *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="field-input mono"
                    value={montoUsd}
                    onChange={(e) => setMontoUsd(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="field-label">Fecha</label>
                  <input type="date" className="field-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
              </div>

              {monto > 0 && (
                <div className="text-xs" style={{ color: 'var(--ink-700)' }}>
                  NC por{' '}
                  <span className="mono fw-700" style={{ color: 'var(--red-500)' }}>
                    −{fmtUSD(monto)}
                  </span>
                </div>
              )}

              <div>
                <label className="field-label">Motivo *</label>
                <textarea
                  className="field-input"
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej. Descuento por calidad / peso faltante"
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={footer}>
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

const overlay = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(10, 37, 64, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  zIndex: 100,
};
const sheet = {
  background: 'white',
  borderRadius: 'var(--r-lg)',
  boxShadow: 'var(--shadow-xl)',
  width: '100%',
  maxHeight: '92vh',
  overflowY: 'auto' as const,
};
const header = {
  padding: '18px 22px',
  borderBottom: '1px solid var(--ink-100)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
};
const footer = {
  padding: '14px 22px',
  borderTop: '1px solid var(--ink-100)',
  display: 'flex',
  background: 'var(--ink-50)',
  borderRadius: '0 0 var(--r-lg) var(--r-lg)',
};
