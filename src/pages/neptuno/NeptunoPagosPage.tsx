/**
 * Pagos Neptuno (USD). Sub-tabs Pendientes / Realizados / Forwards.
 * Pendientes: facturas con saldo agrupadas por semana de su vencimiento.
 * Forwards (2026-08-11): dólares pactados con el banco. Pueden llegar movidos
 * desde otro módulo (Blufin) y entonces aparecen "Por asignar" hasta que se
 * eligen la factura a la que se aplican.
 */
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
  fetchCatalogos,
  fetchFacturasConPendiente,
  fetchSaldosPorFactura,
  type FacturaConPendiente,
  type SaldoFactura,
} from '@/features/neptuno/queries';
import { fetchPagos, deletePago, type NepPagoEnriquecido } from '@/features/neptuno/pagos-queries';
import {
  fetchForwardsNep,
  executeForwardNep,
  deleteForwardNep,
  type NepForwardEnriquecido,
} from '@/features/neptuno/forwards-queries';
import { PagoModal } from '@/features/neptuno/PagoModal';
import { NepAsignarForwardModal } from '@/features/neptuno/AsignarForwardModal';

type View = 'pendientes' | 'realizados' | 'forwards';

function TipoPill({ tipo }: { tipo: string }) {
  const meta: Record<string, { bg: string; text: string }> = {
    completo: { bg: 'var(--violet-100)', text: '#5B21B6' },
    abono: { bg: 'var(--amber-100)', text: '#92400E' },
  };
  const m = meta[tipo] ?? { bg: 'var(--ink-100)', text: 'var(--ink-700)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '2px 8px',
        borderRadius: 999,
        background: m.bg,
        color: m.text,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    >
      {tipo}
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

export function NeptunoPagosPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<View>('pendientes');
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ facturaId?: string }>({});
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'pago' | 'forward'; id: string; description: string } | null
  >(null);
  const [asignarTarget, setAsignarTarget] = useState<NepForwardEnriquecido | null>(null);

  const { data: pagos = [], isLoading: loadingPagos } = useQuery({
    queryKey: ['neptuno_pagos', empresaId],
    queryFn: () => fetchPagos(empresaId),
  });
  const { data: pendientes = [], isLoading: loadingPendientes } = useQuery({
    queryKey: ['neptuno_facturas_pendientes', empresaId],
    queryFn: () => fetchFacturasConPendiente(empresaId),
  });
  const { data: saldos } = useQuery({
    queryKey: ['neptuno_saldos', empresaId],
    queryFn: () => fetchSaldosPorFactura(empresaId),
  });
  const { data: cat } = useQuery({
    queryKey: ['neptuno_catalogos', empresaId],
    queryFn: () => fetchCatalogos(empresaId),
  });
  const { data: forwards = [], isLoading: loadingForwards } = useQuery({
    queryKey: ['nep_forwards', empresaId],
    queryFn: () => fetchForwardsNep(empresaId),
  });

  const invalidarForwards = () => {
    qc.invalidateQueries({ queryKey: ['nep_forwards'] });
    qc.invalidateQueries({ queryKey: ['neptuno_pagos'] });
    qc.invalidateQueries({ queryKey: ['neptuno_facturas'] });
    qc.invalidateQueries({ queryKey: ['neptuno_facturas_pendientes'] });
    qc.invalidateQueries({ queryKey: ['neptuno_saldos'] });
  };

  const executeForwardMut = useMutation({
    mutationFn: (id: string) => executeForwardNep(id),
    onSuccess: (r) => {
      toast.success(
        r.remanente > 0
          ? `Pagado ${fmtUSD(r.aplicar)} · quedan ${fmtUSD(r.remanente)} en forward por asignar`
          : 'Forward ejecutado y registrado como pago',
      );
      invalidarForwards();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteForwardMut = useMutation({
    mutationFn: (id: string) => deleteForwardNep(id),
    onSuccess: () => {
      toast.success('Forward eliminado');
      invalidarForwards();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePagoMut = useMutation({
    mutationFn: (id: string) => deletePago(id),
    onSuccess: () => {
      toast.success('Pago eliminado');
      qc.invalidateQueries({ queryKey: ['neptuno_pagos'] });
      qc.invalidateQueries({ queryKey: ['neptuno_facturas'] });
      qc.invalidateQueries({ queryKey: ['neptuno_facturas_pendientes'] });
      qc.invalidateQueries({ queryKey: ['neptuno_saldos'] });
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
    const usdPendiente = pendientes.reduce(
      (s, c) =>
        s +
        Math.max(
          0,
          Number(c.total_usd ?? 0) -
            (saldos?.get(c.id)?.pagado ?? 0) -
            (saldos?.get(c.id)?.ncAplicado ?? 0),
        ),
      0,
    );
    return { totalUsd, tcEfectivo, esteMes, usdPendiente };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagos, pendientes, saldos]);

  const openModal = (p?: { facturaId?: string }) => {
    setPrefill(p ?? {});
    setModalOpen(true);
  };

  return (
    <>
      <PageEnter className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Pagos al proveedor
          </h2>
          <p className="page-subtitle">Pagos completos o abonos parciales en USD</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => openModal()}>
          <Icon name="plus" size={13} /> Registrar pago
        </button>
      </PageEnter>

      <StatStrip
        stats={[
          { value: fmtUSD(kpis.totalUsd), label: 'pagado' },
          {
            value: fmtUSD(kpis.usdPendiente),
            label: `pendiente · ${pendientes.length} facturas`,
            color: kpis.usdPendiente > 0 ? 'var(--amber-500)' : undefined,
          },
          { value: kpis.tcEfectivo > 0 ? kpis.tcEfectivo.toFixed(4) : '—', label: 'TC efectivo' },
          { value: kpis.esteMes, label: `pagos este mes · de ${pagos.length}` },
        ]}
      />

      <div className="tabs" style={{ marginBottom: 12 }}>
        {(['pendientes', 'realizados', 'forwards'] as const).map((v) => (
          <button key={v} className={`tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
            {v === 'pendientes' ? (
              <Icon name="alert" size={13} />
            ) : v === 'realizados' ? (
              <Icon name="check" size={13} />
            ) : (
              <Icon name="calendar" size={13} />
            )}
            {v === 'pendientes' ? 'Pendientes' : v === 'realizados' ? 'Realizados' : 'Forwards'}
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
          saldos={saldos}
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
              description: `${p.factura?.factura_num ?? '—'} · ${p.tipo} · ${fmtUSD(p.monto_usd)} · ${fmtFechaCorta(p.fecha)}`,
            })
          }
        />
      )}
      {view === 'forwards' && (
        <ForwardsView
          forwards={forwards}
          isLoading={loadingForwards}
          onExecute={(f) => executeForwardMut.mutate(f.id)}
          onAsignar={(f) => setAsignarTarget(f)}
          executingId={executeForwardMut.variables ?? null}
          isExecuting={executeForwardMut.isPending}
          onDelete={(f) =>
            setDeleteTarget({
              kind: 'forward',
              id: f.id,
              description: `${f.factura?.factura_num ?? 'Por asignar'} · ${fmtUSD(f.monto_usd)} @ ${Number(f.tc_forward).toFixed(4)}`,
            })
          }
        />
      )}

      <PagoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        prefillFacturaId={prefill.facturaId ?? null}
      />

      <NepAsignarForwardModal
        open={!!asignarTarget}
        onClose={() => setAsignarTarget(null)}
        forward={asignarTarget}
      />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what={deleteTarget?.kind === 'forward' ? 'este forward' : 'este pago'}
        itemDescription={deleteTarget?.description}
        consequences={
          deleteTarget?.kind === 'forward'
            ? 'El compromiso con el banco sigue vigente — esto solo lo quita del CRM.'
            : 'El saldo de la factura se recalcula. Si vuelve a quedar descubierto, su status regresa a Pendiente/Parcial.'
        }
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === 'forward') await deleteForwardMut.mutateAsync(deleteTarget.id);
          else await deletePagoMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

/* ─── Pendientes (por semana de vencimiento) ──────────────────────── */

type PendItem = {
  facturaId: string;
  facturaNum: string;
  status: string;
  saldo: number;
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

function lunesDe(iso: string): Date {
  const d = new Date(iso + 'T12:00:00');
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
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
  saldos,
  isLoading,
  onPay,
}: {
  pendientes: FacturaConPendiente[];
  saldos: Map<string, SaldoFactura> | undefined;
  isLoading: boolean;
  onPay: (p: { facturaId: string }) => void;
}) {
  const { grupos, totalSemana, totalAtrasado } = useMemo(() => {
    const items: PendItem[] = pendientes
      .map((c) => ({
        facturaId: c.id,
        facturaNum: c.factura_num,
        status: c.status ?? 'Pendiente',
        saldo: Math.max(
          0,
          Number(c.total_usd ?? 0) -
            (saldos?.get(c.id)?.pagado ?? 0) -
            (saldos?.get(c.id)?.ncAplicado ?? 0),
        ),
        fecha: c.fecha_vencimiento,
      }))
      .filter((it) => it.saldo > 0.01);

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
      (a.fecha ?? '').localeCompare(b.fecha ?? '') || a.facturaNum.localeCompare(b.facturaNum);
    const sum = (arr: PendItem[]) => arr.reduce((s, it) => s + it.saldo, 0);

    atrasado.sort(porFecha);
    sinFecha.sort((a, b) => a.facturaNum.localeCompare(b.facturaNum));

    const grupos: GrupoSemana[] = [];
    if (atrasado.length) {
      grupos.push({ key: 'atrasado', kind: 'atrasado', label: 'Atrasado', esActual: false, items: atrasado, total: sum(atrasado) });
    }
    for (const lunISO of [...semanas.keys()].sort()) {
      const arr = semanas.get(lunISO)!;
      arr.sort(porFecha);
      const esActual = lunISO === lunesHoyISO;
      grupos.push({
        key: lunISO,
        kind: 'semana',
        label: esActual ? 'Esta semana' : `Semana del ${fmtFechaCorta(lunISO)} al ${fmtFechaCorta(addDias(lunISO, 6))}`,
        esActual,
        items: arr,
        total: sum(arr),
      });
    }
    if (sinFecha.length) {
      grupos.push({ key: 'sinfecha', kind: 'sinfecha', label: 'Sin fecha de vencimiento', esActual: false, items: sinFecha, total: sum(sinFecha) });
    }

    const sem = grupos.find((g) => g.esActual);
    return { grupos, totalSemana: sem?.total ?? 0, totalAtrasado: atrasado.length ? sum(atrasado) : 0 };
  }, [pendientes, saldos]);

  if (isLoading) return <SkeletonList rows={4} />;

  if (pendientes.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="check-circle" size={36} />
          <div className="empty-title">Sin pagos pendientes</div>
          <p className="muted">Todas las facturas están liquidadas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vstack" style={{ gap: 12 }}>
      <StatStrip
        style={{ marginBottom: 0 }}
        stats={[
          { value: fmtUSD(totalSemana), label: 'esta semana', color: totalSemana > 0 ? 'var(--blue-500)' : undefined },
          { value: fmtUSD(totalAtrasado), label: 'atrasado', color: totalAtrasado > 0 ? 'var(--red-500)' : undefined },
        ]}
      />

      {grupos.map((g) => {
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
                <span style={{ width: 8, height: 8, borderRadius: 999, background: accent, display: 'inline-block', flexShrink: 0 }} />
                <span className="fw-700" style={{ fontSize: 13, color: g.kind === 'atrasado' ? 'var(--red-500)' : 'var(--ink-900)' }}>
                  {g.label}
                </span>
                <span className="text-xs muted">
                  {g.items.length} factura{g.items.length !== 1 ? 's' : ''}
                </span>
              </div>
              <span className="mono fw-700" style={{ fontSize: 13 }}>{fmtUSD(g.total)}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {g.items.map((it, i) => {
                const dias = diasDesde(it.fecha);
                const vencido = dias !== null && dias < 0;
                const proximo = dias !== null && dias >= 0 && dias <= 3;
                return (
                  <div
                    key={it.facturaId}
                    style={{
                      padding: '10px 16px',
                      borderBottom: i < g.items.length - 1 ? '1px solid var(--ink-100)' : 'none',
                      display: 'grid',
                      gridTemplateColumns: '160px 1fr 1fr 130px',
                      gap: 16,
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div className="mono fw-700" style={{ fontSize: 13 }}>{it.facturaNum}</div>
                      <div className="text-xs muted" style={{ marginTop: 2 }}>{it.status}</div>
                    </div>
                    <div>
                      <div className="mono fw-700" style={{ fontSize: 15 }}>{fmtUSD(it.saldo)}</div>
                      <div className="text-xs muted" style={{ marginTop: 2 }}>Vence {fmtFecha(it.fecha)}</div>
                    </div>
                    <div>
                      {dias !== null && (
                        <div
                          className="text-xs fw-600"
                          style={{
                            color: vencido ? 'var(--red-500)' : proximo ? 'var(--amber-500)' : 'var(--ink-500)',
                          }}
                        >
                          {vencido ? `Vencido hace ${-dias}d` : dias === 0 ? 'Vence hoy' : `En ${dias} días`}
                        </div>
                      )}
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onPay({ facturaId: it.facturaId })}
                      style={{ justifySelf: 'end' }}
                    >
                      <Icon name="check" size={12} /> Pagar
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Realizados ──────────────────────────────────────────────────── */

type FiltroTipoPago = 'todos' | 'completo' | 'abono';

function RealizadosView({
  pagos,
  bancos,
  isLoading,
  onDelete,
}: {
  pagos: NepPagoEnriquecido[];
  bancos: { id: number; nombre: string }[];
  isLoading: boolean;
  onDelete: (p: NepPagoEnriquecido) => void;
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
        const fnum = (p.factura?.factura_num ?? '').toLowerCase();
        const ref = (p.referencia ?? '').toLowerCase();
        const banco = (p.banco?.nombre ?? '').toLowerCase();
        if (!fnum.includes(s) && !ref.includes(s) && !banco.includes(s)) return false;
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
      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
              placeholder="Buscar factura, referencia o banco…"
              style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 12, color: 'var(--ink-900)' }}
            />
          </div>

          <div className="hstack" style={{ gap: 4, flexWrap: 'wrap' }}>
            {(['todos', 'completo', 'abono'] as FiltroTipoPago[]).map((t) => (
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
              <option key={b.id} value={b.nombre}>{b.nombre}</option>
            ))}
          </select>

          <div className="hstack" style={{ gap: 4 }}>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="field-input" style={{ width: 140, padding: '5px 8px', fontSize: 12 }} title="Desde" />
            <span className="text-xs muted">→</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="field-input" style={{ width: 140, padding: '5px 8px', fontSize: 12 }} title="Hasta" />
          </div>

          {hayFiltros && (
            <button className="btn btn-ghost btn-sm" onClick={limpiar} style={{ padding: '5px 10px', fontSize: 11 }}>
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
            <span>{filtrados.length} de {pagos.length} pagos</span>
            <span>
              Suma filtrada:{' '}
              <strong className="mono" style={{ color: 'var(--ink-900)' }}>{fmtUSD(sumaFiltrada.usd)}</strong>{' '}
              · <strong className="mono" style={{ color: 'var(--blue-500)' }}>{fmtMXN(sumaFiltrada.mxn)}</strong>
            </span>
          </div>
        )}
      </div>

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
                <th>Factura</th>
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
                    <div className="text-xs muted">{new Date(p.fecha + 'T12:00:00').getFullYear()}</div>
                  </td>
                  <td className="mono text-sm fw-600">{p.factura?.factura_num ?? '—'}</td>
                  <td>
                    <TipoPill tipo={p.tipo} />
                  </td>
                  <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtUSD(p.monto_usd)}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{Number(p.tc).toFixed(4)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--blue-500)' }} className="mono fw-600">{fmtMXN(p.monto_mxn)}</td>
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
  onExecute,
  onAsignar,
  onDelete,
  executingId,
  isExecuting,
}: {
  forwards: NepForwardEnriquecido[];
  isLoading: boolean;
  onExecute: (f: NepForwardEnriquecido) => void;
  onAsignar: (f: NepForwardEnriquecido) => void;
  onDelete: (f: NepForwardEnriquecido) => void;
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
            Aquí aparecen los dólares pactados con un banco para pagar facturas de Neptuno,
            incluidos los que se muevan desde otro módulo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <table className="tbl">
        <thead>
          <tr>
            <th>Factura</th>
            <th style={{ textAlign: 'right' }}>USD</th>
            <th style={{ textAlign: 'right' }}>TC pactado</th>
            <th style={{ textAlign: 'right' }}>MXN</th>
            <th>Cerrado</th>
            <th>Se ejecuta</th>
            <th>Banco</th>
            <th>Status</th>
            <th style={{ width: 150 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {forwards.map((f) => {
            const dias = diasDesde(f.fecha_entrega);
            const sinAsignar = !f.factura_id;
            return (
              <tr key={f.id}>
                <td className="mono text-sm fw-600">
                  {f.factura?.factura_num ?? (
                    <span
                      className="badge badge-blue"
                      title={
                        f.origen_modulo === 'blufin'
                          ? `Movido desde Blufin${f.origen_ref ? ` (${f.origen_ref})` : ''}. Asígnalo a una factura.`
                          : 'Sin factura asignada.'
                      }
                    >
                      Por asignar
                    </span>
                  )}
                  {f.origen_modulo === 'blufin' && (
                    <div className="text-xs muted" style={{ marginTop: 2 }}>
                      de Blufin{f.origen_ref ? ` · ${f.origen_ref}` : ''}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'right' }} className="mono fw-600">
                  {fmtUSD(f.monto_usd)}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--amber-500)' }} className="mono fw-700">
                  {Number(f.tc_forward).toFixed(4)}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--blue-500)' }} className="mono fw-600">
                  {fmtMXN(f.monto_mxn)}
                </td>
                <td className="text-sm">{fmtFechaCorta(f.fecha_cierre)}</td>
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
                  {f.status === 'Ejecutado' ? (
                    <span className="badge badge-green">Ejecutado</span>
                  ) : f.status === 'Remanente' ? (
                    <span
                      className="badge badge-blue"
                      title="Sobró al ejecutarlo contra una factura menor. Sigue vivo con el banco: asígnalo a otra factura."
                    >
                      Remanente
                    </span>
                  ) : (
                    <span className="badge badge-amber">Pendiente</span>
                  )}
                </td>
                <td>
                  <div className="hstack" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    {sinAsignar && f.status !== 'Ejecutado' && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => onAsignar(f)}
                        title="Asignar este forward a una factura"
                      >
                        <Icon name="arrow-right" size={11} /> Asignar
                      </button>
                    )}
                    {f.status === 'Pendiente' && !sinAsignar && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => onExecute(f)}
                        disabled={isExecuting && executingId === f.id}
                        title="Convertir el forward en pago real (al TC pactado)"
                      >
                        {isExecuting && executingId === f.id ? (
                          <div className="spinner" style={{ width: 11, height: 11 }} />
                        ) : (
                          <>
                            <Icon name="check" size={11} /> Ejecutar
                          </>
                        )}
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
