/**
 * Ficha de una factura revisada: comparación guardada (contrato vs factura),
 * enlace al PDF (URL firmada) y acción de aprobar si sigue pendiente.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';
import { fmtUSD, fmtKg, fmtFechaCorta } from '@/lib/format';
import {
  fetchFacturaDetalle,
  approveFactura,
  getFacturaUrl,
} from '@/features/blufin/facturas-queries';

export function FacturaDetalleModal({
  facturaId,
  onClose,
}: {
  facturaId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const backdrop = useBackdropDismiss(onClose);

  const { data, isLoading } = useQuery({
    queryKey: ['blufin_factura_detalle', facturaId],
    queryFn: () => fetchFacturaDetalle(facturaId!),
    enabled: !!facturaId,
  });

  const aprobar = useMutation({
    mutationFn: () => approveFactura(facturaId!),
    onSuccess: () => {
      toast.success('Factura aprobada — el contrato quedó como dice la factura');
      qc.invalidateQueries({ queryKey: ['blufin_facturas'] });
      qc.invalidateQueries({ queryKey: ['blufin_factura_detalle', facturaId] });
      // approveFactura reescribe el contrato (líneas/total/saldo) — refrescar todo lo dependiente.
      qc.invalidateQueries({ queryKey: ['blufin_contratos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos_pendientes'] });
      qc.invalidateQueries({ queryKey: ['blufin_saldos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verArchivo = async (path: string) => {
    try {
      const url = await getFacturaUrl(path);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast.error('No se pudo abrir el archivo: ' + (e as Error).message);
    }
  };

  const f = data?.factura;
  const lineas = data?.lineas ?? [];
  const dif = f ? Number(f.total_factura ?? 0) - Number(f.total_contrato ?? 0) : 0;

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
                        {f.contrato?.folio ?? '—'}
                      </span>
                      <span
                        className={`badge ${f.status === 'Aprobada' ? 'badge-green' : 'badge-amber'}`}
                      >
                        {f.status ?? 'Pendiente revisión'}
                      </span>
                    </div>
                    <div className="text-xs muted">
                      Subida {fmtFechaCorta(f.fecha_subida)}
                      {f.nombre_archivo ? ` · ${f.nombre_archivo}` : ' · sin archivo'}
                    </div>
                  </div>
                  <div className="hstack" style={{ gap: 8 }}>
                    {(f.storage_path || f.drive_pdf_id) && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          f.storage_path
                            ? verArchivo(f.storage_path)
                            : window.open(
                                `https://drive.google.com/file/d/${f.drive_pdf_id}/view`,
                                '_blank',
                                'noopener',
                              )
                        }
                        title="Abrir el PDF de la factura para verificar el mapeo"
                      >
                        <Icon name="receipt" size={13} /> Ver PDF
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                </div>

                {/* Resumen de totales */}
                <div
                  style={{
                    padding: '14px 22px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                    borderBottom: '1px solid var(--ink-100)',
                  }}
                >
                  {[
                    { label: 'Total contrato', value: fmtUSD(f.total_contrato), color: 'var(--ink-900)' },
                    { label: 'Total factura', value: fmtUSD(f.total_factura), color: 'var(--ink-900)' },
                    {
                      label: 'Diferencia',
                      value: Math.abs(dif) < 0.01 ? 'Sin diferencia' : `${dif > 0 ? '+' : '−'}${fmtUSD(Math.abs(dif))}`,
                      color: Math.abs(dif) < 0.01 ? 'var(--green-500)' : dif > 0 ? 'var(--red-500)' : 'var(--amber-500)',
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

                <div style={{ padding: '14px 22px 20px', overflowX: 'auto' }}>
                  <table className="tbl" style={{ minWidth: 760 }}>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th style={{ textAlign: 'right' }}>Kg contrato</th>
                        <th style={{ textAlign: 'right' }}>Kg factura</th>
                        <th style={{ textAlign: 'right' }}>$/kg contrato</th>
                        <th style={{ textAlign: 'right' }}>$/kg factura</th>
                        <th style={{ textAlign: 'right' }}>Total contrato</th>
                        <th style={{ textAlign: 'right' }}>Total factura</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((l) => {
                        const diferente = l.match === 'diferente';
                        return (
                          <tr key={l.id} style={diferente ? { background: 'color-mix(in srgb, var(--amber-500) 5%, white)' } : undefined}>
                            <td className="text-sm fw-600">
                              {l.descripcion_contrato ?? l.descripcion_factura ?? '—'}
                              {l.descripcion_factura &&
                                l.descripcion_contrato &&
                                l.descripcion_factura !== l.descripcion_contrato && (
                                  <div className="text-xs muted">
                                    En factura: {l.descripcion_factura}
                                  </div>
                                )}
                              {l.nota_revision && (
                                <div className="text-xs muted">{l.nota_revision}</div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }} className="mono">{fmtKg(l.kg_contrato)}</td>
                            <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtKg(l.kg_factura)}</td>
                            <td style={{ textAlign: 'right' }} className="mono">
                              {l.precio_contrato != null ? '$' + Number(l.precio_contrato).toFixed(4) : '—'}
                            </td>
                            <td style={{ textAlign: 'right' }} className="mono fw-600">
                              {l.precio_factura != null ? '$' + Number(l.precio_factura).toFixed(4) : '—'}
                            </td>
                            <td style={{ textAlign: 'right' }} className="mono">{fmtUSD(l.total_contrato)}</td>
                            <td style={{ textAlign: 'right' }} className="mono fw-700">{fmtUSD(l.total_factura)}</td>
                            <td>
                              {diferente ? (
                                <span className="badge badge-amber">Diferente</span>
                              ) : (
                                <span className="badge badge-green">OK</span>
                              )}
                              {!l.aceptado && (
                                <span className="badge badge-red" style={{ marginLeft: 4 }}>
                                  No aceptada
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {f.status !== 'Aprobada' && (
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
                      Cerrar
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => aprobar.mutate()}
                      disabled={aprobar.isPending}
                    >
                      {aprobar.isPending ? (
                        <div className="spinner" style={{ width: 12, height: 12 }} />
                      ) : (
                        <Icon name="check-circle" size={13} />
                      )}
                      Aprobar factura
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
