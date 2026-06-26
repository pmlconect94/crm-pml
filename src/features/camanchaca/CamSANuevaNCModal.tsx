/**
 * Modal de captura de una NC por descuento SA (simplificada — monto USD + motivo,
 * sin CFDI ni aplicaciones múltiples). Se liga a un contenedor y reduce su saldo.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { Combobox } from '@/components/Combobox';
import { fetchContenedoresSA } from '@/features/camanchaca/sa-queries';
import { createNcSA } from '@/features/camanchaca/sa-nc-queries';
import { useAuth } from '@/lib/auth';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';
import { fmtUSD } from '@/lib/format';

type Props = { open: boolean; onClose: () => void };

const todayISO = () => new Date().toISOString().slice(0, 10);
const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export function CamSANuevaNCModal({ open, onClose }: Props) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const backdrop = useBackdropDismiss(onClose);

  const { data: contenedores = [] } = useQuery({
    queryKey: ['cam_sa_contenedores', empresaId],
    queryFn: () => fetchContenedoresSA(empresaId),
    enabled: open,
  });

  const [contenedorId, setContenedorId] = useState('');
  const [montoUsd, setMontoUsd] = useState('');
  const [motivo, setMotivo] = useState('');
  const [fecha, setFecha] = useState(todayISO());

  useEffect(() => {
    if (!open) return;
    setContenedorId('');
    setMontoUsd('');
    setMotivo('');
    setFecha(todayISO());
  }, [open]);

  const valid = !!contenedorId && toNum(montoUsd) > 0 && motivo.trim() !== '';

  const mutation = useMutation({
    mutationFn: async () => {
      await createNcSA({
        contenedor_id: contenedorId,
        monto_usd: toNum(montoUsd),
        motivo: motivo.trim(),
        fecha,
        status: 'Aplicada',
      });
    },
    onSuccess: () => {
      toast.success('Nota de crédito registrada');
      qc.invalidateQueries({ queryKey: ['cam_sa_nc'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores_pendientes'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_saldos'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
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
              maxWidth: 520,
              width: '100%',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
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
                  Descuento simplificado (monto USD + motivo) — reduce el saldo del contenedor
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                <Icon name="x" size={14} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'grid', gap: 14 }}>
              <div>
                <label className="field-label">Contenedor * (escribe el folio)</label>
                <Combobox
                  options={contenedores.map((c) => ({
                    id: c.id,
                    label: `${c.folio_interno} · ${fmtUSD(c.total_usd)} · ${c.status}`,
                  }))}
                  value={contenedorId || null}
                  onChange={(id) => setContenedorId(id ?? '')}
                  placeholder="CAM-001…"
                />
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
              <div>
                <label className="field-label">Motivo *</label>
                <textarea
                  className="field-input"
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej. Descuento por calidad / merma / peso"
                  style={{ resize: 'vertical' }}
                />
              </div>
              {toNum(montoUsd) > 0 && (
                <div className="text-xs" style={{ color: 'var(--ink-700)' }}>
                  NC por{' '}
                  <span className="mono fw-700" style={{ color: 'var(--red-500)' }}>
                    −{fmtUSD(toNum(montoUsd))}
                  </span>{' '}
                  — se descuenta del saldo del contenedor.
                </div>
              )}
            </div>

            <div
              style={{
                padding: '14px 24px',
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
              <button className="btn btn-primary btn-sm" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending ? (
                  <div className="spinner" style={{ width: 12, height: 12 }} />
                ) : (
                  <Icon name="check" size={13} />
                )}
                Registrar NC
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
