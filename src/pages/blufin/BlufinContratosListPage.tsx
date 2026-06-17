import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { StatusPill } from '@/features/blufin/StatusPill';
import { fetchContratos } from '@/features/blufin/queries';
import { deleteContrato, fetchSaldosPorContrato } from '@/features/blufin/pagos-queries';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { ExportMenu } from '@/components/ExportMenu';
import { ContratoDetalleModal } from '@/features/blufin/ContratoDetalleModal';
import { exportContratos, exportProductosPorContrato } from '@/features/blufin/blufin-export';
import { useAuth } from '@/lib/auth';
import { fmtUSD, fmtKg, fmtFecha, fmtFechaCorta } from '@/lib/format';
import type { BlufinContratoConProductos } from '@/types/database';

const FILTROS = [
  { id: 'activos', label: 'Activos' },
  { id: 'terminados', label: 'Terminados' },
  { id: 'todos', label: 'Todos' },
];

/** Terminado = ya llegó (Entregado) y está liquidado (saldo pagado). */
const esTerminado = (c: BlufinContratoConProductos) =>
  c.status === 'Entregado' && c.saldo_pagado === true;

export function BlufinContratosListPage() {
  const { empresaId } = useAuth();
  const { data: contratos = [], isLoading, error } = useQuery({
    queryKey: ['blufin_contratos', empresaId],
    queryFn: () => fetchContratos(empresaId),
  });
  const { data: saldos } = useQuery({
    queryKey: ['blufin_saldos', empresaId],
    queryFn: () => fetchSaldosPorContrato(empresaId),
  });
  const saldoDe = (c: BlufinContratoConProductos) => {
    // Liquidado solo si AMBOS flags están cubiertos (anticipo + saldo). Si solo
    // el saldo se cubrió por NC, el anticipo puede seguir pendiente.
    if (c.anticipo_pagado && c.saldo_pagado) return 0;
    const s = saldos?.get(c.id);
    return Math.max(0, Number(c.total_usd ?? 0) - (s?.pagado ?? 0) - (s?.ncAplicado ?? 0));
  };

  const [filter, setFilter] = useState('activos');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BlufinContratoConProductos | null>(null);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const qc = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteContrato(id),
    onSuccess: () => {
      toast.success('Contrato eliminado');
      qc.invalidateQueries({ queryKey: ['blufin_contratos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos_pendientes'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const res = contratos.filter((c) => {
      if (filter === 'activos' && esTerminado(c)) return false;
      if (filter === 'terminados' && !esTerminado(c)) return false;
      if (search) {
        const s = search.toLowerCase();
        const folioMatch = c.folio.toLowerCase().includes(s);
        const productoMatch = c.productos?.some(
          (p) =>
            (p.descripcion ?? '').toLowerCase().includes(s) ||
            (p.marca ?? '').toLowerCase().includes(s),
        );
        const contenedorMatch = (c.contenedor ?? '').toLowerCase().includes(s);
        if (!folioMatch && !productoMatch && !contenedorMatch) return false;
      }
      return true;
    });
    // Orden por ETA puerto ascendente (los próximos a llegar primero); los que
    // no tienen ETA puerto van al final, y entre ellos por llegada más reciente.
    return res.sort((a, b) => {
      const ka = a.eta_puerto || '9999-99-99';
      const kb = b.eta_puerto || '9999-99-99';
      if (ka !== kb) return ka < kb ? -1 : 1;
      const la = a.llegada_real || '';
      const lb = b.llegada_real || '';
      return la < lb ? 1 : la > lb ? -1 : 0;
    });
  }, [contratos, filter, search]);

  const kpis = useMemo(() => {
    const enTransito = contratos.filter((c) => c.status === 'En tránsito').length;
    const terminados = contratos.filter(esTerminado).length;
    const totalUsd = contratos.reduce((s, c) => s + (Number(c.total_usd) || 0), 0);
    const totalKg = contratos.reduce((s, c) => s + (Number(c.total_kg) || 0), 0);
    return {
      enTransito,
      terminados,
      activos: contratos.length - terminados,
      totalUsd,
      totalKg,
      count: contratos.length,
    };
  }, [contratos]);

  return (
    <>
      <div className="hstack page-enter" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Contratos</h2>
          <p className="page-subtitle">
            Órdenes de compra individuales (folio MCO-CV-XXXXXX)
          </p>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          {contratos.length > 0 && (
            <ExportMenu
              items={[
                {
                  label: 'Contratos',
                  hint: 'Folios, fechas de llegada, totales y estado de pago',
                  onSelect: () => exportContratos(contratos, saldoDe),
                },
                {
                  label: 'Productos por contrato',
                  hint: 'Cada producto con su contrato y fechas de llegada',
                  onSelect: () => exportProductosPorContrato(contratos),
                },
              ]}
            />
          )}
          <Link to="/app/importaciones/blufin/contratos/carga-masiva" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
            <Icon name="download" size={13} /> Carga masiva PDF
          </Link>
          <Link to="/app/importaciones/blufin/contratos/nuevo" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
            <Icon name="plus" size={13} /> Nuevo contrato
          </Link>
        </div>
      </div>

      {/* Stat strip compacto — una sola línea para dar más espacio a la tabla */}
      <div
        className="hstack"
        style={{ gap: 14, marginBottom: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--ink-500)' }}
      >
        <span>
          <strong className="mono" style={{ color: 'var(--ink-900)', fontSize: 13 }}>
            {kpis.count}
          </strong>{' '}
          contratos
        </span>
        <span style={{ color: 'var(--ink-300)' }}>·</span>
        <span>
          <strong className="mono" style={{ color: 'var(--amber-500)' }}>{kpis.enTransito}</strong> en
          tránsito
        </span>
        <span style={{ color: 'var(--ink-300)' }}>·</span>
        <span>
          <strong className="mono" style={{ color: 'var(--green-500)' }}>{kpis.terminados}</strong>{' '}
          terminados
        </span>
        <span style={{ color: 'var(--ink-300)' }}>·</span>
        <span>
          <strong className="mono" style={{ color: 'var(--ink-900)' }}>{fmtUSD(kpis.totalUsd)}</strong>{' '}
          comprometido
        </span>
        <span style={{ color: 'var(--ink-300)' }}>·</span>
        <span className="mono">{fmtKg(kpis.totalKg)}</span>
      </div>

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
              placeholder="Buscar folio, producto, marca, contenedor…"
              style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13 }}
            />
          </div>
          <div className="hstack" style={{ gap: 6, flexWrap: 'wrap' }}>
            {FILTROS.map((f) => {
              const activo = filter === f.id;
              const n =
                f.id === 'todos' ? kpis.count : f.id === 'terminados' ? kpis.terminados : kpis.activos;
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
          <div>
            <div
              style={{
                padding: '10px 16px',
                background: 'var(--ink-50)',
                borderBottom: '1px solid var(--ink-200)',
                display: 'grid',
                gridTemplateColumns: '1fr 2fr 100px 90px 120px 90px 60px',
                gap: 16,
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--ink-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <div>Contrato</div>
              <div>Producto principal</div>
              <div>ETA puerto</div>
              <div>Status</div>
              <div>Contenedor</div>
              <div style={{ textAlign: 'right' }}>USD</div>
              <div style={{ textAlign: 'right' }}>Pagos</div>
            </div>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-row">
                <div>
                  <div className="skeleton-bar" style={{ width: '70%', marginBottom: 6 }} />
                  <div className="skeleton-bar" style={{ width: '40%', height: 10 }} />
                </div>
                <div>
                  <div className="skeleton-bar" style={{ width: '85%', marginBottom: 6 }} />
                  <div className="skeleton-bar" style={{ width: '50%', height: 10 }} />
                </div>
                <div>
                  <div className="skeleton-bar" style={{ width: '80%', marginBottom: 6 }} />
                  <div className="skeleton-bar" style={{ width: '60%', height: 10 }} />
                </div>
                <div className="skeleton-bar" style={{ width: 80, borderRadius: 999 }} />
                <div>
                  <div className="skeleton-bar" style={{ width: '80%', marginBottom: 6 }} />
                  <div className="skeleton-bar" style={{ width: '50%', height: 10 }} />
                </div>
                <div className="skeleton-bar" style={{ marginLeft: 'auto', width: 70 }} />
                <div className="hstack" style={{ gap: 4, justifyContent: 'flex-end' }}>
                  <div className="skeleton" style={{ width: 12, height: 12, borderRadius: 999 }} />
                  <div className="skeleton" style={{ width: 12, height: 12, borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="empty">
            <Icon name="alert" size={36} />
            <div className="empty-title">Error al cargar</div>
            <p className="muted">{(error as Error).message}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <Icon name="file-text" size={36} />
            <div className="empty-title">
              {contratos.length === 0 ? 'Aún no hay contratos' : 'Sin contratos que coincidan'}
            </div>
            <p className="muted">
              {contratos.length === 0
                ? 'Crea tu primer contrato con el botón "Nuevo contrato".'
                : 'Prueba con otros filtros o ajusta tu búsqueda.'}
            </p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Producto principal</th>
                <th>ETA puerto</th>
                <th>Status</th>
                <th>Contenedor</th>
                <th style={{ textAlign: 'right' }}>Costo USD</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
                <th style={{ textAlign: 'right' }}>Pagos</th>
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
                    title="Ver ficha del contrato"
                  >
                    <td>
                      <div className="mono fw-600" style={{ fontSize: 13 }}>{c.folio}</div>
                      <div className="text-xs muted">
                        {fmtFechaCorta(c.fecha)} {c.lote ? `· ${c.lote}` : ''}
                      </div>
                    </td>
                    <td>
                      {principal ? (
                        <>
                          <div className="fw-600" style={{ fontSize: 13 }}>
                            {(principal.descripcion ?? '').replace('FROZEN ', '').substring(0, 36)}
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
                      {c.eta_puerto ? (
                        <>
                          <div className="fw-600">{fmtFechaCorta(c.eta_puerto)}</div>
                          <div className="text-xs muted">
                            {c.llegada_real ? `llegó ${fmtFechaCorta(c.llegada_real)}` : 'ETA puerto'}
                            {c.bodega_destino ? ` · ${c.bodega_destino}` : ''}
                          </div>
                        </>
                      ) : c.llegada_real ? (
                        <>
                          <div className="fw-600">{fmtFechaCorta(c.llegada_real)}</div>
                          <div className="text-xs muted">
                            llegó{c.bodega_destino ? ` · ${c.bodega_destino}` : ''}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs muted">— Por llegar —</span>
                      )}
                    </td>
                    <td><StatusPill status={c.status} /></td>
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
                    <td style={{ textAlign: 'right' }} className="fw-600 mono">
                      {fmtUSD(c.total_usd)}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono fw-700">
                      {saldoDe(c) <= 0.01 ? (
                        <span style={{ color: 'var(--green-500)' }}>Liquidado</span>
                      ) : (
                        <span style={{ color: 'var(--amber-500)' }}>{fmtUSD(saldoDe(c))}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="hstack" style={{ gap: 4, justifyContent: 'flex-end' }}>
                        <span
                          title={c.saldo_pagado ? 'Anticipo (cubierto por liquidación)' : 'Anticipo'}
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 999,
                            background:
                              c.anticipo_pagado || c.saldo_pagado
                                ? 'var(--green-500)'
                                : 'var(--ink-300)',
                            display: 'inline-block',
                          }}
                        />
                        <span
                          title="Saldo"
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 999,
                            background: c.saldo_pagado
                              ? 'var(--green-500)'
                              : c.anticipo_pagado
                                ? 'var(--amber-500)'
                                : 'var(--ink-300)',
                            display: 'inline-block',
                          }}
                        />
                      </div>
                      <div className="text-xs muted" style={{ marginTop: 2 }}>
                        {c.anticipo_pagado && c.saldo_pagado
                          ? 'Liquidado'
                          : c.saldo_pagado
                            ? 'Falta anticipo'
                            : c.anticipo_pagado
                              ? 'Saldo pdte'
                              : 'Anticipo pdte'}
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(c);
                        }}
                        title="Eliminar contrato"
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
              Mostrando {filtered.length} de {contratos.length} contratos
            </div>
            <div className="text-xs muted">
              Última actualización: {fmtFecha(new Date().toISOString().slice(0, 10))}
            </div>
          </div>
        )}
      </div>

      {/* CTAs grandes */}
      <div className="grid grid-2" style={{ marginTop: 16, gap: 16 }}>
        <Link
          to="/app/importaciones/blufin/contratos/carga-masiva"
          style={{
            padding: 20,
            borderRadius: 14,
            border: '1px solid var(--ink-200)',
            background: 'linear-gradient(135deg, #F3F9FF 0%, #E6F4FF 100%)',
            textAlign: 'left',
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--blue-500)',
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <Icon name="download" size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="fw-700" style={{ fontSize: 14, marginBottom: 4 }}>
              Carga masiva desde PDF
            </div>
            <div className="text-sm muted">
              Sube el PDF con todas las órdenes de compra y déjanos extraerlas. Tú revisas y editas antes de guardar.
            </div>
            <div className="text-xs" style={{ color: 'var(--blue-500)', fontWeight: 600, marginTop: 8 }}>
              Recomendado para 5+ contratos →
            </div>
          </div>
        </Link>
        <Link
          to="/app/importaciones/blufin/contratos/nuevo"
          style={{
            padding: 20,
            borderRadius: 14,
            border: '1px solid var(--ink-200)',
            background: 'white',
            textAlign: 'left',
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'var(--ink-50)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ink-700)',
              flexShrink: 0,
            }}
          >
            <Icon name="plus" size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="fw-700" style={{ fontSize: 14, marginBottom: 4 }}>
              Captura manual
            </div>
            <div className="text-sm muted">
              Formulario completo para capturar un contrato a la vez. Ideal cuando llega solo o necesitas precisión total.
            </div>
            <div className="text-xs" style={{ color: 'var(--ink-600)', fontWeight: 600, marginTop: 8 }}>
              Captura 1 contrato →
            </div>
          </div>
        </Link>
      </div>

      <ContratoDetalleModal contratoId={detalleId} onClose={() => setDetalleId(null)} />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what="este contrato"
        itemDescription={
          deleteTarget
            ? `${deleteTarget.folio} · ${deleteTarget.status} · ${fmtUSD(deleteTarget.total_usd)} · ${fmtKg(deleteTarget.total_kg)}`
            : undefined
        }
        consequences="Si el contrato tiene pagos o forwards registrados, primero hay que eliminarlos (la auditoría se preserva). Las líneas de producto sí se eliminan en cascada."
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
