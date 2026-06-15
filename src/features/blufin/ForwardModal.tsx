/**
 * Modal de captura de un Forward cambiario.
 * Un forward es un cierre de dólares con un banco para una fecha futura
 * con un TC pactado. Se asocia a un contrato y cubre anticipo o saldo.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon, type IconName } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { fetchCatalogos } from '@/features/blufin/queries';
import {
  createForward,
  fetchContratosConPendiente,
  fetchForwardsActivos,
  type ContratoConPendiente,
} from '@/features/blufin/pagos-queries';
import { useAuth } from '@/lib/auth';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';
import { fmtUSD, fmtMXN, fmtFechaCorta } from '@/lib/format';

type AsociadoA = 'anticipo' | 'saldo';

const ASOCIADOS: { id: AsociadoA; label: string; descripcion: string; icon: IconName; color: string }[] = [
  { id: 'anticipo', label: 'Cubre anticipo', descripcion: 'Forward asociado al anticipo del contrato', icon: 'banknote', color: 'var(--blue-500)' },
  { id: 'saldo',    label: 'Cubre saldo',    descripcion: 'Forward asociado al saldo restante',         icon: 'check',    color: 'var(--violet-500)' },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export function ForwardModal({ open, onClose }: Props) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const backdrop = useBackdropDismiss(onClose);

  const { data: cat } = useQuery({
    queryKey: ['blufin_catalogos', empresaId],
    queryFn: () => fetchCatalogos(empresaId),
    enabled: open,
  });

  const { data: contratos = [] } = useQuery({
    queryKey: ['blufin_contratos_pendientes', empresaId],
    queryFn: () => fetchContratosConPendiente(empresaId),
    enabled: open,
  });
  const { data: forwardsActivos = [] } = useQuery({
    queryKey: ['blufin_forwards_activos', empresaId],
    queryFn: () => fetchForwardsActivos(empresaId),
    enabled: open,
  });

  const [asociadoA, setAsociadoA] = useState<AsociadoA>('saldo');
  const [contratoId, setContratoId] = useState<string>('');
  const [montoUsd, setMontoUsd] = useState('');
  const [montoUsdOverride, setMontoUsdOverride] = useState(false);
  const [tcForward, setTcForward] = useState('17.50');
  const [fechaCierre, setFechaCierre] = useState(todayISO());
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [bancoId, setBancoId] = useState<number | ''>('');

  const contrato: ContratoConPendiente | undefined = useMemo(
    () => contratos.find((c) => c.id === contratoId),
    [contratos, contratoId],
  );

  // Forwards ya activos del contrato seleccionado
  const yaActivos = useMemo(
    () => new Set(forwardsActivos.filter((f) => f.contrato_id === contratoId).map((f) => f.asociado_a)),
    [forwardsActivos, contratoId],
  );

  // Si el asociadoA actual ya está ocupado, cambiar al otro automáticamente
  useEffect(() => {
    if (!contratoId) return;
    if (asociadoA === 'saldo' && yaActivos.has('saldo') && !yaActivos.has('anticipo')) {
      setAsociadoA('anticipo');
    } else if (asociadoA === 'anticipo' && yaActivos.has('anticipo') && !yaActivos.has('saldo')) {
      setAsociadoA('saldo');
    }
  }, [contratoId, yaActivos, asociadoA]);

  // Sugerir monto desde anticipo/saldo del contrato
  useEffect(() => {
    if (!contrato || montoUsdOverride) return;
    if (asociadoA === 'anticipo') setMontoUsd(String(contrato.anticipo_usd ?? ''));
    else setMontoUsd(String(contrato.saldo_usd ?? ''));
  }, [contrato, asociadoA, montoUsdOverride]);

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setAsociadoA('saldo');
    setContratoId('');
    setMontoUsd('');
    setMontoUsdOverride(false);
    setTcForward('17.50');
    setFechaCierre(todayISO());
    setFechaEntrega('');
    setBancoId('');
  }, [open]);

  const montoMxn = toNum(montoUsd) * toNum(tcForward);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!contratoId) throw new Error('Selecciona el contrato');
      if (toNum(montoUsd) <= 0) throw new Error('Captura el monto USD');
      if (toNum(tcForward) <= 0) throw new Error('Captura el TC pactado');
      if (!fechaEntrega) throw new Error('Captura la fecha de entrega');
      if (!bancoId) throw new Error('Selecciona el banco');
      await createForward({
        contrato_id: contratoId,
        asociado_a: asociadoA,
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
      qc.invalidateQueries({ queryKey: ['blufin_forwards'] });
      qc.invalidateQueries({ queryKey: ['blufin_forwards_activos'] });
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
            {/* Header */}
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
              <button
                className="btn btn-ghost btn-sm"
                onClick={onClose}
                aria-label="Cerrar"
                style={{ padding: 6 }}
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            {/* Asociado a */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--ink-100)',
              }}
            >
              <label className="field-label">¿Qué cubre?</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {ASOCIADOS.map((a) => {
                  const sel = asociadoA === a.id;
                  const ocupado = yaActivos.has(a.id);
                  const disabled = ocupado && contratoId;
                  return (
                    <button
                      key={a.id}
                      onClick={() => {
                        if (disabled) return;
                        setAsociadoA(a.id);
                        setMontoUsdOverride(false);
                      }}
                      disabled={!!disabled}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--r-md)',
                        border:
                          '1px solid ' +
                          (sel ? a.color : disabled ? 'var(--ink-100)' : 'var(--ink-200)'),
                        background: disabled
                          ? 'var(--ink-50)'
                          : sel
                            ? `color-mix(in srgb, ${a.color} 6%, white)`
                            : 'white',
                        textAlign: 'left',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.55 : 1,
                        transition:
                          'border-color 160ms var(--ease-soft), background-color 160ms var(--ease-soft)',
                      }}
                      title={disabled ? `Ya hay un forward pendiente para ${a.id}` : undefined}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 'var(--r-sm)',
                          background: sel ? a.color : 'var(--ink-100)',
                          color: sel ? 'white' : 'var(--ink-600)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon name={a.icon} size={14} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: disabled ? 'var(--ink-500)' : 'var(--ink-900)',
                          }}
                        >
                          {a.label}
                          {disabled && (
                            <span
                              className="text-xs"
                              style={{
                                marginLeft: 6,
                                color: 'var(--amber-500)',
                                fontWeight: 700,
                              }}
                            >
                              · YA CERRADO
                            </span>
                          )}
                        </div>
                        <div className="text-xs muted">{a.descripcion}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form */}
            <div
              style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}
            >
              <div style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Contrato *</label>
                <select
                  className="field-input mono"
                  value={contratoId}
                  onChange={(e) => {
                    setContratoId(e.target.value);
                    setMontoUsdOverride(false);
                  }}
                >
                  <option value="">— Selecciona contrato —</option>
                  {contratos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.folio} · {c.status} · {fmtUSD(c.total_usd)}
                    </option>
                  ))}
                </select>
                {contrato && (
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
                      Anticipo: <strong className="mono">{fmtUSD(contrato.anticipo_usd)}</strong>
                    </span>
                    <span>
                      Saldo: <strong className="mono">{fmtUSD(contrato.saldo_usd)}</strong>
                    </span>
                    {contrato.saldo_fecha && (
                      <span>Vence: {fmtFechaCorta(contrato.saldo_fecha)}</span>
                    )}
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
                    setMontoUsdOverride(true);
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
                  placeholder="17.5000"
                />
                <div className="text-xs muted" style={{ marginTop: 4 }}>
                  El TC fijo que cerraste con el banco
                </div>
              </div>

              <div>
                <label className="field-label">Fecha de cierre *</label>
                <input
                  type="date"
                  className="field-input"
                  value={fechaCierre}
                  onChange={(e) => setFechaCierre(e.target.value)}
                />
                <div className="text-xs muted" style={{ marginTop: 4 }}>
                  Cuándo cerraste el forward
                </div>
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
                <div className="text-xs muted" style={{ marginTop: 4 }}>
                  Cuándo se ejecuta el forward
                </div>
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
                  <div
                    className="mono fw-700"
                    style={{ fontSize: 16, color: 'var(--amber-500)' }}
                  >
                    {tcForward || '—'}
                  </div>
                </div>
                <div>
                  <div className="kpi-label">= MXN cierre</div>
                  <div
                    className="mono fw-700"
                    style={{ fontSize: 16, color: 'var(--blue-500)' }}
                  >
                    {fmtMXN(montoMxn)}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
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
                disabled={mutation.isPending}
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
