import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { CamSAStatusPill } from '@/features/camanchaca/CamSAStatusPill';
import { statusContenedorSA } from '@/features/camanchaca/sa-status';
import { fetchContenedoresSA, fetchSaldosSA, deleteContenedorSA } from '@/features/camanchaca/sa-queries';
import { CamSAContenedorDetalleModal } from '@/features/camanchaca/CamSAContenedorDetalleModal';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { useAuth } from '@/lib/auth';
import { fmtUSD, fmtKg, fmtFecha, fmtFechaCorta } from '@/lib/format';
import type { CamContenedorSAConProductos } from '@/types/database';

const FILTROS = [
  { id: 'activos', label: 'Activos' },
  { id: 'terminados', label: 'Terminados' },
  { id: 'todos', label: 'Todos' },
];

type SortCol = 'folio' | 'producto' | 'eta' | 'status' | 'contenedor' | 'costo' | 'saldo';
const STATUS_ORDEN = ['Planeado', 'En tránsito', 'En Manzanillo', 'Entregado'];

export function CamSAContenedoresListPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const { data: contenedores = [], isLoading, error } = useQuery({
    queryKey: ['cam_sa_contenedores', empresaId],
    queryFn: () => fetchContenedoresSA(empresaId),
  });
  const { data: saldos } = useQuery({
    queryKey: ['cam_sa_saldos', empresaId],
    queryFn: () => fetchSaldosSA(empresaId),
  });

  const saldoDe = (c: CamContenedorSAConProductos) => {
    const s = saldos?.get(c.id);
    return Math.max(0, Number(c.total_usd ?? 0) - (s?.pagado ?? 0) - (s?.ncAplicado ?? 0));
  };
  const liquidado = (c: CamContenedorSAConProductos) => saldoDe(c) <= 0.01 && Number(c.total_usd ?? 0) > 0;
  const esTerminado = (c: CamContenedorSAConProductos) => c.status === 'Entregado' && liquidado(c);

  const [filter, setFilter] = useState('activos');
  const [search, setSearch] = useState('');
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CamContenedorSAConProductos | null>(null);
  const [sort, setSort] = useState<{ by: SortCol; dir: 'asc' | 'desc' }>({ by: 'eta', dir: 'asc' });
  const toggleSort = (by: SortCol) =>
    setSort((s) => (s.by === by ? { by, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { by, dir: 'asc' }));

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteContenedorSA(id),
    onSuccess: () => {
      toast.success('Contenedor eliminado');
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const res = contenedores.filter((c) => {
      if (filter === 'activos' && esTerminado(c)) return false;
      if (filter === 'terminados' && !esTerminado(c)) return false;
      if (search) {
        const s = search.toLowerCase();
        const folioMatch = c.folio_interno.toLowerCase().includes(s);
        const facturaMatch = (c.factura ?? '').toLowerCase().includes(s);
        const productoMatch = c.productos?.some((p) => (p.descripcion ?? '').toLowerCase().includes(s));
        const contMatch = (c.contenedor ?? '').toLowerCase().includes(s);
        if (!folioMatch && !facturaMatch && !productoMatch && !contMatch) return false;
      }
      return true;
    });
    const key = (c: CamContenedorSAConProductos): string | number => {
      switch (sort.by) {
        case 'folio': return c.folio_interno.toLowerCase();
        case 'producto': return (c.productos?.[0]?.descripcion ?? '~').toLowerCase();
        case 'status': return STATUS_ORDEN.indexOf(statusContenedorSA(c));
        case 'contenedor': return (c.contenedor ?? '~~').toLowerCase();
        case 'costo': return Number(c.total_usd ?? 0);
        case 'saldo': return saldoDe(c);
        case 'eta':
        default: return c.eta_manzanillo || '9999-99-99';
      }
    };
    const dir = sort.dir === 'asc' ? 1 : -1;
    return res.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (ka < kb) return -1 * dir;
      if (ka > kb) return 1 * dir;
      const ea = a.eta_manzanillo || '9999-99-99';
      const eb = b.eta_manzanillo || '9999-99-99';
      return ea < eb ? -1 : ea > eb ? 1 : 0;
    });
  }, [contenedores, filter, search, sort, saldos]);

  const kpis = useMemo(() => {
    const enTransito = contenedores.filter((c) => statusContenedorSA(c) === 'En tránsito').length;
    const enManzanillo = contenedores.filter((c) => statusContenedorSA(c) === 'En Manzanillo').length;
    const terminados = contenedores.filter(esTerminado).length;
    const totalUsd = contenedores.reduce((s, c) => s + (Number(c.total_usd) || 0), 0);
    const totalKg = contenedores.reduce((s, c) => s + (Number(c.total_kg) || 0), 0);
    return {
      enTransito,
      enManzanillo,
      terminados,
      activos: contenedores.length - terminados,
      totalUsd,
      totalKg,
      count: contenedores.length,
    };
  }, [contenedores, saldos]);

  const th = (col: SortCol, label: string, align?: 'right') => {
    const active = sort.by === col;
    return (
      <th
        onClick={() => toggleSort(col)}
        title="Ordenar por esta columna"
        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', textAlign: align }}
      >
        {label}
        <span style={{ marginLeft: 4, fontSize: 10, color: active ? 'var(--blue-500)' : 'var(--ink-300)' }}>
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </th>
    );
  };

  return (
    <>
      <div className="hstack page-enter" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Contenedores SA</h2>
          <p className="page-subtitle">Importación USD desde Chile (folio interno CAM-XXX)</p>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <Link to="/app/importaciones/camanchaca/sa/contenedores/nuevo" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
            <Icon name="plus" size={13} /> Nuevo contenedor
          </Link>
        </div>
      </div>

      <div
        className="hstack"
        style={{ gap: 14, marginBottom: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--ink-500)' }}
      >
        <span>
          <strong className="mono" style={{ color: 'var(--ink-900)', fontSize: 13 }}>{kpis.count}</strong> contenedores
        </span>
        <span style={{ color: 'var(--ink-300)' }}>·</span>
        <span>
          <strong className="mono" style={{ color: 'var(--amber-500)' }}>{kpis.enTransito}</strong> en tránsito
        </span>
        <span style={{ color: 'var(--ink-300)' }}>·</span>
        <span>
          <strong className="mono" style={{ color: 'var(--violet-500)' }}>{kpis.enManzanillo}</strong> en Manzanillo
        </span>
        <span style={{ color: 'var(--ink-300)' }}>·</span>
        <span>
          <strong className="mono" style={{ color: 'var(--green-500)' }}>{kpis.terminados}</strong> terminados
        </span>
        <span style={{ color: 'var(--ink-300)' }}>·</span>
        <span>
          <strong className="mono" style={{ color: 'var(--ink-900)' }}>{fmtUSD(kpis.totalUsd)}</strong> comprometido
        </span>
        <span style={{ color: 'var(--ink-300)' }}>·</span>
        <span className="mono">{fmtKg(kpis.totalKg)}</span>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div
            className="hstack"
            style={{
              gap: 8,
              padding: '6px 10px',
              background: 'var(--ink-50)',
              borderRadius: 8,
              border: '1px solid var(--ink-200)',
              flex: 1,
              minWidth: 280,
            }}
          >
            <Icon name="search" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar folio, factura, producto, contenedor…"
              style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13 }}
            />
          </div>
          <div className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
            {FILTROS.map((f) => {
              const activo = filter === f.id;
              const n = f.id === 'todos' ? kpis.count : f.id === 'terminados' ? kpis.terminados : kpis.activos;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    padding: '6px 12px',
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
                  {f.label}
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
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div style={{ padding: 20 }}>
            <div className="skeleton-bar" style={{ width: '40%', marginBottom: 10 }} />
            <div className="skeleton-bar" style={{ width: '70%' }} />
          </div>
        ) : error ? (
          <div className="empty">
            <Icon name="alert" size={36} />
            <div className="empty-title">Error al cargar</div>
            <p className="muted">{(error as Error).message}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <Icon name="container" size={36} />
            <div className="empty-title">
              {contenedores.length === 0 ? 'Aún no hay contenedores' : 'Sin contenedores que coincidan'}
            </div>
            <p className="muted">
              {contenedores.length === 0
                ? 'Crea tu primer contenedor con el botón "Nuevo contenedor".'
                : 'Prueba con otros filtros o ajusta tu búsqueda.'}
            </p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                {th('folio', 'Folio / factura')}
                {th('producto', 'Producto principal')}
                {th('eta', 'ETA Manzanillo')}
                {th('status', 'Status')}
                {th('contenedor', 'Contenedor')}
                {th('costo', 'Costo USD', 'right')}
                {th('saldo', 'Saldo', 'right')}
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const principal = c.productos?.[0];
                const numProductos = c.productos?.length ?? 0;
                return (
                  <tr key={c.id} onClick={() => setDetalleId(c.id)} style={{ cursor: 'pointer' }} title="Ver ficha del contenedor">
                    <td>
                      <span className="mono fw-600" style={{ fontSize: 13 }}>{c.folio_interno}</span>
                      <div className="text-xs muted">
                        {c.factura ? `Factura ${c.factura}` : 'Sin factura'}
                        {c.fecha_factura ? ` · ${fmtFechaCorta(c.fecha_factura)}` : ''}
                      </div>
                    </td>
                    <td>
                      {principal ? (
                        <>
                          <div className="fw-600" style={{ fontSize: 13 }}>
                            {(principal.descripcion ?? '').substring(0, 38)}
                          </div>
                          <div className="text-xs muted">
                            {principal.marca ?? '—'}{principal.talla ? ` · ${principal.talla}` : ''}
                            {numProductos > 1 && <span> · +{numProductos - 1} más</span>}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs muted">— Sin productos —</span>
                      )}
                    </td>
                    <td>
                      {c.eta_manzanillo ? (
                        <>
                          <div className="fw-600">{fmtFechaCorta(c.eta_manzanillo)}</div>
                          <div className="text-xs muted">
                            {c.llegada_real ? `llegó ${fmtFechaCorta(c.llegada_real)}` : 'ETA Manzanillo'}
                            {c.bodega_destino ? ` · ${c.bodega_destino}` : ''}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs muted">— Por definir —</span>
                      )}
                    </td>
                    <td><CamSAStatusPill status={statusContenedorSA(c)} /></td>
                    <td>
                      {c.contenedor ? (
                        <>
                          <div className="mono fw-600" style={{ fontSize: 12 }}>{c.contenedor}</div>
                          <div className="text-xs muted">{c.naviera ?? '—'}</div>
                        </>
                      ) : (
                        <span className="text-xs muted">— Sin asignar —</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} className="fw-600 mono">{fmtUSD(c.total_usd)}</td>
                    <td style={{ textAlign: 'right' }} className="mono fw-700">
                      {saldoDe(c) <= 0.01 && Number(c.total_usd ?? 0) > 0 ? (
                        <span style={{ color: 'var(--green-500)' }}>Liquidado</span>
                      ) : (
                        <span style={{ color: 'var(--amber-500)' }}>{fmtUSD(saldoDe(c))}</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(c);
                        }}
                        title="Eliminar contenedor"
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

        {!isLoading && filtered.length > 0 && (
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--ink-100)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div className="text-xs muted">Mostrando {filtered.length} de {contenedores.length} contenedores</div>
            <div className="text-xs muted">Última actualización: {fmtFecha(new Date().toISOString().slice(0, 10))}</div>
          </div>
        )}
      </div>

      <CamSAContenedorDetalleModal contenedorId={detalleId} onClose={() => setDetalleId(null)} />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what="este contenedor"
        itemDescription={
          deleteTarget
            ? `${deleteTarget.folio_interno} · ${deleteTarget.factura ?? 'sin factura'} · ${fmtUSD(deleteTarget.total_usd)}`
            : undefined
        }
        consequences="Si el contenedor tiene pagos, forwards, costos de importación o recepción, primero hay que eliminarlos. Las líneas de producto sí se eliminan en cascada."
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
