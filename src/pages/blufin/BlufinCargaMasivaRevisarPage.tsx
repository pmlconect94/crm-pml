/**
 * Revisión de un lote de carga masiva: se muestran los contratos extraídos del
 * PDF con el SKU auto-emparejado por renglón (editable con buscador) y badges de
 * confianza/duplicado. Al confirmar, se promueven a las tablas reales.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { Combobox } from '@/components/Combobox';
import {
  fetchImportLoteDetalle,
  importarLote,
  toggleOmitirContrato,
  updateImportLineaSku,
  getImportPdfUrl,
} from '@/features/blufin/import-queries';
import { fetchCatalogos } from '@/features/blufin/queries';
import { useAuth } from '@/lib/auth';
import { fmtUSD, fmtKg, fmtFechaCorta } from '@/lib/format';
import type { BlufinImportContratoConLineas } from '@/types/database';

const CONFIANZA_META: Record<string, { bg: string; text: string; label: string }> = {
  alta: { bg: '#D1FAE5', text: '#065F46', label: 'alta' },
  media: { bg: '#FEF3C7', text: '#92400E', label: 'media' },
  baja: { bg: '#FEE2E2', text: '#991B1B', label: 'baja' },
  sin_match: { bg: 'var(--ink-100)', text: 'var(--ink-500)', label: 'sin SKU' },
};

// Un contrato es importable si no es duplicado/omitido/importado y todas sus
// líneas tienen SKU asignado.
const estadoContrato = (c: BlufinImportContratoConLineas) => {
  if (c.status === 'importado') return 'importado';
  if (c.status === 'omitido') return 'omitido';
  if (c.duplicado) return 'duplicado';
  const lineas = c.lineas ?? [];
  if (lineas.length === 0 || lineas.some((l) => !l.sku_id)) return 'incompleto';
  return 'listo';
};

export function BlufinCargaMasivaRevisarPage() {
  const { loteId } = useParams<{ loteId: string }>();
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [abriendoPdf, setAbriendoPdf] = useState<string | null>(null);

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ['blufin_import_lote', loteId],
    queryFn: () => fetchImportLoteDetalle(loteId!),
    enabled: !!loteId,
  });

  const { data: cat } = useQuery({
    queryKey: ['blufin_catalogos', empresaId],
    queryFn: () => fetchCatalogos(empresaId),
  });

  const skuOptions = useMemo(
    () => (cat?.skus ?? []).map((s) => ({ id: s.id, label: `${s.code} — ${s.descripcion}` })),
    [cat],
  );

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['blufin_import_lote', loteId] });
    qc.invalidateQueries({ queryKey: ['blufin_import_lotes'] });
  };

  const skuMut = useMutation({
    mutationFn: ({ lineaId, skuId }: { lineaId: string; skuId: string | null }) =>
      updateImportLineaSku(lineaId, skuId),
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message),
  });

  const omitirMut = useMutation({
    mutationFn: ({ id, omitir }: { id: string; omitir: boolean }) => toggleOmitirContrato(id, omitir),
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message),
  });

  const importarMut = useMutation({
    mutationFn: () => importarLote(loteId!, empresaId),
    onSuccess: (r) => {
      const partes = [`${r.importados} importados`];
      if (r.omitidos) partes.push(`${r.omitidos} omitidos`);
      if (r.errores.length) partes.push(`${r.errores.length} con problemas`);
      if (r.errores.length) {
        toast.warning(`Importación parcial: ${partes.join(' · ')}`, {
          description: r.errores.map((e) => `${e.folio}: ${e.error}`).join(' | '),
        });
      } else {
        toast.success(`Importados ${r.importados} contratos`);
      }
      invalidar();
      qc.invalidateQueries({ queryKey: ['blufin_contratos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verPdf = async (path: string) => {
    setAbriendoPdf(path);
    try {
      const url = await getImportPdfUrl(path);
      if (url) window.open(url, '_blank');
      else toast.error('No se encontró el PDF');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al abrir el PDF');
    } finally {
      setAbriendoPdf(null);
    }
  };

  const kpis = useMemo(() => {
    let listos = 0,
      incompletos = 0,
      duplicados = 0,
      importados = 0;
    for (const c of contratos) {
      const e = estadoContrato(c);
      if (e === 'listo') listos++;
      else if (e === 'incompleto') incompletos++;
      else if (e === 'duplicado') duplicados++;
      else if (e === 'importado') importados++;
    }
    return { total: contratos.length, listos, incompletos, duplicados, importados };
  }, [contratos]);

  return (
    <>
      <PageEnter className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Revisar lote de importación
          </h2>
          <p className="page-subtitle">
            Corrige el SKU de cada renglón y confirma. Los contratos sólo se crean al importar.
          </p>
        </div>
        <Link
          to="/app/importaciones/blufin/contratos/carga-masiva"
          className="btn btn-ghost btn-sm"
          style={{ textDecoration: 'none' }}
        >
          <Icon name="arrow-left" size={13} /> Volver a lotes
        </Link>
      </PageEnter>

      {/* KPIs */}
      <div className="grid grid-4" style={{ marginBottom: 12 }}>
        <div className="kpi">
          <span className="kpi-label">Contratos</span>
          <span className="kpi-value">{kpis.total}</span>
          <span className="kpi-delta">En el lote</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Listos</span>
          <span className="kpi-value" style={{ color: 'var(--green-500)' }}>{kpis.listos}</span>
          <span className="kpi-delta">Todos los SKU asignados</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Por resolver</span>
          <span className="kpi-value" style={{ color: kpis.incompletos ? 'var(--red-500)' : undefined }}>
            {kpis.incompletos}
          </span>
          <span className="kpi-delta">Renglón sin SKU</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Duplicados</span>
          <span className="kpi-value" style={{ color: kpis.duplicados ? 'var(--amber-500)' : undefined }}>
            {kpis.duplicados}
          </span>
          <span className="kpi-delta">Folio ya en la BD</span>
        </div>
      </div>

      {isLoading ? (
        <div className="vstack" style={{ gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 140, borderRadius: 'var(--r-md)' }} />
          ))}
        </div>
      ) : contratos.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Icon name="inbox" size={42} style={{ color: 'var(--ink-400)', marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 700 }}>Este lote no tiene contratos</div>
          <div className="muted text-sm">Puede que se haya descartado.</div>
        </div>
      ) : (
        <div className="vstack" style={{ gap: 12, paddingBottom: 80 }}>
          {contratos.map((c) => (
            <ContratoCard
              key={c.id}
              contrato={c}
              skuOptions={skuOptions}
              abriendoPdf={abriendoPdf === c.pdf_path}
              onVerPdf={c.pdf_path ? () => verPdf(c.pdf_path!) : undefined}
              onSku={(lineaId, skuId) => skuMut.mutate({ lineaId, skuId })}
              onOmitir={(omitir) => omitirMut.mutate({ id: c.id, omitir })}
            />
          ))}
        </div>
      )}

      {/* Footer sticky */}
      {!isLoading && contratos.length > 0 && (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'white',
            padding: 14,
            borderRadius: 'var(--r-lg)',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--ink-200)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 12,
          }}
        >
          <div className="text-sm muted">
            <span className="fw-700" style={{ color: 'var(--green-500)' }}>{kpis.listos}</span> listos para
            importar
            {kpis.incompletos > 0 && (
              <> · <span className="fw-700" style={{ color: 'var(--red-500)' }}>{kpis.incompletos}</span> sin SKU</>
            )}
            {kpis.duplicados > 0 && <> · {kpis.duplicados} duplicados se omiten</>}
          </div>
          <button
            className="btn btn-primary"
            disabled={kpis.listos === 0 || importarMut.isPending}
            onClick={() => importarMut.mutate()}
          >
            {importarMut.isPending ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }} /> Importando…
              </>
            ) : (
              <>
                <Icon name="check" size={14} /> Importar {kpis.listos} contrato{kpis.listos === 1 ? '' : 's'}
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}

