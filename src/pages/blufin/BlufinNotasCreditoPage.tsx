import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { StatStrip } from '@/components/StatStrip';
import { useAuth } from '@/lib/auth';
import { fmtUSD, fmtMXN, fmtFecha, fmtFechaCorta } from '@/lib/format';
import {
  fetchNotasCredito,
  setFolioTimbrado,
  deleteNotaCredito,
  NC_RAZON_META,
  NC_STATUS_META,
  type NcRazon,
} from '@/features/blufin/nc-queries';
import { NuevaNCModal } from '@/features/blufin/NuevaNCModal';
import { CapturarMontoNCModal } from '@/features/blufin/CapturarMontoNCModal';
import { AplicarNCModal } from '@/features/blufin/AplicarNCModal';
import type { BlufinNotaCreditoEnriquecida } from '@/types/database';

type View = 'poraplicar' | 'aplicadas' | 'todas';

function RazonPill({ razon }: { razon: string }) {
  const m = NC_RAZON_META[razon as NcRazon];
  if (!m) return <span className="text-xs muted">{razon}</span>;
  return (
    <span className="badge" style={{ background: m.bg, color: m.text }}>
      {m.short}
    </span>
  );
}

function NCStatusPill({ status }: { status: string }) {
  const m = NC_STATUS_META[status] ?? NC_STATUS_META['Sin monto'];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 999,
        background: m.bg,
        color: m.text,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: m.dot }} />
      {status}
    </span>
  );
}

