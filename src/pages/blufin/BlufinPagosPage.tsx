import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { StatStrip } from '@/components/StatStrip';
import { useAuth } from '@/lib/auth';
import { fmtUSD, fmtMXN, fmtFecha, fmtFechaCorta, diasDesde } from '@/lib/format';
import {
  fetchPagos,
  fetchForwards,
  fetchContratosConPendiente,
  fetchForwardsActivos,
  deletePago,
  deleteForward,
  executeForward,
  type ContratoConPendiente,
  type ForwardActivo,
} from '@/features/blufin/pagos-queries';
import { fetchCatalogos } from '@/features/blufin/queries';
import { PagoModal } from '@/features/blufin/PagoModal';
import { ForwardModal } from '@/features/blufin/ForwardModal';
import { AsignarForwardModal } from '@/features/blufin/AsignarForwardModal';
import type { BlufinPagoEnriquecido, BlufinForwardEnriquecido } from '@/types/database';

type View = 'pendientes' | 'realizados' | 'forwards';

const TIPO_META: Record<string, { bg: string; text: string; label: string }> = {
  anticipo: { bg: 'var(--blue-100)',   text: '#1E40AF', label: 'Anticipo' },
  saldo:    { bg: 'var(--violet-100)', text: '#5B21B6', label: 'Saldo' },
  abono:    { bg: 'var(--amber-100)',  text: '#92400E', label: 'Abono' },
};

function TipoPill({ tipo }: { tipo: string }) {
  const m = TIPO_META[tipo] ?? { bg: 'var(--ink-100)', text: 'var(--ink-700)', label: tipo };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        background: m.bg,
        color: m.text,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {m.label}
    </span>
  );
}

function BancoTag({ nombre }: { nombre: string | undefined }) {
  if (!nombre) return <span className="text-xs muted">—</span>;
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '2px 8px',
        borderRadius: 'var(--r-sm)',
        background: 'var(--ink-100)',
        color: 'var(--ink-700)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {nombre}
    </span>
  );
}

