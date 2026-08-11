/**
 * Confirmación al ejecutar un forward. Existe porque ejecutar ya no es
 * "pagar el monto del forward": se paga min(forward, faltante real), y lo que
 * sobra queda vivo como Remanente asignable a otro contenedor. El usuario tiene
 * que ver eso ANTES de confirmar — es dinero.
 *
 * La previsualización sale de `planForward`, la MISMA función que usa
 * `executeForward`, así que no puede mostrar algo distinto de lo que va a pasar.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { fmtUSD } from '@/lib/format';
import { planForward, executeForward } from '@/features/blufin/pagos-queries';
import type { BlufinForwardEnriquecido } from '@/types/database';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';

type Props = {
  open: boolean;
  onClose: () => void;
  forward: BlufinForwardEnriquecido | null;
};

function Cifra({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div>
      <div className="text-xs muted">{label}</div>
      <div className="mono fw-700" style={{ fontSize: fuerte ? 17 : 14, marginTop: 2 }}>
        {valor}
      </div>
    </div>
  );
}

export function EjecutarForwardModal({ open, onClose, forward }: Props) {
  const qc = useQueryClient();
  const backdrop = useBackdropDismiss(onClose);

  const {
    data: plan,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['blufin_forward_plan', forward?.id],
    queryFn: () => planForward(forward!.id),
    enabled: open && !!forward,
    staleTime: 0,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () => executeForward(forward!.id),
    onSuccess: (p) => {
      toast.success(
        p.excede
          ? `Pagado ${fmtUSD(p.aplicar)} · quedan ${fmtUSD(p.remanente)} en forward por asignar`
          : p.esAbono
            ? `Abono de ${fmtUSD(p.aplicar)} registrado — ${p.folio} sigue con saldo`
            : `Forward ejecutado — ${p.folio} liquidado`,
      );
      qc.invalidateQueries({ queryKey: ['blufin_forwards'] });
      qc.invalidateQueries({ queryKey: ['blufin_forwards_activos'] });
      qc.invalidateQueries({ queryKey: ['blufin_pagos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos_pendientes'] });
      qc.invalidateQueries({ queryKey: ['blufin_saldos'] });
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
              maxWidth: 480,
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
                  Ejecutar forward
                </h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  Se registra el pago al TC pactado con el banco
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
              {isLoading && (
                <div className="hstack" style={{ gap: 8, padding: '8px 0' }}>
                  <div className="spinner" style={{ width: 14, height: 14 }} />
                  <span className="text-sm muted">Calculando…</span>
                </div>
              )}

              {error && (
                <div
                  className="text-sm"
                  style={{
                    padding: 12,
                    background: 'color-mix(in srgb, var(--red-500) 8%, white)',
                    border: '1px solid color-mix(in srgb, var(--red-500) 30%, white)',
                    borderRadius: 'var(--r-sm)',
                    color: 'var(--red-500)',
                  }}
                >
                  {(error as Error).message}
                </div>
              )}

              {plan && (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 12,
                      padding: '12px 14px',
                      background: 'var(--ink-50)',
                      border: '1px solid var(--ink-200)',
                      borderRadius: 'var(--r-sm)',
                    }}
                  >
                    <Cifra
                      label={`Forward @ ${plan.tcForward.toFixed(4)}`}
                      valor={fmtUSD(plan.montoForward)}
                    />
                    <Cifra label={`Saldo de ${plan.folio}`} valor={fmtUSD(plan.faltante)} />
                    <Cifra label="Se pagará" valor={fmtUSD(plan.aplicar)} fuerte />
                  </div>

                  {(plan.excede || plan.esAbono) && (
                    <div
                      className="text-sm"
                      style={{
                        marginTop: 12,
                        padding: 12,
                        background: 'color-mix(in srgb, var(--amber-500) 8%, white)',
                        border: '1px solid color-mix(in srgb, var(--amber-500) 30%, white)',
                        borderRadius: 'var(--r-sm)',
                        lineHeight: 1.5,
                      }}
                    >
                      {plan.excede ? (
                        <>
                          El forward <strong>excede el saldo por {fmtUSD(plan.remanente)}</strong>. Se
                          pagarán {fmtUSD(plan.aplicar)} y {plan.folio} queda liquidado;{' '}
                          <strong>quedarán {fmtUSD(plan.remanente)} en forward sin asignar</strong>,
                          listos para otro contenedor o para marcarlos como usados en Salmón/Neptuno.
                        </>
                      ) : (
                        <>
                          El forward <strong>no alcanza</strong> a cubrir el saldo. Se registra un{' '}
                          <strong>abono</strong> de {fmtUSD(plan.aplicar)} y {plan.folio} queda con{' '}
                          <strong>{fmtUSD(plan.faltante - plan.aplicar)} pendientes</strong>.
                        </>
                      )}
                    </div>
                  )}

                  {!plan.excede && !plan.esAbono && (
                    <div className="text-sm muted" style={{ marginTop: 12 }}>
                      Liquida exactamente el saldo de {plan.folio}.
                    </div>
                  )}
                </>
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
                disabled={!plan || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? (
                  <div className="spinner" style={{ width: 12, height: 12 }} />
                ) : (
                  <Icon name="check" size={13} />
                )}
                {plan?.excede ? 'Pagar y dejar remanente' : 'Ejecutar forward'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