export function BlufinNotasCreditoPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<View>('poraplicar');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [capturarNC, setCapturarNC] = useState<BlufinNotaCreditoEnriquecida | null>(null);
  const [aplicarTarget, setAplicarTarget] = useState<BlufinNotaCreditoEnriquecida | null>(null);
  const [timbrarNC, setTimbrarNC] = useState<{ nc: BlufinNotaCreditoEnriquecida; valor: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);

  const { data: ncs = [], isLoading } = useQuery({
    queryKey: ['blufin_notas_credito', empresaId],
    queryFn: () => fetchNotasCredito(empresaId),
  });

  const sinMonto = ncs.filter((n) => n.status === 'Sin monto'); // solo para el KPI
  // "Por aplicar" agrupa todo lo que aún no está aplicado (incluye Sin monto):
  // ahí mismo se captura el monto y se aplica a un contrato.
  const porAplicar = ncs.filter((n) => n.status !== 'Aplicada');
  const aplicadas = ncs.filter((n) => n.status === 'Aplicada');
  const visibles = view === 'poraplicar' ? porAplicar : view === 'aplicadas' ? aplicadas : ncs;

  const kpis = useMemo(() => {
    const saldo = porAplicar.reduce((s, n) => s + Number(n.saldo_pendiente_usd ?? 0), 0);
    const emitido = ncs.reduce((s, n) => s + Number(n.monto_usd ?? 0), 0);
    const timbradas = ncs.filter((n) => n.folio_timbrado).length;
    return { saldo, emitido, timbradas };
  }, [ncs, porAplicar]);

  const timbrarMut = useMutation({
    mutationFn: ({ id, folio }: { id: string; folio: string }) => setFolioTimbrado(id, folio),
    onSuccess: () => {
      toast.success('Folio timbrado guardado');
      qc.invalidateQueries({ queryKey: ['blufin_notas_credito'] });
      setTimbrarNC(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteNotaCredito(id),
    onSuccess: () => {
      toast.success('Nota de crédito eliminada');
      qc.invalidateQueries({ queryKey: ['blufin_notas_credito'] });
      // si estaba aplicada, el saldo del contrato vuelve a subir
      qc.invalidateQueries({ queryKey: ['blufin_contratos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos_pendientes'] });
      qc.invalidateQueries({ queryKey: ['blufin_saldos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const TABS: { id: View; label: string; count: number; accent?: 'amber' | 'gray' }[] = [
    { id: 'poraplicar', label: 'Por aplicar', count: porAplicar.length, accent: 'amber' },
    { id: 'aplicadas', label: 'Aplicadas', count: aplicadas.length },
    { id: 'todas', label: 'Todas', count: ncs.length },
  ];

  return (
    <>
      <PageEnter className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Notas de crédito
          </h2>
          <p className="page-subtitle">
            Por presentación, descuento o faltante — se aplican a contratos y consumen saldo
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setNuevaOpen(true)}>
          <Icon name="plus" size={13} /> Nueva NC
        </button>
      </PageEnter>

      {/* Stat strip compacto — una sola línea para dar más espacio a la tabla */}
      <StatStrip
        stats={[
          {
            value: sinMonto.length,
            label: 'sin monto',
            color: sinMonto.length > 0 ? 'var(--amber-500)' : undefined,
          },
          { value: fmtUSD(kpis.saldo), label: `por aplicar · ${porAplicar.length} NCs` },
          { value: fmtUSD(kpis.emitido), label: `emitido · ${ncs.length} NCs` },
          { value: kpis.timbradas, label: 'timbradas' },
        ]}
      />

      {/* Sub-tabs */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${view === t.id ? 'active' : ''}`} onClick={() => setView(t.id)}>
            {t.label}
            <span
              style={{
                marginLeft: 4,
                fontSize: 10,
                padding: '0 6px',
                borderRadius: 999,
                fontWeight: 700,
                background: t.accent === 'amber' && t.count > 0 ? 'var(--amber-500)' : 'var(--ink-100)',
                color: t.accent === 'amber' && t.count > 0 ? 'white' : 'var(--ink-600)',
              }}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="card">
        {isLoading ? (
          <div style={{ padding: 20 }}>
            <div className="skeleton-bar" style={{ width: '40%', marginBottom: 10 }} />
            <div className="skeleton-bar" style={{ width: '70%' }} />
          </div>
        ) : visibles.length === 0 ? (
          <div className="empty">
            <Icon name="note" size={34} />
            <div className="empty-title">Sin notas de crédito en esta vista</div>
            <p className="muted">
              {ncs.length === 0
                ? 'Emite la primera NC con el botón "Nueva NC".'
                : 'Cambia de pestaña para ver otras NCs.'}
            </p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 26 }}></th>
                <th>Folio</th>
                <th>Razón</th>
                <th>Origen</th>
                <th>Emitida</th>
                <th style={{ textAlign: 'right' }}>Monto NC</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
                <th>Timbrado</th>
                <th>Estado</th>
                <th style={{ width: 180 }}></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((nc) => {
                const isExp = expanded.has(nc.id);
                const esSinMonto = nc.status === 'Sin monto';
                const saldo = Number(nc.saldo_pendiente_usd ?? 0);
                return (
                  <FragmentRow key={nc.id}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => toggle(nc.id)}>
                      <td className="muted" style={{ textAlign: 'center' }}>
                        <Icon name={isExp ? 'chevron-down' : 'chevron-right'} size={13} />
                      </td>
                      <td className="mono fw-700 text-sm">{nc.folio_interno}</td>
                      <td>
                        <RazonPill razon={nc.razon} />
                      </td>
                      <td className="mono text-sm fw-600">{nc.contrato_origen?.folio ?? '—'}</td>
                      <td className="text-sm">{fmtFechaCorta(nc.fecha ?? nc.created_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {esSinMonto ? (
                          <span className="text-xs muted" style={{ fontStyle: 'italic' }}>
                            pendiente
                          </span>
                        ) : (
                          <span className="mono fw-700" style={{ color: 'var(--red-500)' }}>
                            −{fmtUSD(nc.monto_usd)}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {esSinMonto ? (
                          <span className="text-xs muted">—</span>
                        ) : saldo > 0.01 ? (
                          <span className="mono fw-700" style={{ color: 'var(--amber-500)' }}>
                            {fmtUSD(saldo)}
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--green-500)' }}>
                            liquidada
                          </span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {nc.folio_timbrado ? (
                          <span className="mono text-xs" title={nc.folio_timbrado}>
                            {nc.folio_timbrado.length > 14
                              ? nc.folio_timbrado.slice(0, 14) + '…'
                              : nc.folio_timbrado}
                          </span>
                        ) : (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, padding: '2px 8px', color: 'var(--ink-500)' }}
                            onClick={() => setTimbrarNC({ nc, valor: '' })}
                          >
                            + Folio SAT
                          </button>
                        )}
                      </td>
                      <td>
                        <NCStatusPill status={nc.status ?? '—'} />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="hstack" style={{ gap: 4, justifyContent: 'flex-end' }}>
                          {esSinMonto && (
                            <button className="btn btn-outline btn-sm" onClick={() => setCapturarNC(nc)}>
                              <Icon name="banknote" size={12} /> Capturar monto
                            </button>
                          )}
                          {!esSinMonto && nc.status !== 'Aplicada' && (
                            <button className="btn btn-primary btn-sm" onClick={() => setAplicarTarget(nc)}>
                              <Icon name="check" size={12} /> Aplicar
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              setDeleteTarget({
                                id: nc.id,
                                description: `${nc.folio_interno} · ${nc.razon} · ${esSinMonto ? 'sin monto' : fmtUSD(nc.monto_usd)}`,
                              })
                            }
                            title="Eliminar NC"
                            style={{ padding: 6, color: 'var(--red-500)' }}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExp && (
                      <tr>
                        <td colSpan={10} style={{ padding: 0, background: 'var(--ink-50)' }}>
                          <div style={{ padding: '14px 22px' }}>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: (nc.aplicaciones?.length ?? 0) > 0 ? '1fr 1fr' : '1fr',
                                gap: 24,
                              }}
                            >
                              <div>
                                <div className="text-xs fw-700" style={ueprLabel}>
                                  Detalle
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 5, columnGap: 14, fontSize: 13 }}>
                                  <span className="muted">Razón:</span>
                                  <span className="fw-600">{NC_RAZON_META[nc.razon as NcRazon]?.label ?? nc.razon}</span>
                                  {nc.tc != null && (
                                    <>
                                      <span className="muted">TC:</span>
                                      <span className="mono">{Number(nc.tc).toFixed(4)}</span>
                                    </>
                                  )}
                                  {nc.monto_mxn != null && (
                                    <>
                                      <span className="muted">Monto MXN:</span>
                                      <span className="mono fw-600">−{fmtMXN(nc.monto_mxn)}</span>
                                    </>
                                  )}
                                  <span className="muted">Emitida:</span>
                                  <span>{fmtFecha(nc.fecha ?? nc.created_at)}</span>
                                  {nc.folio_timbrado && (
                                    <>
                                      <span className="muted">Timbrado:</span>
                                      <span className="mono">{nc.folio_timbrado}</span>
                                    </>
                                  )}
                                  {nc.nota && (
                                    <>
                                      <span className="muted" style={{ alignSelf: 'start' }}>
                                        Nota:
                                      </span>
                                      <span style={{ fontStyle: 'italic' }}>{nc.nota}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {(nc.aplicaciones?.length ?? 0) > 0 && (
                                <div>
                                  <div className="text-xs fw-700" style={ueprLabel}>
                                    Aplicaciones
                                  </div>
                                  <div className="vstack" style={{ gap: 6 }}>
                                    {nc.aplicaciones!.map((a) => (
                                      <div
                                        key={a.id}
                                        style={{
                                          padding: '8px 12px',
                                          borderRadius: 'var(--r-sm)',
                                          border: '1px solid var(--ink-200)',
                                          background: 'white',
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                        }}
                                      >
                                        <div>
                                          <div className="hstack" style={{ gap: 6 }}>
                                            <span className="mono fw-600 text-sm">
                                              {a.contrato_destino?.folio ?? '—'}
                                            </span>
                                            <span
                                              className={`badge ${a.contrato_destino_id === nc.contrato_origen_id ? 'badge-gray' : 'badge-blue'}`}
                                              style={{ fontSize: 10 }}
                                            >
                                              {a.contrato_destino_id === nc.contrato_origen_id ? 'mismo' : 'otro'}
                                            </span>
                                          </div>
                                          {a.nota && <div className="text-xs muted">{a.nota}</div>}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                          <div className="mono fw-700" style={{ color: 'var(--green-500)' }}>
                                            −{fmtUSD(a.monto_usd)}
                                          </div>
                                          <div className="text-xs muted">{fmtFechaCorta(a.fecha)}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Folio timbrado inline */}
      {timbrarNC && (
        <div
          onClick={() => setTimbrarNC(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 37, 64, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', borderRadius: 'var(--r-lg)', padding: '20px 22px', maxWidth: 420, width: '100%', boxShadow: 'var(--shadow-xl)' }}
          >
            <div className="fw-700" style={{ marginBottom: 4 }}>
              Folio timbrado (SAT) — {timbrarNC.nc.folio_interno}
            </div>
            <label className="field-label">Folio CFDI de la NC del proveedor</label>
            <input
              className="field-input mono"
              value={timbrarNC.valor}
              onChange={(e) => setTimbrarNC({ nc: timbrarNC.nc, valor: e.target.value })}
              placeholder="Ej. FBTF-A-0134-2026-00456"
              autoFocus
            />
            <div className="hstack" style={{ gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setTimbrarNC(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!timbrarNC.valor.trim() || timbrarMut.isPending}
                onClick={() => timbrarMut.mutate({ id: timbrarNC.nc.id, folio: timbrarNC.valor })}
              >
                <Icon name="check" size={13} /> Guardar folio
              </button>
            </div>
          </div>
        </div>
      )}

      <NuevaNCModal open={nuevaOpen} onClose={() => setNuevaOpen(false)} />
      <CapturarMontoNCModal nc={capturarNC} onClose={() => setCapturarNC(null)} />
      <AplicarNCModal nc={aplicarTarget} onClose={() => setAplicarTarget(null)} />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what="esta nota de crédito"
        itemDescription={deleteTarget?.description}
        consequences="Se borran también sus aplicaciones a contratos."
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

const ueprLabel = {
  color: 'var(--ink-500)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  marginBottom: 10,
};

// Helper para agrupar la fila + su detalle sin key duplicada
function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
