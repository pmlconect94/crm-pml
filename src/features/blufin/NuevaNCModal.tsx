import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { Combobox } from '@/components/Combobox';
import { useAuth } from '@/lib/auth';
import { fmtUSD, fmtMXN } from '@/lib/format';
import { fetchContratos } from '@/features/blufin/queries';
import { createNotaCredito, NC_RAZON_META, type NcRazon } from '@/features/blufin/nc-queries';

const hoyISO = () => new Date().toISOString().slice(0, 10);
const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
};

export function NuevaNCModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const { data: contratos = [] } = useQuery({
    queryKey: ['blufin_contratos', empresaId],
    queryFn: () => fetchContratos(empresaId),
    enabled: open,
  });

  const [razon, setRazon] = useState<NcRazon>('presentacion');
  const [contratoId, setContratoId] = useState('');
  const [folioTimbrado, setFolioTimbrado] = useState('');
  const [tengoMonto, setTengoMonto] = useState(false);
  const [montoUsd, setMontoUsd] = useState('');
  const [tc, setTc] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [nota, setNota] = useState('');

  useEffect(() => {
    if (!open) return;
    setRazon('presentacion');
    setContratoId('');
    setFolioTimbrado('');
    setTengoMonto(false);
    setMontoUsd('');
    setTc('');
    setFecha(hoyISO());
    setNota('');
  }, [open]);

  const contrato = useMemo(() => contratos.find((c) => c.id === contratoId), [contratos, contratoId]);

  // En descuento el monto es obligatorio; en los demás es opcional ("sin monto")
  const montoObligatorio = razon === 'descuento';
  const capturaMonto = montoObligatorio || tengoMonto;
  const monto = toNum(montoUsd);
  const montoMxn = monto * toNum(tc);

  const valid =
    !!contratoId &&
    !!fecha &&
    (!capturaMonto || monto > 0) &&
    (razon !== 'descuento' || nota.trim() !== '' || monto > 0);

  const mutation = useMutation({
    mutationFn: () =>
      createNotaCredito({
        empresaId,
        razon,
        contrato_origen_id: contratoId,
        folio_timbrado: folioTimbrado.trim() || null,
        fecha,
        nota: nota.trim() || null,
        monto_usd: capturaMonto ? monto : null,
        tc: capturaMonto && toNum(tc) > 0 ? toNum(tc) : null,
      }),
    onSuccess: () => {
      toast.success('Nota de crédito emitida');
      qc.invalidateQueries({ queryKey: ['blufin_notas_credito'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const meta = NC_RAZON_META[razon];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          style={overlay}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={SPRING.snappy}
            onClick={(e) => e.stopPropagation()}
            style={{ ...sheet, maxWidth: 640 }}
          >
            <div style={header}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Nueva nota de crédito
                </h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  Vinculada a un contrato. Puedes capturar el monto ahora o después.
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                <Icon name="x" size={14} />
              </button>
            </div>

            <div style={{ padding: '16px 22px', display: 'grid', gap: 14 }}>
              {/* Motivo */}
              <div>
                <label className="field-label">Motivo</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(Object.keys(NC_RAZON_META) as NcRazon[]).map((id) => {
                    const m = NC_RAZON_META[id];
                    const sel = razon === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setRazon(id)}
                        style={{
                          padding: 10,
                          borderRadius: 'var(--r-md)',
                          border: '1px solid ' + (sel ? m.color : 'var(--ink-200)'),
                          background: sel ? m.bg : 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div className="fw-700 text-sm" style={{ color: sel ? m.text : 'var(--ink-900)' }}>
                          {m.short}
                        </div>
                        <div className="text-xs" style={{ color: sel ? m.text : 'var(--ink-400)', marginTop: 2 }}>
                          {m.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Contrato origen */}
              <div>
                <label className="field-label">Contrato origen * (escribe el número)</label>
                <Combobox
                  options={contratos.map((c) => ({
                    id: c.id,
                    label: `${c.folio} · ${fmtUSD(c.total_usd)} · ${c.status}`,
                  }))}
                  value={contratoId || null}
                  onChange={(id) => setContratoId(id ?? '')}
                  placeholder="MCO-CV-003502…"
                />
                {contrato && (
                  <div
                    className="text-xs"
                    style={{
                      marginTop: 5,
                      padding: '7px 10px',
                      background: 'var(--ink-50)',
                      borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--ink-200)',
                      color: 'var(--ink-700)',
                      display: 'flex',
                      gap: 16,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      Presentación: <span className="fw-700">{contrato.presentacion ?? '—'}</span>
                    </span>
                    <span>
                      Total: <span className="mono fw-600">{fmtUSD(contrato.total_usd)}</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Monto */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--ink-50)',
                  border: '1px dashed var(--ink-300)',
                }}
              >
                <div className="text-xs fw-700" style={{ color: 'var(--ink-500)', marginBottom: 6 }}>
                  MONTO
                </div>
                {!montoObligatorio && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: tengoMonto ? 10 : 0 }}>
                    <input type="checkbox" checked={tengoMonto} onChange={(e) => setTengoMonto(e.target.checked)} />
                    <span className="text-sm fw-600">Ya tengo el monto — el proveedor me lo comunicó</span>
                  </label>
                )}
                {capturaMonto ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="field-label">Monto NC USD *</label>
                      <input
                        type="number"
                        step="0.01"
                        className="field-input mono"
                        value={montoUsd}
                        onChange={(e) => setMontoUsd(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="field-label">TC (opcional)</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="field-input mono"
                        value={tc}
                        onChange={(e) => setTc(e.target.value)}
                        placeholder="17.5000"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-xs muted">
                    La NC se crea en status <strong>Sin monto</strong>. Lo capturas aquí cuando el
                    proveedor te lo indique.
                  </div>
                )}
                {capturaMonto && monto > 0 && (
                  <div className="text-xs" style={{ marginTop: 8, color: 'var(--ink-700)' }}>
                    NC por <span className="mono fw-700" style={{ color: 'var(--red-500)' }}>−{fmtUSD(monto)}</span>
                    {toNum(tc) > 0 && (
                      <>
                        {' '}· <span className="mono fw-600" style={{ color: 'var(--blue-500)' }}>−{fmtMXN(montoMxn)}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Folio timbrado + fecha */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Folio timbrado SAT (opcional)</label>
                  <input
                    className="field-input mono"
                    value={folioTimbrado}
                    onChange={(e) => setFolioTimbrado(e.target.value)}
                    placeholder="CFDI del proveedor"
                  />
                </div>
                <div>
                  <label className="field-label">Fecha de emisión</label>
                  <input type="date" className="field-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="field-label">
                  Nota / detalle {razon === 'descuento' ? '*' : '(opcional)'}
                </label>
                <textarea
                  className="field-input"
                  rows={2}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder={
                    razon === 'presentacion'
                      ? 'Ej. Pactado Paletizado, llegó Granel'
                      : razon === 'faltante'
                        ? 'Ej. 200 kg faltantes vs lo facturado'
                        : 'Ej. Descuento por volumen mayo 2026'
                  }
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={footer}>
              <div className="hstack" style={{ gap: 8, marginLeft: 'auto' }}>
                <button className="btn btn-ghost btn-sm" onClick={onClose}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!valid || mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  {mutation.isPending ? (
                    <div className="spinner" style={{ width: 12, height: 12 }} />
                  ) : (
                    <Icon name="check" size={13} />
                  )}
                  Emitir NC{!capturaMonto ? ' (sin monto)' : ''}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const overlay = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(10, 37, 64, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  zIndex: 100,
};
const sheet = {
  background: 'white',
  borderRadius: 'var(--r-lg)',
  boxShadow: 'var(--shadow-xl)',
  width: '100%',
  maxHeight: '92vh',
  overflowY: 'auto' as const,
};
const header = {
  padding: '18px 22px',
  borderBottom: '1px solid var(--ink-100)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
};
const footer = {
  padding: '14px 22px',
  borderTop: '1px solid var(--ink-100)',
  display: 'flex',
  background: 'var(--ink-50)',
  borderRadius: '0 0 var(--r-lg) var(--r-lg)',
};
