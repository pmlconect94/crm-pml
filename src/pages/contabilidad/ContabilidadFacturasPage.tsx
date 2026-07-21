/**
 * Facturas recibidas — CFDIs sincronizados del SAT para PML. Fase 1: solo lectura
 * (lista + detalle). Reportes/conciliación/exports quedan para una fase posterior.
 */
import { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { FacturaDetalleModal } from '@/features/contabilidad/FacturaDetalleModal';
import { fetchFacturas, fetchUltimaSincronizacion, FACTURAS_PAGE_SIZE, type FacturasFiltros } from '@/features/contabilidad/facturas-queries';
import { exportFacturasDetallado } from '@/features/contabilidad/facturas-export';
import { TIPO_COMPROBANTE_FILTROS, METODO_PAGO_FILTROS, formaPagoCorto } from '@/features/contabilidad/catalogos-sat';
import { useAuth } from '@/lib/auth';
import { fmtPorMoneda, fmtFechaTS, fmtFechaHoraTS } from '@/lib/format';
import type { ContFactura } from '@/types/database';

// El sincronizador (Contabilidad PML) corre 3 veces al día vía tarea programada de
// Windows (7:30, 11:00, 13:00) — refrescar cada 5 min es de sobra para que el dato
// no se vea "viejo" sin generar tráfico de más.
const REFETCH_ULTIMA_SYNC_MS = 5 * 60 * 1000;

const TIPO_BADGE: Record<string, string> = { I: 'badge-blue', E: 'badge-amber', T: 'badge-violet', P: 'badge-gray' };

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="btn btn-sm"
      style={{
        background: active ? 'var(--navy-900)' : 'white',
        color: active ? 'white' : 'var(--ink-700)',
        boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--ink-200)',
        padding: '4px 11px',
        fontSize: 11.5,
      }}
    >
      {children}
    </button>
  );
}

