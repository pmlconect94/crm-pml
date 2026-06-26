import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter, SPRING } from '@/components/motion';
import { StatStrip } from '@/components/StatStrip';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { useAuth } from '@/lib/auth';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';
import { fmtKg, fmtFechaCorta } from '@/lib/format';
import {
  fetchOrdenesPlaneadas,
  createOrdenPlaneada,
  deleteOrdenPlaneada,
} from '@/features/camanchaca/sa-queries';
import type { CamOrdenPlaneada } from '@/types/database';

const STATUS_META: Record<string, { bg: string; text: string; label: string }> = {
  planeado: { bg: '#E6F4FF', text: '#1E40AF', label: 'Planeado' },
  confirmado: { bg: '#D1FAE5', text: '#065F46', label: 'Confirmado' },
  cancelado: { bg: 'var(--ink-100)', text: 'var(--ink-600)', label: 'Cancelado' },
};

export function CamSAPlaneacionPage() {
  const { empresaId, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);

  const { data: ordenes = [], isLoading } = useQuery({
    queryKey: ['cam_sa_planeacion', empresaId],
    queryFn: () => fetchOrdenesPlaneadas(empresaId),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteOrdenPlaneada(id),
    onSuccess: () => {
      toast.success('Orden planeada eliminada');
      qc.invalidateQueries({ queryKey: ['cam_sa_planeacion'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const planeadas = ordenes.filter((o) => o.status === 'planeado').length;
    const confirmadas = ordenes.filter((o) => o.status === 'confirmado').length;
    const kg = ordenes.reduce((s, o) => s + Number(o.kg_estimados ?? 0), 0);
    return { planeadas, confirmadas, kg };
  }, [ordenes]);

  return (
    <>
      <PageEnter className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Planeación
          </h2>
          <p className="page-subtitle">
            Calendario de Felipe (vía WhatsApp): OC, descripción y llegada estimada — antes de la factura
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setNuevoOpen(true)}>
          <Icon name="plus" size={13} /> Nueva orden planeada
        </button>
      </PageEnter>

      <StatStrip
        stats={[
          { value: ordenes.length, label: 'órdenes' },
          { value: kpis.planeadas, label: 'planeadas', color: kpis.planeadas > 0 ? 'var(--blue-500)' : undefined },
          { value: kpis.confirmadas, label: 'confirmadas', color: 'var(--green-500)' },
          { value: fmtKg(kpis.kg), label: 'kg estimados' },
        ]}
      />

      <div className="card">
        {isLoading ? (
          <div style={{ padding: 20 }}>
            <div className="skeleton-bar" style={{ width: '40%', marginBottom: 10 }} />
            <div className="skeleton-bar" style={{ width: '70%' }} />
          </div>
        ) : ordenes.length === 0 ? (
          <div className="empty">
            <Icon name="calendar" size={36} />
            <div className="empty-title">Sin órdenes planeadas</div>
            <p className="muted">
              Captura lo que Felipe manda por WhatsApp (OC, descripción y llegada estimada). Cuando
              llegue la factura, confírmala como contenedor.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => setNuevoOpen(true)} style={{ marginTop: 12 }}>
              <Icon name="plus" size={13} /> Nueva orden planeada
            </button>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>OC proveedor</th>
                <th>Descripción</th>
                <th style={{ textAlign: 'right' }}>Kg estimados</th>
                <th>Llegada estimada</th>
                <th>Status</th>
                <th>Folio interno</th>
                <th style={{ width: 200 }}></th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => {
                const m = STATUS_META[o.status] ?? STATUS_META.planeado;
                return (
                  <tr key={o.id}>
                    <td className="mono fw-700 text-sm">{o.oc_proveedor}</td>
                    <td className="text-sm">{o.descripcion ?? <span className="muted">—</span>}</td>
                    <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtKg(o.kg_estimados)}</td>
                    <td className="text-sm">{o.llegada_estimada ?? <span className="muted">—</span>}</td>
                    <td>
                      <span className="badge" style={{ background: m.bg, color: m.text }}>
                        {m.label}
                      </span>
                    </td>
                    <td className="mono text-sm">{o.folio_interno ?? <span className="muted">—</span>}</td>
                    <td>
                      <div className="hstack" style={{ gap: 4, justifyContent: 'flex-end' }}>
                        {o.status !== 'confirmado' && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() =>
                              navigate(
                                `/app/importaciones/camanchaca/sa/contenedores/nuevo?planeada=${o.id}`,
                              )
                            }
                            title="Confirmar con factura — crea el contenedor"
                          >
                            <Icon name="check" size={12} /> Confirmar
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setDeleteTarget({
                              id: o.id,
                              description: `${o.oc_proveedor} · ${o.descripcion ?? '—'}`,
                            })
                          }
                          title="Eliminar"
                          style={{ padding: 6, color: 'var(--red-500)' }}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <NuevaOrdenModal open={nuevoOpen} onClose={() => setNuevoOpen(false)} />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what="esta orden planeada"
        itemDescription={deleteTarget?.description}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
      {user && !user.capturar && null}
    </>
  );
}

/* ─── Modal nueva orden planeada ───────────────────────────────────── */

function NuevaOrdenModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const backdrop = useBackdropDismiss(onClose);

  const [oc, setOc] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [kg, setKg] = useState('');
  const [llegada, setLlegada] = useState('');

  const reset = () => {
    setOc('');
    setDescripcion('');
    setKg('');
    setLlegada('');
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!oc.trim()) throw new Error('Captura la OC del proveedor');
      const kgNum = parseFloat(kg.replace(',', '.'));
      await createOrdenPlaneada({
        empresa_id: empresaId,
        oc_proveedor: oc.trim(),
        descripcion: descripcion.trim() || null,
        kg_estimados: Number.isNaN(kgNum) ? null : kgNum,
        llegada_estimada: llegada.trim() || null,
        status: 'planeado',
      });
    },
    onSuccess: () => {
      toast.success('Orden planeada registrada');
      qc.invalidateQueries({ queryKey: ['cam_sa_planeacion'] });
      reset();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
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
            style={{ background: 'white', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xl)', maxWidth: 480, width: '100%' }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--ink-100)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nueva orden planeada</h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  Lo que Felipe avisa por WhatsApp — texto libre
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                <Icon name="x" size={14} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'grid', gap: 14 }}>
              <div>
                <label className="field-label">OC del proveedor *</label>
                <input className="field-input mono" value={oc} onChange={(e) => setOc(e.target.value)} placeholder="OC-12345" />
              </div>
              <div>
                <label className="field-label">Descripción estimada</label>
                <input
                  className="field-input"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="18 ton salmón lonja premium"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Kg estimados</label>
                  <input type="number" step="0.001" className="field-input mono" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="18000" />
                </div>
                <div>
                  <label className="field-label">Llegada estimada</label>
                  <input className="field-input" value={llegada} onChange={(e) => setLlegada(e.target.value)} placeholder="principios mayo 2026" />
                </div>
              </div>
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
              <button className="btn btn-primary btn-sm" disabled={!oc.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="check" size={13} />}
                Guardar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// re-export tipo por si se usa fuera
export type { CamOrdenPlaneada };
