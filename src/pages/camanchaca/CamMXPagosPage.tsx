import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { StatStrip } from '@/components/StatStrip';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { useAuth } from '@/lib/auth';
import { fmtMXN, fmtFecha, fmtFechaCorta, diasDesde } from '@/lib/format';
import {
  fetchPagosMX,
  fetchComprasConPendienteMX,
  deletePagoMX,
} from '@/features/camanchaca/mx-pagos-queries';
import { CamMXPagoModal } from '@/features/camanchaca/CamMXPagoModal';
import { CamMXCompraDetalleModal } from '@/features/camanchaca/CamMXCompraDetalleModal';

type View = 'pendientes' | 'realizados';

export function CamMXPagosPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const [view, setView] = useState<View>('pendientes');
  const [pagoOpen, setPagoOpen] = useState(false);
  const [prefillCompra, setPrefillCompra] = useState<string | null>(null);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);

  // Filtros de "Realizados"
  const [search, setSearch] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data: pendientes = [], isLoading: loadingPend } = useQuery({
    queryKey: ['cam_mx_compras_pendientes', empresaId],
    queryFn: () => fetchComprasConPendienteMX(empresaId),
  });

  const { data: pagos = [], isLoading: loadingPagos } = useQuery({
    queryKey: ['cam_mx_pagos', empresaId],
    queryFn: () => fetchPagosMX(empresaId),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePagoMX(id),
    onSuccess: () => {
      toast.success('Pago eliminado');
      qc.invalidateQueries({ queryKey: ['cam_mx_pagos'] });
      qc.invalidateQueries({ queryKey: ['cam_mx_compras'] });
      qc.invalidateQueries({ queryKey: ['cam_mx_compras_pendientes'] });
      qc.invalidateQueries({ queryKey: ['cam_mx_pagado'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const porPagar = pendientes.reduce(
      (s, c) => s + Number(c.saldo_pendiente ?? c.total_mxn ?? 0),
      0,
    );
    const vencido = pendientes
      .filter((c) => c.fecha_vencimiento && (diasDesde(c.fecha_vencimiento) ?? 1) < 0)
      .reduce((s, c) => s + Number(c.saldo_pendiente ?? c.total_mxn ?? 0), 0);
    const pagadoTotal = pagos.reduce((s, p) => s + Number(p.monto), 0);
    return { porPagar, vencido, pagadoTotal, numPend: pendientes.length, numPagos: pagos.length };
  }, [pendientes, pagos]);

  // Pendientes ordenados por vencimiento; los vencidos arriba
  const pendientesOrdenados = useMemo(
    () =>
      [...pendientes].sort((a, b) =>
        (a.fecha_vencimiento || '9999-99-99').localeCompare(b.fecha_vencimiento || '9999-99-99'),
      ),
    [pendientes],
  );

  const realizadosFiltrados = useMemo(() => {
    return pagos.filter((p) => {
      if (search) {
        const s = search.toLowerCase();
        const m =
          (p.compra?.folio_interno ?? '').toLowerCase().includes(s) ||
          (p.compra?.factura_num ?? '').toLowerCase().includes(s) ||
          (p.referencia ?? '').toLowerCase().includes(s) ||
          (p.banco?.nombre ?? '').toLowerCase().includes(s);
        if (!m) return false;
      }
      if (desde && p.fecha < desde) return false;
      if (hasta && p.fecha > hasta) return false;
      return true;
    });
  }, [pagos, search, desde, hasta]);

  const totalFiltrado = realizadosFiltrados.reduce((s, p) => s + Number(p.monto), 0);

  const abrirPago = (compraId?: string) => {
    setPrefillCompra(compraId ?? null);
    setPagoOpen(true);
  };

  return (
    <>
      <PageEnter className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Pagos</h2>
          <p className="page-subtitle">
            Abonos en MXN a Camanchaca México — crédito 30 días, pagos parciales
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => abrirPago()}>
          <Icon name="plus" size={13} /> Registrar pago
        </button>
      </PageEnter>

      <StatStrip
        stats={[
          { value: fmtMXN(kpis.porPagar), label: `por pagar · ${kpis.numPend} compras`, color: 'var(--amber-500)' },
          { value: fmtMXN(kpis.vencido), label: 'vencido', color: kpis.vencido > 0 ? 'var(--red-500)' : undefined },
          { value: fmtMXN(kpis.pagadoTotal), label: `pagado · ${kpis.numPagos} pagos`, color: 'var(--green-500)' },
        ]}
      />

      {/* Sub-tabs */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        {([
          { id: 'pendientes', label: 'Pendientes', count: pendientes.length },
          { id: 'realizados', label: 'Realizados', count: pagos.length },
        ] as { id: View; label: string; count: number }[]).map((t) => (
          <button key={t.id} className={`tab ${view === t.id ? 'active' : ''}`} onClick={() => setView(t.id)}>
            {t.label}
            <span
              style={{
                marginLeft: 4,
                fontSize: 10,
                padding: '0 6px',
                borderRadius: 999,
                fontWeight: 700,
                background: 'var(--ink-100)',
                color: 'var(--ink-600)',
              }}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {view === 'pendientes' ? (
        <div className="card">
          {loadingPend ? (
            <div style={{ padding: 20 }}>
              <div className="skeleton-bar" style={{ width: '40%', marginBottom: 10 }} />
              <div className="skeleton-bar" style={{ width: '70%' }} />
            </div>
          ) : pendientesOrdenados.length === 0 ? (
            <div className="empty">
              <Icon name="check-circle" size={34} />
              <div className="empty-title">Todo pagado</div>
              <p className="muted">No hay compras con saldo pendiente.</p>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Compra</th>
                  <th>Factura</th>
                  <th>Vencimiento</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Saldo</th>
                  <th style={{ width: 140 }}></th>
                </tr>
              </thead>
              <tbody>
                {pendientesOrdenados.map((c) => {
                  const dias = c.fecha_vencimiento ? diasDesde(c.fecha_vencimiento) : null;
                  const vencido = dias != null && dias < 0;
                  const saldo = Number(c.saldo_pendiente ?? c.total_mxn ?? 0);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setDetalleId(c.id)}
                      style={{ cursor: 'pointer' }}
                      title="Ver ficha de la compra"
                    >
                      <td className="mono fw-700 text-sm">{c.folio_interno}</td>
                      <td className="mono text-sm fw-600">{c.factura_num}</td>
                      <td>
                        {c.fecha_vencimiento ? (
                          <>
                            <div className="fw-600">{fmtFechaCorta(c.fecha_vencimiento)}</div>
                            <div
                              className="text-xs"
                              style={{ color: vencido ? 'var(--red-500)' : 'var(--ink-500)' }}
                            >
                              {vencido
                                ? `vencido ${Math.abs(dias!)} d`
                                : dias === 0
                                  ? 'vence hoy'
                                  : `en ${dias} d`}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs muted">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">{fmtMXN(c.total_mxn)}</td>
                      <td style={{ textAlign: 'right' }} className="mono fw-700" >
                        <span style={{ color: 'var(--amber-500)' }}>{fmtMXN(saldo)}</span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-primary btn-sm" onClick={() => abrirPago(c.id)}>
                          <Icon name="banknote" size={12} /> Pagar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <>
          {/* Filtros de Realizados */}
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
                  minWidth: 240,
                }}
              >
                <Icon name="search" size={14} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar compra, factura, banco, referencia…"
                  style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13 }}
                />
              </div>
              <div className="hstack" style={{ gap: 6 }}>
                <input type="date" className="field-input" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ width: 150 }} />
                <span className="text-xs muted">a</span>
                <input type="date" className="field-input" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ width: 150 }} />
              </div>
              <div className="text-sm fw-700" style={{ marginLeft: 'auto', color: 'var(--green-500)' }}>
                {fmtMXN(totalFiltrado)}
              </div>
            </div>
          </div>

          <div className="card">
            {loadingPagos ? (
              <div style={{ padding: 20 }}>
                <div className="skeleton-bar" style={{ width: '40%', marginBottom: 10 }} />
                <div className="skeleton-bar" style={{ width: '70%' }} />
              </div>
            ) : realizadosFiltrados.length === 0 ? (
              <div className="empty">
                <Icon name="banknote" size={34} />
                <div className="empty-title">Sin pagos en esta vista</div>
                <p className="muted">
                  {pagos.length === 0 ? 'Aún no se registra ningún pago.' : 'Ajusta los filtros para ver pagos.'}
                </p>
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Compra</th>
                    <th>Factura</th>
                    <th style={{ textAlign: 'right' }}>Monto MXN</th>
                    <th>Banco</th>
                    <th>Referencia</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {realizadosFiltrados.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => p.compra_id && setDetalleId(p.compra_id)}
                      style={{ cursor: p.compra_id ? 'pointer' : 'default' }}
                    >
                      <td className="text-sm">{fmtFechaCorta(p.fecha)}</td>
                      <td className="mono fw-600 text-sm">{p.compra?.folio_interno ?? '—'}</td>
                      <td className="mono text-sm">{p.compra?.factura_num ?? '—'}</td>
                      <td style={{ textAlign: 'right' }} className="mono fw-700" >
                        <span style={{ color: 'var(--green-500)' }}>{fmtMXN(p.monto)}</span>
                      </td>
                      <td className="text-xs muted">{p.banco?.nombre ?? '—'}</td>
                      <td className="text-xs muted mono">{p.referencia ?? '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setDeleteTarget({
                              id: p.id,
                              description: `${p.compra?.folio_interno ?? '—'} · ${fmtMXN(p.monto)} · ${fmtFecha(p.fecha)}`,
                            })
                          }
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
      )}

      <CamMXPagoModal
        open={pagoOpen}
        onClose={() => {
          setPagoOpen(false);
          setPrefillCompra(null);
        }}
        prefillCompraId={prefillCompra}
      />
      <CamMXCompraDetalleModal compraId={detalleId} onClose={() => setDetalleId(null)} />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what="este pago"
        itemDescription={deleteTarget?.description}
        consequences="El saldo de la compra vuelve a subir por el monto del pago."
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
