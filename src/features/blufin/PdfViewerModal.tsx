import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';

/** PDF para mostrar dentro de la app: `embed` va en el iframe; `open` se abre en
 *  pestaña nueva al imprimir (Storage = misma URL; Drive = /preview vs /view). */
export type PdfTarget = { title: string; embed: string; open: string };

/**
 * Visor de PDF EMBEBIDO (no abre pestaña nueva). Muestra el documento en un
 * iframe dentro de un modal grande. El botón "Imprimir" sí abre la pestaña
 * nueva (ahí el usuario imprime con el visor del navegador).
 */
export function PdfViewerModal({
  target,
  loading,
  onClose,
}: {
  target: PdfTarget | null;
  loading?: boolean;
  onClose: () => void;
}) {
  const backdrop = useBackdropDismiss(onClose);
  const visible = !!target || !!loading;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          {...backdrop}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 37, 64, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 120, // por encima de las fichas/modales (z 100)
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={SPRING.snappy}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-xl)',
              maxWidth: 1000,
              width: '100%',
              height: '92vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--ink-100)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
              }}
            >
              <div className="hstack" style={{ gap: 8, minWidth: 0 }}>
                <Icon name="file-text" size={15} style={{ color: 'var(--blue-500)', flexShrink: 0 }} />
                <span
                  className="fw-700 text-sm"
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {target?.title ?? 'Cargando…'}
                </span>
              </div>
              <div className="hstack" style={{ gap: 6, flexShrink: 0 }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => target && window.open(target.open, '_blank', 'noopener')}
                  disabled={!target}
                  title="Abrir en una pestaña nueva para imprimir"
                >
                  <Icon name="printer" size={13} /> Imprimir
                </button>
                <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                  <Icon name="x" size={14} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, background: 'var(--ink-100)' }}>
              {target ? (
                <iframe
                  src={target.embed}
                  title={target.title}
                  style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                />
              ) : (
                <div
                  className="hstack"
                  style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                >
                  <div className="spinner" style={{ width: 18, height: 18 }} />
                  <span className="text-sm muted">Cargando documento…</span>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
