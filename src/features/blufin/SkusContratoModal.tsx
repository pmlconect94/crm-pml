import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { fmtKg } from '@/lib/format';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';
import type { BlufinContratoConProductos } from '@/types/database';

/**
 * Ventana chica con los SKUs y cantidades de un contrato/contenedor (sin precios).
 * Se usa en Recepción → Por recibir y en Llegadas → Por producto (vista de ventas).
 */
export function SkusContratoModal({
  contrato,
  onClose,
}: {
  contrato: BlufinContratoConProductos | null;
  onClose: () => void;
}) {
  const backdrop = useBackdropDismiss(onClose);
  const prods = contrato?.productos ?? [];
  const totalKg = prods.reduce((s, p) => s + Number(p.kg ?? 0), 0);
  const totalCajas = prods.reduce((s, p) => s + Number(p.cajas ?? 0), 0);

  return (
    <AnimatePresence>
      {contrato && (
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
              maxWidth: 480,
              width: '100%',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--ink-100)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div>
                <div className="mono fw-700 text-sm">{contrato.folio}</div>
                <div className="text-xs muted">
                  {prods.length} SKU{prods.length !== 1 ? 's' : ''} · {fmtKg(totalKg)} kg contratados
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }} aria-label="Cerrar">
                <Icon name="x" size={14} />
              </button>
            </div>
            <div style={{ overflowY: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>SKU / descripción</th>
                    <th style={{ textAlign: 'right' }}>Kg</th>
                    <th style={{ textAlign: 'right' }}>Cajas</th>
                  </tr>
                </thead>
                <tbody>
                  {prods.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="muted text-sm" style={{ textAlign: 'center', padding: 16 }}>
                        Este contrato no tiene productos capturados.
                      </td>
                    </tr>
                  ) : (
                    prods.map((p, i) => (
                      <tr key={i}>
                        <td className="text-sm">
                          {p.descripcion ?? '—'}
                          {p.talla ? <span className="muted"> · {p.talla}</span> : null}
                        </td>
                        <td className="mono text-sm" style={{ textAlign: 'right' }}>{fmtKg(p.kg)}</td>
                        <td className="mono text-sm" style={{ textAlign: 'right' }}>{p.cajas ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {prods.length > 0 && (
                  <tfoot>
                    <tr>
                      <td className="fw-700">Total</td>
                      <td className="mono fw-700" style={{ textAlign: 'right' }}>{fmtKg(totalKg)}</td>
                      <td className="mono fw-700" style={{ textAlign: 'right' }}>{totalCajas || '—'}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
