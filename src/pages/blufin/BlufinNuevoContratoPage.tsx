import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { createContrato, fetchCatalogos } from '@/features/blufin/queries';
import { useAuth } from '@/lib/auth';
import { useDraft } from '@/lib/useDraft';
import { fmtUSD, fmtKg } from '@/lib/format';
import { getTcDelDia } from '@/lib/tc';

const STATUS_OPTS = ['Contratado', 'En tránsito', 'En puerto', 'Entregado'];
const FOLIO_INICIAL = 'MCO-CV-';

// La línea solo captura kg/cajas y precio — la ficha (descripción, marca,
// %, talla, kg/caja) se copia del SKU al elegirlo (snapshot: si el SKU
// cambia después en el catálogo, los contratos viejos no se alteran).
// `skuText` es lo que se escribe en el buscador de SKU de la línea.
type LineaProducto = {
  uid: string;
  sku_id: string | null;
  skuText: string;
  descripcion: string;
  marca: string;
  pct: string;
  talla: string;
  kg: string;
  kg_caja: string;
  cajas: string;
  precio_usd: string;
};

const emptyLinea = (): LineaProducto => ({
  uid: crypto.randomUUID(),
  sku_id: null,
  skuText: '',
  descripcion: '',
  marca: '',
  pct: '',
  talla: '',
  kg: '',
  kg_caja: '',
  cajas: '',
  precio_usd: '',
});

const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

type ContratoDraft = {
  folio: string;
  fecha: string;
  status: string;
  etaPuerto: string;
  etaBodegaOverride: string | null;
  bodegaDestino: string;
  presentacion: 'Paletizado' | 'Granel';
  contenedor: string;
  anticipoUsdOverride: string | null;
  anticipoFecha: string;
  saldoFecha: string;
  observaciones: string;
  lineas: LineaProducto[];
};

