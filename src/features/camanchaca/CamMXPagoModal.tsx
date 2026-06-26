/**
 * Modal de captura de un pago (abono) de Camanchaca México.
 * MXN puro, crédito 30 días — sin TC ni forwards (a diferencia de Blufin/SA).
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { Combobox } from '@/components/Combobox';
import { fetchCatalogosMX } from '@/features/camanchaca/mx-queries';
import {
  createPagoMX,
  fetchComprasConPendienteMX,
  type CompraMXConPendiente,
} from '@/features/camanchaca/mx-pagos-queries';
import { useAuth } from '@/lib/auth';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';
import { fmtMXN, fmtFechaCorta } from '@/lib/format';

type Props = {
  open: boolean;
  onClose: () => void;
  prefillCompraId?: string | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
};

export function CamMXPagoModal({ open, onClose, prefillCompraId }: Props) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const backdrop = useBackdropDismiss(onClose);

  const { data: cat } = useQuery({
    queryKey: ['cam_mx_catalogos', empresaId],
    queryFn: () => fetchCatalogosMX(empresaId),
    enabled: open,
  });

  const { data: compras = [] } = useQuery({
    queryKey: ['cam_mx_compras_pendientes', empresaId],
    queryFn: () => fetchComprasConPendienteMX(empresaId),
    enabled: open,
  });

  const [compraId, setCompraId] = useState<string>(prefillCompraId ?? '');
  const [monto, setMonto] = useState('');
  const [montoOverride, setMontoOverride] = useState(false);
  const [fecha, setFecha] = useState(todayISO());
  const [bancoId, setBancoId] = useState<number | ''>('');
  const [referencia, setReferencia] = useState('');

  const compra: CompraMXConPendiente | undefined = useMemo(
    () => compras.find((c) => c.id === compraId),
    [compras, compraId],
  );

  const saldoPendiente = compra ? Number(compra.saldo_pendiente ?? compra.total_mxn ?? 0) : 0;

  // Sugerir el saldo completo a menos que el usuario ya tecleó un monto
  useEffect(() => {
    if (!compra || montoOverride) return;
    setMonto(saldoPendiente > 0 ? saldoPendiente.toFixed(2) : '');
  }, [compra, montoOverride, saldoPendiente]);

  useEffect(() => {
    if (!open) return;
    setCompraId(prefillCompraId ?? '');
    setMonto('');
    setMontoOverride(false);
    setFecha(todayISO());
    setBancoId('');
    setReferencia('');
  }, [open, prefillCompraId]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!compraId) throw new Error('Selecciona la compra');
      if (toNum(monto) <= 0) throw new Error('Captura el monto en MXN');
      if (!bancoId) throw new Error('Selecciona el banco');
      await createPagoMX({
        compra_id: compraId,
        monto: toNum(monto),
        fecha,
        banco_id: bancoId as number,
        referencia: referencia || null,
      });
    },
    onSuccess: () => {
      toast.success(`Pago de ${fmtMXN(toNum(monto))} registrado`);
      qc.invalidateQueries({ queryKey: ['cam_mx_pagos'] });
      qc.invalidateQueries({ queryKey: ['cam_mx_compras'] });
      qc.invalidateQueries({ queryKey: ['cam_mx_compras_pendientes'] });
      qc.invalidateQueries({ queryKey: ['cam_mx_pagado'] });
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
                  Registrar pago
                </h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  Abono parcial o liquidación de una compra (MXN, crédito 30 días)
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                <Icon name="x" size={14} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Compra * (escribe el folio o la factura)</label>
                <Combobox
                  options={compras.map((c) => ({
                    id: c.id,
                    label: `${c.folio_interno} · ${c.factura_num} · ${fmtMXN(c.total_mxn)}`,
                  }))}
                  value={compraId || null}
                  onChange={(id) => {
                    setCompraId(id ?? '');
                    setMontoOverride(false);
                  }}
                  placeholder="CAM-002 · MX-8841…"
                />
                {compra && (
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
                      Total: <strong className="mono">{fmtMXN(compra.total_mxn)}</strong>
                    </span>
                    <span style={{ color: 'var(--ink-900)' }}>
                      Saldo pendiente:{' '}
                      <strong className="mono" style={{ color: 'var(--amber-500)' }}>
                        {fmtMXN(saldoPendiente)}
                      </strong>
                    </span>
                    {compra.fecha_vencimiento && (
                      <span>Vence: {fmtFechaCorta(compra.fecha_vencimiento)}</span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="field-label">Monto MXN *</label>
                <input
                  className="field-input mono"
                  type="number"
                  step="0.01"
                  value={monto}
                  onChange={(e) => {
                    setMonto(e.target.value);
                    setMontoOverride(true);
                  }}
                  placeholder="0.00"
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
              <div>
                <label className="field-label">Referencia bancaria</label>
                <input
                  className="field-input mono"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="SPEI 029384 · cheque 12930…"
                />
              </div>

              <div
                style={{
                  gridColumn: 'span 2',
                  padding: 16,
                  background: 'var(--ink-50)',
                  borderRadius: 'var(--r-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div className="kpi-label">Monto del pago</div>
                <div className="mono fw-700" style={{ fontSize: 18, color: 'var(--camanchaca)' }}>
                  {fmtMXN(toNum(monto))}
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
