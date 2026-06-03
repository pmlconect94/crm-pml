/**
 * Modal de confirmación destructiva. Requiere PIN de 4 dígitos del super admin.
 * Reutilizable para borrar pago, contrato, forward, NC, etc.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from './Icon';
import { SPRING } from './motion';
import { verifyPin } from '@/lib/pin';
import { useAuth } from '@/lib/auth';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  /** Qué se está borrando — para el título: "este pago", "este contrato"... */
  what: string;
  /** Línea descriptiva del item específico — "MCO-CV-100001 · saldo · $24,800" */
  itemDescription?: string;
  /** Texto extra de consecuencias — "Esto desmarcará el saldo como pagado..." */
  consequences?: string;
};

export function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  what,
  itemDescription,
  consequences,
}: Props) {
  const { user } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canDelete = user?.rol === 'admin_total';

  useEffect(() => {
    if (open) {
      setPin('');
      setError(null);
      setSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const submit = async () => {
    setError(null);

    if (!canDelete) {
      setError('Solo el superadministrador puede eliminar registros');
      return;
    }
    if (!verifyPin(pin)) {
      setError('PIN incorrecto');
      setPin('');
      return;
    }

    try {
      setSubmitting(true);
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo eliminar';
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
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
            <div style={{ padding: '20px 24px 4px' }}>
              <div
                className="hstack"
                style={{ gap: 12, alignItems: 'flex-start', marginBottom: 12 }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--red-100)',
                    color: 'var(--red-500)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="warning" size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
                    Eliminar {what}
                  </h2>
                  <p
                    className="card-subtitle"
                    style={{ marginTop: 2, fontSize: 12, lineHeight: 1.4 }}
                  >
                    Esta acción no se puede deshacer.
                  </p>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={onClose}
                  aria-label="Cerrar"
                  style={{ padding: 6 }}
                >
                  <Icon name="x" size={13} />
                </button>
              </div>
            </div>

            {itemDescription && (
              <div
                style={{
                  margin: '0 24px 12px',
                  padding: '10px 12px',
                  background: 'var(--ink-50)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 12,
                  color: 'var(--ink-700)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {itemDescription}
              </div>
            )}

            {consequences && (
              <div
                style={{
                  margin: '0 24px 16px',
                  padding: '10px 12px',
                  background: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 12,
                  color: '#92400E',
                  lineHeight: 1.5,
                }}
              >
                {consequences}
              </div>
            )}

            <div style={{ padding: '0 24px 20px' }}>
              <label className="field-label" htmlFor="pin-input">
                PIN del superadministrador
              </label>
              <input
                ref={inputRef}
                id="pin-input"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                className="field-input mono"
                value={pin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(v);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pin.length === 4 && !submitting) submit();
                }}
                placeholder="••••"
                style={{
                  textAlign: 'center',
                  fontSize: 22,
                  letterSpacing: '0.4em',
                  fontWeight: 700,
                  padding: '12px 14px',
                }}
              />
              {error && (
                <div
                  className="text-xs"
                  style={{ color: 'var(--red-500)', marginTop: 6, fontWeight: 600 }}
                >
                  {error}
                </div>
              )}
              {!canDelete && (
                <div
                  className="text-xs muted"
                  style={{ marginTop: 6 }}
                >
                  Tu rol ({user?.rol ?? '—'}) no permite eliminar. Contacta al superadministrador.
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
              }}
            >
              <button className="btn btn-outline" onClick={onClose} disabled={submitting}>
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={submit}
                disabled={submitting || pin.length !== 4 || !canDelete}
              >
                {submitting ? (
                  <>
                    <div className="spinner" style={{ width: 13, height: 13 }} /> Eliminando…
                  </>
                ) : (
                  <>
                    <Icon name="trash" size={13} /> Eliminar
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
