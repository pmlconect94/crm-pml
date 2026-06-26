/**
 * Notas de crédito Neptuno — simplificadas (monto USD + motivo, sin CFDI).
 * Lista plana; cada NC reduce el saldo de su factura.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { StatStrip } from '@/components/StatStrip';
import { useAuth } from '@/lib/auth';
import { fmtUSD, fmtFechaCorta } from '@/lib/format';
import { fetchNotasCredito, deleteNotaCredito } from '@/features/neptuno/nc-queries';
import { NuevaNCModal } from '@/features/neptuno/NuevaNCModal';

export function NeptunoNotasCreditoPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);

  const { data: ncs = [], isLoading } = useQuery({
    queryKey: ['neptuno_notas_credito', empresaId],
    queryFn: () => fetchNotasCredito(empresaId),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteNotaCredito(id),
    onSuccess: () => {
      toast.success('Nota de crédito eliminada');
      qc.invalidateQueries({ queryKey: ['neptuno_notas_credito'] });
      qc.invalidateQueries({ queryKey: ['neptuno_facturas'] });
      qc.invalidateQueries({ queryKey: ['neptuno_facturas_pendientes'] });
      qc.invalidateQueries({ queryKey: ['neptuno_saldos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const total = ncs.reduce((s, n) => s + Number(n.monto_usd ?? 0), 0);
    const facturas = new Set(ncs.map((n) => n.factura_id).filter(Boolean)).size;
    return { total, count: ncs.length, facturas };
  }, [ncs]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ncs;
    return ncs.filter(
      (n) =>
        (n.factura?.factura_num ?? '').toLowerCase().includes(q) ||
        (n.motivo ?? '').toLowerCase().includes(q),
    );
  }, [ncs, search]);

  return (
    <>
      <PageEnter className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Notas de crédito
          </h2>
          <p className="page-subtitle">Descuentos sobre facturas (USD) — reducen el saldo</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setNuevaOpen(true)}>
          <Icon name="plus" size={13} /> Nueva NC
        </button>
      </PageEnter>

      <StatStrip
        stats={[
          { value: kpis.count, label: 'notas de crédito' },
          { value: fmtUSD(kpis.total), label: 'total acreditado', color: 'var(--green-500)' },
          { value: kpis.facturas, label: 'facturas con NC' },
        ]}
      />

      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ padding: '10px 12px' }}>
          <div
            className="hstack"
            style={{
              gap: 8,
              padding: '6px 10px',
              background: 'var(--ink-50)',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--ink-200)',
            }}
          >
            <Icon name="search" size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por factura o motivo…"
              style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 12, color: 'var(--ink-900)' }}
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
        ) : filtradas.length === 0 ? (
          <div className="empty">
            <Icon name="note" size={34} />
            <div className="empty-title">{ncs.length === 0 ? 'Sin notas de crédito' : 'Sin resultados'}</div>
            <p className="muted">
              {ncs.length === 0
                ? 'Registra la primera NC con el botón "Nueva NC".'
                : 'Ajusta la búsqueda.'}
            </p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Factura</th>
                <th>Motivo</th>
                <th>Fecha</th>
                <th style={{ textAlign: 'right' }}>Monto NC</th>
                <th>Status</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((n) => (
                <tr key={n.id}>
                  <td className="mono fw-700 text-sm" style={{ color: 'var(--blue-500)' }}>
                    {n.factura?.factura_num ?? '—'}
                  </td>
                  <td className="text-sm">{n.motivo}</td>
                  <td className="text-sm">{fmtFechaCorta(n.fecha)}</td>
                  <td style={{ textAlign: 'right' }} className="mono fw-700" >
                    <span style={{ color: 'var(--red-500)' }}>−{fmtUSD(n.monto_usd)}</span>
                  </td>
                  <td>
                    <span className="badge badge-green">{n.status ?? 'Aplicada'}</span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setDeleteTarget({
                          id: n.id,
                          description: `${n.factura?.factura_num ?? '—'} · ${fmtUSD(n.monto_usd)} · ${n.motivo}`,
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

      <NuevaNCModal open={nuevaOpen} onClose={() => setNuevaOpen(false)} />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what="esta nota de crédito"
        itemDescription={deleteTarget?.description}
        consequences="El saldo de la factura vuelve a subir por el monto de la NC."
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
