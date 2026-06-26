/**
 * Facturas Neptuno — lista. El número de factura ES el identificador.
 * Alta vía página dedicada (líneas SKU). Clic en una fila abre la ficha.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { StatStrip } from '@/components/StatStrip';
import { FacturaDetalleModal } from '@/features/neptuno/FacturaDetalleModal';
import { fetchFacturas, deleteFactura, fetchSaldosPorFactura } from '@/features/neptuno/queries';
import { useAuth } from '@/lib/auth';
import { fmtUSD, fmtKg, fmtFechaCorta, diasDesde } from '@/lib/format';
import type { NepFacturaConProductos } from '@/types/database';

type View = 'pendientes' | 'liquidadas' | 'todas';

const SUBTABS: { id: View; label: string; icon: 'inbox' | 'check-circle' | 'receipt' }[] = [
  { id: 'pendientes', label: 'Pendientes', icon: 'inbox' },
  { id: 'liquidadas', label: 'Liquidadas', icon: 'check-circle' },
  { id: 'todas', label: 'Todas', icon: 'receipt' },
];

const STATUS_BADGE: Record<string, string> = {
  Pendiente: 'badge-amber',
  Parcial: 'badge-blue',
  Liquidada: 'badge-green',
};

export function NeptunoFacturasListPage() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [view, setView] = useState<View>('pendientes');
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NepFacturaConProductos | null>(null);

  const { data: facturas = [], isLoading } = useQuery({
    queryKey: ['neptuno_facturas', empresaId],
    queryFn: () => fetchFacturas(empresaId),
  });

  const { data: saldos } = useQuery({
    queryKey: ['neptuno_saldos', empresaId],
    queryFn: () => fetchSaldosPorFactura(empresaId),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFactura(id),
    onSuccess: () => {
      toast.success('Factura eliminada');
      qc.invalidateQueries({ queryKey: ['neptuno_facturas'] });
      qc.invalidateQueries({ queryKey: ['neptuno_facturas_pendientes'] });
      qc.invalidateQueries({ queryKey: ['neptuno_saldos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saldoDe = (f: NepFacturaConProductos) =>
    Math.max(
      0,
      Number(f.total_usd ?? 0) -
        (saldos?.get(f.id)?.pagado ?? 0) -
        (saldos?.get(f.id)?.ncAplicado ?? 0),
    );

  const kpis = useMemo(() => {
    const pendientes = facturas.filter((f) => f.status !== 'Liquidada').length;
    const liquidadas = facturas.filter((f) => f.status === 'Liquidada').length;
    const totalUsd = facturas.reduce((s, f) => s + Number(f.total_usd ?? 0), 0);
    const porPagar = facturas.reduce((s, f) => s + saldoDe(f), 0);
    const totalKg = facturas.reduce((s, f) => s + Number(f.total_kg ?? 0), 0);
    return { pendientes, liquidadas, totalUsd, porPagar, totalKg };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturas, saldos]);

  const filtradas = useMemo(() => {
    const base =
      view === 'pendientes'
        ? facturas.filter((f) => f.status !== 'Liquidada')
        : view === 'liquidadas'
          ? facturas.filter((f) => f.status === 'Liquidada')
          : facturas;
    return base;
  }, [facturas, view]);

  return (
    <>
      <PageEnter className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Facturas Neptuno
          </h2>
          <p className="page-subtitle">El número de factura es el identificador · moneda USD</p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/app/importaciones/neptuno/facturas/nueva')}
        >
          <Icon name="plus" size={13} /> Nueva factura
        </button>
      </PageEnter>

      {/* Stat strip compacto — una sola línea para dar más espacio a la tabla */}
      <StatStrip
        stats={[
          { value: kpis.pendientes, label: 'pendientes' },
          { value: kpis.liquidadas, label: 'liquidadas' },
          { value: fmtUSD(kpis.totalUsd), label: 'facturado' },
          {
            value: fmtUSD(kpis.porPagar),
            label: 'por pagar',
            color: kpis.porPagar > 0 ? 'var(--amber-500)' : undefined,
          },
          { value: fmtKg(kpis.totalKg), label: 'kg' },
        ]}
      />

      {/* Sub-tabs */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        {SUBTABS.map((t) => (
          <button key={t.id} className={`tab ${view === t.id ? 'active' : ''}`} onClick={() => setView(t.id)}>
            <Icon name={t.icon} size={13} />
            {t.label}
            {t.id === 'pendientes' && kpis.pendientes > 0 && (
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
                {kpis.pendientes}
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
                ? 'Da de alta la primera factura del proveedor con sus productos.'
                : 'Cambia de pestaña para ver otras facturas.'}
            </p>
            {facturas.length === 0 && (
              <button
                className="btn btn-primary btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => navigate('/app/importaciones/neptuno/facturas/nueva')}
              >
                <Icon name="plus" size={13} /> Nueva factura
              </button>
            )}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Factura</th>
                <th>Intelisis</th>
                <th>Fecha</th>
                <th>Vence</th>
                <th style={{ textAlign: 'right' }}>Kg</th>
                <th style={{ textAlign: 'right' }}>Total USD</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
                <th>Status</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((f) => {
                const saldo = saldoDe(f);
                const dias = diasDesde(f.fecha_vencimiento);
                const vencido = dias !== null && dias < 0 && saldo > 0.01;
                return (
                  <tr
                    key={f.id}
                    onClick={() => setDetalleId(f.id)}
                    style={{ cursor: 'pointer' }}
                    title="Ver detalle"
                  >
                    <td className="mono fw-700" style={{ fontSize: 13, color: 'var(--blue-500)' }}>
                      {f.factura_num}
                    </td>
                    <td className="mono text-xs muted">{f.entrada_intelisis ?? '—'}</td>
                    <td className="text-sm">{fmtFechaCorta(f.fecha_factura)}</td>
                    <td className="text-sm">
                      {f.fecha_vencimiento ? (
                        <span style={vencido ? { color: 'var(--red-500)', fontWeight: 600 } : undefined}>
                          {fmtFechaCorta(f.fecha_vencimiento)}
                          {vencido && dias !== null && (
                            <span className="text-xs"> · {-dias}d</span>
                          )}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">{fmtKg(f.total_kg)}</td>
                    <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtUSD(f.total_usd)}</td>
                    <td style={{ textAlign: 'right' }} className="mono fw-700">
                      {saldo <= 0.01 ? (
                        <span style={{ color: 'var(--green-500)' }}>Liquidada</span>
                      ) : (
                        <span style={{ color: 'var(--amber-500)' }}>{fmtUSD(saldo)}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[f.status ?? 'Pendiente'] ?? 'badge-amber'}`}>
                        {f.status ?? 'Pendiente'}
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
            ? `${deleteTarget.factura_num} · ${fmtUSD(deleteTarget.total_usd)} · ${deleteTarget.status ?? 'Pendiente'}`
            : undefined
        }
        consequences="Se borran también sus productos. No se puede eliminar si tiene pagos o NCs."
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