export function BlufinNuevoContratoPage() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: cat } = useQuery({
    queryKey: ['blufin_catalogos', empresaId],
    queryFn: () => fetchCatalogos(empresaId),
  });

  // Cabecera del contrato
  const [folio, setFolio] = useState(FOLIO_INICIAL);
  const [fecha, setFecha] = useState(hoyISO());
  const [status, setStatus] = useState('Contratado');
  const [etaPuerto, setEtaPuerto] = useState('');
  // etaBodega se calcula automáticamente como etaPuerto + 7 días pero queda editable
  const [etaBodegaOverride, setEtaBodegaOverride] = useState<string | null>(null);
  const [bodegaDestino, setBodegaDestino] = useState('');
  const [presentacion, setPresentacion] = useState<'Paletizado' | 'Granel'>('Paletizado');
  const [contenedor, setContenedor] = useState('');
  // tc_ponderado se llena automáticamente con el TC del día (Banxico) al guardar el contrato
  // anticipoUsd se calcula automáticamente como 10% del total pero queda editable
  const [anticipoUsdOverride, setAnticipoUsdOverride] = useState<string | null>(null);
  const [anticipoFecha, setAnticipoFecha] = useState('');
  const [saldoFecha, setSaldoFecha] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Líneas
  const [lineas, setLineas] = useState<LineaProducto[]>([emptyLinea()]);

  // ── Borrador automático: nada de lo capturado se pierde al salir ──
  const draftKey = `crm:draft:blufin-nuevo-contrato:${empresaId}`;

  const draftSnapshot = useMemo<ContratoDraft>(
    () => ({
      folio,
      fecha,
      status,
      etaPuerto,
      etaBodegaOverride,
      bodegaDestino,
      presentacion,
      contenedor,
      anticipoUsdOverride,
      anticipoFecha,
      saldoFecha,
      observaciones,
      lineas,
    }),
    [
      folio, fecha, status, etaPuerto, etaBodegaOverride, bodegaDestino,
      presentacion, contenedor, anticipoUsdOverride, anticipoFecha, saldoFecha,
      observaciones, lineas,
    ],
  );

  const applyDraft = (d: ContratoDraft) => {
    setFolio(d.folio ?? FOLIO_INICIAL);
    setFecha(d.fecha ?? hoyISO());
    setStatus(d.status ?? 'Contratado');
    setEtaPuerto(d.etaPuerto ?? '');
    setEtaBodegaOverride(d.etaBodegaOverride ?? null);
    setBodegaDestino(d.bodegaDestino ?? '');
    setPresentacion(d.presentacion ?? 'Paletizado');
    setContenedor(d.contenedor ?? '');
    setAnticipoUsdOverride(d.anticipoUsdOverride ?? null);
    setAnticipoFecha(d.anticipoFecha ?? '');
    setSaldoFecha(d.saldoFecha ?? '');
    setObservaciones(d.observaciones ?? '');
    setLineas(d.lineas?.length ? d.lineas : [emptyLinea()]);
  };

  const draft = useDraft(draftKey, draftSnapshot, applyDraft);

  const resetForm = () => {
    draft.clear();
    setFolio(FOLIO_INICIAL);
    setFecha(hoyISO());
    setStatus('Contratado');
    setEtaPuerto('');
    setEtaBodegaOverride(null);
    setBodegaDestino('');
    setPresentacion('Paletizado');
    setContenedor('');
    setAnticipoUsdOverride(null);
    setAnticipoFecha('');
    setSaldoFecha('');
    setObservaciones('');
    setLineas([emptyLinea()]);
  };

  // ¿Hay algo capturado que valga la pena conservar como borrador?
  const hasContent =
    folio.trim() !== FOLIO_INICIAL ||
    etaPuerto !== '' ||
    bodegaDestino !== '' ||
    contenedor !== '' ||
    observaciones !== '' ||
    lineas.some((l) => l.sku_id || l.skuText || toNum(l.kg) > 0 || toNum(l.precio_usd) > 0);

  const totales = useMemo(() => {
    const totalKg = lineas.reduce((s, l) => s + toNum(l.kg), 0);
    const totalUsd = lineas.reduce((s, l) => s + toNum(l.kg) * toNum(l.precio_usd), 0);
    return { totalKg, totalUsd };
  }, [lineas]);

  // ETA bodega automático = ETA puerto + 7 días (override manual gana si existe)
  const etaBodegaAuto = useMemo(() => {
    if (!etaPuerto) return '';
    const d = new Date(etaPuerto + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, [etaPuerto]);
  const etaBodega = etaBodegaOverride ?? etaBodegaAuto;

  // Anticipo automático = 10% del total (override manual gana)
  const anticipoUsdAuto = totales.totalUsd * 0.1;
  const anticipoUsd = anticipoUsdOverride ?? (anticipoUsdAuto > 0 ? anticipoUsdAuto.toFixed(2) : '');

  const saldoUsd = Math.max(totales.totalUsd - toNum(anticipoUsd), 0);

  const updateLinea = (uid: string, patch: Partial<LineaProducto>) => {
    setLineas((prev) =>
      prev.map((l) => {
        if (l.uid !== uid) return l;
        const next = { ...l, ...patch };
        const kgC = toNum(next.kg_caja);
        // conversión bidireccional kg ↔ cajas usando kg/caja del SKU
        if (('kg' in patch || 'kg_caja' in patch) && kgC > 0) {
          const kg = toNum(next.kg);
          next.cajas = kg > 0 ? String(Number((kg / kgC).toFixed(2))) : '';
        } else if ('cajas' in patch && kgC > 0) {
          const cajas = toNum(next.cajas);
          next.kg = cajas > 0 ? String(Number((cajas * kgC).toFixed(3))) : '';
        }
        return next;
      }),
    );
  };

  // Etiqueta canónica del SKU en el buscador
  const skuLabel = (s: { code: string; descripcion: string }) => `${s.code} — ${s.descripcion}`;

  // Resuelve el texto escrito a un SKU (match exacto por etiqueta o por código)
  const resolveSku = (text: string) => {
    const t = text.trim();
    return cat?.skus.find((s) => skuLabel(s) === t || s.code === t) ?? null;
  };

  // El buscador de SKU: al escribir se filtra (datalist nativo); al coincidir
  // con un SKU se copia su ficha completa del catálogo.
  const onSkuText = (uid: string, text: string) => {
    const sku = resolveSku(text);
    if (sku) {
      updateLinea(uid, {
        skuText: skuLabel(sku),
        sku_id: sku.id,
        descripcion: sku.descripcion,
        marca: sku.marca ?? '',
        pct: sku.pct ?? '',
        talla: sku.talla ?? '',
        kg_caja: String(sku.kg_caja),
      });
    } else {
      updateLinea(uid, {
        skuText: text,
        sku_id: null,
        descripcion: '',
        marca: '',
        pct: '',
        talla: '',
        kg_caja: '',
        cajas: '',
      });
    }
  };

  const removeLinea = (uid: string) => {
    setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.uid !== uid) : prev));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!folio.trim() || folio.trim() === 'MCO-CV-') {
        throw new Error('Captura el folio del contrato');
      }
      const lineasValidas = lineas.filter((l) => l.sku_id && toNum(l.kg) > 0);
      if (lineasValidas.length === 0) {
        throw new Error('Agrega al menos una línea con SKU elegido y kg capturados');
      }

      // TC del día (Banxico) — stub por ahora, será Edge Function
      const tcDelDia = await getTcDelDia();

      await createContrato(
        {
          empresa_id: empresaId,
          folio: folio.trim(),
          fecha: fecha || null,
          // lote: se llena cuando llega la factura (no se captura al crear contrato)
          status,
          eta_puerto: etaPuerto || null,
          eta_bodega: etaBodega || null,
          presentacion,
          bodega_destino: bodegaDestino || null,
          contenedor: contenedor || null,
          // naviera: se llena cuando se confirma el embarque (no se captura al crear contrato)
          total_usd: totales.totalUsd,
          total_kg: totales.totalKg,
          anticipo_usd: toNum(anticipoUsd) || null,
          anticipo_fecha: anticipoFecha || null,
          anticipo_pagado: false,
          saldo_usd: saldoUsd || null,
          saldo_fecha: saldoFecha || null,
          saldo_pagado: false,
          tc_ponderado: tcDelDia,
          observaciones: observaciones || null,
          // created_by se setea cuando integremos auth real (FK a crm.usuarios)
        },
        lineasValidas.map((l) => ({
          sku_id: l.sku_id,
          descripcion: l.descripcion || null,
          marca: l.marca || null,
          pct: l.pct || null,
          talla: l.talla || null,
          kg: toNum(l.kg),
          kg_caja: toNum(l.kg_caja),
          cajas: Math.round(toNum(l.cajas)) || null,
          precio_usd: toNum(l.precio_usd),
          total_usd: toNum(l.kg) * toNum(l.precio_usd),
        })),
      );
    },
    onSuccess: () => {
      toast.success(`Contrato ${folio} creado correctamente`);
      draft.clear();
      qc.invalidateQueries({ queryKey: ['blufin_contratos'] });
      navigate('/app/importaciones/blufin/contratos');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <>
      <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nuevo contrato</h2>
          <p className="page-subtitle">Captura manual de una orden de compra Blufin</p>
        </div>
        <div className="hstack" style={{ gap: 10 }}>
          {hasContent && (
            <div
              className="hstack"
              style={{
                gap: 8,
                padding: '4px 6px 4px 10px',
                borderRadius: 999,
                background: 'color-mix(in srgb, var(--green-500) 8%, white)',
                border: '1px solid color-mix(in srgb, var(--green-500) 28%, white)',
              }}
              title="Lo capturado se guarda como borrador automáticamente — si sales y vuelves, sigue aquí"
            >
              <span
                className="text-xs fw-600"
                style={{ color: '#065F46', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Icon name="check" size={12} /> Borrador guardado
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (window.confirm('¿Descartar el borrador y limpiar el formulario?')) resetForm();
                }}
                style={{ padding: '2px 8px', fontSize: 11 }}
              >
                Descartar
              </button>
            </div>
          )}
          <Link to="/app/importaciones/blufin/contratos" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
            <Icon name="arrow-left" size={13} /> Volver a contratos
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Información general</h3>
            <p className="card-subtitle">Cabecera del contrato</p>
          </div>
        </div>
        <div className="card-body grid grid-3">
          <div>
            <label className="field-label">Folio del contrato *</label>
            <input
              className="field-input mono"
              value={folio}
              onChange={(e) => setFolio(e.target.value.toUpperCase())}
              placeholder="MCO-CV-003566"
            />
          </div>
          <div>
            <label className="field-label">Fecha</label>
            <input type="date" className="field-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Status</label>
            <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">ETA puerto</label>
            <input type="date" className="field-input" value={etaPuerto} onChange={(e) => setEtaPuerto(e.target.value)} />
          </div>
          <div>
            <label className="field-label">
              ETA bodega
              {etaPuerto && etaBodegaOverride == null && (
                <span className="muted text-xs" style={{ fontWeight: 400, marginLeft: 6 }}>
                  · auto +7d
                </span>
              )}
              {etaBodegaOverride != null && (
                <button
                  type="button"
                  className="text-xs"
                  style={{ marginLeft: 6, color: 'var(--blue-500)', fontWeight: 400 }}
                  onClick={() => setEtaBodegaOverride(null)}
                >
                  restaurar auto
                </button>
              )}
            </label>
            <input
              type="date"
              className="field-input"
              value={etaBodega}
              onChange={(e) => setEtaBodegaOverride(e.target.value)}
              disabled={!etaPuerto && etaBodegaOverride == null}
            />
          </div>
          <div>
            <label className="field-label">Bodega destino</label>
            <select className="field-input" value={bodegaDestino} onChange={(e) => setBodegaDestino(e.target.value)}>
              <option value="">— Selecciona —</option>
              {cat?.bodegas.map((b) => (
                <option key={b.id} value={b.nombre}>{b.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Presentación</label>
            <select className="field-input" value={presentacion} onChange={(e) => setPresentacion(e.target.value as 'Paletizado' | 'Granel')}>
              <option value="Paletizado">Paletizado</option>
              <option value="Granel">Granel</option>
            </select>
          </div>
          <div>
            <label className="field-label">Contenedor</label>
            <input
              className="field-input mono"
              value={contenedor}
              onChange={(e) => setContenedor(e.target.value.toUpperCase())}
              placeholder="MSKU-1234567"
            />
          </div>
        </div>
      </div>

      {/* Líneas de producto */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Productos del contrato</h3>
            <p className="card-subtitle">
              Elige el SKU y su ficha se llena sola — captura únicamente kg (o cajas) y precio
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setLineas((p) => [...p, emptyLinea()])}>
            <Icon name="plus" size={13} /> Agregar línea
          </button>
        </div>
        {/* Buscador de SKU compartido por todas las líneas (autocompletado nativo) */}
        <datalist id="sku-catalog">
          {cat?.skus.map((s) => (
            <option key={s.id} value={`${s.code} — ${s.descripcion}`} />
          ))}
        </datalist>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>SKU</th>
                <th>Marca</th>
                <th>%</th>
                <th>Talla</th>
                <th style={{ textAlign: 'right' }}>Kg/caja</th>
                <th style={{ textAlign: 'right' }}>Kg</th>
                <th style={{ textAlign: 'right' }}>Cajas</th>
                <th style={{ textAlign: 'right' }}>Precio USD</th>
                <th style={{ textAlign: 'right' }}>Total USD</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, idx) => {
                const total = toNum(l.kg) * toNum(l.precio_usd);
                const sinSku = !l.sku_id;
                return (
                  <tr key={l.uid}>
                    <td className="muted">{idx + 1}</td>
                    <td style={{ minWidth: 240 }}>
                      <input
                        className="field-input"
                        list="sku-catalog"
                        value={l.skuText}
                        onChange={(e) => onSkuText(l.uid, e.target.value)}
                        placeholder="Escribe código o nombre…"
                        style={{
                          fontSize: 12,
                          padding: '6px 8px',
                          width: '100%',
                          borderColor: l.sku_id
                            ? 'var(--green-500)'
                            : l.skuText
                              ? 'var(--amber-500)'
                              : undefined,
                        }}
                      />
                    </td>
                    <td className="text-sm">
                      {l.marca || <span className="muted">—</span>}
                    </td>
                    <td className="mono text-sm">
                      {l.pct || <span className="muted">—</span>}
                    </td>
                    <td className="mono text-sm">
                      {l.talla || <span className="muted">—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono text-sm">
                      {l.kg_caja || <span className="muted">—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        className="field-input mono"
                        type="number"
                        step="0.001"
                        value={l.kg}
                        onChange={(e) => updateLinea(l.uid, { kg: e.target.value })}
                        disabled={sinSku}
                        title={sinSku ? 'Primero elige el SKU' : undefined}
                        style={{ fontSize: 12, padding: '6px 8px', textAlign: 'right', width: 100 }}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        className="field-input mono"
                        type="number"
                        step="1"
                        value={l.cajas}
                        onChange={(e) => updateLinea(l.uid, { cajas: e.target.value })}
                        disabled={sinSku || toNum(l.kg_caja) <= 0}
                        title={
                          sinSku
                            ? 'Primero elige el SKU'
                            : 'Al editar cajas, los kg se calculan automáticamente'
                        }
                        style={{ fontSize: 12, padding: '6px 8px', textAlign: 'right', width: 80 }}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        className="field-input mono"
                        type="number"
                        step="0.0001"
                        value={l.precio_usd}
                        onChange={(e) => updateLinea(l.uid, { precio_usd: e.target.value })}
                        disabled={sinSku}
                        title={sinSku ? 'Primero elige el SKU' : undefined}
                        style={{ fontSize: 12, padding: '6px 8px', textAlign: 'right', width: 100 }}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono fw-700">
                      {total > 0 ? fmtUSD(total) : '—'}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeLinea(l.uid)}
                        disabled={lineas.length === 1}
                        title="Eliminar línea"
                        style={{ padding: 6 }}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--ink-50)' }}>
                <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, padding: 12 }}>
                  Totales
                </td>
                <td style={{ textAlign: 'right' }} className="mono fw-700">
                  {fmtKg(totales.totalKg)}
                </td>
                <td colSpan={2}></td>
                <td
                  className="mono fw-700"
                  style={{ textAlign: 'right', fontSize: 14, color: 'var(--blue-500)' }}
                >
                  {fmtUSD(totales.totalUsd)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Anticipo y saldo */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Anticipo y saldo</h3>
            <p className="card-subtitle">
              Programación de pagos. El saldo se calcula automático.
            </p>
          </div>
        </div>
        <div className="card-body grid grid-3">
          <div>
            <label className="field-label">
              Anticipo USD
              {anticipoUsdOverride == null && totales.totalUsd > 0 && (
                <span className="muted text-xs" style={{ fontWeight: 400, marginLeft: 6 }}>
                  · auto 10%
                </span>
              )}
              {anticipoUsdOverride != null && (
                <button
                  type="button"
                  className="text-xs"
                  style={{ marginLeft: 6, color: 'var(--blue-500)', fontWeight: 400 }}
                  onClick={() => setAnticipoUsdOverride(null)}
                >
                  restaurar auto
                </button>
              )}
            </label>
            <input
              className="field-input mono"
              type="number"
              step="0.01"
              value={anticipoUsd}
              onChange={(e) => setAnticipoUsdOverride(e.target.value)}
              placeholder="0.00"
            />
            <div className="text-xs muted" style={{ marginTop: 4 }}>
              {anticipoUsdOverride == null
                ? 'Calculado al 10% del total. Edítalo si tu anticipo fue distinto.'
                : `Auto sería ${fmtUSD(anticipoUsdAuto)} (10% del total).`}
            </div>
          </div>
          <div>
            <label className="field-label">Fecha anticipo</label>
            <input
              type="date"
              className="field-input"
              value={anticipoFecha}
              onChange={(e) => setAnticipoFecha(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Fecha saldo</label>
            <input
              type="date"
              className="field-input"
              value={saldoFecha}
              onChange={(e) => setSaldoFecha(e.target.value)}
            />
          </div>
          <div style={{ gridColumn: 'span 3' }}>
            <div
              className="card"
              style={{
                background: 'var(--ink-50)',
                padding: 14,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 16,
              }}
            >
              <div>
                <div className="kpi-label">Total contrato</div>
                <div className="mono fw-700" style={{ fontSize: 18 }}>{fmtUSD(totales.totalUsd)}</div>
              </div>
              <div>
                <div className="kpi-label">Anticipo</div>
                <div className="mono fw-700" style={{ fontSize: 18, color: 'var(--blue-500)' }}>
                  {fmtUSD(toNum(anticipoUsd))}
                </div>
              </div>
              <div>
                <div className="kpi-label">Saldo</div>
                <div className="mono fw-700" style={{ fontSize: 18, color: 'var(--amber-500)' }}>
                  {fmtUSD(saldoUsd)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <label className="field-label">Observaciones</label>
          <textarea
            className="field-input"
            rows={3}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Notas internas sobre el contrato…"
          />
        </div>
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: 'white',
          padding: 16,
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--ink-200)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 24,
        }}
      >
        <div className="hstack" style={{ gap: 16 }}>
          <div>
            <div className="text-xs muted">Total</div>
            <div className="mono fw-700" style={{ fontSize: 16 }}>{fmtUSD(totales.totalUsd)}</div>
          </div>
          <div>
            <div className="text-xs muted">Kg</div>
            <div className="mono fw-700" style={{ fontSize: 16 }}>{fmtKg(totales.totalKg)}</div>
          </div>
          <div>
            <div className="text-xs muted">Líneas</div>
            <div className="fw-700" style={{ fontSize: 16 }}>
              {lineas.filter((l) => toNum(l.kg) > 0).length}
            </div>
          </div>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <Link
            to="/app/importaciones/blufin/contratos"
            className="btn btn-outline"
            style={{ textDecoration: 'none' }}
            title="Salir sin perder lo capturado — queda guardado como borrador"
          >
            Salir
          </Link>
          <button
            className="btn btn-primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }} /> Guardando…
              </>
            ) : (
              <>
                <Icon name="check" size={14} /> Guardar contrato
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
