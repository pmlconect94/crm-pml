import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { StatusPill } from '@/features/blufin/StatusPill';
import { fmtUSD, fmtMXN, fmtKg, fmtFechaCorta } from '@/lib/format';
import { fetchContratoDetalle } from '@/features/blufin/queries';

const NC_STATUS_COLOR: Record<string, string> = {
  'Sin monto': 'var(--ink-500)',
  Pendiente: 'var(--amber-500)',
  Parcial: 'var(--blue-500)',
  Aplicada: 'var(--green-500)',
};

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

export function ContratoDetalleModal({
  contratoId,
  onClose,
}: {
  contratoId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['blufin_contrato_detalle', contratoId],
    queryFn: () => fetchContratoDetalle(contratoId!),
    enabled: !!contratoId,
  });

  const c = data?.contrato;
  const restante =
    c && !(c.anticipo_pagado && c.saldo_pagado)
      ? Math.max(0, Number(c.total_usd ?? 0) - (data?.pagado ?? 0) - (data?.ncAplicado ?? 0))
      : 0;

  return (
    <AnimatePresence>
      {contratoId && (
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
              maxWidth: 820,
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
                        {c.folio}
                      </span>
                      <StatusPill status={c.status} />
                    </div>
                    <div className="text-xs muted">
                      Fecha {fmtFechaCorta(c.fecha)} · ETA puerto {fmtFechaCorta(c.eta_puerto)} · ETA
                      bodega {fmtFechaCorta(c.eta_bodega)} ·{' '}
                      {c.contenedor ? <span className="mono">{c.contenedor}</span> : 'sin contenedor'} ·{' '}
                      {c.presentacion ?? '—'}
                      {c.lote ? ` · lote ${c.lote}` : ''}
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
                      { label: 'Total contrato', value: fmtUSD(c.total_usd), color: 'var(--ink-900)' },
                      { label: 'Pagado', value: fmtUSD(data!.pagado), color: 'var(--green-500)' },
                      { label: 'NC aplicada', value: fmtUSD(data!.ncAplicado), color: 'var(--blue-500)' },
                      {
                        label: 'Falta por pagar',
                        value: restante <= 0.01 ? 'Liquidado' : fmtUSD(restante),
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
                  <Section title={`Productos (${c.productos?.length ?? 0})`}>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Descripción</th>
                          <th style={{ textAlign: 'right' }}>Kg</th>
                          <th style={{ textAlign: 'right' }}>Cajas</th>
                          <th style={{ textAlign: 'right' }}>USD/kg</th>
                          <th style={{ textAlign: 'right' }}>Total USD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(c.productos ?? []).map((p) => (
                          <tr key={p.id}>
                            <td className="text-sm fw-600">{p.descripcion ?? '—'}</td>
                            <td style={{ textAlign: 'right' }} className="mono">{fmtKg(p.kg)}</td>
                            <td style={{ textAlign: 'right' }} className="mono">{p.cajas ?? '—'}</td>
                            <td style={{ textAlign: 'right' }} className="mono">{p.precio_usd != null ? '$' + Number(p.precio_usd).toFixed(4) : '—'}</td>
                            <td style={{ textAlign: 'right' }} className="mono fw-700">{fmtUSD(p.total_usd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Section>

                  {/* Pagos */}
                  <Section title={`Pagos (${data!.pagos.length})`}>
                    {data!.pagos.length === 0 ? (
                      <div className="text-sm muted">Sin pagos registrados.</div>
                    ) : (
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th style={{ textAlign: 'right' }}>USD</th>
                            <th style={{ textAlign: 'right' }}>TC</th>
                            <th style={{ textAlign: 'right' }}>MXN</th>
                            <th>Banco</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data!.pagos.map((p) => (
                            <tr key={p.id}>
                              <td className="text-sm">{fmtFechaCorta(p.fecha)}</td>
                              <td className="text-sm" style={{ textTransform: 'capitalize' }}>{p.tipo}</td>
                              <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtUSD(p.monto_usd)}</td>
                              <td style={{ textAlign: 'right' }} className="mono">{p.tc.toFixed(4)}</td>
                              <td style={{ textAlign: 'right' }} className="mono">{fmtMXN(p.monto_mxn)}</td>
                              <td className="text-xs muted">{p.banco ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Section>

                  {/* Forwards */}
                  {data!.forwards.length > 0 && (
                    <Section title={`Forwards (${data!.forwards.length})`}>
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Cubre</th>
                            <th style={{ textAlign: 'right' }}>USD</th>
                            <th style={{ textAlign: 'right' }}>TC</th>
                            <th>Se ejecuta</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data!.forwards.map((f) => (
                            <tr key={f.id}>
                              <td className="text-sm" style={{ textTransform: 'capitalize' }}>{f.asociado_a ?? '—'}</td>
                              <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtUSD(f.monto_usd)}</td>
                              <td style={{ textAlign: 'right' }} className="mono">{f.tc_forward != null ? f.tc_forward.toFixed(4) : '—'}</td>
                              <td className="text-sm">{fmtFechaCorta(f.fecha_entrega)}</td>
                              <td className="text-xs fw-600">{f.status ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Section>
                  )}

                  {/* Recepción */}
                  {data!.recepcion && (
                    <Section title="Recepción">
                      <div className="text-xs muted" style={{ marginBottom: 8 }}>
                        {fmtFechaCorta(data!.recepcion.fecha_recepcion)} · {data!.recepcion.bodega ?? 'sin bodega'} ·
                        Intelisis <span className="mono">{data!.recepcion.entrada_intelisis ?? '—'}</span> · recibida{' '}
                        {data!.recepcion.presentacion_recibida ?? '—'}
                      </div>
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th style={{ textAlign: 'right' }}>Contratado</th>
                            <th style={{ textAlign: 'right' }}>Recibido</th>
                            <th style={{ textAlign: 'right' }}>Diferencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data!.recepcion.lineas.map((l, i) => (
                            <tr key={i}>
                              <td className="text-sm fw-600">{l.descripcion}</td>
                              <td style={{ textAlign: 'right' }} className="mono">{fmtKg(l.kg_contratados)}</td>
                              <td style={{ textAlign: 'right' }} className="mono">{fmtKg(l.kg_recibidos)}</td>
                              <td
                                className="mono fw-700"
                                style={{ textAlign: 'right', color: (l.diferencia ?? 0) < 0 ? 'var(--red-500)' : 'var(--green-500)' }}
                              >
                                {(l.diferencia ?? 0) < 0 ? `−${fmtKg(-(l.diferencia ?? 0))}` : 'OK'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Section>
                  )}

                  {/* NCs */}
                  {data!.ncs.length > 0 && (
                    <Section title={`Notas de crédito de origen (${data!.ncs.length})`}>
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Folio</th>
                            <th>Razón</th>
                            <th style={{ textAlign: 'right' }}>Monto</th>
                            <th style={{ textAlign: 'right' }}>Saldo</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data!.ncs.map((n) => (
                            <tr key={n.id}>
                              <td className="mono fw-600 text-sm">{n.folio_interno}</td>
                              <td className="text-sm" style={{ textTransform: 'capitalize' }}>{n.razon}</td>
                              <td style={{ textAlign: 'right' }} className="mono">{n.monto_usd > 0 ? fmtUSD(n.monto_usd) : '—'}</td>
                              <td style={{ textAlign: 'right' }} className="mono">{fmtUSD(n.saldo_pendiente_usd ?? 0)}</td>
                              <td className="text-xs fw-700" style={{ color: NC_STATUS_COLOR[n.status ?? ''] ?? 'var(--ink-500)' }}>
                                {n.status ?? '—'}
                              </td>
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