function ContratoCard({
  contrato,
  skuOptions,
  abriendoPdf,
  onVerPdf,
  onSku,
  onOmitir,
}: {
  contrato: BlufinImportContratoConLineas;
  skuOptions: { id: string; label: string }[];
  abriendoPdf: boolean;
  onVerPdf?: () => void;
  onSku: (lineaId: string, skuId: string | null) => void;
  onOmitir: (omitir: boolean) => void;
}) {
  const c = contrato;
  const estado = estadoContrato(c);
  const lineas = c.lineas ?? [];
  const omitido = c.status === 'omitido';
  const importado = c.status === 'importado';

  const borde =
    estado === 'incompleto'
      ? 'color-mix(in srgb, var(--red-500) 40%, white)'
      : estado === 'duplicado'
        ? 'color-mix(in srgb, var(--amber-500) 40%, white)'
        : 'var(--ink-200)';

  return (
    <div
      className="card"
      style={{ padding: 0, border: `1px solid ${borde}`, opacity: omitido ? 0.55 : 1 }}
    >
      {/* Cabecera del contrato */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--ink-200)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div className="hstack" style={{ gap: 8 }}>
          <span className="mono fw-700" style={{ fontSize: 14 }}>{c.folio}</span>
          {importado && <span className="badge badge-green"><span className="dot" /> Importado</span>}
          {c.duplicado && !importado && (
            <span className="text-xs fw-600" style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 999 }}>
              Duplicado
            </span>
          )}
          {estado === 'incompleto' && (
            <span className="text-xs fw-600" style={{ background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 999 }}>
              Falta SKU
            </span>
          )}
          {omitido && (
            <span className="text-xs fw-600" style={{ background: 'var(--ink-100)', color: 'var(--ink-500)', padding: '2px 8px', borderRadius: 999 }}>
              Omitido
            </span>
          )}
        </div>

        <div className="hstack text-xs muted" style={{ gap: 12, flexWrap: 'wrap', flex: 1 }}>
          <span>Fecha {fmtFechaCorta(c.fecha)}</span>
          <span>ETA puerto {fmtFechaCorta(c.eta_puerto)}</span>
          <span>ETA bodega {fmtFechaCorta(c.eta_bodega)}</span>
          {c.bodega_destino && <span title={c.bodega_destino} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Entrega: {c.bodega_destino}</span>}
        </div>

        <div className="hstack" style={{ gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="text-xs muted">Total</div>
            <div className="mono fw-700" style={{ fontSize: 13 }}>{fmtUSD(c.total_usd)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="text-xs muted">Kg</div>
            <div className="mono fw-700" style={{ fontSize: 13 }}>{fmtKg(c.total_kg)}</div>
          </div>
        </div>

        <div className="hstack" style={{ gap: 6 }}>
          {onVerPdf && (
            <button className="btn btn-ghost btn-sm" onClick={onVerPdf} disabled={abriendoPdf} title="Ver el PDF de esta orden">
              {abriendoPdf ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="file-text" size={13} />}
              PDF
            </button>
          )}
          {!importado && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onOmitir(!omitido)}
              title={omitido ? 'Incluir en la importación' : 'Omitir este contrato'}
            >
              <Icon name={omitido ? 'check' : 'x'} size={13} />
              {omitido ? 'Incluir' : 'Omitir'}
            </button>
          )}
        </div>
      </div>

      {/* Renglones */}
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>Producto (PDF)</th>
              <th>Marca</th>
              <th>Talla</th>
              <th>%</th>
              <th style={{ textAlign: 'right' }}>Kg</th>
              <th style={{ textAlign: 'right' }}>Cajas</th>
              <th style={{ textAlign: 'right' }}>Precio</th>
              <th style={{ minWidth: 260 }}>SKU del catálogo</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, idx) => {
              const conf = CONFIANZA_META[l.match_confianza ?? 'sin_match'] ?? CONFIANZA_META.sin_match;
              return (
                <tr key={l.id}>
                  <td className="muted">{idx + 1}</td>
                  <td className="text-xs" style={{ maxWidth: 280 }}>
                    <div
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={l.descripcion_pdf ?? ''}
                    >
                      {l.descripcion_pdf ?? '—'}
                    </div>
                  </td>
                  <td className="text-xs">{l.marca_pdf || <span className="muted">—</span>}</td>
                  <td className="mono text-xs">{l.talla_pdf || <span className="muted">—</span>}</td>
                  <td className="mono text-xs">{l.pct_pdf || <span className="muted">—</span>}</td>
                  <td className="mono text-xs" style={{ textAlign: 'right' }}>{fmtKg(l.kg)}</td>
                  <td className="mono text-xs" style={{ textAlign: 'right' }}>{l.cajas ?? '—'}</td>
                  <td className="mono text-xs" style={{ textAlign: 'right' }}>{fmtUSD(l.precio_usd)}</td>
                  <td>
                    <div className="hstack" style={{ gap: 6 }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <Combobox
                          options={skuOptions}
                          value={l.sku_id}
                          onChange={(id) => onSku(l.id, id)}
                          placeholder="Escribe código o nombre…"
                          className="field-input"
                        />
                      </div>
                      <span
                        className="text-xs fw-600"
                        style={{ background: conf.bg, color: conf.text, padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}
                      >
                        {conf.label}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
