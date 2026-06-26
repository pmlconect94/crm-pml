import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { StatStrip } from '@/components/StatStrip';
import { ExportMenu } from '@/components/ExportMenu';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { downloadXlsx } from '@/lib/excel';
import { useAuth } from '@/lib/auth';
import { fmtMXN, fmtKg, fmtFecha, fmtFechaCorta } from '@/lib/format';
import { fetchComprasMX, deleteCompraMX } from '@/features/camanchaca/mx-queries';
import { CompraMXStatusPill } from '@/features/camanchaca/CompraMXStatusPill';
import { CamMXCompraDetalleModal } from '@/features/camanchaca/CamMXCompraDetalleModal';
import type { CamCompraMXConProductos } from '@/types/database';

const FILTROS = [
  { id: 'pendientes', label: 'Con saldo' },
  { id: 'liquidadas', label: 'Liquidadas' },
  { id: 'todas', label: 'Todas' },
];

const esLiquidada = (c: CamCompraMXConProductos) => c.status === 'Liquidada';

type SortCol = 'folio' | 'factura' | 'producto' | 'venc' | 'status' | 'total' | 'saldo';

export function CamMXComprasListPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const { data: compras = [], isLoading, error } = useQuery({
    queryKey: ['cam_mx_compras', empresaId],
    queryFn: () => fetchComprasMX(empresaId),
  });

  const [filter, setFilter] = useState('pendientes');
  const [search, setSearch] = useState('');
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CamCompraMXConProductos | null>(null);
  const [sort, setSort] = useState<{ by: SortCol; dir: 'asc' | 'desc' }>({ by: 'venc', dir: 'asc' });
  const toggleSort = (by: SortCol) =>
    setSort((s) => (s.by === by ? { by, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { by, dir: 'asc' }));

  const saldoDe = (c: CamCompraMXConProductos) =>
    Math.max(0, Number(c.saldo_pendiente ?? c.total_mxn ?? 0));

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCompraMX(id),
    onSuccess: () => {
      toast.success('Compra eliminada');
      qc.invalidateQueries({ queryKey: ['cam_mx_compras'] });
      qc.invalidateQueries({ queryKey: ['cam_mx_compras_pendientes'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const res = compras.filter((c) => {
      if (filter === 'pendientes' && esLiquidada(c)) return false;
      if (filter === 'liquidadas' && !esLiquidada(c)) return false;
      if (search) {
        const s = search.toLowerCase();
        const folioMatch = c.folio_interno.toLowerCase().includes(s);
        const facturaMatch = c.factura_num.toLowerCase().includes(s);
        const intelisisMatch = (c.entrada_intelisis ?? '').toLowerCase().includes(s);
        const productoMatch = c.productos?.some((p) => (p.descripcion ?? '').toLowerCase().includes(s));
        if (!folioMatch && !facturaMatch && !intelisisMatch && !productoMatch) return false;
      }
      return true;
    });
    const key = (c: CamCompraMXConProductos): string | number => {
      switch (sort.by) {
        case 'folio': return c.folio_interno.toLowerCase();
        case 'factura': return c.factura_num.toLowerCase();
        case 'producto': return (c.productos?.[0]?.descripcion ?? '~').toLowerCase();
        case 'status': return c.status === 'Liquidada' ? 2 : c.status === 'Parcial' ? 1 : 0;
        case 'total': return Number(c.total_mxn ?? 0);
        case 'saldo': return saldoDe(c);
        case 'venc':
        default: return c.fecha_vencimiento || '9999-99-99';
      }
    };
    const dir = sort.dir === 'asc' ? 1 : -1;
    return res.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (ka < kb) return -1 * dir;
      if (ka > kb) return 1 * dir;
      return 0;
    });
  }, [compras, filter, search, sort]);

  const kpis = useMemo(() => {
    const liquidadas = compras.filter(esLiquidada).length;
    const conSaldo = compras.length - liquidadas;
    const totalMxn = compras.reduce((s, c) => s + Number(c.total_mxn ?? 0), 0);
    const saldoTotal = compras.reduce((s, c) => s + saldoDe(c), 0);
    const totalKg = compras.reduce(
      (s, c) => s + (c.productos ?? []).reduce((k, p) => k + Number(p.kg ?? 0), 0),
      0,
    );
    return { count: compras.length, conSaldo, liquidadas, totalMxn, saldoTotal, totalKg };
  }, [compras]);

  const exportar = () => {
    downloadXlsx('camanchaca-mx-compras', [
      {
        name: 'Compras MX',
        rows: [
          ['Folio interno', 'Factura', 'Entrada Intelisis', 'Fecha factura', 'Vencimiento', 'Status', 'Total MXN', 'Saldo MXN'],
          ...compras.map((c) => [
            c.folio_interno,
            c.factura_num,
            c.entrada_intelisis ?? '',
            c.fecha_factura ?? '',
            c.fecha_vencimiento ?? '',
            c.status ?? '',
            Number(c.total_mxn ?? 0),
            saldoDe(c),
          ]),
        ],
      },
    ]);
  };

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
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Compras</h2>
          <p className="page-subtitle">
            Camanchaca México — facturas locales en MXN, crédito 30 días
          </p>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          {compras.length > 0 && (
            <ExportMenu items={[{ label: 'Compras MX', hint: 'Folios, facturas, vencimientos, totales y saldos', onSelect: exportar }]} />
          )}
          <Link
            to="/app/importaciones/camanchaca/mx/compras/nueva"
            className="btn btn-primary btn-sm"
            style={{ textDecoration: 'none' }}
          >
            <Icon name="plus" size={13} /> Nueva compra
          </Link>
        </div>
      </div>

      <StatStrip
        stats={[
          { value: kpis.count, label: 'compras' },
          { value: kpis.conSaldo, label: 'con saldo', color: kpis.conSaldo > 0 ? 'var(--amber-500)' : undefined },
          { value: kpis.liquidadas, label: 'liquidadas', color: 'var(--green-500)' },
          { value: fmtMXN(kpis.saldoTotal), label: 'por pagar', color: 'var(--amber-500)' },
          { value: fmtMXN(kpis.totalMxn), label: 'comprado' },
          { value: fmtKg(kpis.totalKg) },
        ]}
      />

      {/* Filtros */}
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
              placeholder="Buscar folio, factura, Intelisis, producto…"
              style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13 }}
            />
          </div>
          <div className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
            {FILTROS.map((f) => {
              const activo = filter === f.id;
              const n =
                f.id === 'todas' ? kpis.count : f.id === 'liquidadas' ? kpis.liquidadas : kpis.conSaldo;
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

      {/* Tabla */}
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
            <Icon name="cart" size={36} />
            <div className="empty-title">
              {compras.length === 0 ? 'Aún no hay compras' : 'Sin compras que coincidan'}
            </div>
            <p className="muted">
              {compras.length === 0
                ? 'Captura tu primera factura con el botón "Nueva compra".'
                : 'Prueba con otros filtros o ajusta tu búsqueda.'}
            </p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                {th('folio', 'Folio')}
                {th('factura', 'Factura')}
                {th('producto', 'Producto principal')}
                {th('venc', 'Vencimiento')}
                {th('status', 'Status')}
                {th('total', 'Total MXN', 'right')}
                {th('saldo', 'Saldo', 'right')}
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const principal = c.productos?.[0];
                const numProductos = c.productos?.length ?? 0;
                return (
                  <tr
                    key={c.id}
                    onClick={() => setDetalleId(c.id)}
                    style={{ cursor: 'pointer' }}
                    title="Ver ficha de la compra"
                  >
                    <td>
                      <div className="mono fw-700 text-sm">{c.folio_interno}</div>
                      <div className="text-xs muted">{fmtFechaCorta(c.fecha_factura)}</div>
                    </td>
                    <td>
                      <div className="mono fw-600 text-sm">{c.factura_num}</div>
                      <div className="text-xs muted">
                        {c.entrada_intelisis ? `EI ${c.entrada_intelisis}` : 'sin Intelisis'}
                      </div>
                    </td>
                    <td>
                      {principal ? (
                        <>
                          <div className="fw-600" style={{ fontSize: 13 }}>
                            {(principal.descripcion ?? '').substring(0, 36)}
                          </div>
                          <div className="text-xs muted">
                            {numProductos > 1 ? `+${numProductos - 1} más` : (principal.marca ?? '—')}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs muted">— Sin productos —</span>
                      )}
                    </td>
                    <td>
                      {c.fecha_vencimiento ? (
                        <div className="fw-600">{fmtFechaCorta(c.fecha_vencimiento)}</div>
                      ) : (
                        <span className="text-xs muted">—</span>
                      )}
                    </td>
                    <td><CompraMXStatusPill status={c.status ?? 'Pendiente'} /></td>
                    <td style={{ textAlign: 'right' }} className="fw-600 mono">
                      {fmtMXN(c.total_mxn)}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono fw-700">
                      {saldoDe(c) <= 0.01 ? (
                        <span style={{ color: 'var(--green-500)' }}>Liquidada</span>
                      ) : (
                        <span style={{ color: 'var(--amber-500)' }}>{fmtMXN(saldoDe(c))}</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(c);
                        }}
                        title="Eliminar compra"
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
            <div className="text-xs muted">
              Mostrando {filtered.length} de {compras.length} compras
            </div>
            <div className="text-xs muted">
              Última actualización: {fmtFecha(new Date().toISOString().slice(0, 10))}
            </div>
          </div>
        )}
      </div>

      <CamMXCompraDetalleModal compraId={detalleId} onClose={() => setDetalleId(null)} />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what="esta compra"
        itemDescription={
          deleteTarget
            ? `${deleteTarget.folio_interno} · ${deleteTarget.factura_num} · ${fmtMXN(deleteTarget.total_mxn)}`
            : undefined
        }
        consequences="Si la compra tiene pagos o notas de crédito registrados, primero hay que eliminarlos. Las líneas de producto sí se eliminan en cascada."
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