export function ContabilidadFacturasPage() {
  const { empresaId } = useAuth();
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tipoComprobante, setTipoComprobante] = useState<string | undefined>(undefined);
  const [metodoPago, setMetodoPago] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [detalleUuid, setDetalleUuid] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const filtros: FacturasFiltros = useMemo(
    () => ({ q: q.trim() || undefined, desde: desde || undefined, hasta: hasta || undefined, tipoComprobante, metodoPago }),
    [q, desde, hasta, tipoComprobante, metodoPago],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['cont_facturas', empresaId, filtros, page],
    queryFn: () => fetchFacturas(empresaId, filtros, page),
    placeholderData: keepPreviousData,
  });

  const { data: ultimaSync } = useQuery({
    queryKey: ['cont_ultima_sincronizacion'],
    queryFn: fetchUltimaSincronizacion,
    refetchInterval: REFETCH_ULTIMA_SYNC_MS,
  });

  const facturas = data?.facturas ?? [];
  const total = data?.count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / FACTURAS_PAGE_SIZE));
  const hayFiltros = !!(q || desde || hasta || tipoComprobante || metodoPago);

  const cambiarFiltro = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(0);
  };

  const irPagina = (p: number) => setPage(Math.max(0, Math.min(totalPaginas - 1, p)));

  const descargarExcel = async () => {
    setExportando(true);
    try {
      const n = await exportFacturasDetallado(empresaId, filtros);
      toast.success(`Excel generado: ${n} factura${n === 1 ? '' : 's'}${hayFiltros ? ' (según filtros activos)' : ''}.`);
    } catch (e) {
      toast.error('No se pudo generar el Excel: ' + (e as Error).message);
    } finally {
      setExportando(false);
    }
  };

  return (
    <>
      <PageEnter className="page-header" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="page-title">Facturas recibidas</h1>
          <p className="page-subtitle">
            CFDIs sincronizados automáticamente del SAT — proveedores y gastos de {empresaId === 'marlin' ? 'Marlin' : 'PML'}
          </p>
        </div>
        <div className="hstack" style={{ gap: 14, flexShrink: 0 }}>
          <div className="text-xs muted" title="El sincronizador corre 3 veces al día (7:30, 11:00 y 13:00)">
            Última actualización: {ultimaSync ? <span className="fw-600">{fmtFechaHoraTS(ultimaSync)}</span> : '—'}
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={descargarExcel}
            disabled={exportando}
            title="Descarga en Excel todas las facturas que matchean los filtros activos, línea por concepto, con IVA/IEPS/retenciones desglosados"
          >
            {exportando ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="download" size={13} />}
            Descargar Excel
          </button>
        </div>
      </PageEnter>

      {/* Filtros + tabla: una sola tarjeta, sin separación entre ambos bloques */}
      <div className="card" style={{ opacity: isFetching && !isLoading ? 0.7 : 1, transition: 'opacity 180ms var(--ease-soft)' }}>
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--ink-100)' }}>
          <div className="hstack" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <div
              className="hstack"
              style={{
                gap: 8,
                padding: '5px 10px',
                background: 'var(--ink-50)',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--ink-200)',
                flex: 1,
                minWidth: 200,
              }}
            >
              <Icon name="search" size={13} />
              <input
                value={q}
                onChange={(e) => cambiarFiltro(setQ)(e.target.value)}
                placeholder="Buscar por razón social o RFC del emisor…"
                style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 12, color: 'var(--ink-900)' }}
              />
            </div>

            <input
              type="date"
              className="field-input"
              style={{ width: 136, padding: '5px 8px', fontSize: 12 }}
              value={desde}
              max={hasta || undefined}
              onChange={(e) => cambiarFiltro(setDesde)(e.target.value)}
              title="Desde"
            />
            <span className="text-xs muted">–</span>
            <input
              type="date"
              className="field-input"
              style={{ width: 136, padding: '5px 8px', fontSize: 12 }}
              value={hasta}
              min={desde || undefined}
              onChange={(e) => cambiarFiltro(setHasta)(e.target.value)}
              title="Hasta"
            />

            {hayFiltros && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setQ('');
                  setDesde('');
                  setHasta('');
                  setTipoComprobante(undefined);
                  setMetodoPago(undefined);
                  setPage(0);
                }}
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="hstack" style={{ gap: 14, flexWrap: 'wrap' }}>
            <div className="hstack" style={{ gap: 4 }}>
              {TIPO_COMPROBANTE_FILTROS.map((t) => (
                <Chip key={t.label} active={tipoComprobante === t.value} onClick={() => cambiarFiltro(setTipoComprobante)(t.value)}>
                  {t.label}
                </Chip>
              ))}
            </div>
            <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--ink-200)' }} />
            <div className="hstack" style={{ gap: 4 }}>
              {METODO_PAGO_FILTROS.map((m) => (
                <Chip key={m.label} active={metodoPago === m.value} onClick={() => cambiarFiltro(setMetodoPago)(m.value)}>
                  {m.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 16 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-bar" style={{ width: '80%', marginBottom: 10 }} />
            ))}
          </div>
        ) : facturas.length === 0 ? (
          <div className="empty">
            <Icon name="file-text" size={36} />
            <div className="empty-title">{hayFiltros ? 'Sin resultados' : 'Aún no hay facturas'}</div>
            <p className="muted">
              {hayFiltros ? 'Ajusta la búsqueda o los filtros.' : 'Las facturas se sincronizan automáticamente del SAT.'}
            </p>
          </div>
        ) : (
          <>
            <table className="tbl tbl-dense">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Emisor</th>
                  <th>Folio</th>
                  <th>Forma de pago</th>
                  <th>Método</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Estatus</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f: ContFactura) => (
                  <tr key={f.uuid} onClick={() => setDetalleUuid(f.uuid)} style={{ cursor: 'pointer' }} title="Ver detalle">
                    <td className="text-sm">{fmtFechaTS(f.fecha_emision)}</td>
                    <td>
                      {f.tipo_comprobante ? (
                        <span className={`badge ${TIPO_BADGE[f.tipo_comprobante] ?? 'badge-gray'}`}>{f.tipo_comprobante}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="text-sm wrap">
                      <div className="fw-600">{f.emisor_nombre ?? <span className="muted">Sin nombre</span>}</div>
                      <div className="mono text-xs muted">{f.emisor_rfc}</div>
                    </td>
                    <td className="mono text-sm">
                      {f.folio ? `${f.serie ? f.serie + '-' : ''}${f.folio}` : <span className="muted">—</span>}
                    </td>
                    <td className="text-sm">{formaPagoCorto(f.forma_pago)}</td>
                    <td>
                      {f.metodo_pago ? (
                        <span className={`badge ${f.metodo_pago === 'PUE' ? 'badge-green' : 'badge-blue'}`}>{f.metodo_pago}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono fw-600">
                      {fmtPorMoneda(f.total, f.moneda)}
                    </td>
                    <td>
                      <span className={`badge ${f.estatus_sat === 'vigente' ? 'badge-green' : 'badge-red'}`}>
                        {f.estatus_sat === 'vigente' ? 'Vigente' : 'Cancelado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="hstack" style={{ justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid var(--ink-100)' }}>
              <span className="text-xs muted">
                Página {page + 1} de {totalPaginas} · {total} factura{total === 1 ? '' : 's'}
              </span>
              <div className="hstack" style={{ gap: 6 }}>
                <button className="btn btn-ghost btn-sm" disabled={page === 0 || isFetching} onClick={() => irPagina(page - 1)}>
                  <Icon name="chevron-left" size={13} /> Anterior
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page >= totalPaginas - 1 || isFetching}
                  onClick={() => irPagina(page + 1)}
                >
                  Siguiente <Icon name="chevron-right" size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <FacturaDetalleModal uuid={detalleUuid} onClose={() => setDetalleUuid(null)} />
    </>
  );
}
