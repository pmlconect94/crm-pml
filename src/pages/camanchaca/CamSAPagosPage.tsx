import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { StatStrip } from '@/components/StatStrip';
import { useAuth } from '@/lib/auth';
import { getTcDelDiaInfo } from '@/lib/tc';
import { fmtUSD, fmtMXN, fmtFechaCorta, diasDesde } from '@/lib/format';
import {
  fetchPagosSA,
  fetchForwardsSA,
  fetchCostosImportacionSA,
  deletePagoSA,
  deleteForwardSA,
  deleteCostoImportacionSA,
  executeForwardSA,
  type CamPagoSAEnriquecido,
  type CamForwardSAEnriquecido,
  type CamCostoImportacionEnriquecido,
} from '@/features/camanchaca/sa-pagos-queries';
import { fetchContenedoresConPendienteSA } from '@/features/camanchaca/sa-queries';
import { fetchCostosDataSA, type ContenedorCostoSA } from '@/features/camanchaca/sa-costos-queries';
import { CamSAPagoModal } from '@/features/camanchaca/CamSAPagoModal';
import { CamSAForwardModal } from '@/features/camanchaca/CamSAForwardModal';
import { CamSACostoImportacionModal } from '@/features/camanchaca/CamSACostoImportacionModal';

type View = 'pagos' | 'forwards' | 'importacion' | 'comparacion';

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

