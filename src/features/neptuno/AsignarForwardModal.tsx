/**
 * Asignar a una factura un forward que llegó "Por asignar" — típicamente movido
 * desde otro módulo (Blufin). El dinero ya está pactado con el banco; aquí solo
 * se decide a qué factura se aplica.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { Combobox } from '@/components/Combobox';
import { useAuth } from '@/lib/auth';
import { fmtUSD } from '@/lib/format';
import { fetchFacturasConPendiente, fetchSaldosPorFactura } from '@/features/neptuno/queries';
import { asignarForwardNep, type NepForwardEnriquecido } from '@/features/neptuno/forwards-queries';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';

type Props = {
  open: boolean;
  onClose: () => void;
  forward: NepForwardEnriquecido | null;
};

export function NepAsignarForwardModal({ open, onClose, forward }: Props) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const backdrop = useBackdropDismiss(onClose);
  const [seleccion, setSeleccion] = useState('');

  const { data: pendientes = [] } = useQuery({
    queryKey: ['neptuno_facturas_pendientes', empresaId],
    queryFn: () => fetchFacturasConPendiente(empresaId),
    enabled: open,
  });
  const { data: saldos } = useQuery({
    queryKey: ['neptuno_saldos', empresaId],
    queryFn: () => fetchSaldosPorFactura(empresaId),
    enabled: open,
  });

  useEffect(() => {
    if (open) setSeleccion('');
  }, [open, forward?.id]);

  // Facturas con saldo real pendiente (total − pagos − NCs).
  const opciones = useMemo(
    () =>
      pendientes
        .map((f) => {
          const s = saldos?.get(f.id);
          const restante = Math.max(
            0,
            Number(f.total_usd ?? 0) - (s?.pagado ?? 0) - (s?.ncAplicado ?? 0),
          );
          return { id: f.id, num: f.factura_num, restante };
        })
        .filter((o) => o.restante > 0.01),
    [pendientes, saldos],
  );

  const elegida = opciones.find((o) => o.id === seleccion);
  const montoFwd = Number(forward?.monto_usd ?? 0);
  const diferencia = elegida ? montoFwd - elegida.restante : 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!forward) throw new Error('Sin forward');
      if (!seleccion) throw new Error('Selecciona una factura');
      await asignarForwardNep(forward.id, seleccion);
    },
    onSuccess: () => {
      toast.success('Forward asignado — quedó Pendiente en esa factura');
      qc.invalidateQueries({ queryKey: ['nep_forwards'] });
      qc.invalidateQueries({ queryKey: ['neptuno_facturas_pendientes'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AnimatePresence>
      {open && forward && (
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
              maxWidth: 460,
              width: '100%',
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
                  Asignar forward a factura
                </h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  {fmtUSD(forward.monto_usd)} @ TC{' '}
                  <span className="mono">{Number(forward.tc_forward ?? 0).toFixed(4)}</span>
                  {forward.origen_modulo === 'blufin' && (
                    <> — movido de Blufin{forward.origen_ref ? ` (${forward.origen_ref})` : ''}</>
                  )}
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

            <div style={{ padding: '16px 24px' }}>
              <label className="field-label">Factura destino *</label>
              {opciones.length === 0 ? (
                <div
                  className="text-sm muted"
                  style={{
                    padding: 12,
                    background: 'var(--ink-50)',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--ink-200)',
                  }}
                >
                  No hay facturas con saldo pendiente.
                </div>
              ) : (
                <Combobox
                  options={opciones.map((o) => ({
                    id: o.id,
                    label: `${o.num} · ${fmtUSD(o.restante)} pendiente`,
                  }))}
                  value={seleccion || null}
                  onChange={(id) => setSeleccion(id ?? '')}
                  placeholder="Escribe el número de factura…"
                  className="field-input"
                />
              )}

              {elegida && Math.abs(diferencia) > 0.01 && (
                <div
                  className="text-sm"
                  style={{
                    marginTop: 10,
                    padding: 10,
                    background: 'color-mix(in srgb, var(--amber-500) 8%, white)',
                    border: '1px solid color-mix(in srgb, var(--amber-500) 30%, white)',
                    borderRadius: 'var(--r-sm)',
                    lineHeight: 1.5,
                  }}
                >
                  {diferencia > 0 ? (
                    <>
                      El forward <strong>excede</strong> lo pendiente de {elegida.num} — al ejecutarlo
                      se pagarán {fmtUSD(elegida.restante)} y quedarán{' '}
                      <strong>{fmtUSD(diferencia)}</strong> de remanente por asignar.
                    </>
                  ) : (
                    <>
                      El forward <strong>no alcanza</strong> lo pendiente de {elegida.num} — se
                      registrará como <strong>abono</strong> y quedarán {fmtUSD(-diferencia)} por
                      pagar.
                    </>
                  )}
                </div>
              )}
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
              <button
                className="btn btn-primary btn-sm"
                disabled={!seleccion || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? (
                  <div className="spinner" style={{ width: 12, height: 12 }} />
                ) : (
                  <Icon name="check" size={13} />
                )}
                Asignar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
