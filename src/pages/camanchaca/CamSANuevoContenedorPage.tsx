import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { createContenedorSA, fetchCatalogosSA, fetchOrdenesPlaneadas, updateOrdenPlaneada } from '@/features/camanchaca/sa-queries';
import { etaBodegaAutoSA, CAM_SA_STATUS_OPTS } from '@/features/camanchaca/sa-status';
import { useAuth } from '@/lib/auth';
import { useDraft } from '@/lib/useDraft';
import { fmtUSD, fmtKg } from '@/lib/format';

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

type ContenedorDraft = {
  ocProveedor: string;
  factura: string;
  fechaFactura: string;
  fechaVencimiento: string;
  status: string;
  etaManzanillo: string;
  etaBodegaOverride: string | null;
  naviera: string;
  contenedor: string;
  bodegaDestino: string;
  presentacion: 'Paletizado' | 'Granel';
  observaciones: string;
  lineas: LineaProducto[];
};

export function CamSANuevoContenedorPage() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const planeadaId = params.get('planeada');

  const { data: cat } = useQuery({
    queryKey: ['cam_sa_catalogos', empresaId],
    queryFn: () => fetchCatalogosSA(empresaId),
  });
  const { data: ordenes } = useQuery({
    queryKey: ['cam_sa_planeacion', empresaId],
    queryFn: () => fetchOrdenesPlaneadas(empresaId),
    enabled: !!planeadaId,
  });
  const ordenPlaneada = ordenes?.find((o) => o.id === planeadaId);

  const [ocProveedor, setOcProveedor] = useState('');
  const [factura, setFactura] = useState('');
  const [fechaFactura, setFechaFactura] = useState(hoyISO());
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [status, setStatus] = useState('En tránsito');
  const [etaManzanillo, setEtaManzanillo] = useState('');
  const [etaBodegaOverride, setEtaBodegaOverride] = useState<string | null>(null);
  const [naviera, setNaviera] = useState('');
  const [contenedor, setContenedor] = useState('');
  const [bodegaDestino, setBodegaDestino] = useState('');
  const [presentacion, setPresentacion] = useState<'Paletizado' | 'Granel'>('Paletizado');
  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState<LineaProducto[]>([emptyLinea()]);

  // Prefill OC desde la orden planeada (si vino por ?planeada=)
  useEffect(() => {
    if (ordenPlaneada && !ocProveedor) setOcProveedor(ordenPlaneada.oc_proveedor);
  }, [ordenPlaneada, ocProveedor]);

  const draftKey = `crm:draft:cam-sa-nuevo-contenedor:${empresaId}`;
  const draftSnapshot = useMemo<ContenedorDraft>(
    () => ({
      ocProveedor,
      factura,
      fechaFactura,
      fechaVencimiento,
      status,
      etaManzanillo,
      etaBodegaOverride,
      naviera,
      contenedor,
      bodegaDestino,
      presentacion,
      observaciones,
      lineas,
    }),
    [ocProveedor, factura, fechaFactura, fechaVencimiento, status, etaManzanillo, etaBodegaOverride, naviera, contenedor, bodegaDestino, presentacion, observaciones, lineas],
  );
  const applyDraft = (d: ContenedorDraft) => {
    setOcProveedor(d.ocProveedor ?? '');
    setFactura(d.factura ?? '');
    setFechaFactura(d.fechaFactura ?? hoyISO());
    setFechaVencimiento(d.fechaVencimiento ?? '');
    setStatus(d.status ?? 'En tránsito');
    setEtaManzanillo(d.etaManzanillo ?? '');
    setEtaBodegaOverride(d.etaBodegaOverride ?? null);
    setNaviera(d.naviera ?? '');
    setContenedor(d.contenedor ?? '');
    setBodegaDestino(d.bodegaDestino ?? '');
    setPresentacion(d.presentacion ?? 'Paletizado');
    setObservaciones(d.observaciones ?? '');
    setLineas(d.lineas?.length ? d.lineas : [emptyLinea()]);
  };
  const draft = useDraft(draftKey, draftSnapshot, applyDraft);

  const resetForm = () => {
    draft.clear();
    setOcProveedor('');
    setFactura('');
    setFechaFactura(hoyISO());
    setFechaVencimiento('');
    setStatus('En tránsito');
    setEtaManzanillo('');
    setEtaBodegaOverride(null);
    setNaviera('');
    setContenedor('');
    setBodegaDestino('');
    setPresentacion('Paletizado');
    setObservaciones('');
    setLineas([emptyLinea()]);
  };

  const hasContent =
    factura !== '' ||
    ocProveedor !== '' ||
    etaManzanillo !== '' ||
    contenedor !== '' ||
    observaciones !== '' ||
    lineas.some((l) => l.sku_id || l.skuText || toNum(l.kg) > 0 || toNum(l.precio_usd) > 0);

  const totales = useMemo(() => {
    const totalKg = lineas.reduce((s, l) => s + toNum(l.kg), 0);
    const totalUsd = lineas.reduce((s, l) => s + toNum(l.kg) * toNum(l.precio_usd), 0);
    return { totalKg, totalUsd };
  }, [lineas]);

  // ETA bodega = ETA Manzanillo + 7d (override gana)
  const etaBodegaAuto = useMemo(() => etaBodegaAutoSA(etaManzanillo || null) ?? '', [etaManzanillo]);
  const etaBodega = etaBodegaOverride ?? etaBodegaAuto;

  const updateLinea = (uid: string, patch: Partial<LineaProducto>) => {
    setLineas((prev) =>
      prev.map((l) => {
        if (l.uid !== uid) return l;
        const next = { ...l, ...patch };
        const kgC = toNum(next.kg_caja);
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

  const skuLabel = (s: { code: string; descripcion: string }) => `${s.code} — ${s.descripcion}`;
  const resolveSku = (text: string) => {
    const t = text.trim();
    return cat?.skus.find((s) => skuLabel(s) === t || s.code === t) ?? null;
  };
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
      updateLinea(uid, { skuText: text, sku_id: null, descripcion: '', marca: '', pct: '', talla: '', kg_caja: '', cajas: '' });
    }
  };
  const removeLinea = (uid: string) => setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.uid !== uid) : prev));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!factura.trim()) throw new Error('Captura el número de factura');
      const lineasValidas = lineas.filter((l) => l.sku_id && toNum(l.kg) > 0);
      if (lineasValidas.length === 0) throw new Error('Agrega al menos una línea con SKU elegido y kg capturados');

      const naviera_id = naviera ? cat?.navieras.find((n) => n.nombre === naviera)?.id ?? null : null;

      await createContenedorSA(
        {
          empresa_id: empresaId,
          // folio_interno lo asigna la BD (next_cam_folio)
          orden_planeada_id: planeadaId || null,
          oc_proveedor: ocProveedor.trim() || null,
          factura: factura.trim(),
          fecha_factura: fechaFactura || null,
          fecha_vencimiento: fechaVencimiento || null,
          status,
          eta_manzanillo: etaManzanillo || null,
          eta_bodega: etaBodega || null,
          naviera_id,
          naviera: naviera || null,
          contenedor: contenedor || null,
          presentacion,
          bodega_destino: bodegaDestino || null,
          total_usd: totales.totalUsd,
          total_kg: totales.totalKg,
          observaciones: observaciones || null,
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

      // Marcar la orden planeada como confirmada si vino de una
      if (planeadaId) {
        try {
          await updateOrdenPlaneada(planeadaId, { status: 'confirmado' });
        } catch {
          // no bloquea el alta del contenedor
        }
      }
    },
    onSuccess: () => {
      toast.success(`Contenedor con factura ${factura} creado correctamente`);
      draft.clear();
      qc.invalidateQueries({ queryKey: ['cam_sa_contenedores'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_planeacion'] });
      navigate('/app/importaciones/camanchaca/sa/contenedores');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nuevo contenedor SA</h2>
          <p className="page-subtitle">
            Confirmación con factura — el folio interno (CAM-XXX) se asigna automáticamente
          </p>
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
              title="Lo capturado se guarda como borrador automáticamente"
            >
              <span className="text-xs fw-600" style={{ color: '#065F46', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
          <Link to="/app/importaciones/camanchaca/sa/contenedores" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
            <Icon name="arrow-left" size={13} /> Volver a contenedores
          </Link>
        </div>
      </div>

      {ordenPlaneada && (
        <div
          className="card"
          style={{
            marginBottom: 12,
            padding: '10px 14px',
            background: 'color-mix(in srgb, var(--blue-500) 6%, white)',
            border: '1px solid color-mix(in srgb, var(--blue-500) 24%, white)',
            fontSize: 12,
          }}
        >
          Confirmando la orden planeada <strong className="mono">{ordenPlaneada.oc_proveedor}</strong>
          {ordenPlaneada.descripcion ? ` — ${ordenPlaneada.descripcion}` : ''}. Al guardar quedará como confirmada.
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Información general</h3>
            <p className="card-subtitle">Factura, fechas y logística del contenedor</p>
          </div>
        </div>
        <div className="card-body grid grid-3">
          <div>
            <label className="field-label">OC del proveedor</label>
            <input className="field-input mono" value={ocProveedor} onChange={(e) => setOcProveedor(e.target.value)} placeholder="OC-12345" />
          </div>
          <div>
            <label className="field-label"># Factura *</label>
            <input className="field-input mono" value={factura} onChange={(e) => setFactura(e.target.value)} placeholder="CAM-8841" />
          </div>
          <div>
            <label className="field-label">Status</label>
            <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {CAM_SA_STATUS_OPTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Fecha factura</label>
            <input type="date" className="field-input" value={fechaFactura} onChange={(e) => setFechaFactura(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Fecha vencimiento</label>
            <input type="date" className="field-input" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Naviera</label>
            <select className="field-input" value={naviera} onChange={(e) => setNaviera(e.target.value)}>
              <option value="">— Selecciona —</option>
              {cat?.navieras.map((n) => (
                <option key={n.id} value={n.nombre}>{n.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">ETA Manzanillo</label>
            <input type="date" className="field-input" value={etaManzanillo} onChange={(e) => setEtaManzanillo(e.target.value)} />
          </div>
          <div>
            <label className="field-label">
              ETA bodega
              {etaManzanillo && etaBodegaOverride == null && (
                <span className="muted text-xs" style={{ fontWeight: 400, marginLeft: 6 }}>· auto +7d</span>
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
              disabled={!etaManzanillo && etaBodegaOverride == null}
            />
          </div>
          <div>
            <label className="field-label">Contenedor</label>
            <input className="field-input mono" value={contenedor} onChange={(e) => setContenedor(e.target.value.toUpperCase())} placeholder="MSKU-1234567" />
          </div>

          <div>
            <label className="field-label">Presentación</label>
            <select className="field-input" value={presentacion} onChange={(e) => setPresentacion(e.target.value as 'Paletizado' | 'Granel')}>
              <option value="Paletizado">Paletizado</option>
              <option value="Granel">Granel</option>
            </select>
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
        </div>
      </div>

      {/* Líneas de producto */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Productos del contenedor</h3>
            <p className="card-subtitle">Elige el SKU y su ficha se llena sola — captura kg (o cajas) y precio USD</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setLineas((p) => [...p, emptyLinea()])}>
            <Icon name="plus" size={13} /> Agregar línea
          </button>
        </div>
        <datalist id="cam-sku-catalog">
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
                        list="cam-sku-catalog"
                        value={l.skuText}
                        onChange={(e) => onSkuText(l.uid, e.target.value)}
                        placeholder="Escribe código o nombre…"
                        style={{
                          fontSize: 12,
                          padding: '6px 8px',
                          width: '100%',
                          borderColor: l.sku_id ? 'var(--green-500)' : l.skuText ? 'var(--amber-500)' : undefined,
                        }}
                      />
                    </td>
                    <td className="text-sm">{l.marca || <span className="muted">—</span>}</td>
                    <td className="mono text-sm">{l.pct || <span className="muted">—</span>}</td>
                    <td className="mono text-sm">{l.talla || <span className="muted">—</span>}</td>
                    <td style={{ textAlign: 'right' }} className="mono text-sm">{l.kg_caja || <span className="muted">—</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        className="field-input mono"
                        type="number"
                        step="0.001"
                        value={l.kg}
                        onChange={(e) => updateLinea(l.uid, { kg: e.target.value })}
                        disabled={sinSku}
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
                        style={{ fontSize: 12, padding: '6px 8px', textAlign: 'right', width: 100 }}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono fw-700">{total > 0 ? fmtUSD(total) : '—'}</td>
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
                <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, padding: 12 }}>Totales</td>
                <td style={{ textAlign: 'right' }} className="mono fw-700">{fmtKg(totales.totalKg)}</td>
                <td colSpan={2}></td>
                <td className="mono fw-700" style={{ textAlign: 'right', fontSize: 14, color: 'var(--blue-500)' }}>{fmtUSD(totales.totalUsd)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
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
            placeholder="Notas internas del contenedor…"
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
            <div className="fw-700" style={{ fontSize: 16 }}>{lineas.filter((l) => toNum(l.kg) > 0).length}</div>
          </div>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <Link to="/app/importaciones/camanchaca/sa/contenedores" className="btn btn-outline" style={{ textDecoration: 'none' }} title="Salir sin perder lo capturado">
            Salir
          </Link>
          <button className="btn btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }} /> Guardando…
              </>
            ) : (
              <>
                <Icon name="check" size={14} /> Guardar contenedor
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
