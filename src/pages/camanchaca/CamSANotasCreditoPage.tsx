import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { StatStrip } from '@/components/StatStrip';
import { useAuth } from '@/lib/auth';
import { fmtUSD, fmtFecha, fmtFechaCorta } from '@/lib/format';
import { fetchNcSA, deleteNcSA, type CamNcSaEnriquecida } from '@/features/camanchaca/sa-nc-queries';
import { CamSANuevaNCModal } from '@/features/camanchaca/CamSANuevaNCModal';

export function CamSANotasCreditoPage() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);

  const { data: ncs = [], isLoading } = useQuery({
    queryKey: ['cam_sa_nc', empresaId],
    queryFn: () => fetchNcSA(empresaId),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteNcSA(id),
    onSuccess: () => {
      toast.success('Nota de crédito eliminada');
      qc.invalidateQueries({ queryKey: ['cam_sa_nc'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores_pendientes'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_saldos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtradas = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return ncs;
    return ncs.filter(
      (n) =>
        (n.contenedor?.folio_interno ?? '').toLowerCase().includes(s) ||
        n.motivo.toLowerCase().includes(s),
    );
  }, [ncs, search]);

  const kpis = useMemo(() => {
    const total = ncs.reduce((s, n) => s + Number(n.monto_usd), 0);
    return { total, count: ncs.length };
  }, [ncs]);

  return (
    <>
      <PageEnter className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Notas de crédito
          </h2>
          <p className="page-subtitle">
            Descuentos simplificados (monto USD + motivo) — reducen el saldo del contenedor
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setNuevaOpen(true)}>
          <Icon name="plus" size={13} /> Nueva NC
        </button>
      </PageEnter>

      <StatStrip
        stats={[
          { value: kpis.count, label: 'NCs' },
          { value: fmtUSD(kpis.total), label: 'descontado' },
        ]}
      />

      <div
        className="hstack"
        style={{ gap: 8, padding: '7px 12px', marginBottom: 10, background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 'var(--r-md)' }}
      >
        <Icon name="search" size={14} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar folio o motivo…"
          style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13, color: 'var(--ink-900)' }}
        />
      </div>

      <div className="card">
        {isLoading ? (
          <div style={{ padding: 20 }}>
            <div className="skeleton-bar" style={{ width: '40%', marginBottom: 10 }} />
            <div className="skeleton-bar" style={{ width: '70%' }} />
          </div>
        ) : ncs.length === 0 ? (
          <div className="empty">
            <Icon name="note" size={34} />
            <div className="empty-title">Sin notas de crédito</div>
            <p className="muted">Emite la primera NC con el botón "Nueva NC".</p>
            <button className="btn btn-primary btn-sm" onClick={() => setNuevaOpen(true)} style={{ marginTop: 12 }}>
              <Icon name="plus" size={13} /> Nueva NC
            </button>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="empty">
            <Icon name="search" size={34} />
            <div className="empty-title">Sin resultados</div>
            <p className="muted">Ninguna NC coincide con la búsqueda.</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Contenedor</th>
                <th>Motivo</th>
                <th style={{ textAlign: 'right' }}>Monto USD</th>
                <th>Status</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((n) => (
                <tr key={n.id}>
                  <td className="text-sm fw-600">{fmtFecha(n.fecha)}</td>
                  <td className="mono text-sm fw-600">{n.contenedor?.folio_interno ?? '—'}</td>
                  <td className="text-sm">{n.motivo}</td>
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
                          description: `${n.contenedor?.folio_interno ?? '—'} · ${n.motivo} · ${fmtUSD(n.monto_usd)} · ${fmtFechaCorta(n.fecha)}`,
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

      <CamSANuevaNCModal open={nuevaOpen} onClose={() => setNuevaOpen(false)} />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what="esta nota de crédito"
        itemDescription={deleteTarget?.description}
        consequences="El saldo del contenedor vuelve a subir por el monto de la NC."
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
