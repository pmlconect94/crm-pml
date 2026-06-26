/**
 * Ficha de una factura Neptuno (read-only): cabecera, productos, pagos y NCs,
 * con resumen de saldo.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';
import { fmtUSD, fmtMXN, fmtKg, fmtFecha, fmtFechaCorta } from '@/lib/format';
import { fetchFacturaDetalle } from '@/features/neptuno/queries';

const STATUS_BADGE: Record<string, string> = {
  Pendiente: 'badge-amber',
  Parcial: 'badge-blue',
  Liquidada: 'badge-green',
};

export function FacturaDetalleModal({
  facturaId,
  onClose,
}: {
  facturaId: string | null;
  onClose: () => void;
}) {
  const backdrop = useBackdropDismiss(onClose);

  const { data, isLoading } = useQuery({
    queryKey: ['neptuno_factura_detalle', facturaId],
    queryFn: () => fetchFacturaDetalle(facturaId!),
    enabled: !!facturaId,
  });

  const f = data?.factura;
  const productos = f?.productos ?? [];
  const pagos = data?.pagos ?? [];
  const ncs = data?.ncs ?? [];
  const saldo = f
    ? Math.max(0, Number(f.total_usd ?? 0) - (data?.pagado ?? 0) - (data?.ncAplicado ?? 0))
    : 0;

  return (
    <AnimatePresence>
      {facturaId && (
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
              maxWidth: 880,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            {isLoading || !f ? (
              <div style={{ padding: 24 }}>
                <div className="skeleton-bar" style={{ width: '30%', marginBottom: 10 }} />
                <div className="skeleton-bar" style={{ width: '60%' }} />
              </div>
            ) : (
              <>
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
                    <div className="hstack" style={{ gap: 10, marginBottom: 4 }}>
                      <span className="mono fw-700" style={{ fontSize: 16 }}>
                        {f.factura_num}
                      </span>
                      <span className={`badge ${STATUS_BADGE[f.status ?? 'Pendiente'] ?? 'badge-amber'}`}>
                        {f.status ?? 'Pendiente'}
                      </span>
                    </div>
                    <div className="text-xs muted">
                      Factura {fmtFecha(f.fecha_factura)}
                      {f.fecha_vencimiento ? ` · vence ${fmtFechaCorta(f.fecha_vencimiento)}` : ''}
                      {f.entrada_intelisis ? ` · Intelisis ${f.entrada_intelisis}` : ''}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                    <Icon name="x" size={14} />
                  </button>
                </div>

                {/* Resumen de saldo */}
                <div
                  style={{
                    padding: '14px 22px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 12,
                    borderBottom: '1px solid var(--ink-100)',
                  }}
                >
                  {[
                    { label: 'Total factura', value: fmtUSD(f.total_usd), color: 'var(--ink-900)' },
                    { label: 'Pagado', value: fmtUSD(data?.pagado ?? 0), color: 'var(--blue-500)' },
                    { label: 'NCs', value: fmtUSD(data?.ncAplicado ?? 0), color: 'var(--green-500)' },
                    {
                      label: 'Saldo',
                      value: fmtUSD(saldo),
                      color: saldo <= 0.01 ? 'var(--green-500)' : 'var(--amber-500)',
                    },
                  ].map((k) => (
                    <div key={k.label} style={{ padding: '8px 12px', background: 'var(--ink-50)', borderRadius: 'var(--r-sm)' }}>
                      <div className="kpi-label">{k.label}</div>
                      <div className="mono fw-700" style={{ fontSize: 15, color: k.color }}>
                        {k.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Productos */}
                <div style={{ padding: '14px 22px 8px', overflowX: 'auto' }}>
                  <div className="text-xs fw-700" style={sectionLabel}>
                    Productos · {fmtKg(f.total_kg)}
                  </div>
                  <table className="tbl" style={{ minWidth: 640 }}>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Talla</th>
                        <th style={{ textAlign: 'right' }}>Kg</th>
                        <th style={{ textAlign: 'right' }}>Cajas</th>
                        <th style={{ textAlign: 'right' }}>Precio USD</th>
                        <th style={{ textAlign: 'right' }}>Total USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map((p) => (
                        <tr key={p.id}>
                          <td className="text-sm fw-600">{p.descripcion ?? '—'}</td>
                          <td className="mono text-sm">{p.talla ?? '—'}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{fmtKg(p.kg)}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{p.cajas ?? '—'}</td>
                          <td style={{ textAlign: 'right' }} className="mono">
                            {p.precio_usd != null ? '$' + Number(p.precio_usd).toFixed(4) : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }} className="mono fw-700">{fmtUSD(p.total_usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagos y NCs */}
                <div
                  style={{
                    padding: '8px 22px 20px',
                    display: 'grid',
                    gridTemplateColumns: ncs.length > 0 ? '1fr 1fr' : '1fr',
                    gap: 24,
                  }}
                >
                  <div>
                    <div className="text-xs fw-700" style={sectionLabel}>
                      Pagos ({pagos.length})
                    </div>
                    {pagos.length === 0 ? (
                      <div className="text-xs muted">Sin pagos registrados.</div>
                    ) : (
                      <div className="vstack" style={{ gap: 6 }}>
                        {pagos.map((p) => (
                          <div
                            key={p.id}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 'var(--r-sm)',
                              border: '1px solid var(--ink-200)',
                              background: 'white',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <div className="text-sm fw-600" style={{ textTransform: 'capitalize' }}>
                                {p.tipo}
                                {p.banco ? ` · ${p.banco}` : ''}
                              </div>
                              <div className="text-xs muted">
                                {fmtFechaCorta(p.fecha)} · TC {p.tc.toFixed(4)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div className="mono fw-700">{fmtUSD(p.monto_usd)}</div>
                              <div className="text-xs muted mono">{fmtMXN(p.monto_mxn)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {ncs.length > 0 && (
                    <div>
                      <div className="text-xs fw-700" style={sectionLabel}>
                        Notas de crédito ({ncs.length})
                      </div>
                      <div className="vstack" style={{ gap: 6 }}>
                        {ncs.map((n) => (
                          <div
                            key={n.id}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 'var(--r-sm)',
                              border: '1px solid var(--ink-200)',
                              background: 'white',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <div className="text-sm fw-600">{n.motivo}</div>
                              <div className="text-xs muted">{fmtFechaCorta(n.fecha)}</div>
                            </div>
                            <div className="mono fw-700" style={{ color: 'var(--green-500)' }}>
                              −{fmtUSD(n.monto_usd)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const sectionLabel = {
  color: 'var(--ink-500)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  marginBottom: 8,
};