export function CamSAPagosPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<View>('pagos');
  const [pagoOpen, setPagoOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [costoOpen, setCostoOpen] = useState(false);
  const [prefillContenedor, setPrefillContenedor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'pago'; id: string; description: string }
    | { kind: 'forward'; id: string; description: string }
    | { kind: 'costo'; id: string; description: string }
    | null
  >(null);

  const { data: pagos = [], isLoading: loadingPagos } = useQuery({
    queryKey: ['cam_sa_pagos', empresaId],
    queryFn: () => fetchPagosSA(empresaId),
  });
  const { data: forwards = [], isLoading: loadingForwards } = useQuery({
    queryKey: ['cam_sa_forwards', empresaId],
    queryFn: () => fetchForwardsSA(empresaId),
  });
  const { data: costos = [], isLoading: loadingCostos } = useQuery({
    queryKey: ['cam_sa_costos_importacion', empresaId],
    queryFn: () => fetchCostosImportacionSA(empresaId),
  });
  const { data: pendientes = [] } = useQuery({
    queryKey: ['cam_sa_contenedores_pendientes', empresaId],
    queryFn: () => fetchContenedoresConPendienteSA(empresaId),
  });

  const deletePagoMut = useMutation({
    mutationFn: (id: string) => deletePagoSA(id),
    onSuccess: () => {
      toast.success('Pago eliminado');
      qc.invalidateQueries({ queryKey: ['cam_sa_pagos'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores_pendientes'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_saldos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteForwardMut = useMutation({
    mutationFn: (id: string) => deleteForwardSA(id),
    onSuccess: () => {
      toast.success('Forward eliminado');
      qc.invalidateQueries({ queryKey: ['cam_sa_forwards'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteCostoMut = useMutation({
    mutationFn: (id: string) => deleteCostoImportacionSA(id),
    onSuccess: () => {
      toast.success('Costo de importación eliminado');
      qc.invalidateQueries({ queryKey: ['cam_sa_costos_importacion'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_costos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const executeMut = useMutation({
    mutationFn: (id: string) => executeForwardSA(id),
    onSuccess: () => {
      toast.success('Forward ejecutado y registrado como pago');
      qc.invalidateQueries({ queryKey: ['cam_sa_forwards'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_pagos'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores_pendientes'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const totalUsd = pagos.reduce((s, p) => s + Number(p.monto_usd ?? 0), 0);
    const totalMxn = pagos.reduce((s, p) => s + Number(p.monto_mxn ?? 0), 0);
    const tcEfectivo = totalUsd > 0 ? totalMxn / totalUsd : 0;
    const usdPendiente = pendientes.reduce(
      (s, c) => s + Math.max(0, Number(c.total_usd ?? 0) - c.pagado - c.ncAplicado),
      0,
    );
    const importacion = costos.reduce((s, c) => s + Number(c.monto_mxn), 0);
    return { totalUsd, tcEfectivo, usdPendiente, importacion };
  }, [pagos, pendientes, costos]);

  const openPago = (contenedorId?: string) => {
    setPrefillContenedor(contenedorId ?? null);
    setPagoOpen(true);
  };

  return (
    <>
      <PageEnter className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Pagos al proveedor
          </h2>
          <p className="page-subtitle">Pagos USD, forwards y costos de importación (MXN a agencias)</p>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setCostoOpen(true)}>
            <Icon name="truck" size={13} /> Costo importación
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setForwardOpen(true)}>
            <Icon name="calendar" size={13} /> Nuevo forward
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openPago()}>
            <Icon name="plus" size={13} /> Registrar pago
          </button>
        </div>
      </PageEnter>

      <StatStrip
        stats={[
          { value: fmtUSD(kpis.totalUsd), label: 'pagado' },
          {
            value: fmtUSD(kpis.usdPendiente),
            label: `pendiente · ${pendientes.length} contenedores`,
            color: kpis.usdPendiente > 0 ? 'var(--amber-500)' : undefined,
          },
          { value: kpis.tcEfectivo > 0 ? kpis.tcEfectivo.toFixed(4) : '—', label: 'TC efectivo' },
          { value: fmtMXN(kpis.importacion), label: 'importación' },
        ]}
      />

      {/* Sub-tabs */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        {(
          [
            { id: 'pagos', label: 'Pagos', icon: 'banknote' },
            { id: 'forwards', label: 'Forwards', icon: 'calendar' },
            { id: 'importacion', label: 'Costo importación', icon: 'truck' },
            { id: 'comparacion', label: 'Comparación internación', icon: 'calculator' },
          ] as const
        ).map((t) => (
          <button key={t.id} className={`tab ${view === t.id ? 'active' : ''}`} onClick={() => setView(t.id)}>
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {view === 'pagos' && (
        <PagosView
          pagos={pagos}
          isLoading={loadingPagos}
          onNew={() => openPago()}
          onDelete={(p) =>
            setDeleteTarget({
              kind: 'pago',
              id: p.id,
              description: `${p.contenedor?.folio_interno ?? '—'} · ${p.tipo} · ${fmtUSD(p.monto_usd)} · ${fmtFechaCorta(p.fecha)}`,
            })
          }
        />
      )}
      {view === 'forwards' && (
        <ForwardsView
          forwards={forwards}
          isLoading={loadingForwards}
          onNew={() => setForwardOpen(true)}
          onExecute={(f) => executeMut.mutate(f.id)}
          executingId={executeMut.variables ?? null}
          isExecuting={executeMut.isPending}
          onDelete={(f) =>
            setDeleteTarget({
              kind: 'forward',
              id: f.id,
              description: `${f.contenedor?.folio_interno ?? '—'} · ${fmtUSD(f.monto_usd)} @ ${Number(f.tc_forward).toFixed(4)}`,
            })
          }
        />
      )}
      {view === 'importacion' && (
        <ImportacionView
          costos={costos}
          isLoading={loadingCostos}
          onNew={() => setCostoOpen(true)}
          onDelete={(c) =>
            setDeleteTarget({
              kind: 'costo',
              id: c.id,
              description: `${c.contenedor?.folio_interno ?? '—'} · ${c.agencia?.razon_social ?? c.concepto ?? '—'} · ${fmtMXN(c.monto_mxn)}`,
            })
          }
        />
      )}
      {view === 'comparacion' && <ComparacionView />}

      <CamSAPagoModal open={pagoOpen} onClose={() => setPagoOpen(false)} prefillContenedorId={prefillContenedor} />
      <CamSAForwardModal open={forwardOpen} onClose={() => setForwardOpen(false)} />
      <CamSACostoImportacionModal open={costoOpen} onClose={() => setCostoOpen(false)} />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what={
          deleteTarget?.kind === 'pago'
            ? 'este pago'
            : deleteTarget?.kind === 'forward'
              ? 'este forward'
              : 'este costo de importación'
        }
        itemDescription={deleteTarget?.description}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === 'pago') await deletePagoMut.mutateAsync(deleteTarget.id);
          else if (deleteTarget.kind === 'forward') await deleteForwardMut.mutateAsync(deleteTarget.id);
          else await deleteCostoMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

/* ─── Pagos realizados ────────────────────────────────────────────── */

function PagosView({
  pagos,
  isLoading,
  onNew,
  onDelete,
}: {
  pagos: CamPagoSAEnriquecido[];
  isLoading: boolean;
  onNew: () => void;
  onDelete: (p: CamPagoSAEnriquecido) => void;
}) {
  const [search, setSearch] = useState('');
  const filtrados = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return pagos;
    return pagos.filter(
      (p) =>
        (p.contenedor?.folio_interno ?? '').toLowerCase().includes(s) ||
        (p.referencia ?? '').toLowerCase().includes(s) ||
        (p.banco?.nombre ?? '').toLowerCase().includes(s),
    );
  }, [pagos, search]);

  if (isLoading) return <SkeletonList rows={4} />;

  if (pagos.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="banknote" size={36} />
          <div className="empty-title">Sin pagos registrados</div>
          <p className="muted">Captura el primer pago con el botón "Registrar pago".</p>
          <button className="btn btn-primary btn-sm" onClick={onNew} style={{ marginTop: 12 }}>
            <Icon name="plus" size={13} /> Registrar pago
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="hstack"
        style={{
          gap: 8,
          padding: '7px 12px',
          marginBottom: 10,
          background: 'var(--ink-50)',
          border: '1px solid var(--ink-200)',
          borderRadius: 'var(--r-md)',
        }}
      >
        <Icon name="search" size={14} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar folio, referencia o banco…"
          style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13, color: 'var(--ink-900)' }}
        />
      </div>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Contenedor</th>
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
                </td>
                <td className="mono text-sm fw-600">{p.contenedor?.folio_interno ?? '—'}</td>
                <td className="text-sm" style={{ textTransform: 'capitalize' }}>{p.tipo}</td>
                <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtUSD(p.monto_usd)}</td>
                <td style={{ textAlign: 'right' }} className="mono">{Number(p.tc).toFixed(4)}</td>
                <td style={{ textAlign: 'right', color: 'var(--blue-500)' }} className="mono fw-600">{fmtMXN(p.monto_mxn)}</td>
                <td><BancoTag nombre={p.banco?.nombre} /></td>
                <td className="mono text-xs muted">{p.referencia ?? '—'}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => onDelete(p)} title="Eliminar pago" style={{ padding: 6, color: 'var(--red-500)' }}>
                    <Icon name="trash" size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ─── Forwards ────────────────────────────────────────────────────── */

function ForwardsView({
  forwards,
  isLoading,
  onNew,
  onExecute,
  onDelete,
  executingId,
  isExecuting,
}: {
  forwards: CamForwardSAEnriquecido[];
  isLoading: boolean;
  onNew: () => void;
  onExecute: (f: CamForwardSAEnriquecido) => void;
  onDelete: (f: CamForwardSAEnriquecido) => void;
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
          <p className="muted">Cierra dólares a futuro con un banco para garantizar el TC de un contenedor.</p>
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
            <th>Contenedor</th>
            <th style={{ textAlign: 'right' }}>USD</th>
            <th style={{ textAlign: 'right' }}>TC pactado</th>
            <th style={{ textAlign: 'right' }}>MXN</th>
            <th>Cerrado</th>
            <th>Se ejecuta</th>
            <th>Banco</th>
            <th>Status</th>
            <th style={{ width: 140 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {forwards.map((f) => {
            const dias = diasDesde(f.fecha_entrega);
            return (
              <tr key={f.id}>
                <td className="mono text-sm fw-600">{f.contenedor?.folio_interno ?? '—'}</td>
                <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtUSD(f.monto_usd)}</td>
                <td style={{ textAlign: 'right', color: 'var(--amber-500)' }} className="mono fw-700">{Number(f.tc_forward).toFixed(4)}</td>
                <td style={{ textAlign: 'right', color: 'var(--blue-500)' }} className="mono fw-600">{fmtMXN(f.monto_mxn)}</td>
                <td className="text-sm">{fmtFechaCorta(f.fecha_cierre)}</td>
                <td>
                  <div className="fw-600 text-sm">{fmtFechaCorta(f.fecha_entrega)}</div>
                  {f.status === 'Pendiente' && dias !== null && (
                    <div className="text-xs" style={{ color: dias <= 3 ? 'var(--amber-500)' : 'var(--ink-500)', fontWeight: 600 }}>
                      {dias < 0 ? `vencido ${-dias}d` : dias === 0 ? 'hoy' : `en ${dias}d`}
                    </div>
                  )}
                </td>
                <td><BancoTag nombre={f.banco?.nombre} /></td>
                <td>
                  {f.status === 'Pendiente' ? (
                    <span className="badge badge-amber">Pendiente</span>
                  ) : f.status === 'Ejecutado' ? (
                    <span className="badge badge-green">Ejecutado</span>
                  ) : (
                    <span className="badge" style={{ background: 'var(--ink-100)', color: 'var(--ink-600)' }} title="Cerrado con el banco pero ya no asignado: se pagó spot.">
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
                          <div className="spinner" style={{ width: 11, height: 11 }} />
                        ) : (
                          <>
                            <Icon name="check" size={11} /> Ejecutar
                          </>
                        )}
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => onDelete(f)} title="Eliminar forward" style={{ padding: 6, color: 'var(--red-500)' }}>
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

/* ─── Costo de importación ────────────────────────────────────────── */

function ImportacionView({
  costos,
  isLoading,
  onNew,
  onDelete,
}: {
  costos: CamCostoImportacionEnriquecido[];
  isLoading: boolean;
  onNew: () => void;
  onDelete: (c: CamCostoImportacionEnriquecido) => void;
}) {
  if (isLoading) return <SkeletonList rows={3} />;

  if (costos.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="truck" size={36} />
          <div className="empty-title">Sin costos de importación</div>
          <p className="muted">
            Registra los pagos en MXN a las agencias aduanales de Manzanillo (LTP, MAFA, etc.). Pueden ser varios por contenedor.
          </p>
          <button className="btn btn-primary btn-sm" onClick={onNew} style={{ marginTop: 12 }}>
            <Icon name="plus" size={13} /> Registrar costo
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
            <th>Fecha</th>
            <th>Contenedor</th>
            <th>Agencia</th>
            <th>Concepto</th>
            <th style={{ textAlign: 'right' }}>MXN</th>
            <th>Pagado</th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {costos.map((c) => (
            <tr key={c.id}>
              <td className="fw-600">{fmtFechaCorta(c.fecha)}</td>
              <td className="mono text-sm fw-600">{c.contenedor?.folio_interno ?? '—'}</td>
              <td className="text-sm fw-600">{c.agencia?.razon_social ?? '—'}</td>
              <td className="text-sm">{c.concepto ?? '—'}</td>
              <td style={{ textAlign: 'right', color: 'var(--blue-500)' }} className="mono fw-600">{fmtMXN(c.monto_mxn)}</td>
              <td>{c.pagado ? <span className="badge badge-green">Pagado</span> : <span className="badge badge-amber">Pendiente</span>}</td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => onDelete(c)} title="Eliminar costo" style={{ padding: 6, color: 'var(--red-500)' }}>
                  <Icon name="trash" size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Comparación internación ─────────────────────────────────────── */

function ComparacionView() {
  const { empresaId } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['cam_sa_costos', empresaId],
    queryFn: () => fetchCostosDataSA(empresaId),
  });
  // TC del día como respaldo para contenedores sin TC efectivo
  const { data: tcInfo } = useQuery({
    queryKey: ['tc-del-dia'],
    queryFn: getTcDelDiaInfo,
    staleTime: 1000 * 60 * 60,
  });
  const tcDia = tcInfo?.tc ?? null;

  const contenedores = data?.contenedores ?? [];
  const agencias = data?.agencias ?? [];

  if (isLoading) return <SkeletonList rows={4} />;

  if (contenedores.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="calculator" size={36} />
          <div className="empty-title">Sin contenedores para comparar</div>
          <p className="muted">Crea contenedores y registra sus pagos y costos de importación.</p>
        </div>
      </div>
    );
  }

  // Color del % de importación: verde <8%, amarillo 8-12%, rojo >12%
  const colorPct = (pct: number | null) => {
    if (pct == null) return 'var(--ink-400)';
    if (pct < 8) return 'var(--green-500)';
    if (pct <= 12) return 'var(--amber-500)';
    return 'var(--red-500)';
  };

  const row = (c: ContenedorCostoSA) => {
    const tcUsado = c.tc ?? tcDia;
    const estimado = c.tc == null && tcDia != null;
    const fobMxn = tcUsado != null ? c.total_usd * tcUsado : null;
    const pct = fobMxn != null && fobMxn > 0 ? (c.costoImportacionMxn / fobMxn) * 100 : null;
    const totalMxn = fobMxn != null ? fobMxn + c.costoImportacionMxn : null;
    const costoKg = totalMxn != null && c.total_kg > 0 ? totalMxn / c.total_kg : null;
    const agenciaMonto = (agencia: string) =>
      c.costosPorAgencia.find((a) => a.agencia === agencia)?.monto_mxn ?? 0;
    return { c, tcUsado, estimado, fobMxn, pct, totalMxn, costoKg, agenciaMonto };
  };

  return (
    <>
      <div className="text-xs muted" style={{ marginBottom: 8 }}>
        FOB MXN = USD × TC efectivo (pagos → forward → TC del día estimado). % importación: verde &lt;8%, amarillo 8–12%, rojo &gt;12%.
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ minWidth: 900 + agencias.length * 120 }}>
          <thead>
            <tr>
              <th>Contenedor</th>
              <th style={{ textAlign: 'right' }}>FOB USD</th>
              <th style={{ textAlign: 'right' }}>TC</th>
              <th style={{ textAlign: 'right' }}>FOB MXN</th>
              {agencias.map((a) => (
                <th key={a} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{a}</th>
              ))}
              <th style={{ textAlign: 'right' }}>Total import.</th>
              <th style={{ textAlign: 'right' }}>% FOB</th>
              <th style={{ textAlign: 'right' }}>Costo MXN/kg</th>
            </tr>
          </thead>
          <tbody>
            {contenedores.map((c) => {
              const r = row(c);
              return (
                <tr key={c.contenedor_id}>
                  <td>
                    <div className="mono fw-600 text-sm">{c.folio}</div>
                    <div className="text-xs muted">{c.contenedor ?? '—'}</div>
                  </td>
                  <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtUSD(c.total_usd)}</td>
                  <td style={{ textAlign: 'right' }} className="mono" title={r.estimado ? 'TC del día (estimado)' : `TC ${c.tc_origen}`}>
                    {r.tcUsado != null ? (
                      <span style={{ color: r.estimado ? '#92400E' : 'var(--ink-900)' }}>
                        {r.tcUsado.toFixed(4)}
                        {r.estimado && <span className="text-xs"> est.</span>}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ textAlign: 'right', color: r.estimado ? '#92400E' : 'var(--ink-900)' }} className="mono">
                    {r.fobMxn != null ? fmtMXN(r.fobMxn) : '—'}
                  </td>
                  {agencias.map((a) => {
                    const m = r.agenciaMonto(a);
                    return (
                      <td key={a} style={{ textAlign: 'right' }} className="mono">
                        {m > 0 ? fmtMXN(m) : <span className="muted">—</span>}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'right' }} className="mono fw-600">
                    {c.costoImportacionMxn > 0 ? fmtMXN(c.costoImportacionMxn) : <span className="muted">—</span>}
                  </td>
                  <td style={{ textAlign: 'right' }} className="mono fw-700">
                    {r.pct != null ? <span style={{ color: colorPct(r.pct) }}>{r.pct.toFixed(1)}%</span> : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: r.estimado ? '#92400E' : 'var(--blue-500)' }} className="mono fw-700">
                    {r.costoKg != null ? fmtMXN(r.costoKg) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
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
            gridTemplateColumns: '100px 1fr 80px 80px 100px',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <div className="skeleton-bar" style={{ width: '70%' }} />
          <div className="skeleton-bar" style={{ width: '50%' }} />
          <div className="skeleton-bar" style={{ marginLeft: 'auto', width: 60 }} />
          <div className="skeleton-bar" style={{ marginLeft: 'auto', width: 50 }} />
          <div className="skeleton-bar" style={{ marginLeft: 'auto', width: 80 }} />
        </div>
      ))}
    </div>
  );
}
