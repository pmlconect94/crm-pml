/**
 * Modal de captura de un pago individual.
 * Pago múltiple irá a una página dedicada (futuro), per impeccable:
 * forms cortos cabe modal; forms con muchas decisiones merecen ruta propia.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon, type IconName } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { fetchCatalogos } from '@/features/blufin/queries';
import {
  createPago,
  fetchContratosConPendiente,
  type ContratoConPendiente,
} from '@/features/blufin/pagos-queries';
import { useAuth } from '@/lib/auth';
import { fmtUSD, fmtMXN, fmtFechaCorta } from '@/lib/format';

type Tipo = 'anticipo' | 'saldo' | 'abono';

const TIPOS: { id: Tipo; label: string; descripcion: string; icon: IconName; color: string }[] = [
  { id: 'anticipo', label: 'Anticipo', descripcion: '10% del contrato', icon: 'banknote', color: 'var(--blue-500)' },
  { id: 'saldo',    label: 'Saldo',    descripcion: '90% restante',     icon: 'check',    color: 'var(--violet-500)' },
  { id: 'abono',    label: 'Abono',    descripcion: 'Pago parcial libre', icon: 'coins',  color: 'var(--amber-500)' },
];

type Props = {
  open: boolean;
  onClose: () => void;
  prefillContratoId?: string | null;
  prefillTipo?: Tipo;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export function PagoModal({ open, onClose, prefillContratoId, prefillTipo }: Props) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

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

  const [tipo, setTipo] = useState<Tipo>(prefillTipo ?? 'anticipo');
  const [contratoId, setContratoId] = useState<string>(prefillContratoId ?? '');
  const [montoUsd, setMontoUsd] = useState('');
  const [montoUsdOverride, setMontoUsdOverride] = useState(false);
  const [tc, setTc] = useState('17.50');
  const [fecha, setFecha] = useState(todayISO());
  const [bancoId, setBancoId] = useState<number | ''>('');
  const [referencia, setReferencia] = useState('');

  const contrato: ContratoConPendiente | undefined = useMemo(
    () => contratos.find((c) => c.id === contratoId),
    [contratos, contratoId],
  );

  // Sugerir monto cuando cambia contrato o tipo (a menos que ya esté override)
  useEffect(() => {
    if (!contrato || montoUsdOverride) return;
    if (tipo === 'anticipo') setMontoUsd(String(contrato.anticipo_usd ?? ''));
    else if (tipo === 'saldo') setMontoUsd(String(contrato.saldo_usd ?? ''));
    else setMontoUsd('');
  }, [contrato, tipo, montoUsdOverride]);

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setTipo(prefillTipo ?? 'anticipo');
    setContratoId(prefillContratoId ?? '');
    setMontoUsd('');
    setMontoUsdOverride(false);
    setTc('17.50');
    setFecha(todayISO());
    setBancoId('');
    setReferencia('');
  }, [open, prefillContratoId, prefillTipo]);

  const montoMxn = toNum(montoUsd) * toNum(tc);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!contratoId) throw new Error('Selecciona el contrato');
      if (toNum(montoUsd) <= 0) throw new Error('Captura el monto en USD');
      if (toNum(tc) <= 0) throw new Error('Captura el tipo de cambio');
      if (!bancoId) throw new Error('Selecciona el banco');
      await createPago({
        contrato_id: contratoId,
        tipo,
        monto_usd: toNum(montoUsd),
        tc: toNum(tc),
        fecha,
        banco_id: bancoId as number,
        referencia: referencia || null,
      });
    },
    onSuccess: () => {
      toast.success(`Pago de ${fmtUSD(toNum(montoUsd))} registrado`);
      qc.invalidateQueries({ queryKey: ['blufin_pagos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos_pendientes'] });
      // un pago spot puede liberar un forward → refrescar las vistas de forwards
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
                  Registrar pago
                </h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  Anticipo, saldo o abono parcial al proveedor
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

            {/* Tipo selector */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--ink-100)',
              }}
            >
              <label className="field-label">Tipo</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {TIPOS.map((t) => {
                  const sel = tipo === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTipo(t.id);
                        setMontoUsdOverride(false);
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--r-md)',
                        border: '1px solid ' + (sel ? t.color : 'var(--ink-200)'),
                        background: sel ? `color-mix(in srgb, ${t.color} 6%, white)` : 'white',
                        textAlign: 'left',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        cursor: 'pointer',
                        transition:
                          'border-color 160ms var(--ease-soft), background-color 160ms var(--ease-soft)',
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 'var(--r-sm)',
                          background: sel ? t.color : 'var(--ink-100)',
                          color: sel ? 'white' : 'var(--ink-600)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon name={t.icon} size={14} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)' }}>
                          {t.label}
                        </div>
                        <div className="text-xs muted">{t.descripcion}</div>
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
                  <option value="">— Selecciona contrato con pendiente —</option>
                  {contratos.map((c) => {
                    const flag =
                      tipo === 'anticipo'
                        ? c.anticipo_pagado
                          ? ' (anticipo pagado)'
                          : ''
                        : tipo === 'saldo'
                          ? c.saldo_pagado
                            ? ' (saldo pagado)'
                            : ''
                          : '';
                    return (
                      <option key={c.id} value={c.id}>
                        {c.folio} · {c.status} · {fmtUSD(c.total_usd)}{flag}
                      </option>
                    );
                  })}
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
                      {contrato.anticipo_pagado && ' ✓'}
                    </span>
                    <span>
                      Saldo: <strong className="mono">{fmtUSD(contrato.saldo_usd)}</strong>
                      {contrato.saldo_pagado && ' ✓'}
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
                <label className="field-label">TC capturado *</label>
                <input
                  className="field-input mono"
                  type="number"
                  step="0.0001"
                  value={tc}
                  onChange={(e) => setTc(e.target.value)}
                  placeholder="17.5000"
                />
                <div className="text-xs muted" style={{ marginTop: 4 }}>
                  Banxico del día: pendiente integración
                </div>
              </div>

              <div>
                <label className="field-label">Fecha *</label>
                <input
                  type="date"
                  className="field-input"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
              <div>
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

              <div style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Referencia bancaria</label>
                <input
                  className="field-input mono"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="SPEI 029384 · cheque 12930 · etc"
                />
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
                  <div className="kpi-label">× TC</div>
                  <div className="mono fw-700" style={{ fontSize: 16 }}>
                    {tc || '—'}
                  </div>
                </div>
                <div>
                  <div className="kpi-label">= MXN</div>
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
                    <Icon name="check" size={14} /> Registrar pago
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
