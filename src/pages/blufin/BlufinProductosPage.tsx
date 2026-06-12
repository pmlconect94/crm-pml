import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { useAuth } from '@/lib/auth';
import { fmtNum } from '@/lib/format';
import {
  CATEGORIAS_BLUFIN,
  fetchSkusBlufin,
  toggleSkuActivo,
} from '@/features/blufin/productos-queries';
import { SkuModal } from '@/features/blufin/SkuModal';
import type { CatalogoSku } from '@/types/database';

export function BlufinProductosPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('Todos');
  const [verInactivos, setVerInactivos] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSku, setEditSku] = useState<CatalogoSku | null>(null);

  const { data: skus = [], isLoading } = useQuery({
    queryKey: ['blufin_skus', empresaId],
    queryFn: () => fetchSkusBlufin(empresaId),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => toggleSkuActivo(id, activo),
    onSuccess: (_, v) => {
      toast.success(v.activo ? 'SKU reactivado' : 'SKU desactivado — ya no aparece en capturas');
      qc.invalidateQueries({ queryKey: ['blufin_skus'] });
      qc.invalidateQueries({ queryKey: ['blufin_catalogos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activos = useMemo(() => skus.filter((s) => s.activo !== false), [skus]);
  const inactivos = skus.length - activos.length;

  const filtrados = useMemo(() => {
    const base = verInactivos ? skus : activos;
    const q = search.toLowerCase();
    return base.filter((s) => {
      if (catFilter !== 'Todos' && s.categoria !== catFilter) return false;
      if (!q) return true;
      return (
        s.code.toLowerCase().includes(q) ||
        s.descripcion.toLowerCase().includes(q) ||
        (s.categoria ?? '').toLowerCase().includes(q) ||
        (s.marca ?? '').toLowerCase().includes(q) ||
        (s.talla ?? '').toLowerCase().includes(q)
      );
    });
  }, [skus, activos, verInactivos, search, catFilter]);

  const abrir = (sku: CatalogoSku | null) => {
    setEditSku(sku);
    setModalOpen(true);
  };

  return (
    <>
      <PageEnter className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Catálogo de productos
          </h2>
          <p className="page-subtitle">
            Master de SKUs Blufin — se referencia en contratos, recepciones y costos
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => abrir(null)}>
          <Icon name="plus" size={13} /> Nuevo SKU
        </button>
      </PageEnter>

      {/* KPIs — mount instantáneo */}
      <div className="grid grid-4" style={{ marginBottom: 12 }}>
        <div className="kpi">
          <span className="kpi-label">SKUs activos</span>
          <span className="kpi-value">{activos.length}</span>
          <span className="kpi-delta">
            {inactivos > 0 ? `${inactivos} inactivo${inactivos !== 1 ? 's' : ''}` : 'Catálogo completo'}
          </span>
        </div>
        {CATEGORIAS_BLUFIN.slice(0, 3).map((c) => (
          <div className="kpi" key={c}>
            <span className="kpi-label">{c}</span>
            <span className="kpi-value">{activos.filter((s) => s.categoria === c).length}</span>
            <span className="kpi-delta">SKUs en la categoría</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
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
              placeholder="Buscar código o descripción…"
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
            {['Todos', ...CATEGORIAS_BLUFIN].map((c) => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 999,
                  border: '1px solid ' + (catFilter === c ? 'var(--blue-500)' : 'var(--ink-200)'),
                  background: catFilter === c ? 'var(--blue-500)' : 'white',
                  color: catFilter === c ? 'white' : 'var(--ink-700)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {c}
              </button>
            ))}
          </div>

          {inactivos > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setVerInactivos((v) => !v)}
              style={{ fontSize: 11 }}
            >
              {verInactivos ? 'Ocultar inactivos' : `Ver inactivos (${inactivos})`}
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        {isLoading ? (
          <SkeletonTabla />
        ) : filtrados.length === 0 ? (
          <div className="empty">
            <Icon name="package" size={36} />
            <div className="empty-title">
              {skus.length === 0 ? 'Catálogo vacío' : 'Sin SKUs que coincidan'}
            </div>
            <p className="muted">
              {skus.length === 0
                ? 'Da de alta el primer producto del proveedor.'
                : 'Ajusta la búsqueda o el filtro de categoría.'}
            </p>
            {skus.length === 0 && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => abrir(null)}
                style={{ marginTop: 12 }}
              >
                <Icon name="plus" size={13} /> Nuevo SKU
              </button>
            )}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Marca</th>
                <th>Talla</th>
                <th>%</th>
                <th>Categoría</th>
                <th style={{ textAlign: 'right' }}>Kg / caja</th>
                <th>Cajas tipo</th>
                <th>Status</th>
                <th style={{ width: 170 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((s) => {
                const inactivo = s.activo === false;
                return (
                  <tr key={s.id} style={inactivo ? { opacity: 0.55 } : undefined}>
                    <td className="mono fw-700" style={{ color: 'var(--blue-500)' }}>
                      {s.code}
                    </td>
                    <td className="text-sm fw-600">{s.descripcion}</td>
                    <td className="text-sm">{s.marca ?? <span className="muted">—</span>}</td>
                    <td className="mono text-sm">{s.talla ?? <span className="muted">—</span>}</td>
                    <td className="mono text-sm">{s.pct ?? <span className="muted">—</span>}</td>
                    <td>
                      {s.categoria ? (
                        <span
                          style={{
                            padding: '2px 9px',
                            borderRadius: 999,
                            fontSize: 10.5,
                            fontWeight: 700,
                            background: 'color-mix(in srgb, var(--blue-500) 10%, white)',
                            color: 'var(--blue-500)',
                          }}
                        >
                          {s.categoria}
                        </span>
                      ) : (
                        <span className="text-xs muted">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono fw-600">
                      {fmtNum(s.kg_caja, 3)}
                    </td>
                    <td className="text-sm">{s.cajas_tipo ?? <span className="muted">—</span>}</td>
                    <td>
                      {inactivo ? (
                        <span className="badge badge-red">Inactivo</span>
                      ) : (
                        <span className="badge badge-green">Activo</span>
                      )}
                    </td>
                    <td>
                      <div className="hstack" style={{ gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => abrir(s)}
                          style={{ fontSize: 11, padding: '4px 10px' }}
                        >
                          <Icon name="edit" size={12} /> Editar
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => toggleMut.mutate({ id: s.id, activo: inactivo })}
                          title={
                            inactivo
                              ? 'Reactivar — vuelve a aparecer en capturas'
                              : 'Desactivar — deja de aparecer en capturas (no se borra)'
                          }
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            color: inactivo ? 'var(--green-500)' : 'var(--ink-500)',
                          }}
                        >
                          {inactivo ? 'Reactivar' : 'Desactivar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <SkuModal open={modalOpen} onClose={() => setModalOpen(false)} sku={editSku} />
    </>
  );
}

function SkeletonTabla() {
  return (
    <div>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          style={{
            padding: '12px 20px',
            borderBottom: i < 4 ? '1px solid var(--ink-100)' : 'none',
            display: 'grid',
            gridTemplateColumns: '90px 1fr 110px 80px 80px 120px',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <div className="skeleton-bar" style={{ width: '80%' }} />
          <div className="skeleton-bar" style={{ width: '55%' }} />
          <div className="skeleton-bar" style={{ width: 90 }} />
          <div className="skeleton-bar" style={{ marginLeft: 'auto', width: 50 }} />
          <div className="skeleton-bar" style={{ width: 50 }} />
          <div className="skeleton-bar" style={{ marginLeft: 'auto', width: 100 }} />
        </div>
      ))}
    </div>
  );
}
