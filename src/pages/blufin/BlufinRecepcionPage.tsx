import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { StatusPill } from '@/features/blufin/StatusPill';
import { useAuth } from '@/lib/auth';
import { fmtKg, fmtFechaCorta, fmtFecha, diasDesde } from '@/lib/format';
import {
  fetchRecepciones,
  fetchContratosPorRecibir,
  deleteRecepcion,
} from '@/features/blufin/recepcion-queries';
import type { BlufinContratoConProductos, BlufinRecepcionEnriquecida } from '@/types/database';

export function BlufinRecepcionPage() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(
    null,
  );

  const { data: porRecibir = [], isLoading: loadingPorRecibir } = useQuery({
    queryKey: ['blufin_contratos_por_recibir', empresaId],
    queryFn: () => fetchContratosPorRecibir(empresaId),
  });
  const { data: recepciones = [], isLoading: loadingRecepciones } = useQuery({
    queryKey: ['blufin_recepciones', empresaId],
    queryFn: () => fetchRecepciones(empresaId),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRecepcion(id),
    onSuccess: () => {
      toast.success('Recepción eliminada — el contrato volvió a "En puerto"');
      qc.invalidateQueries({ queryKey: ['blufin_recepciones'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos_por_recibir'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const lineas = recepciones.flatMap((r) => r.lineas ?? []);
    const kgRecibidos = lineas.reduce((s, l) => s + Number(l.kg_recibidos), 0);
    // diferencia (BD) = recibidos - contratados → negativo = faltante
    const kgFaltantes = lineas.reduce((s, l) => s + Math.max(0, -Number(l.diferencia ?? 0)), 0);
    const skusConFaltante = lineas.filter((l) => Number(l.diferencia ?? 0) < 0).length;
    return { kgRecibidos, kgFaltantes, skusConFaltante };
  }, [recepciones]);

  return (
    <>
      <PageEnter className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Recepción en bodega
          </h2>
          <p className="page-subtitle">
            Verificación de kg por SKU, captura de lote y naviera real del contenedor
          </p>
        </div>
      </PageEnter>

      {/* KPIs — mount instantáneo */}
      <div className="grid grid-4" style={{ marginBottom: 12 }}>
        <div className="kpi">
          <span className="kpi-label">Por recibir</span>
          <span
            className="kpi-value"
            style={porRecibir.length > 0 ? { color: 'var(--amber-500)' } : undefined}
          >
            {porRecibir.length}
          </span>
          <span className="kpi-delta">Contratos sin recepción</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Recibidos</span>
          <span className="kpi-value">{recepciones.length}</span>
          <span className="kpi-delta">En historial</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Kg recibidos</span>
          <span className="kpi-value mono" style={{ fontSize: 18 }}>
            {fmtKg(kpis.kgRecibidos)}
          </span>
          <span className="kpi-delta">Acumulado en bodega</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Kg faltantes</span>
          <span
            className="kpi-value mono"
            style={{ fontSize: 18, color: kpis.kgFaltantes > 0 ? 'var(--red-500)' : undefined }}
          >
            {fmtKg(kpis.kgFaltantes)}
          </span>
          <span className="kpi-delta">
            {kpis.skusConFaltante} SKU{kpis.skusConFaltante !== 1 ? 's' : ''} con faltante
          </span>
        </div>
      </div>

      <PorRecibirSection
        contratos={porRecibir}
        isLoading={loadingPorRecibir}
        onReceive={(c) => navigate(`/app/importaciones/blufin/recepcion/registrar/${c.id}`)}
      />

      <HistorialSection
        recepciones={recepciones}
        isLoading={loadingRecepciones}
        onDelete={(r) =>
          setDeleteTarget({
            id: r.id,
            description: `${r.contrato?.folio ?? '—'} · ${fmtFechaCorta(r.fecha_recepcion)} · ${r.bodega?.nombre ?? 'sin bodega'}`,
          })
        }
      />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what="esta recepción"
        itemDescription={deleteTarget?.description}
        consequences='Se borran las líneas por SKU y el contrato regresa a "En puerto", limpiando lote, naviera y llegada real.'
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

/* ─── Por recibir ─────────────────────────────────────────────────── */

function PorRecibirSection({
  contratos,
  isLoading,
  onReceive,
}: {
  contratos: BlufinContratoConProductos[];
  isLoading: boolean;
  onReceive: (c: BlufinContratoConProductos) => void;
}) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--ink-100)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <span className="fw-700" style={{ fontSize: 14 }}>
          Por recibir
        </span>
        <span
          style={{
            fontSize: 10,
            padding: '1px 7px',
            borderRadius: 999,
            background: contratos.length > 0 ? 'var(--amber-500)' : 'var(--ink-100)',
            color: contratos.length > 0 ? 'white' : 'var(--ink-500)',
            fontWeight: 700,
          }}
        >
          {contratos.length}
        </span>
      </div>

      {isLoading ? (
        <SkeletonRows rows={2} />
      ) : contratos.length === 0 ? (
        <div className="empty">
          <Icon name="check-circle" size={36} />
          <div className="empty-title">Sin contenedores pendientes</div>
          <p className="muted">Todos los contratos activos ya fueron recibidos en bodega.</p>
        </div>
      ) : (
        contratos.map((c, i) => {
          const dias = diasDesde(c.eta_bodega);
          const productos = c.productos ?? [];
          const eta = c.eta_bodega ? new Date(c.eta_bodega + 'T12:00:00') : null;
          return (
            <div
              key={c.id}
              style={{
                padding: '14px 20px',
                borderBottom: i < contratos.length - 1 ? '1px solid var(--ink-100)' : 'none',
                display: 'grid',
                gridTemplateColumns: '46px 1fr 130px 110px 80px 170px',
                gap: 16,
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: 44,
                  padding: '4px 5px',
                  borderRadius: 'var(--r-sm)',
                  textAlign: 'center',
                  background: 'var(--ink-50)',
                  border: '1px solid var(--ink-200)',
                }}
              >
                <div
                  className="text-xs fw-700"
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    color: 'var(--ink-500)',
                  }}
                >
                  {eta ? eta.toLocaleDateString('es-MX', { month: 'short' }) : '—'}
                </div>
                <div className="fw-700" style={{ fontSize: 17, lineHeight: 1 }}>
                  {eta ? eta.getDate() : ''}
                </div>
              </div>
              <div>
                <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
                  <span className="mono fw-700 text-sm">{c.folio}</span>
                  <StatusPill status={c.status} />
                  {dias !== null && dias < 0 && (
                    <span className="text-xs fw-600" style={{ color: 'var(--red-500)' }}>
                      ETA vencida hace {-dias}d
                    </span>
                  )}
                </div>
                <div className="text-sm fw-600">
                  {productos[0]
                    ? `${productos[0].descripcion ?? ''}${productos[0].marca ? ' · ' + productos[0].marca : ''}`
                    : 'Sin productos'}
                  {productos.length > 1 && (
                    <span className="muted"> +{productos.length - 1} más</span>
                  )}
                </div>
                <div className="text-xs muted">
                  {[c.contenedor, c.naviera].filter(Boolean).join(' · ') || 'Contenedor por asignar'}
                </div>
              </div>
              <div>
                <div className="text-xs muted">Kg contratados</div>
                <div className="mono fw-700">{fmtKg(c.total_kg)}</div>
              </div>
              <div>
                <div className="text-xs muted">Presentación</div>
                <div className="fw-700 text-sm" style={{ color: 'var(--blue-500)' }}>
                  {c.presentacion ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-xs muted">SKUs</div>
                <div className="fw-700 text-sm">{productos.length}</div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onReceive(c)}
                style={{ justifySelf: 'end' }}
              >
                <Icon name="inbox" size={13} /> Registrar recepción
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ─── Historial ───────────────────────────────────────────────────── */

function HistorialSection({
  recepciones,
  isLoading,
  onDelete,
}: {
  recepciones: BlufinRecepcionEnriquecida[];
  isLoading: boolean;
  onDelete: (r: BlufinRecepcionEnriquecida) => void;
}) {
  return (
    <div className="card">
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--ink-100)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <span className="fw-700" style={{ fontSize: 14 }}>
          Historial
        </span>
        <span
          style={{
            fontSize: 10,
            padding: '1px 7px',
            borderRadius: 999,
            background: 'var(--ink-100)',
            color: 'var(--ink-500)',
            fontWeight: 700,
          }}
        >
          {recepciones.length}
        </span>
      </div>

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : recepciones.length === 0 ? (
        <div className="empty">
          <Icon name="inbox" size={36} />
          <div className="empty-title">Sin recepciones registradas</div>
          <p className="muted">
            Cuando llegue un contenedor, regístralo desde la lista "Por recibir".
          </p>
        </div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Contrato</th>
              <th>Bodega</th>
              <th>Intelisis</th>
              <th>Presentación</th>
              <th style={{ textAlign: 'right' }}>Kg recibidos</th>
              <th style={{ textAlign: 'right' }}>Diferencia</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {recepciones.map((r) => {
              const lineas = r.lineas ?? [];
              const kgRecibidos = lineas.reduce((s, l) => s + Number(l.kg_recibidos), 0);
              const kgDif = lineas.reduce((s, l) => s + Number(l.diferencia ?? 0), 0);
              const presDif =
                r.presentacion_recibida &&
                r.contrato?.presentacion &&
                r.presentacion_recibida !== r.contrato.presentacion;
              return (
                <tr key={r.id}>
                  <td>
                    <div className="fw-600">{fmtFecha(r.fecha_recepcion)}</div>
                  </td>
                  <td className="mono text-sm fw-600">{r.contrato?.folio ?? '—'}</td>
                  <td className="text-sm">{r.bodega?.nombre ?? '—'}</td>
                  <td className="mono text-sm">{r.entrada_intelisis ?? '—'}</td>
                  <td>
                    {presDif ? (
                      <span className="badge badge-amber">
                        {r.contrato?.presentacion} → {r.presentacion_recibida}
                      </span>
                    ) : (
                      <span className="text-sm">{r.presentacion_recibida ?? '—'}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }} className="mono fw-600">
                    {fmtKg(kgRecibidos)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {kgDif < 0 ? (
                      <span className="mono fw-600" style={{ color: 'var(--red-500)' }}>
                        −{fmtKg(-kgDif)}
                      </span>
                    ) : (
                      <span className="badge badge-green">Completo</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onDelete(r)}
                      title="Eliminar recepción"
                      style={{ padding: 6, color: 'var(--red-500)' }}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ─── Skeleton ────────────────────────────────────────────────────── */

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <div>
      {[...Array(rows)].map((_, i) => (
        <div
          key={i}
          style={{
            padding: '14px 20px',
            borderBottom: i < rows - 1 ? '1px solid var(--ink-100)' : 'none',
            display: 'grid',
            gridTemplateColumns: '46px 1fr 120px 100px 140px',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <div className="skeleton-bar" style={{ width: 44, height: 36 }} />
          <div>
            <div className="skeleton-bar" style={{ width: '40%', marginBottom: 6 }} />
            <div className="skeleton-bar" style={{ width: '60%', height: 10 }} />
          </div>
          <div className="skeleton-bar" style={{ width: 80 }} />
          <div className="skeleton-bar" style={{ width: 60 }} />
          <div className="skeleton-bar" style={{ width: 120 }} />
        </div>
      ))}
    </div>
  );
}
