/**
 * Modal de captura de un Forward cambiario para Camanchaca SA.
 * A diferencia de Blufin, no hay anticipo/saldo — el forward cubre el pago del
 * contenedor (un forward Pendiente por contenedor).
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { Combobox } from '@/components/Combobox';
import { fetchCatalogosSA, fetchContenedoresConPendienteSA, type ContenedorConPendiente } from '@/features/camanchaca/sa-queries';
import { createForwardSA, fetchForwardsSA } from '@/features/camanchaca/sa-pagos-queries';
import { useAuth } from '@/lib/auth';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';
import { fmtUSD, fmtMXN, fmtFechaCorta } from '@/lib/format';

type Props = { open: boolean; onClose: () => void };

const todayISO = () => new Date().toISOString().slice(0, 10);
const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export function CamSAForwardModal({ open, onClose }: Props) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const backdrop = useBackdropDismiss(onClose);

  const { data: cat } = useQuery({
    queryKey: ['cam_sa_catalogos', empresaId],
    queryFn: () => fetchCatalogosSA(empresaId),
    enabled: open,
  });
  const { data: contenedores = [] } = useQuery({
    queryKey: ['cam_sa_contenedores_pendientes', empresaId],
    queryFn: () => fetchContenedoresConPendienteSA(empresaId),
    enabled: open,
  });
  const { data: forwards = [] } = useQuery({
    queryKey: ['cam_sa_forwards', empresaId],
    queryFn: () => fetchForwardsSA(empresaId),
    enabled: open,
  });

  const [contenedorId, setContenedorId] = useState('');
  const [montoUsd, setMontoUsd] = useState('');
  const [montoOverride, setMontoOverride] = useState(false);
  const [tcForward, setTcForward] = useState('18.00');
  const [fechaCierre, setFechaCierre] = useState(todayISO());
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [bancoId, setBancoId] = useState<number | ''>('');

  const contenedor: ContenedorConPendiente | undefined = useMemo(
    () => contenedores.find((c) => c.id === contenedorId),
    [contenedores, contenedorId],
  );

  const yaTieneForward = useMemo(
    () => forwards.some((f) => f.contenedor_id === contenedorId && f.status === 'Pendiente'),
    [forwards, contenedorId],
  );

  useEffect(() => {
    if (!contenedor || montoOverride) return;
    const restante = Math.max(0, Number(contenedor.total_usd ?? 0) - contenedor.pagado - contenedor.ncAplicado);
    setMontoUsd(restante > 0 ? restante.toFixed(2) : '');
  }, [contenedor, montoOverride]);

  useEffect(() => {
    if (!open) return;
    setContenedorId('');
    setMontoUsd('');
    setMontoOverride(false);
    setTcForward('18.00');
    setFechaCierre(todayISO());
    setFechaEntrega('');
    setBancoId('');
  }, [open]);

  const montoMxn = toNum(montoUsd) * toNum(tcForward);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!contenedorId) throw new Error('Selecciona el contenedor');
      if (toNum(montoUsd) <= 0) throw new Error('Captura el monto USD');
      if (toNum(tcForward) <= 0) throw new Error('Captura el TC pactado');
      if (!fechaEntrega) throw new Error('Captura la fecha de entrega');
      if (!bancoId) throw new Error('Selecciona el banco');
      await createForwardSA({
        contenedor_id: contenedorId,
        monto_usd: toNum(montoUsd),
        tc_forward: toNum(tcForward),
        fecha_cierre: fechaCierre,
        fecha_entrega: fechaEntrega,
        banco_id: bancoId as number,
        status: 'Pendiente',
      });
    },
    onSuccess: () => {
      toast.success(`Forward por ${fmtUSD(toNum(montoUsd))} cerrado`);
      qc.invalidateQueries({ queryKey: ['cam_sa_forwards'] });
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
              maxWidth: 640,
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
                  Nuevo forward cambiario
                </h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  Cierre de dólares con banco para una fecha futura
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
                    label: `${c.folio_interno} · ${c.contenedor ?? 'sin contenedor'} · ${fmtUSD(c.total_usd)}`,
                  }))}
                  value={contenedorId || null}
                  onChange={(id) => {
                    setContenedorId(id ?? '');
                    setMontoOverride(false);
                  }}
                  placeholder="Escribe el folio o el número de contenedor…"
                />
                {contenedor && (
                  <div
                    className="text-xs muted"
                    style={{
                      marginTop: 8,
                      padding: '8px 12px',
                      background: 'var(--ink-50)',
                      borderRadius: 'var(--r-sm)',
                      display: 'flex',
                      gap: 16,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      Total: <strong className="mono">{fmtUSD(contenedor.total_usd)}</strong>
                    </span>
                    <span>
                      Pagado: <strong className="mono">{fmtUSD(contenedor.pagado)}</strong>
                    </span>
                    {contenedor.fecha_vencimiento && <span>Vence: {fmtFechaCorta(contenedor.fecha_vencimiento)}</span>}
                  </div>
                )}
                {yaTieneForward && (
                  <div className="text-xs fw-600" style={{ color: 'var(--amber-500)', marginTop: 6 }}>
                    Este contenedor ya tiene un forward pendiente — ejecútalo o elimínalo antes de crear otro.
                  </div>
                )}
              </div>

              <div>
                <label className="field-label">Monto USD *</label>
                <input
                  className="field-input mono"
                  type="number"
                  step="0.01"
                  value={montoUsd}
                  onChange={(e) => {
                    setMontoUsd(e.target.value);
                    setMontoOverride(true);
                  }}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="field-label">TC pactado *</label>
                <input
                  className="field-input mono"
                  type="number"
                  step="0.0001"
                  value={tcForward}
                  onChange={(e) => setTcForward(e.target.value)}
                  placeholder="18.0000"
                />
                <div className="text-xs muted" style={{ marginTop: 4 }}>
                  El TC fijo que cerraste con el banco
                </div>
              </div>

              <div>
                <label className="field-label">Fecha de cierre *</label>
                <input type="date" className="field-input" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Fecha de entrega *</label>
                <input
                  type="date"
                  className="field-input"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  min={fechaCierre}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Banco *</label>
                <select
                  className="field-input"
                  value={bancoId}
                  onChange={(e) => setBancoId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">— Selecciona —</option>
                  {cat?.bancos.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  gridColumn: 'span 2',
                  padding: 16,
                  background: 'var(--ink-50)',
                  borderRadius: 'var(--r-md)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 16,
                }}
              >
                <div>
                  <div className="kpi-label">USD</div>
                  <div className="mono fw-700" style={{ fontSize: 16 }}>
                    {fmtUSD(toNum(montoUsd))}
                  </div>
                </div>
                <div>
                  <div className="kpi-label">× TC pactado</div>
                  <div className="mono fw-700" style={{ fontSize: 16, color: 'var(--amber-500)' }}>
                    {tcForward || '—'}
                  </div>
                </div>
                <div>
                  <div className="kpi-label">= MXN cierre</div>
                  <div className="mono fw-700" style={{ fontSize: 16, color: 'var(--blue-500)' }}>
                    {fmtMXN(montoMxn)}
                  </div>
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
              <button
                className="btn btn-primary"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || yaTieneForward}
              >
                {mutation.isPending ? (
                  <>
                    <div className="spinner" style={{ width: 14, height: 14 }} /> Guardando…
                  </>
                ) : (
                  <>
                    <Icon name="check" size={14} /> Cerrar forward
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
