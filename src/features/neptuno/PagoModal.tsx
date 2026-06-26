/**
 * Modal de captura de un pago individual al proveedor Neptuno (USD).
 * Pago completo o abono parcial, con TC por pago.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon, type IconName } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { Combobox } from '@/components/Combobox';
import { fetchCatalogos, fetchFacturasConPendiente, fetchSaldosPorFactura, type FacturaConPendiente } from '@/features/neptuno/queries';
import { createPago } from '@/features/neptuno/pagos-queries';
import { useAuth } from '@/lib/auth';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';
import { fmtUSD, fmtMXN, fmtFechaCorta } from '@/lib/format';

type Tipo = 'completo' | 'abono';

const TIPOS: { id: Tipo; label: string; descripcion: string; icon: IconName; color: string }[] = [
  { id: 'completo', label: 'Pago completo', descripcion: 'Liquida el saldo', icon: 'check', color: 'var(--violet-500)' },
  { id: 'abono', label: 'Abono', descripcion: 'Pago parcial', icon: 'coins', color: 'var(--amber-500)' },
];

type Props = {
  open: boolean;
  onClose: () => void;
  prefillFacturaId?: string | null;
  prefillTipo?: Tipo;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export function PagoModal({ open, onClose, prefillFacturaId, prefillTipo }: Props) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const backdrop = useBackdropDismiss(onClose);

  const { data: cat } = useQuery({
    queryKey: ['neptuno_catalogos', empresaId],
    queryFn: () => fetchCatalogos(empresaId),
    enabled: open,
  });

  const { data: facturas = [] } = useQuery({
    queryKey: ['neptuno_facturas_pendientes', empresaId],
    queryFn: () => fetchFacturasConPendiente(empresaId),
    enabled: open,
  });

  const { data: saldos } = useQuery({
    queryKey: ['neptuno_saldos', empresaId],
    queryFn: () => fetchSaldosPorFactura(empresaId),
    enabled: open,
  });

  const [tipo, setTipo] = useState<Tipo>(prefillTipo ?? 'completo');
  const [facturaId, setFacturaId] = useState<string>(prefillFacturaId ?? '');
  const [montoUsd, setMontoUsd] = useState('');
  const [montoUsdOverride, setMontoUsdOverride] = useState(false);
  const [tc, setTc] = useState('17.50');
  const [fecha, setFecha] = useState(todayISO());
  const [bancoId, setBancoId] = useState<number | ''>('');
  const [referencia, setReferencia] = useState('');

  const factura: FacturaConPendiente | undefined = useMemo(
    () => facturas.find((f) => f.id === facturaId),
    [facturas, facturaId],
  );

  // Lo que falta por pagar = total − pagado − NCs aplicadas.
  const restantePorPagar = factura
    ? Math.max(
        0,
        Number(factura.total_usd ?? 0) -
          (saldos?.get(factura.id)?.pagado ?? 0) -
          (saldos?.get(factura.id)?.ncAplicado ?? 0),
      )
    : 0;

  // Sugerir monto cuando cambia factura o tipo (a menos que ya esté override)
  useEffect(() => {
    if (!factura || montoUsdOverride) return;
    if (tipo === 'completo') setMontoUsd(restantePorPagar > 0 ? restantePorPagar.toFixed(2) : '');
    else setMontoUsd('');
  }, [factura, tipo, montoUsdOverride, restantePorPagar]);

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setTipo(prefillTipo ?? 'completo');
    setFacturaId(prefillFacturaId ?? '');
    setMontoUsd('');
    setMontoUsdOverride(false);
    setTc('17.50');
    setFecha(todayISO());
    setBancoId('');
    setReferencia('');
  }, [open, prefillFacturaId, prefillTipo]);

  const montoMxn = toNum(montoUsd) * toNum(tc);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!facturaId) throw new Error('Selecciona la factura');
      if (toNum(montoUsd) <= 0) throw new Error('Captura el monto en USD');
      if (toNum(tc) <= 0) throw new Error('Captura el tipo de cambio');
      if (!bancoId) throw new Error('Selecciona el banco');
      await createPago({
        factura_id: facturaId,
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
      qc.invalidateQueries({ queryKey: ['neptuno_pagos'] });
      qc.invalidateQueries({ queryKey: ['neptuno_facturas'] });
      qc.invalidateQueries({ queryKey: ['neptuno_facturas_pendientes'] });
      qc.invalidateQueries({ queryKey: ['neptuno_saldos'] });
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
                  Registrar pago
                </h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  Pago completo o abono parcial al proveedor (USD)
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
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--ink-100)' }}>
              <label className="field-label">Tipo</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
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
                <label className="field-label">Factura * (escribe el número)</label>
                <Combobox
                  options={facturas.map((f) => ({
                    id: f.id,
                    label: `${f.factura_num} · ${fmtUSD(f.total_usd)} · ${f.status ?? 'Pendiente'}`,
                  }))}
                  value={facturaId || null}
                  onChange={(id) => {
                    setFacturaId(id ?? '');
                    setMontoUsdOverride(false);
                  }}
                  placeholder="NEP-2026-001…"
                />
                {factura && (
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
                      Total: <strong className="mono">{fmtUSD(factura.total_usd)}</strong>
                    </span>
                    <span style={{ color: 'var(--ink-900)' }}>
                      Falta por pagar:{' '}
                      <strong className="mono" style={{ color: 'var(--violet-500)' }}>
                        {fmtUSD(restantePorPagar)}
                      </strong>
                    </span>
                    {factura.fecha_vencimiento && (
                      <span>Vence: {fmtFechaCorta(factura.fecha_vencimiento)}</span>
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
                  <div className="mono fw-700" style={{ fontSize: 16, color: 'var(--blue-500)' }}>
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
