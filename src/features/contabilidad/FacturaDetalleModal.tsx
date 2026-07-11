/**
 * Ficha de una factura recibida (CFDI): emisor/receptor, metadata fiscal, conceptos
 * con sus impuestos y totales. Solo lectura — el XML se descarga vía URL firmada.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';
import { fmtPorMoneda, fmtFechaHoraTS } from '@/lib/format';
import { fetchFacturaDetalle, getFacturaXmlUrl } from '@/features/contabilidad/facturas-queries';
import { formaPagoLabel, formaPagoCorto, tipoComprobanteLabel } from '@/features/contabilidad/catalogos-sat';

// Función serverless de Vercel (api/pdf.py) — genera el PDF al vuelo, no hay
// nada guardado en Storage. Ruta relativa: funciona en cualquier deploy sin
// depender de una computadora específica prendida.
const PDF_ENDPOINT = '/api/pdf';

const IMPUESTO_LABELS: Record<string, string> = {
  'traslado:002': 'IVA trasladado',
  'traslado:003': 'IEPS trasladado',
  'retencion:001': 'ISR retenido',
  'retencion:002': 'IVA retenido',
};

const sectionLabel = {
  color: 'var(--ink-500)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  marginBottom: 8,
};

export function FacturaDetalleModal({ uuid, onClose }: { uuid: string | null; onClose: () => void }) {
  const backdrop = useBackdropDismiss(onClose);
  const [xmlLoading, setXmlLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['cont_factura_detalle', uuid],
    queryFn: () => fetchFacturaDetalle(uuid!),
    enabled: !!uuid,
  });

  const f = data?.factura;
  const conceptos = data?.conceptos ?? [];
  const relaciones = data?.relaciones ?? [];
  const pagos = data?.pagos ?? [];
  const pagosRecibidos = data?.pagosRecibidos ?? [];
  const esComprobantePago = f?.tipo_comprobante === 'P';

  // Suma de impuestos (traslados/retenciones) de todos los conceptos, agrupada por
  // tipo+clave — de aquí sale el desglose IVA/IEPS/ISR (los dos totales agregados que
  // trae cont_facturas no distinguen por impuesto, solo trasladado vs retenido).
  const impuestosResumen = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const c of conceptos) {
      for (const imp of c.cont_concepto_impuestos ?? []) {
        const key = `${imp.tipo}:${imp.impuesto}`;
        acc[key] = (acc[key] ?? 0) + Number(imp.importe ?? 0);
      }
    }
    return acc;
  }, [conceptos]);

  const totalItems: { label: string; value: string; strong?: boolean; color?: string }[] = f
    ? [
        { label: 'Subtotal', value: fmtPorMoneda(f.subtotal, f.moneda) },
        ...(f.descuento
          ? [{ label: 'Descuento', value: '−' + fmtPorMoneda(f.descuento, f.moneda), color: 'var(--amber-500)' }]
          : []),
        ...Object.entries(impuestosResumen).map(([key, val]) => ({
          label: IMPUESTO_LABELS[key] ?? key,
          value: fmtPorMoneda(val, f.moneda),
        })),
        { label: 'Total', value: fmtPorMoneda(f.total, f.moneda), strong: true },
      ]
    : [];

  const metaItems: { label: string; value: ReactNode }[] = f
    ? [
        {
          label: 'Folio',
          value: f.folio ? `${f.serie ? f.serie + '-' : ''}${f.folio}` : <span className="muted">Sin folio</span>,
        },
        { label: 'Fecha emisión', value: fmtFechaHoraTS(f.fecha_emision) },
        { label: 'Fecha timbrado', value: fmtFechaHoraTS(f.fecha_timbrado) },
        { label: 'Lugar expedición', value: f.lugar_expedicion ?? '—' },
        { label: 'Forma de pago', value: formaPagoLabel(f.forma_pago) },
        {
          label: 'Método de pago',
          value: f.metodo_pago ? (
            <span className={`badge ${f.metodo_pago === 'PUE' ? 'badge-green' : 'badge-blue'}`}>{f.metodo_pago}</span>
          ) : (
            <span className="muted">—</span>
          ),
        },
        {
          label: 'Moneda',
          value: f.moneda
            ? f.tipo_cambio != null && Number(f.tipo_cambio) !== 1
              ? `${f.moneda} · TC ${Number(f.tipo_cambio).toFixed(4)}`
              : f.moneda
            : '—',
        },
        { label: 'Condiciones de pago', value: f.condiciones_de_pago ?? '—' },
      ]
    : [];

  const descargarXml = async () => {
    if (!f?.xml_storage_path) return;
    setXmlLoading(true);
    try {
      const url = await getFacturaXmlUrl(f.xml_storage_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error('No se pudo obtener el XML: ' + (e as Error).message);
    } finally {
      setXmlLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {uuid && (
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
              maxWidth: 900,
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
                {/* Header — UUID es el identificador real (folio puede venir null) */}
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
                  <div style={{ minWidth: 0 }}>
                    <div className="hstack" style={{ gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span className="mono fw-700" style={{ fontSize: 13 }}>
                        {f.uuid}
                      </span>
                      <span className={`badge ${f.estatus_sat === 'vigente' ? 'badge-green' : 'badge-red'}`}>
                        {f.estatus_sat === 'vigente' ? 'Vigente' : 'Cancelado'}
                      </span>
                    </div>
                    <div className="text-xs muted">
                      {f.tipo_comprobante ? `Comprobante ${f.tipo_comprobante}` : 'CFDI'} · recibida de{' '}
                      {f.emisor_nombre ?? f.emisor_rfc}
                    </div>
                  </div>
                  <div className="hstack" style={{ gap: 8, flexShrink: 0 }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => window.open(`${PDF_ENDPOINT}?uuid=${f.uuid}`, '_blank', 'noopener,noreferrer')}
                      title="Genera el PDF de esta factura al momento"
                    >
                      <Icon name="printer" size={13} />
                      Generar PDF
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={descargarXml}
                      disabled={xmlLoading}
                      title="Descargar el XML original (CFDI)"
                    >
                      {xmlLoading ? (
                        <div className="spinner" style={{ width: 12, height: 12 }} />
                      ) : (
                        <Icon name="download" size={13} />
                      )}
                      Descargar XML
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                </div>

                {/* Emisor / Receptor — visualmente distintos: el receptor SIEMPRE es PML */}
                <div
                  style={{
                    padding: '14px 22px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    borderBottom: '1px solid var(--ink-100)',
                  }}
                >
                  <div style={{ padding: 12, borderRadius: 'var(--r-sm)', border: '1px solid var(--ink-200)' }}>
                    <div className="text-xs fw-700" style={sectionLabel}>
                      Emisor
                    </div>
                    <div className="text-sm fw-600">{f.emisor_nombre ?? <span className="muted">—</span>}</div>
                    <div className="mono text-xs muted">{f.emisor_rfc}</div>
                    {f.emisor_regimen_fiscal && (
                      <div className="text-xs muted" style={{ marginTop: 2 }}>
                        Régimen {f.emisor_regimen_fiscal}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--blue-300)',
                      background: 'var(--blue-50)',
                    }}
                  >
                    <div className="hstack" style={{ justifyContent: 'space-between' }}>
                      <div className="text-xs fw-700" style={{ ...sectionLabel, marginBottom: 0 }}>
                        Receptor
                      </div>
                      <span className="badge badge-blue">Nosotros</span>
                    </div>
                    <div className="text-sm fw-600" style={{ marginTop: 6 }}>
                      {f.receptor_nombre ?? <span className="muted">—</span>}
                    </div>
                    <div className="mono text-xs muted">{f.receptor_rfc}</div>
                    {f.receptor_uso_cfdi && (
                      <div className="text-xs muted" style={{ marginTop: 2 }}>
                        Uso CFDI {f.receptor_uso_cfdi}
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata fiscal */}
                <div
                  style={{
                    padding: '14px 22px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 12,
                    borderBottom: '1px solid var(--ink-100)',
                  }}
                >
                  {metaItems.map((m) => (
                    <div key={m.label}>
                      <div className="kpi-label">{m.label}</div>
                      <div className="text-sm fw-600" style={{ marginTop: 2 }}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comprobantes relacionados (CfdiRelacionados) — ej. de qué factura viene una NC */}
                {relaciones.length > 0 && (
                  <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--ink-100)' }}>
                    <div className="text-xs fw-700" style={sectionLabel}>
                      Comprobantes relacionados
                    </div>
                    <div className="vstack">
                      {relaciones.map((r) => (
                        <div
                          key={r.id}
                          className="hstack"
                          style={{ gap: 10, padding: '8px 12px', background: 'var(--ink-50)', borderRadius: 'var(--r-sm)' }}
                        >
                          <span className="badge badge-blue" style={{ flexShrink: 0 }}>
                            {r.tipo_relacion_desc ?? (r.tipo_relacion ? `Clave ${r.tipo_relacion}` : 'Relación')}
                          </span>
                          {r.relacionada ? (
                            <span className="text-sm">
                              {tipoComprobanteLabel(r.relacionada.tipo_comprobante)}
                              {r.relacionada.folio ? ` ${r.relacionada.serie ? r.relacionada.serie + '-' : ''}${r.relacionada.folio}` : ''}
                              {' · '}
                              {fmtPorMoneda(r.relacionada.total, r.relacionada.moneda)}
                              {' · '}
                              {fmtFechaHoraTS(r.relacionada.fecha_emision)}
                            </span>
                          ) : (
                            <span className="mono text-xs muted">{r.uuid_relacionado}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pagos: si ESTE comprobante es un Pago (P), qué facturas liquida; si es
                    una factura normal, qué pagos (de otros comprobantes P) la liquidaron. */}
                {(esComprobantePago ? pagos.length > 0 : pagosRecibidos.length > 0) && (
                  <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--ink-100)' }}>
                    <div className="text-xs fw-700" style={sectionLabel}>
                      {esComprobantePago ? 'Este comprobante liquida' : 'Pagos aplicados'}
                    </div>
                    {esComprobantePago ? (
                      <div className="vstack">
                        {pagos.map((p) => (
                          <div key={p.id} style={{ padding: '8px 12px', background: 'var(--ink-50)', borderRadius: 'var(--r-sm)' }}>
                            <div className="hstack" style={{ justifyContent: 'space-between' }}>
                              <span className="text-sm fw-600">
                                {fmtFechaHoraTS(p.fecha_pago)} · {formaPagoCorto(p.forma_pago)}
                              </span>
                              <span className="mono fw-700 text-sm">{fmtPorMoneda(p.monto, p.moneda)}</span>
                            </div>
                            {(p.cont_pagos_documentos ?? []).map((d) => (
                              <div key={d.id} className="text-xs muted" style={{ marginTop: 4 }}>
                                Doc. {d.serie ? `${d.serie}-` : ''}
                                {d.folio ?? d.id_documento} · pagado {fmtPorMoneda(d.imp_pagado, d.moneda_dr)} · saldo{' '}
                                {fmtPorMoneda(d.imp_saldo_insoluto, d.moneda_dr)}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="vstack">
                        {pagosRecibidos.map((p) => (
                          <div
                            key={p.id}
                            className="hstack"
                            style={{ justifyContent: 'space-between', padding: '8px 12px', background: 'var(--ink-50)', borderRadius: 'var(--r-sm)' }}
                          >
                            <span className="text-sm">
                              {fmtFechaHoraTS(p.pago.fecha_pago)} · {formaPagoCorto(p.pago.forma_pago)}
                              {p.comprobante?.folio && (
                                <span className="mono text-xs muted">
                                  {' '}
                                  · comprobante {p.comprobante.serie ? `${p.comprobante.serie}-` : ''}
                                  {p.comprobante.folio}
                                </span>
                              )}
                            </span>
                            <span className="mono fw-700 text-sm">{fmtPorMoneda(p.imp_pagado, p.moneda_dr)}</span>
                          </div>
                        ))}
                        {(() => {
                          const ultimo = pagosRecibidos[pagosRecibidos.length - 1];
                          return ultimo?.imp_saldo_insoluto != null && Number(ultimo.imp_saldo_insoluto) > 0 ? (
                            <div className="text-xs fw-600" style={{ color: 'var(--amber-500)' }}>
                              Saldo pendiente: {fmtPorMoneda(ultimo.imp_saldo_insoluto, ultimo.moneda_dr)}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Conceptos */}
                <div style={{ padding: '14px 22px 8px', overflowX: 'auto' }}>
                  <div className="text-xs fw-700" style={sectionLabel}>
                    Conceptos · importes en {f.moneda ?? 'moneda no especificada'}
                  </div>
                  {conceptos.length === 0 ? (
                    <div className="text-xs muted">Sin conceptos.</div>
                  ) : (
                    <table className="tbl" style={{ minWidth: 820 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'right' }}>Cant.</th>
                          <th>Unidad SAT</th>
                          <th>Artículo</th>
                          <th>Clave SAT</th>
                          <th>Descripción</th>
                          <th style={{ textAlign: 'right' }}>Precio unitario</th>
                          <th style={{ textAlign: 'right' }}>Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conceptos.map((c) => (
                          <tr key={c.id}>
                            <td style={{ textAlign: 'right' }} className="mono text-sm">
                              {c.cantidad != null ? Number(c.cantidad).toLocaleString('es-MX', { maximumFractionDigits: 3 }) : '—'}
                            </td>
                            <td className="text-sm">
                              {c.clave_unidad_desc ?? c.unidad ?? <span className="muted">—</span>}
                              {c.clave_unidad && <div className="text-xs muted mono">{c.clave_unidad}</div>}
                            </td>
                            <td className="text-sm">{c.no_identificacion ?? <span className="muted">—</span>}</td>
                            <td className="text-sm">
                              <div className="mono text-xs">{c.clave_prod_serv ?? '—'}</div>
                              {c.clave_prod_serv_desc && <div className="text-xs muted">{c.clave_prod_serv_desc}</div>}
                            </td>
                            <td className="text-sm fw-600">{c.descripcion ?? <span className="muted">—</span>}</td>
                            <td style={{ textAlign: 'right' }} className="mono text-sm">
                              {c.valor_unitario != null ? Number(c.valor_unitario).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}
                            </td>
                            <td style={{ textAlign: 'right' }} className="mono fw-600">
                              {c.importe != null ? Number(c.importe).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Totales (subtotal, descuento, impuestos desglosados, total) */}
                <div style={{ padding: '8px 22px 20px' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: 10,
                    }}
                  >
                    {totalItems.map((t) => (
                      <div
                        key={t.label}
                        style={{
                          padding: '8px 12px',
                          background: t.strong ? 'var(--navy-900)' : 'var(--ink-50)',
                          borderRadius: 'var(--r-sm)',
                        }}
                      >
                        <div className="kpi-label" style={t.strong ? { color: 'rgba(255,255,255,0.6)' } : undefined}>
                          {t.label}
                        </div>
                        <div
                          className="mono fw-700"
                          style={{ fontSize: 15, color: t.strong ? 'white' : (t.color ?? 'var(--ink-900)') }}
                        >
                          {t.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
