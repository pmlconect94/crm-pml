import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { StatusPill } from '@/features/blufin/StatusPill';
import { statusContrato } from '@/features/blufin/status';
import { useAuth } from '@/lib/auth';
import { fmtKg, fmtUSD, fmtFechaCorta } from '@/lib/format';
import { fetchCatalogos } from '@/features/blufin/queries';
import { createRecepcion, fetchContratoById } from '@/features/blufin/recepcion-queries';
import { getImportPdfUrl, resolveFacturaPdf } from '@/features/blufin/import-queries';
import { PdfViewerModal, type PdfTarget } from '@/features/blufin/PdfViewerModal';

type LineaForm = {
  sku_id: string | null;
  descripcion: string;
  kg_contratados: number;
  kg_caja: number | null;
  kg_recibidos: string;
  cajas: string;
  observaciones: string;
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

// Números legibles en inputs: sin ceros colgantes
const trimNum = (n: number, decimales: number) => String(Number(n.toFixed(decimales)));

const cajasDesdeKg = (kg: number, kgCaja: number | null) =>
  kgCaja && kgCaja > 0 ? trimNum(kg / kgCaja, 2) : '';

const kgDesdeCajas = (cajas: number, kgCaja: number | null) =>
  kgCaja && kgCaja > 0 ? trimNum(cajas * kgCaja, 3) : '';

export function BlufinRecepcionRegistrarPage() {
  const { contratoId } = useParams<{ contratoId: string }>();
  const { empresaId, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Bloqueo: usuarios sin permiso de captura no registran recepciones (ni por URL).
  useEffect(() => {
    if (user && !user.capturar) navigate('/app/importaciones/blufin/recepcion', { replace: true });
  }, [user, navigate]);

  const { data: contrato, isLoading } = useQuery({
    queryKey: ['blufin_contrato', contratoId],
    queryFn: () => fetchContratoById(contratoId!),
    enabled: !!contratoId,
  });
  const { data: cat } = useQuery({
    queryKey: ['blufin_catalogos', empresaId],
    queryFn: () => fetchCatalogos(empresaId),
  });

  const [fecha, setFecha] = useState(hoyISO());
  const [bodegaId, setBodegaId] = useState<string>('');
  const [presRecibida, setPresRecibida] = useState('');
  const [intelisis, setIntelisis] = useState('');
  const [lote, setLote] = useState('');
  const [obsGenerales, setObsGenerales] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([]);
  const [pdf, setPdf] = useState<PdfTarget | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  async function verContratoPdf() {
    if (!contrato?.contrato_pdf_path) return;
    setPdfLoading(true);
    try {
      const url = await getImportPdfUrl(contrato.contrato_pdf_path);
      if (url) setPdf({ title: `Contrato ${contrato.folio}`, embed: url, open: url });
      else toast.error('No se encontró el PDF');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo abrir el PDF');
    } finally {
      setPdfLoading(false);
    }
  }

  async function verFacturaPdf() {
    if (!contrato) return;
    setPdfLoading(true);
    try {
      const u = await resolveFacturaPdf(contrato);
      if (u) setPdf({ title: `Factura ${contrato.folio}`, embed: u.embed, open: u.open });
      else toast.error('No se encontró el PDF de la factura');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo abrir el PDF');
    } finally {
      setPdfLoading(false);
    }
  }

  // Precargar líneas y defaults cuando llega el contrato.
  // kg recibidos arranca = kg contratados (solo se teclea si difiere).
  useEffect(() => {
    if (!contrato) return;
    setLineas(
      (contrato.productos ?? []).map((p) => {
        const kg = Number(p.kg ?? 0);
        const kgCaja = p.kg_caja != null ? Number(p.kg_caja) : null;
        return {
          sku_id: p.sku_id,
          descripcion: [p.descripcion, p.marca, p.talla].filter(Boolean).join(' · '),
          kg_contratados: kg,
          kg_caja: kgCaja,
          kg_recibidos: kg > 0 ? trimNum(kg, 3) : '',
          cajas: p.cajas != null ? String(p.cajas) : kg > 0 ? cajasDesdeKg(kg, kgCaja) : '',
          observaciones: '',
        };
      }),
    );
    setPresRecibida(contrato.presentacion ?? '');
    setLote(contrato.lote ?? '');
  }, [contrato]);

  useEffect(() => {
    if (!bodegaId && cat?.bodegas.length) {
      const porDefecto = contrato?.bodega_destino
        ? cat.bodegas.find((b) => b.nombre === contrato.bodega_destino)
        : null;
      setBodegaId(String((porDefecto ?? cat.bodegas[0]).id));
    }
  }, [cat, contrato, bodegaId]);

  const updateLinea = (idx: number, field: 'observaciones', value: string) =>
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));

  // Conversión bidireccional kg ↔ cajas usando kg/caja del producto
  const updateKg = (idx: number, value: string) =>
    setLineas((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const kg = parseFloat(value);
        return {
          ...l,
          kg_recibidos: value,
          cajas: !Number.isNaN(kg) ? cajasDesdeKg(kg, l.kg_caja) : '',
        };
      }),
    );

  const updateCajas = (idx: number, value: string) =>
    setLineas((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const cajas = parseFloat(value);
        return {
          ...l,
          cajas: value,
          kg_recibidos: !Number.isNaN(cajas) ? kgDesdeCajas(cajas, l.kg_caja) : l.kg_recibidos,
        };
      }),
    );

  const totales = useMemo(() => {
    const contratados = lineas.reduce((s, l) => s + l.kg_contratados, 0);
    const recibidos = lineas.reduce((s, l) => s + (parseFloat(l.kg_recibidos) || 0), 0);
    return { contratados, recibidos, diferencia: recibidos - contratados };
  }, [lineas]);

  const presDif = !!(
    presRecibida &&
    contrato?.presentacion &&
    presRecibida !== contrato.presentacion
  );

  const faltantes = useMemo(
    () =>
      lineas.filter((l) => {
        const kg = parseFloat(l.kg_recibidos);
        return l.kg_recibidos !== '' && !Number.isNaN(kg) && kg < l.kg_contratados;
      }),
    [lineas],
  );

  const faltaIntelisis = intelisis.trim() === '';

  const canConfirm =
    !!fecha &&
    !faltaIntelisis &&
    lineas.length > 0 &&
    lineas.every((l) => l.kg_recibidos !== '' && (parseFloat(l.kg_recibidos) || 0) > 0);

  const crearMut = useMutation({
    mutationFn: () => {
      const bodega = cat?.bodegas.find((b) => String(b.id) === bodegaId) ?? null;
      return createRecepcion({
        empresa_id: empresaId,
        contrato_id: contrato!.id,
        fecha_recepcion: fecha,
        bodega_id: bodega?.id ?? null,
        bodega_nombre: bodega?.nombre ?? null,
        entrada_intelisis: intelisis.trim() || null,
        presentacion_recibida: presRecibida || null,
        presentacion_pactada: contrato?.presentacion ?? null,
        observaciones: obsGenerales.trim() || null,
        lote: lote.trim() || null,
        lineas: lineas.map((l) => ({
          sku_id: l.sku_id,
          kg_contratados: l.kg_contratados,
          kg_recibidos: parseFloat(l.kg_recibidos) || 0,
          observaciones: l.observaciones.trim() || null,
        })),
      });
    },
    onSuccess: (ncCount) => {
      toast.success(
        ncCount > 0
          ? `Recepción registrada — ${ncCount} NC${ncCount > 1 ? 's' : ''} por aplicar generada${ncCount > 1 ? 's' : ''}`
          : `Recepción de ${contrato?.folio} registrada — contrato Entregado`,
      );
      qc.invalidateQueries({ queryKey: ['blufin_recepciones'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos'] });
      qc.invalidateQueries({ queryKey: ['blufin_contratos_por_recibir'] });
      qc.invalidateQueries({ queryKey: ['blufin_contrato', contratoId] });
      qc.invalidateQueries({ queryKey: ['blufin_notas_credito'] });
      navigate('/app/importaciones/blufin/recepcion');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div className="skeleton-bar" style={{ width: '30%', marginBottom: 10 }} />
        <div className="skeleton-bar" style={{ width: '60%' }} />
      </div>
    );
  }

  if (!contrato) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="alert" size={36} />
          <div className="empty-title">Contrato no encontrado</div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate('/app/importaciones/blufin/recepcion')}
            style={{ marginTop: 12 }}
          >
            <Icon name="arrow-left" size={13} /> Volver a Recepción
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageEnter style={{ marginBottom: 12 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate('/app/importaciones/blufin/recepcion')}
          style={{ marginBottom: 8, padding: '4px 8px' }}
        >
          <Icon name="arrow-left" size={13} /> Recepción
        </button>
        <div className="hstack" style={{ gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Registrar recepción de mercancía
          </h2>
          <span className="mono fw-700 text-sm">{contrato.folio}</span>
          <StatusPill status={statusContrato(contrato)} />
          <div className="hstack" style={{ gap: 6, marginLeft: 'auto' }}>
            {contrato.contrato_pdf_path && (
              <button
                className="btn btn-outline btn-sm"
                onClick={verContratoPdf}
                title="Ver el PDF de la orden de compra"
              >
                <Icon name="file-text" size={13} /> Contrato
              </button>
            )}
            {(contrato.factura_pdf_path || contrato.factura_drive_pdf_id) && (
              <button
                className="btn btn-outline btn-sm"
                onClick={verFacturaPdf}
                title="Ver el PDF de la factura del proveedor"
              >
                <Icon name="receipt" size={13} /> Factura
              </button>
            )}
          </div>
        </div>
      </PageEnter>

      {/* Barra de contexto del contrato */}
      <div
        className="card"
        style={{
          marginBottom: 12,
          padding: '10px 16px',
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        {[
          { label: 'Contenedor', value: contrato.contenedor ?? 'Por asignar', mono: true },
          { label: 'ETA bodega', value: fmtFechaCorta(contrato.eta_bodega) },
          { label: 'Total kg', value: fmtKg(contrato.total_kg), mono: true },
          { label: 'Total USD', value: fmtUSD(contrato.total_usd), mono: true },
          { label: 'Presentación pactada', value: contrato.presentacion ?? '—', blue: true },
        ].map((item) => (
          <div key={item.label}>
            <div className="text-xs muted">{item.label}</div>
            <div
              className={`text-sm fw-600 ${item.mono ? 'mono' : ''}`}
              style={item.blue ? { color: 'var(--blue-500)' } : undefined}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Datos generales de la recepción */}
      <div className="card" style={{ marginBottom: 12, padding: 16 }}>
        <div className="fw-700" style={{ fontSize: 13, marginBottom: 12 }}>
          Datos del contenedor
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}
        >
          <div>
            <label className="field-label">Fecha de recepción *</label>
            <input
              type="date"
              className="field-input"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Bodega</label>
            <select
              className="field-input"
              value={bodegaId}
              onChange={(e) => setBodegaId(e.target.value)}
            >
              {(cat?.bodegas ?? []).map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Presentación recibida</label>
            <select
              className="field-input"
              value={presRecibida}
              onChange={(e) => setPresRecibida(e.target.value)}
              style={{
                borderColor: presDif
                  ? 'var(--red-500)'
                  : presRecibida && presRecibida === contrato.presentacion
                    ? 'var(--green-500)'
                    : undefined,
              }}
            >
              <option value="Paletizado">Paletizado</option>
              <option value="Granel">Granel</option>
            </select>
            {presDif ? (
              <div className="text-xs fw-600" style={{ color: 'var(--red-500)', marginTop: 3 }}>
                Difiere del contrato ({contrato.presentacion}) — captura la NC en Notas de crédito
              </div>
            ) : (
              presRecibida && (
                <div className="text-xs" style={{ color: 'var(--green-500)', marginTop: 3 }}>
                  Coincide con el contrato
                </div>
              )
            )}
          </div>
          <div>
            <label className="field-label">Lote</label>
            <input
              className="field-input mono"
              value={lote}
              onChange={(e) => setLote(e.target.value)}
              placeholder="Lote del contenedor"
            />
            <div className="text-xs muted" style={{ marginTop: 3 }}>
              Se captura al recibir — actualiza el contrato
            </div>
          </div>
          <div>
            <label className="field-label">Entrada de compra Intelisis *</label>
            <input
              className="field-input mono"
              value={intelisis}
              onChange={(e) => setIntelisis(e.target.value)}
              placeholder="EC-2026-XXXX"
              style={{
                borderColor: !faltaIntelisis ? 'var(--green-500)' : undefined,
              }}
            />
            <div
              className="text-xs"
              style={{ marginTop: 3, color: faltaIntelisis ? 'var(--amber-500)' : 'var(--ink-500)' }}
            >
              {faltaIntelisis
                ? 'Obligatoria — sin entrada Intelisis no se puede confirmar'
                : 'Entrada registrada en el ERP'}
            </div>
          </div>
        </div>
      </div>

      {/* Verificación por SKU */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--ink-100)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span className="fw-700" style={{ fontSize: 13 }}>
            Verificación por SKU
          </span>
          <span className="text-xs muted">
            {totales.recibidos > 0 ? (
              <span
                className="mono fw-700"
                style={{
                  color:
                    totales.recibidos < totales.contratados
                      ? 'var(--red-500)'
                      : 'var(--green-500)',
                }}
              >
                {fmtKg(totales.recibidos)} / {fmtKg(totales.contratados)}
              </span>
            ) : (
              <span className="mono">{fmtKg(totales.contratados)} contratados</span>
            )}
          </span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Producto</th>
              <th style={{ textAlign: 'right', width: 130 }}>Kg contratados</th>
              <th style={{ width: 140 }}>Kg recibidos *</th>
              <th style={{ width: 110 }}>Cajas</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => {
              const kg = parseFloat(l.kg_recibidos) || 0;
              const hayFaltante = l.kg_recibidos !== '' && kg < l.kg_contratados;
              const completo = l.kg_recibidos !== '' && kg >= l.kg_contratados;
              const borde = hayFaltante
                ? 'var(--red-500)'
                : completo
                  ? 'var(--green-500)'
                  : undefined;
              return (
                <tr key={i}>
                  <td>
                    <div className="text-sm fw-600">
                      {l.descripcion || 'Producto sin descripción'}
                    </div>
                    {l.kg_caja != null && l.kg_caja > 0 && (
                      <div className="text-xs muted mono">{trimNum(l.kg_caja, 3)} kg/caja</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }} className="mono fw-600">
                    {fmtKg(l.kg_contratados)}
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="field-input mono"
                      value={l.kg_recibidos}
                      onChange={(e) => updateKg(i, e.target.value)}
                      placeholder={String(l.kg_contratados)}
                      style={{ fontWeight: 700, borderColor: borde }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      className="field-input mono"
                      value={l.cajas}
                      onChange={(e) => updateCajas(i, e.target.value)}
                      disabled={!l.kg_caja || l.kg_caja <= 0}
                      title={
                        !l.kg_caja || l.kg_caja <= 0
                          ? 'El producto no tiene kg/caja definido — captura en kg'
                          : 'Al editar cajas, los kg se calculan automáticamente'
                      }
                      placeholder={!l.kg_caja || l.kg_caja <= 0 ? '—' : ''}
                      style={{ fontWeight: 700, borderColor: borde }}
                    />
                  </td>
                  <td>
                    <input
                      className="field-input"
                      value={l.observaciones}
                      onChange={(e) => updateLinea(i, 'observaciones', e.target.value)}
                      placeholder="Notas de la línea…"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Diferencias detectadas */}
      {(faltantes.length > 0 || presDif) && (
        <div
          className="card"
          style={{
            marginBottom: 12,
            padding: 14,
            background: 'color-mix(in srgb, var(--amber-500) 6%, white)',
            border: '1px solid color-mix(in srgb, var(--amber-500) 30%, white)',
          }}
        >
          <div className="hstack" style={{ gap: 8, marginBottom: 8 }}>
            <Icon name="alert" size={14} />
            <span className="fw-700 text-sm" style={{ color: '#92400E' }}>
              {faltantes.length + (presDif ? 1 : 0)} diferencia
              {faltantes.length + (presDif ? 1 : 0) > 1 ? 's' : ''} detectada
              {faltantes.length + (presDif ? 1 : 0) > 1 ? 's' : ''}
            </span>
          </div>
          <div className="vstack" style={{ gap: 4 }}>
            {presDif && (
              <div className="text-xs" style={{ color: 'var(--ink-700)' }}>
                <span className="fw-700" style={{ color: '#92400E' }}>
                  PRESENTACIÓN
                </span>{' '}
                · {contrato.presentacion} pactado → {presRecibida} recibido
              </div>
            )}
            {faltantes.map((l, i) => (
              <div key={i} className="text-xs" style={{ color: 'var(--ink-700)' }}>
                <span className="fw-700" style={{ color: 'var(--red-500)' }}>
                  FALTANTE
                </span>{' '}
                · {l.descripcion} ·{' '}
                <span className="mono fw-600">
                  −{fmtKg(l.kg_contratados - (parseFloat(l.kg_recibidos) || 0))}
                </span>
              </div>
            ))}
          </div>
          <div className="text-xs muted" style={{ marginTop: 8 }}>
            Al confirmar la recepción se generará una nota de crédito <strong>«Sin monto»</strong>{' '}
            por cada diferencia, lista en <strong>Notas de crédito → Por aplicar</strong>. Captúrale
            el monto cuando el proveedor lo confirme y aplícala.
          </div>
        </div>
      )}

      {/* Observaciones generales */}
      <div className="card" style={{ marginBottom: 12, padding: 16 }}>
        <label className="field-label">Observaciones generales (opcional)</label>
        <textarea
          className="field-input"
          rows={2}
          value={obsGenerales}
          onChange={(e) => setObsGenerales(e.target.value)}
          placeholder="Estado del contenedor, incidencias generales…"
          style={{ resize: 'vertical' }}
        />
      </div>

      {/* Footer sticky con totales + confirmar */}
      <div
        className="card"
        style={{
          position: 'sticky',
          bottom: 12,
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 -4px 16px rgba(10,37,64,0.08)',
        }}
      >
        <div className="hstack" style={{ gap: 20 }}>
          <div>
            <div className="text-xs muted">Kg recibidos</div>
            <div className="mono fw-700">{fmtKg(totales.recibidos)}</div>
          </div>
          <div>
            <div className="text-xs muted">Kg contratados</div>
            <div className="mono fw-700">{fmtKg(totales.contratados)}</div>
          </div>
          <div>
            <div className="text-xs muted">Diferencia</div>
            <div
              className="mono fw-700"
              style={{
                color:
                  totales.recibidos === 0
                    ? undefined
                    : totales.diferencia < 0
                      ? 'var(--red-500)'
                      : 'var(--green-500)',
              }}
            >
              {totales.recibidos === 0
                ? '—'
                : `${totales.diferencia < 0 ? '−' : ''}${fmtKg(Math.abs(totales.diferencia))}`}
            </div>
          </div>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/app/importaciones/blufin/recepcion')}
          >
            Cancelar
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={!canConfirm || crearMut.isPending}
            onClick={() => crearMut.mutate()}
          >
            {crearMut.isPending ? (
              <div className="spinner" style={{ width: 12, height: 12 }} />
            ) : (
              <Icon name="check" size={13} />
            )}
            Confirmar recepción
          </button>
        </div>
      </div>
      <PdfViewerModal
        target={pdf}
        loading={pdfLoading}
        onClose={() => {
          setPdf(null);
          setPdfLoading(false);
        }}
      />
    </>
  );
}
