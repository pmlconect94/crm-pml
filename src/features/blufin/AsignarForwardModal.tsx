/**
 * Asignar un forward Liberado a otro contenedor. Como el forward ya está
 * pactado con el banco y de todos modos hay que pagarlo, se reasigna a un
 * contrato con anticipo/saldo pendiente y sin forward activo para ese tipo.
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
import {
  fetchContratosConPendiente,
  fetchForwardsActivos,
  reassignForward,
} from '@/features/blufin/pagos-queries';
import type { BlufinForwardEnriquecido } from '@/types/database';

type Props = {
  open: boolean;
  onClose: () => void;
  forward: BlufinForwardEnriquecido | null;
};

type Destino = { contratoId: string; folio: string; tipo: 'anticipo' | 'saldo'; monto: number };

export function AsignarForwardModal({ open, onClose, forward }: Props) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [seleccion, setSeleccion] = useState('');

  const { data: pendientes = [] } = useQuery({
    queryKey: ['blufin_contratos_pendientes', empresaId],
    queryFn: () => fetchContratosConPendiente(empresaId),
    enabled: open,
  });
  const { data: forwardsActivos = [] } = useQuery({
    queryKey: ['blufin_forwards_activos', empresaId],
    queryFn: () => fetchForwardsActivos(empresaId),
    enabled: open,
  });

  useEffect(() => {
    if (open) setSeleccion('');
  }, [open, forward?.id]);

  // Destinos: (contrato, tipo) pendiente sin forward activo para ese tipo
  const destinos = useMemo<Destino[]>(() => {
    const conForward = new Set(forwardsActivos.map((f) => `${f.contrato_id}|${f.asociado_a}`));
    const out: Destino[] = [];
    for (const c of pendientes) {
      if (!c.anticipo_pagado && c.anticipo_usd && !conForward.has(`${c.id}|anticipo`)) {
        out.push({ contratoId: c.id, folio: c.folio, tipo: 'anticipo', monto: Number(c.anticipo_usd) });
      }
      if (!c.saldo_pagado && c.saldo_usd && !conForward.has(`${c.id}|saldo`)) {
        out.push({ contratoId: c.id, folio: c.folio, tipo: 'saldo', monto: Number(c.saldo_usd) });
      }
    }
    return out;
  }, [pendientes, forwardsActivos]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!forward) throw new Error('Sin forward');
      const d = destinos.find((x) => `${x.contratoId}|${x.tipo}` === seleccion);
      if (!d) throw new Error('Selecciona un contenedor destino');
      await reassignForward(forward.id, d.contratoId, d.tipo);
    },
    onSuccess: () => {
      toast.success('Forward reasignado — quedó Pendiente en el nuevo contenedor');
      qc.invalidateQueries({ queryKey: ['blufin_forwards'] });
      qc.invalidateQueries({ queryKey: ['blufin_forwards_activos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos_pendientes'] });
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
                  Asignar forward a contenedor
                </h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  {fmtUSD(forward.monto_usd)} @ TC{' '}
                  <span className="mono">{Number(forward.tc_forward ?? 0).toFixed(4)}</span> — pactado
                  con el banco, se reasigna a un contenedor pendiente
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
              <label className="field-label">Contenedor destino *</label>
              {destinos.length === 0 ? (
                <div
                  className="text-sm muted"
                  style={{
                    padding: '12px',
                    background: 'var(--ink-50)',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--ink-200)',
                  }}
                >
                  No hay contenedores con anticipo o saldo pendiente sin forward. Crea o libera uno
                  primero.
                </div>
              ) : (
                <Combobox
                  options={destinos.map((d) => ({
                    id: `${d.contratoId}|${d.tipo}`,
                    label: `${d.folio} · ${d.tipo} · ${fmtUSD(d.monto)} pendiente`,
                  }))}
                  value={seleccion || null}
                  onChange={(id) => setSeleccion(id ?? '')}
                  placeholder="Escribe el número de contrato…"
                  className="field-input"
                />
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
                Asignar forward
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
