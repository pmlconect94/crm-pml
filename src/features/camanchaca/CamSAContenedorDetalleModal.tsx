import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { CamSAStatusPill } from '@/features/camanchaca/CamSAStatusPill';
import { statusContenedorSA } from '@/features/camanchaca/sa-status';
import { fmtUSD, fmtMXN, fmtKg, fmtFechaCorta } from '@/lib/format';
import { fetchContenedorSADetalle } from '@/features/camanchaca/sa-queries';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';

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

export function CamSAContenedorDetalleModal({
  contenedorId,
  onClose,
}: {
  contenedorId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['cam_sa_contenedor_detalle', contenedorId],
    queryFn: () => fetchContenedorSADetalle(contenedorId!),
    enabled: !!contenedorId,
  });
  const backdrop = useBackdropDismiss(onClose);

  const c = data?.contenedor;
  const prods = c?.productos ?? [];
  const totKg = prods.reduce((s, p) => s + Number(p.kg ?? 0), 0);
  const totCajas = prods.reduce((s, p) => s + Number(p.cajas ?? 0), 0);
  const totUsd = prods.reduce((s, p) => s + Number(p.total_usd ?? 0), 0);
  const restante = c
    ? Math.max(0, Number(c.total_usd ?? 0) - (data?.pagado ?? 0) - (data?.ncAplicado ?? 0))
    : 0;

  // TC efectivo de los pagos (para costo total internado)
  const pagosArr = data?.pagos ?? [];
  const sumUsdPagos = pagosArr.reduce((s, p) => s + p.monto_usd, 0);
  const tcReal = sumUsdPagos > 0 ? pagosArr.reduce((s, p) => s + p.tc * p.monto_usd, 0) / sumUsdPagos : null;
  const fobMxn = tcReal != null ? Number(c?.total_usd ?? 0) * tcReal : null;
  const costoImp = data?.costoImportacionMxn ?? 0;
  const totalInternado = fobMxn != null ? fobMxn + costoImp : null;
  const totalKg = Number(c?.total_kg ?? 0);
  const costoKg = totalInternado != null && totalKg > 0 ? totalInternado / totalKg : null;

  return (
    <AnimatePresence>
      {contenedorId && (
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
              maxWidth: 1080,
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
                      <CamSAStatusPill status={statusContenedorSA(c)} />
                    </div>
                    <div className="text-xs muted">
                      {c.factura ? `Factura ${c.factura}` : 'Sin factura'}
                      {c.fecha_factura ? ` · ${fmtFechaCorta(c.fecha_factura)}` : ''}
                      {c.eta_manzanillo ? ` · ETA Manzanillo ${fmtFechaCorta(c.eta_manzanillo)}` : ''}
                      {c.eta_bodega ? ` · ETA bodega ${fmtFechaCorta(c.eta_bodega)}` : ''}
                      {c.llegada_real ? ` · llegó ${fmtFechaCorta(c.llegada_real)}` : ''}
                      {c.naviera ? ` · ${c.naviera}` : ''}
                      {c.contenedor ? (
                        <>
                          {' · '}
                          <span className="mono">{c.contenedor}</span>
                        </>
                      ) : ''}
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
                      { label: 'Total contenedor', value: fmtUSD(c.total_usd), color: 'var(--ink-900)' },
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

                  {/* Costo total internado */}
                  {totalInternado != null ? (
                    <div
                      className="hstack"
                      style={{
                        marginTop: 12,
                        padding: '9px 14px',
                        borderRadius: 'var(--r-sm)',
                        justifyContent: 'space-between',
                        gap: 16,
                        flexWrap: 'wrap',
                        background: 'color-mix(in srgb, var(--camanchaca, #0EA5A1) 8%, white)',
                        border: '1px solid color-mix(in srgb, var(--camanchaca, #0EA5A1) 28%, white)',
                      }}
                    >
                      <div>
                        <div className="text-xs muted">FOB (USD × TC)</div>
                        <div className="mono fw-700">{fmtMXN(fobMxn)}</div>
                      </div>
                      <div>
                        <div className="text-xs muted">Costo importación</div>
                        <div className="mono fw-700">{fmtMXN(costoImp)}</div>
                      </div>
                      <div>
                        <div className="text-xs muted">Total internado</div>
                        <div className="mono fw-700" style={{ color: 'var(--blue-500)' }}>{fmtMXN(totalInternado)}</div>
                      </div>
                      <div>
                        <div className="text-xs muted">Costo MXN/kg</div>
                        <div className="mono fw-700" style={{ color: 'var(--blue-500)' }}>{fmtMXN(costoKg)}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs muted" style={{ marginTop: 12 }}>
                      Costo total internado no disponible (sin pagos registrados — falta el TC efectivo).
                    </div>
                  )}

                  {/* Logística y fechas clave */}
                  <div className="hstack" style={{ gap: 18, marginTop: 12, flexWrap: 'wrap', fontSize: 12 }}>
                    {[
                      { label: 'Naviera', value: c.naviera ?? '—' },
                      { label: 'Contenedor', value: c.contenedor ?? '—', mono: true },
                      { label: 'ETA Manzanillo', value: fmtFechaCorta(c.eta_manzanillo) },
                      { label: 'Llegó a bodega', value: fmtFechaCorta(c.llegada_real ?? c.eta_bodega) },
                      { label: 'Vencimiento', value: fmtFechaCorta(c.fecha_vencimiento) },
                      { label: 'Intelisis', value: c.entrada_intelisis ?? '—', mono: true },
                    ].map((it) => (
                      <div key={it.label}>
                        <div className="text-xs muted">{it.label}</div>
                        <div className={`fw-600 ${it.mono ? 'mono' : ''}`}>{it.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Productos */}
                  <Section title={`Productos (${prods.length})`}>
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
                        {prods.map((p) => (
                          <tr key={p.id}>
                            <td className="text-sm fw-600">{p.descripcion ?? '—'}</td>
                            <td style={{ textAlign: 'right' }} className="mono">{fmtKg(p.kg)}</td>
                            <td style={{ textAlign: 'right' }} className="mono">{p.cajas ?? '—'}</td>
                            <td style={{ textAlign: 'right' }} className="mono">{p.precio_usd != null ? '$' + Number(p.precio_usd).toFixed(4) : '—'}</td>
                            <td style={{ textAlign: 'right' }} className="mono fw-700">{fmtUSD(p.total_usd)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--ink-50)' }}>
                          <td className="text-sm fw-700">Total</td>
                          <td style={{ textAlign: 'right' }} className="mono fw-700">{fmtKg(totKg)}</td>
                          <td style={{ textAlign: 'right' }} className="mono fw-700">{totCajas || '—'}</td>
                          <td></td>
                          <td style={{ textAlign: 'right', color: 'var(--blue-500)' }} className="mono fw-700">{fmtUSD(totUsd)}</td>
                        </tr>
                      </tfoot>
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

                  {/* Costos de importación */}
                  {data!.costos.length > 0 && (
                    <Section title={`Costos de importación (${data!.costos.length})`}>
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Agencia</th>
                            <th>Concepto</th>
                            <th>Fecha</th>
                            <th style={{ textAlign: 'right' }}>MXN</th>
                            <th>Pagado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data!.costos.map((co) => (
                            <tr key={co.id}>
                              <td className="text-sm fw-600">{co.agencia ?? '—'}</td>
                              <td className="text-sm">{co.concepto ?? '—'}</td>
                              <td className="text-sm">{fmtFechaCorta(co.fecha)}</td>
                              <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtMXN(co.monto_mxn)}</td>
                              <td>{co.pagado ? <span className="badge badge-green">Pagado</span> : <span className="badge badge-amber">Pendiente</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Section>
                  )}

                  {/* Forwards */}
                  {data!.forwards.length > 0 && (
                    <Section title={`Forwards (${data!.forwards.length})`}>
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'right' }}>USD</th>
                            <th style={{ textAlign: 'right' }}>TC</th>
                            <th>Se ejecuta</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data!.forwards.map((f) => (
                            <tr key={f.id}>
                              <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtUSD(f.monto_usd)}</td>
                              <td style={{ textAlign: 'right' }} className="mono">{f.tc_forward.toFixed(4)}</td>
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
                        {fmtFechaCorta(data!.recepcion.fecha)} · {data!.recepcion.bodega ?? 'sin bodega'} ·
                        Intelisis <span className="mono">{data!.recepcion.entrada_intelisis ?? '—'}</span>
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
                    <Section title={`Notas de crédito (${data!.ncs.length})`}>
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Motivo</th>
                            <th style={{ textAlign: 'right' }}>Monto</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data!.ncs.map((n) => (
                            <tr key={n.id}>
                              <td className="text-sm">{fmtFechaCorta(n.fecha)}</td>
                              <td className="text-sm">{n.motivo}</td>
                              <td style={{ textAlign: 'right' }} className="mono fw-700" >−{fmtUSD(n.monto_usd)}</td>
                              <td className="text-xs fw-700">{n.status ?? '—'}</td>
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