export function BlufinPagosPage() {
  const { empresaId } = useAuth();
  const [view, setView] = useState<View>('pendientes');
  const [modalOpen, setModalOpen] = useState(false);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ contratoId?: string; tipo?: 'anticipo' | 'saldo' | 'abono' }>(
    {},
  );
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'pago'; id: string; description: string }
    | { kind: 'forward'; id: string; description: string }
    | null
  >(null);
  const [asignarTarget, setAsignarTarget] = useState<BlufinForwardEnriquecido | null>(null);
  const qc = useQueryClient();

  const deletePagoMut = useMutation({
    mutationFn: (id: string) => deletePago(id),
    onSuccess: () => {
      toast.success('Pago eliminado');
      qc.invalidateQueries({ queryKey: ['blufin_pagos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos_pendientes'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteForwardMut = useMutation({
    mutationFn: (id: string) => deleteForward(id),
    onSuccess: () => {
      toast.success('Forward eliminado');
      qc.invalidateQueries({ queryKey: ['blufin_forwards'] });
      qc.invalidateQueries({ queryKey: ['blufin_forwards_activos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: pagos = [], isLoading: loadingPagos } = useQuery({
    queryKey: ['blufin_pagos', empresaId],
    queryFn: () => fetchPagos(empresaId),
  });
  const { data: forwards = [], isLoading: loadingForwards } = useQuery({
    queryKey: ['blufin_forwards', empresaId],
    queryFn: () => fetchForwards(empresaId),
  });
  const { data: pendientes = [], isLoading: loadingPendientes } = useQuery({
    queryKey: ['blufin_contratos_pendientes', empresaId],
    queryFn: () => fetchContratosConPendiente(empresaId),
  });
  const { data: cat } = useQuery({
    queryKey: ['blufin_catalogos', empresaId],
    queryFn: () => fetchCatalogos(empresaId),
  });
  const { data: forwardsActivos = [] } = useQuery({
    queryKey: ['blufin_forwards_activos', empresaId],
    queryFn: () => fetchForwardsActivos(empresaId),
  });

  const executeForwardMut = useMutation({
    mutationFn: (id: string) => executeForward(id),
    onSuccess: () => {
      toast.success('Forward ejecutado y registrado como pago');
      qc.invalidateQueries({ queryKey: ['blufin_forwards'] });
      qc.invalidateQueries({ queryKey: ['blufin_forwards_activos'] });
      qc.invalidateQueries({ queryKey: ['blufin_pagos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos_pendientes'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const totalUsd = pagos.reduce((s, p) => s + Number(p.monto_usd ?? 0), 0);
    const totalMxn = pagos.reduce((s, p) => s + Number(p.monto_mxn ?? 0), 0);
    const tcEfectivo = totalUsd > 0 ? totalMxn / totalUsd : 0;
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const esteMes = pagos.filter((p) => new Date(p.fecha + 'T12:00:00') >= inicioMes).length;

    const usdPendiente = pendientes.reduce((s, c) => {
      let pdte = 0;
      if (!c.anticipo_pagado) pdte += Number(c.anticipo_usd ?? 0);
      if (!c.saldo_pagado) pdte += Number(c.saldo_usd ?? 0);
      return s + pdte;
    }, 0);

    return { totalUsd, totalMxn, tcEfectivo, esteMes, usdPendiente };
  }, [pagos, pendientes]);

  const openModal = (p?: { contratoId?: string; tipo?: 'anticipo' | 'saldo' | 'abono' }) => {
    setPrefill(p ?? {});
    setModalOpen(true);
  };

  return (
    <>
      <PageEnter
        className="hstack"
        style={{ justifyContent: 'space-between', marginBottom: 12 }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Pagos al proveedor
          </h2>
          <p className="page-subtitle">Anticipos, saldos, abonos y forwards cambiarios</p>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <a
            href="/app/importaciones/blufin/pagos/multiple"
            className="btn btn-outline btn-sm"
            style={{ textDecoration: 'none' }}
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, '', '/app/importaciones/blufin/pagos/multiple');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          >
            <Icon name="package" size={13} /> Pago múltiple
          </a>
          <button className="btn btn-outline btn-sm" onClick={() => setForwardModalOpen(true)}>
            <Icon name="calendar" size={13} /> Nuevo forward
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openModal()}>
            <Icon name="plus" size={13} /> Registrar pago
          </button>
        </div>
      </PageEnter>

      {/* Stat strip compacto — una sola línea para dar más espacio a la tabla */}
      <StatStrip
        stats={[
          { value: fmtUSD(kpis.totalUsd), label: 'pagado' },
          {
            value: fmtUSD(kpis.usdPendiente),
            label: `pendiente · ${pendientes.length} contratos`,
            color: kpis.usdPendiente > 0 ? 'var(--amber-500)' : undefined,
          },
          { value: kpis.tcEfectivo > 0 ? kpis.tcEfectivo.toFixed(4) : '—', label: 'TC efectivo' },
          { value: kpis.esteMes, label: `pagos este mes · de ${pagos.length}` },
        ]}
      />

      {/* Sub-tabs */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        {(['pendientes', 'realizados', 'forwards'] as const).map((v) => (
          <button
            key={v}
            className={`tab ${view === v ? 'active' : ''}`}
            onClick={() => setView(v)}
          >
            {v === 'pendientes' && <Icon name="alert" size={13} />}
            {v === 'realizados' && <Icon name="check" size={13} />}
            {v === 'forwards' && <Icon name="calendar" size={13} />}
            {v === 'pendientes' && 'Pendientes'}
            {v === 'realizados' && 'Realizados'}
            {v === 'forwards' && 'Forwards'}
            {v === 'pendientes' && pendientes.length > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  fontSize: 10,
                  background: 'var(--amber-500)',
                  color: 'white',
                  padding: '0 6px',
                  borderRadius: 999,
                  fontWeight: 700,
                }}
              >
                {pendientes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {view === 'pendientes' && (
        <PendientesView
          pendientes={pendientes}
          forwardsActivos={forwardsActivos}
          isLoading={loadingPendientes}
          onPay={openModal}
        />
      )}
      {view === 'realizados' && (
        <RealizadosView
          pagos={pagos}
          bancos={cat?.bancos ?? []}
          isLoading={loadingPagos}
          onDelete={(p) =>
            setDeleteTarget({
              kind: 'pago',
              id: p.id,
              description: `${p.contrato?.folio ?? '—'} · ${p.tipo} · ${fmtUSD(p.monto_usd)} · ${fmtFechaCorta(p.fecha)}`,
            })
          }
        />
      )}
      {view === 'forwards' && (
        <ForwardsView
          forwards={forwards}
          isLoading={loadingForwards}
          onNew={() => setForwardModalOpen(true)}
          onDelete={(f) =>
            setDeleteTarget({
              kind: 'forward',
              id: f.id,
              description: `${f.contrato?.folio ?? '—'} · ${f.asociado_a} · ${fmtUSD(f.monto_usd)} @ ${Number(f.tc_forward ?? 0).toFixed(4)}`,
            })
          }
          onExecute={(f) => executeForwardMut.mutate(f.id)}
          onAsignar={(f) => setAsignarTarget(f)}
          executingId={executeForwardMut.variables ?? null}
          isExecuting={executeForwardMut.isPending}
        />
      )}

      <AsignarForwardModal
        open={!!asignarTarget}
        onClose={() => setAsignarTarget(null)}
        forward={asignarTarget}
      />

      <PagoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        prefillContratoId={prefill.contratoId ?? null}
        prefillTipo={prefill.tipo}
      />

      <ForwardModal open={forwardModalOpen} onClose={() => setForwardModalOpen(false)} />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what={deleteTarget?.kind === 'pago' ? 'este pago' : 'este forward'}
        itemDescription={deleteTarget?.description}
        consequences={
          deleteTarget?.kind === 'pago'
            ? 'El acumulado del contrato se recalcula. Si el anticipo o saldo queda descubierto, el flag de "pagado" vuelve a false automáticamente.'
            : undefined
        }
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === 'pago') {
            await deletePagoMut.mutateAsync(deleteTarget.id);
          } else {
            await deleteForwardMut.mutateAsync(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

/* ─── Pendientes (por semana, separado por tipo) ──────────────────── */

type TipoPend = 'anticipo' | 'saldo';

type PendItem = {
  contratoId: string;
  folio: string;
  status: string;
  monto: number;
  fecha: string | null;
};

type GrupoSemana = {
  key: string;
  kind: 'atrasado' | 'semana' | 'sinfecha';
  label: string;
  esActual: boolean;
  items: PendItem[];
  total: number;
};

/** Lunes (mediodía local) de la semana que contiene la fecha ISO dada. */
function lunesDe(iso: string): Date {
  const d = new Date(iso + 'T12:00:00');
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0 = lunes … 6 = domingo
  x.setDate(x.getDate() - dow);
  return x;
}
function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

function PendientesView({
  pendientes,
  forwardsActivos,
  isLoading,
  onPay,
}: {
  pendientes: ContratoConPendiente[];
  forwardsActivos: ForwardActivo[];
  isLoading: boolean;
  onPay: (p: { contratoId: string; tipo: 'anticipo' | 'saldo' }) => void;
}) {
  const [tipoTab, setTipoTab] = useState<TipoPend>('anticipo');

  // Conteo por tipo para los chips del toggle.
  const conteo = useMemo(() => {
    let anticipo = 0;
    let saldo = 0;
    for (const c of pendientes) {
      if (!c.anticipo_pagado && c.anticipo_usd) anticipo++;
      if (!c.saldo_pagado && c.saldo_usd) saldo++;
    }
    return { anticipo, saldo };
  }, [pendientes]);

  // Ítems del tipo seleccionado, agrupados por semana de su fecha programada.
  // "Atrasado" = lo que quedó de semanas anteriores sin pagar. La semana actual
  // se marca aparte para responder "¿qué tengo que pagar esta semana?".
  const { grupos, totalSemana, totalAtrasado } = useMemo(() => {
    const items: PendItem[] = [];
    for (const c of pendientes) {
      if (tipoTab === 'anticipo' && !c.anticipo_pagado && c.anticipo_usd) {
        items.push({
          contratoId: c.id,
          folio: c.folio,
          status: c.status,
          monto: Number(c.anticipo_usd),
          fecha: c.anticipo_fecha,
        });
      } else if (tipoTab === 'saldo' && !c.saldo_pagado && c.saldo_usd) {
        items.push({
          contratoId: c.id,
          folio: c.folio,
          status: c.status,
          monto: Number(c.saldo_usd),
          fecha: c.saldo_fecha,
        });
      }
    }

    const lunesHoyISO = isoLocal(lunesDe(isoLocal(new Date())));

    const atrasado: PendItem[] = [];
    const sinFecha: PendItem[] = [];
    const semanas = new Map<string, PendItem[]>();
    for (const it of items) {
      if (!it.fecha) {
        sinFecha.push(it);
        continue;
      }
      const lunISO = isoLocal(lunesDe(it.fecha));
      if (lunISO < lunesHoyISO) {
        atrasado.push(it);
        continue;
      }
      const arr = semanas.get(lunISO);
      if (arr) arr.push(it);
      else semanas.set(lunISO, [it]);
    }

    const porFecha = (a: PendItem, b: PendItem) =>
      (a.fecha ?? '').localeCompare(b.fecha ?? '') || a.folio.localeCompare(b.folio);
    const sum = (arr: PendItem[]) => arr.reduce((s, it) => s + it.monto, 0);

    atrasado.sort(porFecha);
    sinFecha.sort((a, b) => a.folio.localeCompare(b.folio));

    const grupos: GrupoSemana[] = [];
    if (atrasado.length) {
      grupos.push({
        key: 'atrasado',
        kind: 'atrasado',
        label: 'Atrasado',
        esActual: false,
        items: atrasado,
        total: sum(atrasado),
      });
    }
    for (const lunISO of [...semanas.keys()].sort()) {
      const arr = semanas.get(lunISO)!;
      arr.sort(porFecha);
      const esActual = lunISO === lunesHoyISO;
      grupos.push({
        key: lunISO,
        kind: 'semana',
        label: esActual
          ? 'Esta semana'
          : `Semana del ${fmtFechaCorta(lunISO)} al ${fmtFechaCorta(addDias(lunISO, 6))}`,
        esActual,
        items: arr,
        total: sum(arr),
      });
    }
    if (sinFecha.length) {
      grupos.push({
        key: 'sinfecha',
        kind: 'sinfecha',
        label: 'Sin fecha programada',
        esActual: false,
        items: sinFecha,
        total: sum(sinFecha),
      });
    }

    const sem = grupos.find((g) => g.esActual);
    return {
      grupos,
      totalSemana: sem?.total ?? 0,
      totalAtrasado: atrasado.length ? sum(atrasado) : 0,
    };
  }, [pendientes, tipoTab]);

  if (isLoading) return <SkeletonList rows={4} />;

  if (pendientes.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="check-circle" size={36} />
          <div className="empty-title">Sin pagos pendientes</div>
          <p className="muted">Todos los contratos están al día con anticipo y saldo.</p>
        </div>
      </div>
    );
  }

  const tipoLabel = tipoTab === 'anticipo' ? 'anticipos' : 'saldos';

  return (
    <div className="vstack" style={{ gap: 12 }}>
      {/* Toggle Anticipos / Saldos + resumen de la semana */}
      <div
        className="hstack"
        style={{ gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}
      >
        <div className="hstack" style={{ gap: 6 }}>
          {(['anticipo', 'saldo'] as TipoPend[]).map((t) => {
            const activo = tipoTab === t;
            const n = t === 'anticipo' ? conteo.anticipo : conteo.saldo;
            return (
              <button
                key={t}
                onClick={() => setTipoTab(t)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: '1px solid ' + (activo ? 'var(--blue-500)' : 'var(--ink-200)'),
                  background: activo ? 'var(--blue-500)' : 'white',
                  color: activo ? 'white' : 'var(--ink-700)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {t === 'anticipo' ? 'Anticipos' : 'Saldos'}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '0 6px',
                    borderRadius: 999,
                    background: activo ? 'rgba(255,255,255,0.25)' : 'var(--ink-100)',
                    color: activo ? 'white' : 'var(--ink-500)',
                  }}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <StatStrip
          style={{ marginBottom: 0 }}
          stats={[
            {
              value: fmtUSD(totalSemana),
              label: 'esta semana',
              color: totalSemana > 0 ? 'var(--blue-500)' : undefined,
            },
            {
              value: fmtUSD(totalAtrasado),
              label: 'atrasado',
              color: totalAtrasado > 0 ? 'var(--red-500)' : undefined,
            },
          ]}
        />
      </div>

      {grupos.length === 0 ? (
        <div className="card">
          <div className="empty">
            <Icon name="check-circle" size={36} />
            <div className="empty-title">Sin {tipoLabel} pendientes</div>
            <p className="muted">No hay {tipoLabel} por pagar. Revisa la otra pestaña.</p>
          </div>
        </div>
      ) : (
        grupos.map((g) => {
          const accent =
            g.kind === 'atrasado'
              ? 'var(--red-500)'
              : g.esActual
                ? 'var(--blue-500)'
                : g.kind === 'sinfecha'
                  ? 'var(--ink-400)'
                  : 'var(--ink-300)';
          const headerBg =
            g.kind === 'atrasado'
              ? 'color-mix(in srgb, var(--red-500) 7%, white)'
              : g.esActual
                ? 'color-mix(in srgb, var(--blue-500) 7%, white)'
                : 'var(--ink-50)';
          const resaltado = g.esActual || g.kind === 'atrasado';
          return (
            <div key={g.key} className="card" style={resaltado ? { borderColor: accent } : undefined}>
              {/* Cabecera de la semana */}
              <div
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--ink-100)',
                  background: headerBg,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div className="hstack" style={{ gap: 8, alignItems: 'center' }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: accent,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    className="fw-700"
                    style={{
                      fontSize: 13,
                      color: g.kind === 'atrasado' ? 'var(--red-500)' : 'var(--ink-900)',
                    }}
                  >
                    {g.label}
                  </span>
                  <span className="text-xs muted">
                    {g.items.length} pago{g.items.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="mono fw-700" style={{ fontSize: 13 }}>
                  {fmtUSD(g.total)}
                </span>
              </div>

              {/* Filas del grupo */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {g.items.map((it, i) => {
                  const dias = diasDesde(it.fecha);
                  const vencido = dias !== null && dias < 0;
                  const proximo = dias !== null && dias >= 0 && dias <= 3;
                  const fwd = forwardsActivos.find(
                    (f) => f.contrato_id === it.contratoId && f.asociado_a === tipoTab,
                  );
                  return (
                    <div
                      key={it.contratoId}
                      style={{
                        padding: '10px 16px',
                        borderBottom: i < g.items.length - 1 ? '1px solid var(--ink-100)' : 'none',
                        display: 'grid',
                        gridTemplateColumns: '150px 1fr 1fr 130px',
                        gap: 16,
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div className="mono fw-700" style={{ fontSize: 13 }}>
                          {it.folio}
                        </div>
                        <div className="text-xs muted" style={{ marginTop: 2 }}>
                          {it.status}
                        </div>
                      </div>
                      <div>
                        <div className="mono fw-700" style={{ fontSize: 15 }}>
                          {fmtUSD(it.monto)}
                        </div>
                        <div className="text-xs muted" style={{ marginTop: 2 }}>
                          Programado {fmtFecha(it.fecha)}
                        </div>
                      </div>
                      <div>
                        {fwd ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              gap: 2,
                              padding: '6px 10px',
                              background: 'color-mix(in srgb, var(--amber-500) 8%, white)',
                              border: '1px solid color-mix(in srgb, var(--amber-500) 30%, white)',
                              borderRadius: 'var(--r-sm)',
                            }}
                          >
                            <div
                              className="text-xs fw-700"
                              style={{
                                color: '#92400E',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              Forward cerrado para {fmtFechaCorta(fwd.fecha_entrega)}
                            </div>
                            <div className="text-xs muted">
                              TC pactado{' '}
                              <span className="mono fw-600" style={{ color: 'var(--ink-700)' }}>
                                {(fwd.tc_forward ?? 0).toFixed(4)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          dias !== null && (
                            <div
                              className="text-xs fw-600"
                              style={{
                                color: vencido
                                  ? 'var(--red-500)'
                                  : proximo
                                    ? 'var(--amber-500)'
                                    : 'var(--ink-500)',
                              }}
                            >
                              {vencido
                                ? `Vencido hace ${-dias}d`
                                : dias === 0
                                  ? 'Vence hoy'
                                  : `En ${dias} días`}
                            </div>
                          )
                        )}
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => onPay({ contratoId: it.contratoId, tipo: tipoTab })}
                        style={{ justifySelf: 'end' }}
                        title={fwd ? 'Pagar al TC del día (spot, sin usar el forward)' : undefined}
                      >
                        <Icon name="check" size={12} /> {fwd ? 'Pagar spot' : 'Pagar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ─── Realizados ──────────────────────────────────────────────────── */

type FiltroTipoPago = 'todos' | 'anticipo' | 'saldo' | 'abono';

function RealizadosView({
  pagos,
  bancos,
  isLoading,
  onDelete,
}: {
  pagos: BlufinPagoEnriquecido[];
  bancos: { id: number; nombre: string }[];
  isLoading: boolean;
  onDelete: (p: BlufinPagoEnriquecido) => void;
}) {
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState<FiltroTipoPago>('todos');
  const [bancoFiltro, setBancoFiltro] = useState<string>('todos');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const filtrados = useMemo(() => {
    return pagos.filter((p) => {
      if (tipo !== 'todos' && p.tipo !== tipo) return false;
      if (bancoFiltro !== 'todos' && p.banco?.nombre !== bancoFiltro) return false;
      if (desde && p.fecha < desde) return false;
      if (hasta && p.fecha > hasta) return false;
      if (search) {
        const s = search.toLowerCase();
        const folio = (p.contrato?.folio ?? '').toLowerCase();
        const ref = (p.referencia ?? '').toLowerCase();
        const banco = (p.banco?.nombre ?? '').toLowerCase();
        if (!folio.includes(s) && !ref.includes(s) && !banco.includes(s)) return false;
      }
      return true;
    });
  }, [pagos, tipo, bancoFiltro, desde, hasta, search]);

  const sumaFiltrada = useMemo(
    () => ({
      usd: filtrados.reduce((s, p) => s + Number(p.monto_usd), 0),
      mxn: filtrados.reduce((s, p) => s + Number(p.monto_mxn ?? 0), 0),
    }),
    [filtrados],
  );

  const limpiar = () => {
    setSearch('');
    setTipo('todos');
    setBancoFiltro('todos');
    setDesde('');
    setHasta('');
  };

  const hayFiltros = !!(search || tipo !== 'todos' || bancoFiltro !== 'todos' || desde || hasta);

  if (isLoading) return <SkeletonList rows={5} />;

  if (pagos.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="banknote" size={36} />
          <div className="empty-title">Sin pagos registrados</div>
          <p className="muted">Captura el primer pago con el botón "Registrar pago".</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Filter bar */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div
          style={{
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div
            className="hstack"
            style={{
              gap: 8,
              padding: '6px 10px',
              background: 'var(--ink-50)',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--ink-200)',
              flex: 1,
              minWidth: 220,
            }}
          >
            <Icon name="search" size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar folio, referencia o banco…"
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                flex: 1,
                fontSize: 12,
                color: 'var(--ink-900)',
              }}
            />
          </div>

          <div className="hstack" style={{ gap: 4, flexWrap: 'wrap' }}>
            {(['todos', 'anticipo', 'saldo', 'abono'] as FiltroTipoPago[]).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 999,
                  border: '1px solid ' + (tipo === t ? 'var(--blue-500)' : 'var(--ink-200)'),
                  background: tipo === t ? 'var(--blue-500)' : 'white',
                  color: tipo === t ? 'white' : 'var(--ink-700)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {t === 'todos' ? 'Todos los tipos' : t}
              </button>
            ))}
          </div>

          <select
            value={bancoFiltro}
            onChange={(e) => setBancoFiltro(e.target.value)}
            className="field-input"
            style={{ width: 140, padding: '5px 8px', fontSize: 12 }}
          >
            <option value="todos">Todos los bancos</option>
            {bancos.map((b) => (
              <option key={b.id} value={b.nombre}>
                {b.nombre}
              </option>
            ))}
          </select>

          <div className="hstack" style={{ gap: 4 }}>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="field-input"
              style={{ width: 140, padding: '5px 8px', fontSize: 12 }}
              title="Desde"
            />
            <span className="text-xs muted">→</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="field-input"
              style={{ width: 140, padding: '5px 8px', fontSize: 12 }}
              title="Hasta"
            />
          </div>

          {hayFiltros && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={limpiar}
              style={{ padding: '5px 10px', fontSize: 11 }}
            >
              <Icon name="x" size={11} /> Limpiar
            </button>
          )}
        </div>

        {hayFiltros && (
          <div
            style={{
              padding: '8px 14px',
              borderTop: '1px solid var(--ink-100)',
              background: 'var(--ink-50)',
              fontSize: 11,
              color: 'var(--ink-600)',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span>
              {filtrados.length} de {pagos.length} pagos
            </span>
            <span>
              Suma filtrada:{' '}
              <strong className="mono" style={{ color: 'var(--ink-900)' }}>
                {fmtUSD(sumaFiltrada.usd)}
              </strong>{' '}
              ·{' '}
              <strong className="mono" style={{ color: 'var(--blue-500)' }}>
                {fmtMXN(sumaFiltrada.mxn)}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="card">
        {filtrados.length === 0 ? (
          <div className="empty">
            <Icon name="search" size={36} />
            <div className="empty-title">Sin resultados</div>
            <p className="muted">Ningún pago coincide con los filtros aplicados.</p>
            <button className="btn btn-outline btn-sm" onClick={limpiar} style={{ marginTop: 12 }}>
              Limpiar filtros
            </button>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Contrato</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>USD</th>
                <th style={{ textAlign: 'right' }}>TC</th>
                <th style={{ textAlign: 'right' }}>MXN</th>
                <th>Banco</th>
                <th>Referencia</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="fw-600">{fmtFechaCorta(p.fecha)}</div>
                    <div className="text-xs muted">
                      {new Date(p.fecha + 'T12:00:00').getFullYear()}
                    </div>
                  </td>
                  <td className="mono text-sm fw-600">{p.contrato?.folio ?? '—'}</td>
                  <td>
                    <TipoPill tipo={p.tipo} />
                  </td>
                  <td style={{ textAlign: 'right' }} className="mono fw-600">
                    {fmtUSD(p.monto_usd)}
                  </td>
                  <td style={{ textAlign: 'right' }} className="mono">
                    {Number(p.tc).toFixed(4)}
                  </td>
                  <td
                    style={{ textAlign: 'right', color: 'var(--blue-500)' }}
                    className="mono fw-600"
                  >
                    {fmtMXN(p.monto_mxn)}
                  </td>
                  <td>
                    <BancoTag nombre={p.banco?.nombre} />
                  </td>
                  <td className="mono text-xs muted">{p.referencia ?? '—'}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onDelete(p)}
                      title="Eliminar pago"
                      style={{ padding: 6, color: 'var(--red-500)' }}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ─── Forwards ────────────────────────────────────────────────────── */

function ForwardsView({
  forwards,
  isLoading,
  onNew,
  onDelete,
  onExecute,
  onAsignar,
  executingId,
  isExecuting,
}: {
  forwards: BlufinForwardEnriquecido[];
  isLoading: boolean;
  onNew: () => void;
  onDelete: (f: BlufinForwardEnriquecido) => void;
  onExecute: (f: BlufinForwardEnriquecido) => void;
  onAsignar: (f: BlufinForwardEnriquecido) => void;
  executingId: string | null;
  isExecuting: boolean;
}) {
  if (isLoading) return <SkeletonList rows={3} />;

  if (forwards.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="calendar" size={36} />
          <div className="empty-title">Sin forwards cambiarios</div>
          <p className="muted">
            Cierra dólares a futuro con un banco (MONEX, Santander, etc) para garantizar el TC
            de un anticipo o saldo.
          </p>
          <button className="btn btn-primary btn-sm" onClick={onNew} style={{ marginTop: 12 }}>
            <Icon name="plus" size={13} /> Cerrar nuevo forward
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <table className="tbl">
        <thead>
          <tr>
            <th>Contrato</th>
            <th>Cubre</th>
            <th style={{ textAlign: 'right' }}>USD</th>
            <th style={{ textAlign: 'right' }}>TC pactado</th>
            <th style={{ textAlign: 'right' }}>MXN</th>
            <th>Cerrado</th>
            <th>Se ejecuta</th>
            <th>Banco</th>
            <th>Status</th>
            <th style={{ width: 200 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {forwards.map((f) => {
            const dias = diasDesde(f.fecha_entrega);
            return (
              <tr key={f.id}>
                <td className="mono text-sm fw-600">{f.contrato?.folio ?? '—'}</td>
                <td>
                  <TipoPill tipo={f.asociado_a ?? '—'} />
                </td>
                <td style={{ textAlign: 'right' }} className="mono fw-600">
                  {fmtUSD(f.monto_usd)}
                </td>
                <td
                  style={{ textAlign: 'right', color: 'var(--amber-500)' }}
                  className="mono fw-700"
                >
                  {Number(f.tc_forward ?? 0).toFixed(4)}
                </td>
                <td
                  style={{ textAlign: 'right', color: 'var(--blue-500)' }}
                  className="mono fw-600"
                >
                  {fmtMXN(f.monto_mxn)}
                </td>
                <td>
                  <div className="text-sm">{fmtFechaCorta(f.fecha_cierre)}</div>
                </td>
                <td>
                  <div className="fw-600 text-sm">{fmtFechaCorta(f.fecha_entrega)}</div>
                  {f.status === 'Pendiente' && dias !== null && (
                    <div
                      className="text-xs"
                      style={{
                        color: dias <= 3 ? 'var(--amber-500)' : 'var(--ink-500)',
                        fontWeight: 600,
                      }}
                    >
                      {dias < 0 ? `vencido ${-dias}d` : dias === 0 ? 'hoy' : `en ${dias}d`}
                    </div>
                  )}
                </td>
                <td>
                  <BancoTag nombre={f.banco?.nombre} />
                </td>
                <td>
                  {f.status === 'Pendiente' ? (
                    <span className="badge badge-amber">Pendiente</span>
                  ) : f.status === 'Ejecutado' ? (
                    <span className="badge badge-green">Ejecutado</span>
                  ) : (
                    <span
                      className="badge"
                      style={{ background: 'var(--ink-100)', color: 'var(--ink-600)' }}
                      title="Cerrado con el banco pero ya no asignado al contenedor: se pagó spot. El forward sigue vigente con el banco; no genera pago para este contrato."
                    >
                      Liberado
                    </span>
                  )}
                </td>
                <td>
                  <div className="hstack" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    {f.status === 'Pendiente' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => onExecute(f)}
                        disabled={isExecuting && executingId === f.id}
                        title="Convertir el forward en pago real (al TC pactado)"
                      >
                        {isExecuting && executingId === f.id ? (
                          <>
                            <div className="spinner" style={{ width: 11, height: 11 }} />
                          </>
                        ) : (
                          <>
                            <Icon name="check" size={11} /> Ejecutar
                          </>
                        )}
                      </button>
                    )}
                    {f.status === 'Liberado' && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => onAsignar(f)}
                        title="Reasignar este forward (ya pactado) a otro contenedor pendiente"
                      >
                        <Icon name="arrow-right" size={11} /> Asignar
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onDelete(f)}
                      title="Eliminar forward"
                      style={{ padding: 6, color: 'var(--red-500)' }}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Skeleton ────────────────────────────────────────────────────── */

function SkeletonList({ rows }: { rows: number }) {
  return (
    <div className="card">
      {[...Array(rows)].map((_, i) => (
        <div
          key={i}
          style={{
            padding: '14px 20px',
            borderBottom: i < rows - 1 ? '1px solid var(--ink-100)' : 'none',
            display: 'grid',
            gridTemplateColumns: '100px 1fr 80px 80px 100px 80px',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <div className="skeleton-bar" style={{ width: '70%' }} />
          <div>
            <div className="skeleton-bar" style={{ width: '50%', marginBottom: 6 }} />
            <div className="skeleton-bar" style={{ width: '30%', height: 10 }} />
          </div>
          <div className="skeleton-bar" style={{ marginLeft: 'auto', width: 60 }} />
          <div className="skeleton-bar" style={{ marginLeft: 'auto', width: 50 }} />
          <div className="skeleton-bar" style={{ marginLeft: 'auto', width: 80 }} />
          <div className="skeleton-bar" style={{ marginLeft: 'auto', width: 40 }} />
        </div>
      ))}
    </div>
  );
}
