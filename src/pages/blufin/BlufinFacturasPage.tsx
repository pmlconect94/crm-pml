/**
 * Facturas Blufin — lista + revisión de la factura del proveedor vs contrato.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { StatStrip } from '@/components/StatStrip';
import { FacturaDetalleModal } from '@/features/blufin/FacturaDetalleModal';
import { fetchFacturas, deleteFactura } from '@/features/blufin/facturas-queries';
import { useAuth } from '@/lib/auth';
import { fmtUSD, fmtFechaCorta } from '@/lib/format';
import type { BlufinFacturaEnriquecida } from '@/types/database';

const SUBTABS = [
  { id: 'por-revisar', label: 'Por revisar', icon: 'inbox' as const },
  { id: 'aprobadas', label: 'Aprobadas', icon: 'check-circle' as const },
  { id: 'todas', label: 'Todas', icon: 'receipt' as const },
];

const difDe = (f: BlufinFacturaEnriquecida) =>
  f.diferencia_monto != null
    ? Number(f.diferencia_monto)
    : Number(f.total_factura ?? 0) - Number(f.total_contrato ?? 0);

export function BlufinFacturasPage() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [view, setView] = useState('por-revisar');
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlufinFacturaEnriquecida | null>(null);

  const { data: facturas = [], isLoading } = useQuery({
    queryKey: ['blufin_facturas', empresaId],
    queryFn: () => fetchFacturas(empresaId),
  });

  const deleteMut = useMutation({
    mutationFn: (f: BlufinFacturaEnriquecida) => deleteFactura(f.id, f.storage_path),
    onSuccess: () => {
      toast.success('Factura eliminada');
      qc.invalidateQueries({ queryKey: ['blufin_facturas'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const porRevisar = facturas.filter((f) => f.status !== 'Aprobada').length;
    const aprobadas = facturas.filter((f) => f.status === 'Aprobada').length;
    const conDif = facturas.filter((f) => Math.abs(difDe(f)) > 0.01).length;
    const difNeta = facturas.reduce((s, f) => s + difDe(f), 0);
    return { porRevisar, aprobadas, conDif, difNeta };
  }, [facturas]);

  const filtradas = useMemo(() => {
    if (view === 'por-revisar') return facturas.filter((f) => f.status !== 'Aprobada');
    if (view === 'aprobadas') return facturas.filter((f) => f.status === 'Aprobada');
    return facturas;
  }, [facturas, view]);

  return (
    <>
      <PageEnter className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Facturas del proveedor
          </h2>
          <p className="page-subtitle">Revisa la factura de Blufin contra el contrato, línea por línea</p>
        </div>
        <button
          className="btn btn-primary btn-sm hide-on-mobile"
          onClick={() => navigate('/app/importaciones/blufin/facturas/revisar')}
        >
          <Icon name="plus" size={13} /> Revisar factura
        </button>
      </PageEnter>

      {/* Stat strip compacto — una sola línea para dar más espacio a la tabla */}
      <StatStrip
        stats={[
          { value: kpis.porRevisar, label: 'por revisar' },
          { value: kpis.aprobadas, label: 'aprobadas' },
          { value: kpis.conDif, label: 'con diferencia' },
          {
            value:
              Math.abs(kpis.difNeta) < 0.01
                ? '$0.00'
                : `${kpis.difNeta > 0 ? '+' : '−'}${fmtUSD(Math.abs(kpis.difNeta))}`,
            label: 'diferencia neta',
            color:
              Math.abs(kpis.difNeta) < 0.01
                ? undefined
                : kpis.difNeta > 0
                  ? 'var(--red-500)'
                  : 'var(--amber-500)',
          },
        ]}
      />

      {/* Sub-tabs */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${view === t.id ? 'active' : ''}`}
            onClick={() => setView(t.id)}
          >
            <Icon name={t.icon} size={13} />
            {t.label}
            {t.id === 'por-revisar' && kpis.porRevisar > 0 && (
              <span
                style={{
                  fontSize: 10,
                  background: 'var(--amber-500)',
                  color: 'white',
                  padding: '1px 6px',
                  borderRadius: 999,
                  marginLeft: 4,
                }}
              >
                {kpis.porRevisar}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: 20 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-bar" style={{ width: '80%', marginBottom: 12 }} />
            ))}
          </div>
        ) : filtradas.length === 0 ? (
          <div className="empty">
            <Icon name="receipt" size={36} />
            <div className="empty-title">
              {facturas.length === 0 ? 'Aún no hay facturas' : 'Nada en esta vista'}
            </div>
            <p className="muted">
              {facturas.length === 0
                ? 'Sube la factura del proveedor y compárala contra el contrato.'
                : 'Cambia de pestaña para ver otras facturas.'}
            </p>
            {facturas.length === 0 && (
              <button
                className="btn btn-primary btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => navigate('/app/importaciones/blufin/facturas/revisar')}
              >
                <Icon name="plus" size={13} /> Revisar factura
              </button>
            )}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Fecha</th>
                <th>Archivo</th>
                <th style={{ textAlign: 'right' }}>Total contrato</th>
                <th style={{ textAlign: 'right' }}>Total factura</th>
                <th style={{ textAlign: 'right' }}>Diferencia</th>
                <th>Status</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((f) => {
                const dif = difDe(f);
                const hayDif = Math.abs(dif) > 0.01;
                return (
                  <tr
                    key={f.id}
                    onClick={() => setDetalleId(f.id)}
                    style={{ cursor: 'pointer' }}
                    title="Ver comparación"
                  >
                    <td className="mono fw-600" style={{ fontSize: 13 }}>
                      {f.contrato?.folio ?? '—'}
                    </td>
                    <td className="text-sm">{fmtFechaCorta(f.fecha_subida)}</td>
                    <td className="text-xs muted">
                      {f.nombre_archivo ? (
                        <span className="hstack" style={{ gap: 4 }}>
                          <Icon name="receipt" size={12} /> {f.nombre_archivo.length > 22 ? f.nombre_archivo.slice(0, 22) + '…' : f.nombre_archivo}
                        </span>
                      ) : (
                        '— sin archivo —'
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">{fmtUSD(f.total_contrato)}</td>
                    <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtUSD(f.total_factura)}</td>
                    <td style={{ textAlign: 'right' }} className="mono fw-700">
                      {!hayDif ? (
                        <span style={{ color: 'var(--green-500)' }}>OK</span>
                      ) : (
                        <span style={{ color: dif > 0 ? 'var(--red-500)' : 'var(--amber-500)' }}>
                          {dif > 0 ? '+' : '−'}
                          {fmtUSD(Math.abs(dif))}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${f.status === 'Aprobada' ? 'badge-green' : 'badge-amber'}`}>
                        {f.status ?? 'Pendiente revisión'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(f);
                        }}
                        title="Eliminar factura"
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

      <FacturaDetalleModal facturaId={detalleId} onClose={() => setDetalleId(null)} />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        what="esta factura"
        itemDescription={
          deleteTarget
            ? `${deleteTarget.contrato?.folio ?? '—'} · factura ${fmtUSD(deleteTarget.total_factura)} · ${deleteTarget.status ?? 'Pendiente'}`
            : undefined
        }
        consequences="Se elimina la comparación y el archivo subido. Esta acción no afecta al contrato."
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
