import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { fmtMXN, fmtKg, fmtFecha, fmtFechaCorta } from '@/lib/format';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';
import { fetchCompraMXDetalle } from '@/features/camanchaca/mx-queries';
import { CompraMXStatusPill } from '@/features/camanchaca/CompraMXStatusPill';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div
        className="text-xs fw-700"
        style={{ color: 'var(--ink-500)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

export function CamMXCompraDetalleModal({
  compraId,
  onClose,
}: {
  compraId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['cam_mx_compra_detalle', compraId],
    queryFn: () => fetchCompraMXDetalle(compraId!),
    enabled: !!compraId,
  });

  const backdrop = useBackdropDismiss(onClose);
  const c = data?.compra;
  const prods = c?.productos ?? [];
  const totKg = prods.reduce((s, p) => s + Number(p.kg ?? 0), 0);
  const totCajas = prods.reduce((s, p) => s + Number(p.cajas ?? 0), 0);
  const totMxn = prods.reduce((s, p) => s + Number(p.total_mxn ?? 0), 0);
  const restante = c
    ? Math.max(0, Number(c.total_mxn ?? 0) - (data?.pagado ?? 0) - (data?.ncAplicado ?? 0))
    : 0;

  return (
    <AnimatePresence>
      {compraId && (
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
              maxWidth: 1000,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            {isLoading || !c ? (
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
                        {c.folio_interno}
                      </span>
                      <CompraMXStatusPill status={c.status ?? 'Pendiente'} />
                    </div>
                    <div className="text-xs muted">
                      Factura <span className="mono">{c.factura_num}</span>
                      {` · ${fmtFechaCorta(c.fecha_factura)}`}
                      {c.fecha_vencimiento ? ` · vence ${fmtFechaCorta(c.fecha_vencimiento)}` : ''}
                      {c.entrada_intelisis ? (
                        <>
                          {' · Intelisis '}
                          <span className="mono">{c.entrada_intelisis}</span>
                        </>
                      ) : ''}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                    <Icon name="x" size={14} />
                  </button>
                </div>

                <div style={{ padding: '14px 22px 22px' }}>
                  {/* Resumen de saldo */}
                  <div className="grid grid-4" style={{ gap: 10 }}>
                    {[
                      { label: 'Total compra', value: fmtMXN(c.total_mxn), color: 'var(--ink-900)' },
                      { label: 'Pagado', value: fmtMXN(data!.pagado), color: 'var(--green-500)' },
                      { label: 'NC aplicada', value: fmtMXN(data!.ncAplicado), color: 'var(--blue-500)' },
                      {
                        label: 'Saldo pendiente',
                        value: restante <= 0.01 ? 'Liquidada' : fmtMXN(restante),
                        color: restante <= 0.01 ? 'var(--green-500)' : 'var(--amber-500)',
                      },
                    ].map((k) => (
                      <div
                        key={k.label}
                        style={{ padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'var(--ink-50)', border: '1px solid var(--ink-100)' }}
                      >
                        <div className="kpi-label">{k.label}</div>
                        <div className="mono fw-700" style={{ fontSize: 15, color: k.color }}>
                          {k.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Productos */}
                  <div
                    style={{
                      marginTop: 18,
                      border: '1.5px solid color-mix(in srgb, var(--camanchaca) 35%, var(--ink-200))',
                      borderRadius: 'var(--r-md)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      className="hstack"
                      style={{
                        gap: 8,
                        padding: '10px 14px',
                        background: 'color-mix(in srgb, var(--camanchaca) 8%, white)',
                        borderBottom: '1px solid color-mix(in srgb, var(--camanchaca) 20%, var(--ink-100))',
                      }}
                    >
                      <Icon name="package" size={14} style={{ color: 'var(--camanchaca)' }} />
                      <span
                        className="text-xs fw-700"
                        style={{ color: 'var(--camanchaca)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                      >
                        Productos ({prods.length})
                      </span>
                    </div>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Descripción</th>
                          <th style={{ textAlign: 'right' }}>Kg</th>
                          <th style={{ textAlign: 'right' }}>Cajas</th>
                          <th style={{ textAlign: 'right' }}>MXN/kg</th>
                          <th style={{ textAlign: 'right' }}>Total MXN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prods.map((p) => (
                          <tr key={p.id}>
                            <td className="text-sm fw-600">{p.descripcion ?? '—'}</td>
                            <td style={{ textAlign: 'right' }} className="mono">{fmtKg(p.kg)}</td>
                            <td style={{ textAlign: 'right' }} className="mono">{p.cajas ?? '—'}</td>
                            <td style={{ textAlign: 'right' }} className="mono">{p.precio_mxn != null ? fmtMXN(p.precio_mxn) : '—'}</td>
                            <td style={{ textAlign: 'right' }} className="mono fw-700">{fmtMXN(p.total_mxn)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'color-mix(in srgb, var(--camanchaca) 6%, white)' }}>
                          <td className="text-sm fw-700">Total</td>
                          <td style={{ textAlign: 'right' }} className="mono fw-700">{fmtKg(totKg)}</td>
                          <td style={{ textAlign: 'right' }} className="mono fw-700">{totCajas || '—'}</td>
                          <td></td>
                          <td style={{ textAlign: 'right', color: 'var(--camanchaca)' }} className="mono fw-700">
                            {fmtMXN(totMxn)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Pagos */}
                  <Section title={`Pagos (${data!.pagos.length})`}>
                    {data!.pagos.length === 0 ? (
                      <div className="text-sm muted">Sin pagos registrados.</div>
                    ) : (
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th style={{ textAlign: 'right' }}>Monto MXN</th>
                            <th>Banco</th>
                            <th>Referencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data!.pagos.map((p) => (
                            <tr key={p.id}>
                              <td className="text-sm">{fmtFechaCorta(p.fecha)}</td>
                              <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtMXN(p.monto)}</td>
                              <td className="text-xs muted">{p.banco ?? '—'}</td>
                              <td className="text-xs muted mono">{p.referencia ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Section>

                  {/* NCs */}
                  {data!.ncs.length > 0 && (
                    <Section title={`Notas de crédito (${data!.ncs.length})`}>
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th style={{ textAlign: 'right' }}>Monto MXN</th>
                            <th>Motivo</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data!.ncs.map((n) => (
                            <tr key={n.id}>
                              <td className="text-sm">{fmtFecha(n.fecha)}</td>
                              <td style={{ textAlign: 'right' }} className="mono fw-700">
                                <span style={{ color: 'var(--red-500)' }}>−{fmtMXN(n.monto_mxn)}</span>
                              </td>
                              <td className="text-sm">{n.motivo}</td>
                              <td className="text-xs fw-700" style={{ color: 'var(--green-500)' }}>{n.status ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Section>
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
