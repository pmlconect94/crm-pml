import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { StatStrip } from '@/components/StatStrip';
import { useAuth } from '@/lib/auth';
import { fmtNum } from '@/lib/format';
import { fetchSkusCamanchaca, toggleSkuActivoCam } from '@/features/camanchaca/productos-queries';
import { SkuModal } from '@/features/camanchaca/SkuModal';
import type { CatalogoSku } from '@/types/database';

export function CamanchacaProductosPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [prodFilter, setProdFilter] = useState('Todos');
  const [verInactivos, setVerInactivos] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSku, setEditSku] = useState<CatalogoSku | null>(null);

  const { data: skus = [], isLoading } = useQuery({
    queryKey: ['camanchaca_skus', empresaId],
    queryFn: () => fetchSkusCamanchaca(empresaId),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => toggleSkuActivoCam(id, activo),
    onSuccess: (_, v) => {
      toast.success(v.activo ? 'SKU reactivado' : 'SKU desactivado — ya no aparece en capturas');
      qc.invalidateQueries({ queryKey: ['camanchaca_skus'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_catalogos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activos = useMemo(() => skus.filter((s) => s.activo !== false), [skus]);
  const inactivos = skus.length - activos.length;

  const productos = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const s of activos) {
      const p = s.producto ?? '—';
      conteo.set(p, (conteo.get(p) ?? 0) + 1);
    }
    return Array.from(conteo.entries())
      .map(([nombre, count]) => ({ nombre, count }))
      .sort((a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre));
  }, [activos]);

  const filtrados = useMemo(() => {
    const base = verInactivos ? skus : activos;
    const q = search.toLowerCase();
    return base.filter((s) => {
      if (prodFilter !== 'Todos' && (s.producto ?? '—') !== prodFilter) return false;
      if (!q) return true;
      return (
        s.code.toLowerCase().includes(q) ||
        s.descripcion.toLowerCase().includes(q) ||
        (s.producto ?? '').toLowerCase().includes(q) ||
        (s.marca ?? '').toLowerCase().includes(q) ||
        (s.talla ?? '').toLowerCase().includes(q)
      );
    });
  }, [skus, activos, verInactivos, search, prodFilter]);

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
            Master de SKUs Camanchaca — se referencia en contenedores SA y compras MX
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => abrir(null)}>
          <Icon name="plus" size={13} /> Nuevo SKU
        </button>
      </PageEnter>

      <StatStrip
        stats={[
          {
            value: activos.length,
            label: `SKUs activos${inactivos > 0 ? ` · ${inactivos} inactivo${inactivos !== 1 ? 's' : ''}` : ''}`,
          },
          ...productos.slice(0, 3).map((p) => ({ value: p.count, label: p.nombre })),
        ]}
      />

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
              placeholder="Buscar código o descripción…"
              style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 12, color: 'var(--ink-900)' }}
            />
          </div>

          <div className="hstack" style={{ gap: 4, flexWrap: 'wrap' }}>
            {['Todos', ...productos.map((p) => p.nombre)].map((c) => (
              <button
                key={c}
                onClick={() => setProdFilter(c)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 999,
                  border: '1px solid ' + (prodFilter === c ? 'var(--blue-500)' : 'var(--ink-200)'),
                  background: prodFilter === c ? 'var(--blue-500)' : 'white',
                  color: prodFilter === c ? 'white' : 'var(--ink-700)',
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
            <button className="btn btn-ghost btn-sm" onClick={() => setVerInactivos((v) => !v)} style={{ fontSize: 11 }}>
              {verInactivos ? 'Ocultar inactivos' : `Ver inactivos (${inactivos})`}
            </button>
          )}
        </div>
      </div>

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
                : 'Ajusta la búsqueda o el filtro de producto.'}
            </p>
            {skus.length === 0 && (
              <button className="btn btn-primary btn-sm" onClick={() => abrir(null)} style={{ marginTop: 12 }}>
                <Icon name="plus" size={13} /> Nuevo SKU
              </button>
            )}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Descripción</th>
                <th>Marca</th>
                <th>Talla</th>
                <th>% Neto</th>
                <th style={{ textAlign: 'right' }}>Kg / caja</th>
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
                    <td className="text-sm fw-600">{s.producto ?? <span className="muted">—</span>}</td>
                    <td className="text-sm">{s.descripcion}</td>
                    <td className="text-sm">{s.marca ?? <span className="muted">—</span>}</td>
                    <td className="mono text-sm">{s.talla ?? <span className="muted">—</span>}</td>
                    <td className="mono text-sm">{s.pct ?? <span className="muted">—</span>}</td>
                    <td style={{ textAlign: 'right' }} className="mono fw-600">
                      {fmtNum(s.kg_caja, 3)}
                    </td>
                    <td>
                      {inactivo ? (
                        <span className="badge badge-red">Inactivo</span>
                      ) : (
                        <span className="badge badge-green">Activo</span>
                      )}
                    </td>
                    <td>
                      <div className="hstack" style={{ gap: 4, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => abrir(s)} style={{ fontSize: 11, padding: '4px 10px' }}>
                          <Icon name="edit" size={12} /> Editar
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => toggleMut.mutate({ id: s.id, activo: inactivo })}
                          title={inactivo ? 'Reactivar' : 'Desactivar'}
                          style={{ fontSize: 11, padding: '4px 10px', color: inactivo ? 'var(--green-500)' : 'var(--ink-500)' }}
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
