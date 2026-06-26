import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { StatStrip } from '@/components/StatStrip';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { useAuth } from '@/lib/auth';
import { fmtMXN, fmtFecha } from '@/lib/format';
import { fetchNotasCreditoMX, deleteNotaCreditoMX } from '@/features/camanchaca/mx-nc-queries';
import { CamMXNuevaNCModal } from '@/features/camanchaca/CamMXNuevaNCModal';
import { CamMXCompraDetalleModal } from '@/features/camanchaca/CamMXCompraDetalleModal';

export function CamMXNotasCreditoPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);

  const { data: ncs = [], isLoading } = useQuery({
    queryKey: ['cam_mx_notas_credito', empresaId],
    queryFn: () => fetchNotasCreditoMX(empresaId),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteNotaCreditoMX(id),
    onSuccess: () => {
      toast.success('Nota de crédito eliminada');
      qc.invalidateQueries({ queryKey: ['cam_mx_notas_credito'] });
      qc.invalidateQueries({ queryKey: ['cam_mx_compras'] });
      qc.invalidateQueries({ queryKey: ['cam_mx_compras_pendientes'] });
      qc.invalidateQueries({ queryKey: ['cam_mx_pagado'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const total = ncs.reduce((s, n) => s + Number(n.monto_mxn), 0);
    return { count: ncs.length, total };
  }, [ncs]);

  const filtered = useMemo(() => {
    if (!search) return ncs;
    const s = search.toLowerCase();
    return ncs.filter(
      (n) =>
        (n.compra?.folio_interno ?? '').toLowerCase().includes(s) ||
        (n.compra?.factura_num ?? '').toLowerCase().includes(s) ||
        (n.motivo ?? '').toLowerCase().includes(s),
    );
  }, [ncs, search]);

  return (
    <>
      <PageEnter className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Notas de crédito
          </h2>
          <p className="page-subtitle">
            Descuentos en MXN sobre compras — reducen el saldo pendiente
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setNuevaOpen(true)}>
          <Icon name="plus" size={13} /> Nueva NC
        </button>
      </PageEnter>

      <StatStrip
        stats={[
          { value: kpis.count, label: 'notas de crédito' },
          { value: fmtMXN(kpis.total), label: 'descuento total', color: 'var(--red-500)' },
        ]}
      />

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ padding: '10px 14px' }}>
          <div
            className="hstack"
            style={{
              gap: 8,
              padding: '6px 10px',
              background: 'var(--ink-50)',
              borderRadius: 8,
              border: '1px solid var(--ink-200)',
            }}
          >
            <Icon name="search" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar compra, factura, motivo…"
              style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13 }}
            />
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div style={{ padding: 20 }}>
            <div className="skeleton-bar" style={{ width: '40%', marginBottom: 10 }} />
            <div className="skeleton-bar" style={{ width: '70%' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <Icon name="note" size={34} />
            <div className="empty-title">Sin notas de crédito</div>
            <p className="muted">
              {ncs.length === 0
                ? 'Registra la primera NC con el botón "Nueva NC".'
                : 'Ningún resultado para tu búsqueda.'}
            </p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Compra</th>
                <th>Factura</th>
                <th>Motivo</th>
                <th style={{ textAlign: 'right' }}>Monto MXN</th>
                <th>Status</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => (
                <tr
                  key={n.id}
                  onClick={() => n.compra_id && setDetalleId(n.compra_id)}
                  style={{ cursor: n.compra_id ? 'pointer' : 'default' }}
                  title="Ver ficha de la compra"
                >
                  <td className="text-sm">{fmtFecha(n.fecha)}</td>
                  <td className="mono fw-600 text-sm">{n.compra?.folio_interno ?? '—'}</td>
                  <td className="mono text-sm">{n.compra?.factura_num ?? '—'}</td>
                  <td className="text-sm">{n.motivo}</td>
                  <td style={{ textAlign: 'right' }} className="mono fw-700">
                    <span style={{ color: 'var(--red-500)' }}>−{fmtMXN(n.monto_mxn)}</span>
                  </td>
                  <td className="text-xs fw-700" style={{ color: 'var(--green-500)' }}>
                    {n.status ?? '—'}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setDeleteTarget({
                          id: n.id,
                          description: `${n.compra?.folio_interno ?? '—'} · ${n.motivo} · ${fmtMXN(n.monto_mxn)}`,
                        })
                      }
                      title="Eliminar NC"
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

      <CamMXNuevaNCModal open={nuevaOpen} onClose={() => setNuevaOpen(false)} />
      <CamMXCompraDetalleModal compraId={detalleId} onClose={() => setDetalleId(null)} />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what="esta nota de crédito"
        itemDescription={deleteTarget?.description}
        consequences="El saldo de la compra vuelve a subir por el monto de la NC."
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
