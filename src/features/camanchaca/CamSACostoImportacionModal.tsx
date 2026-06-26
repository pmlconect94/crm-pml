/**
 * Modal de captura de un costo de importación (MXN) a una agencia aduanal de un
 * contenedor SA. Puede haber MÚLTIPLES por contenedor (LTP + MAFA, etc.).
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { Combobox } from '@/components/Combobox';
import { fetchCatalogosSA, fetchContenedoresSA } from '@/features/camanchaca/sa-queries';
import { createCostoImportacionSA } from '@/features/camanchaca/sa-pagos-queries';
import { useAuth } from '@/lib/auth';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';
import { fmtMXN } from '@/lib/format';

type Props = { open: boolean; onClose: () => void; prefillContenedorId?: string | null };

const todayISO = () => new Date().toISOString().slice(0, 10);
const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export function CamSACostoImportacionModal({ open, onClose, prefillContenedorId }: Props) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const backdrop = useBackdropDismiss(onClose);

  const { data: cat } = useQuery({
    queryKey: ['cam_sa_catalogos', empresaId],
    queryFn: () => fetchCatalogosSA(empresaId),
    enabled: open,
  });
  const { data: contenedores = [] } = useQuery({
    queryKey: ['cam_sa_contenedores', empresaId],
    queryFn: () => fetchContenedoresSA(empresaId),
    enabled: open,
  });

  const [contenedorId, setContenedorId] = useState('');
  const [agenciaId, setAgenciaId] = useState<number | ''>('');
  const [concepto, setConcepto] = useState('');
  const [montoMxn, setMontoMxn] = useState('');
  const [pagado, setPagado] = useState(false);
  const [fecha, setFecha] = useState(todayISO());
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    if (!open) return;
    setContenedorId(prefillContenedorId ?? '');
    setAgenciaId('');
    setConcepto('');
    setMontoMxn('');
    setPagado(false);
    setFecha(todayISO());
    setObservaciones('');
  }, [open, prefillContenedorId]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!contenedorId) throw new Error('Selecciona el contenedor');
      if (toNum(montoMxn) <= 0) throw new Error('Captura el monto en MXN');
      await createCostoImportacionSA({
        contenedor_id: contenedorId,
        agencia_id: agenciaId === '' ? null : (agenciaId as number),
        concepto: concepto.trim() || null,
        monto_mxn: toNum(montoMxn),
        pagado,
        fecha,
        observaciones: observaciones.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success('Costo de importación registrado');
      qc.invalidateQueries({ queryKey: ['cam_sa_costos_importacion'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_costos'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
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
            style={{
              background: 'white',
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-xl)',
              maxWidth: 560,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--ink-100)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Costo de importación
                </h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  Pago en MXN a la agencia aduanal en Manzanillo
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                <Icon name="x" size={14} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Contenedor *</label>
                <Combobox
                  options={contenedores.map((c) => ({
                    id: c.id,
                    label: `${c.folio_interno} · ${c.contenedor ?? 'sin contenedor'}`,
                  }))}
                  value={contenedorId || null}
                  onChange={(id) => setContenedorId(id ?? '')}
                  placeholder="CAM-001…"
                />
              </div>
              <div>
                <label className="field-label">Agencia aduanal</label>
                <select
                  className="field-input"
                  value={agenciaId}
                  onChange={(e) => setAgenciaId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">— Selecciona —</option>
                  {cat?.agencias.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.razon_social}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Concepto</label>
                <input
                  className="field-input"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  placeholder="Pedimento, flete, maniobras…"
                />
              </div>
              <div>
                <label className="field-label">Monto MXN *</label>
                <input
                  className="field-input mono"
                  type="number"
                  step="0.01"
                  value={montoMxn}
                  onChange={(e) => setMontoMxn(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="field-label">Fecha</label>
                <input type="date" className="field-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={pagado} onChange={(e) => setPagado(e.target.checked)} />
                  <span className="text-sm fw-600">Ya pagado a la agencia</span>
                </label>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Observaciones</label>
                <input
                  className="field-input"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Pedimento 06/2026-001…"
                />
              </div>
              <div
                style={{
                  gridColumn: 'span 2',
                  padding: 14,
                  background: 'var(--ink-50)',
                  borderRadius: 'var(--r-md)',
                }}
              >
                <div className="kpi-label">Monto</div>
                <div className="mono fw-700" style={{ fontSize: 18, color: 'var(--blue-500)' }}>
                  {fmtMXN(toNum(montoMxn))}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--ink-100)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                background: 'var(--ink-50)',
              }}
            >
              <button className="btn btn-outline" onClick={onClose} disabled={mutation.isPending}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <div className="spinner" style={{ width: 14, height: 14 }} /> Guardando…
                  </>
                ) : (
                  <>
                    <Icon name="check" size={14} /> Registrar costo
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
