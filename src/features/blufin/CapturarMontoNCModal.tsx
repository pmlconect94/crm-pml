import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { fmtUSD, fmtMXN } from '@/lib/format';
import { capturarMontoNC, NC_RAZON_META, type NcRazon } from '@/features/blufin/nc-queries';
import type { BlufinNotaCreditoEnriquecida } from '@/types/database';

const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
};

export function CapturarMontoNCModal({
  nc,
  onClose,
}: {
  nc: BlufinNotaCreditoEnriquecida | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [montoUsd, setMontoUsd] = useState('');
  const [tc, setTc] = useState('');

  useEffect(() => {
    if (nc) {
      setMontoUsd('');
      setTc(nc.tc != null ? String(nc.tc) : '');
    }
  }, [nc?.id]);

  const monto = toNum(montoUsd);
  const meta = nc ? NC_RAZON_META[nc.razon as NcRazon] : null;

  const mutation = useMutation({
    mutationFn: () => capturarMontoNC(nc!.id, monto, toNum(tc) > 0 ? toNum(tc) : null),
    onSuccess: () => {
      toast.success('Monto capturado — la NC quedó lista para aplicar');
      qc.invalidateQueries({ queryKey: ['blufin_notas_credito'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AnimatePresence>
      {nc && meta && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
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
              maxWidth: 440,
              width: '100%',
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
                  <span
                    className="badge"
                    style={{ background: meta.bg, color: meta.text }}
                  >
                    {meta.short}
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Capturar monto de la NC</h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  Contrato origen <span className="mono fw-600">{nc.contrato_origen?.folio ?? '—'}</span>
                  {nc.nota ? ` · ${nc.nota}` : ''}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                <Icon name="x" size={14} />
              </button>
            </div>

            <div style={{ padding: '16px 22px', display: 'grid', gap: 12 }}>
              <div>
                <label className="field-label">Monto notificado por el proveedor (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="field-input mono"
                  value={montoUsd}
                  onChange={(e) => setMontoUsd(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div>
                <label className="field-label">TC de referencia (opcional)</label>
                <input
                  type="number"
                  step="0.0001"
                  className="field-input mono"
                  value={tc}
                  onChange={(e) => setTc(e.target.value)}
                  placeholder="17.5000"
                />
              </div>
              {monto > 0 && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 'var(--r-sm)',
                    background: 'color-mix(in srgb, var(--red-500) 6%, white)',
                    border: '1px solid color-mix(in srgb, var(--red-500) 24%, white)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                  }}
                >
                  <div>
                    <div className="text-xs muted">Monto NC USD</div>
                    <div className="mono fw-700" style={{ color: 'var(--red-500)', fontSize: 16 }}>
                      −{fmtUSD(monto)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs muted">Equivalente MXN</div>
                    <div className="mono fw-700" style={{ color: 'var(--blue-500)', fontSize: 16 }}>
                      {toNum(tc) > 0 ? '−' + fmtMXN(monto * toNum(tc)) : '—'}
                    </div>
                  </div>
                </div>
              )}
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
                disabled={monto <= 0 || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? (
                  <div className="spinner" style={{ width: 12, height: 12 }} />
                ) : (
                  <Icon name="check" size={13} />
                )}
                Guardar monto
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
