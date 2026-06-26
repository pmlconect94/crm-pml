import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/lib/auth';
import { useDraft } from '@/lib/useDraft';
import { fmtMXN, fmtKg } from '@/lib/format';
import { createCompraMX, fetchCatalogosMX, vencimientoMX } from '@/features/camanchaca/mx-queries';

// La línea solo captura kg/cajas y precio MXN — la ficha (descripción, marca,
// %, talla, kg/caja) se copia del SKU al elegirlo (snapshot de solo lectura).
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
  precio_mxn: string;
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
  precio_mxn: '',
});

const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};
const hoyISO = () => new Date().toISOString().slice(0, 10);

type CompraDraft = {
  facturaNum: string;
  entradaIntelisis: string;
  fechaFactura: string;
  vencimientoOverride: string | null;
  observaciones: string;
  lineas: LineaProducto[];
};

export function CamMXNuevaCompraPage() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: cat } = useQuery({
    queryKey: ['cam_mx_catalogos', empresaId],
    queryFn: () => fetchCatalogosMX(empresaId),
  });

  // Cabecera
  const [facturaNum, setFacturaNum] = useState('');
  const [entradaIntelisis, setEntradaIntelisis] = useState('');
  const [fechaFactura, setFechaFactura] = useState(hoyISO());
  // Vencimiento = fecha factura + 30 días (override manual gana)
  const [vencimientoOverride, setVencimientoOverride] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');

  // Líneas
  const [lineas, setLineas] = useState<LineaProducto[]>([emptyLinea()]);

  // ── Borrador automático ──
  const draftKey = `crm:draft:cam-mx-nueva-compra:${empresaId}`;

  const draftSnapshot = useMemo<CompraDraft>(
    () => ({ facturaNum, entradaIntelisis, fechaFactura, vencimientoOverride, observaciones, lineas }),
    [facturaNum, entradaIntelisis, fechaFactura, vencimientoOverride, observaciones, lineas],
  );

  const applyDraft = (d: CompraDraft) => {
    setFacturaNum(d.facturaNum ?? '');
    setEntradaIntelisis(d.entradaIntelisis ?? '');
    setFechaFactura(d.fechaFactura ?? hoyISO());
    setVencimientoOverride(d.vencimientoOverride ?? null);
    setObservaciones(d.observaciones ?? '');
    setLineas(d.lineas?.length ? d.lineas : [emptyLinea()]);
  };

  const draft = useDraft(draftKey, draftSnapshot, applyDraft);

  const resetForm = () => {
    draft.clear();
    setFacturaNum('');
    setEntradaIntelisis('');
    setFechaFactura(hoyISO());
    setVencimientoOverride(null);
    setObservaciones('');
    setLineas([emptyLinea()]);
  };

  const hasContent =
    facturaNum.trim() !== '' ||
    entradaIntelisis.trim() !== '' ||
    observaciones !== '' ||
    lineas.some((l) => l.sku_id || l.skuText || toNum(l.kg) > 0 || toNum(l.precio_mxn) > 0);

  const totales = useMemo(() => {
    const totalKg = lineas.reduce((s, l) => s + toNum(l.kg), 0);
    const totalMxn = lineas.reduce((s, l) => s + toNum(l.kg) * toNum(l.precio_mxn), 0);
    return { totalKg, totalMxn };
  }, [lineas]);

  // Vencimiento automático = fecha factura + 30 días
  const vencimientoAuto = useMemo(
    () => (fechaFactura ? vencimientoMX(fechaFactura) : ''),
    [fechaFactura],
  );
  const vencimiento = vencimientoOverride ?? vencimientoAuto;

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
      if (!facturaNum.trim()) throw new Error('Captura el número de factura');
      if (!entradaIntelisis.trim()) {
        throw new Error('La entrada Intelisis es obligatoria para Camanchaca México');
      }
      if (!fechaFactura) throw new Error('Captura la fecha de la factura');
      const lineasValidas = lineas.filter((l) => l.sku_id && toNum(l.kg) > 0);
      if (lineasValidas.length === 0) {
        throw new Error('Agrega al menos una línea con SKU elegido y kg capturados');
      }

      await createCompraMX(
        {
          empresa_id: empresaId,
          factura_num: facturaNum.trim(),
          entrada_intelisis: entradaIntelisis.trim(),
          fecha_factura: fechaFactura,
          fecha_vencimiento: vencimiento || null,
          total_mxn: totales.totalMxn,
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
          precio_mxn: toNum(l.precio_mxn),
          total_mxn: toNum(l.kg) * toNum(l.precio_mxn),
        })),
      );
    },
    onSuccess: () => {
      toast.success(`Compra ${facturaNum} registrada correctamente`);
      draft.clear();
      qc.invalidateQueries({ queryKey: ['cam_mx_compras'] });
      qc.invalidateQueries({ queryKey: ['cam_mx_compras_pendientes'] });
      navigate('/app/importaciones/camanchaca/mx/compras');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nueva compra</h2>
          <p className="page-subtitle">Alta de una factura local de Camanchaca México (MXN)</p>
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
          <Link
            to="/app/importaciones/camanchaca/mx/compras"
            className="btn btn-ghost btn-sm"
            style={{ textDecoration: 'none' }}
          >
            <Icon name="arrow-left" size={13} /> Volver a compras
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Información de la factura</h3>
            <p className="card-subtitle">El folio interno (CAM-…) lo asigna el sistema al guardar</p>
          </div>
        </div>
        <div className="card-body grid grid-3">
          <div>
            <label className="field-label">Número de factura *</label>
            <input
              className="field-input mono"
              value={facturaNum}
              onChange={(e) => setFacturaNum(e.target.value)}
              placeholder="MX-8841"
            />
          </div>
          <div>
            <label className="field-label">Entrada Intelisis *</label>
            <input
              className="field-input mono"
              value={entradaIntelisis}
              onChange={(e) => setEntradaIntelisis(e.target.value)}
              placeholder="EI-2026-0234"
            />
          </div>
          <div>
            <label className="field-label">Fecha factura *</label>
            <input
              type="date"
              className="field-input"
              value={fechaFactura}
              onChange={(e) => setFechaFactura(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">
              Vencimiento
              {fechaFactura && vencimientoOverride == null && (
                <span className="muted text-xs" style={{ fontWeight: 400, marginLeft: 6 }}>
                  · auto +30d
                </span>
              )}
              {vencimientoOverride != null && (
                <button
                  type="button"
                  className="text-xs"
                  style={{ marginLeft: 6, color: 'var(--blue-500)', fontWeight: 400 }}
                  onClick={() => setVencimientoOverride(null)}
                >
                  restaurar auto
                </button>
              )}
            </label>
            <input
              type="date"
              className="field-input"
              value={vencimiento}
              onChange={(e) => setVencimientoOverride(e.target.value)}
              disabled={!fechaFactura && vencimientoOverride == null}
            />
          </div>
        </div>
      </div>

      {/* Líneas de producto */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Productos de la compra</h3>
            <p className="card-subtitle">
              Elige el SKU y su ficha se llena sola — captura únicamente kg (o cajas) y precio MXN
            </p>
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
          <table className="tbl" style={{ minWidth: 980 }}>
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
                <th style={{ textAlign: 'right' }}>Precio MXN</th>
                <th style={{ textAlign: 'right' }}>Total MXN</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, idx) => {
                const total = toNum(l.kg) * toNum(l.precio_mxn);
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
                          borderColor: l.sku_id
                            ? 'var(--green-500)'
                            : l.skuText
                              ? 'var(--amber-500)'
                              : undefined,
                        }}
                      />
                    </td>
                    <td className="text-sm">{l.marca || <span className="muted">—</span>}</td>
                    <td className="mono text-sm">{l.pct || <span className="muted">—</span>}</td>
                    <td className="mono text-sm">{l.talla || <span className="muted">—</span>}</td>
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
                        title={sinSku ? 'Primero elige el SKU' : 'Al editar cajas, los kg se calculan automáticamente'}
                        style={{ fontSize: 12, padding: '6px 8px', textAlign: 'right', width: 80 }}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        className="field-input mono"
                        type="number"
                        step="0.0001"
                        value={l.precio_mxn}
                        onChange={(e) => updateLinea(l.uid, { precio_mxn: e.target.value })}
                        disabled={sinSku}
                        title={sinSku ? 'Primero elige el SKU' : undefined}
                        style={{ fontSize: 12, padding: '6px 8px', textAlign: 'right', width: 100 }}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono fw-700">
                      {total > 0 ? fmtMXN(total) : '—'}
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
                <td className="mono fw-700" style={{ textAlign: 'right', fontSize: 14, color: 'var(--camanchaca)' }}>
                  {fmtMXN(totales.totalMxn)}
                </td>
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
            placeholder="Notas internas sobre la compra…"
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
            <div className="mono fw-700" style={{ fontSize: 16 }}>{fmtMXN(totales.totalMxn)}</div>
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
            to="/app/importaciones/camanchaca/mx/compras"
            className="btn btn-outline"
            style={{ textDecoration: 'none' }}
            title="Salir sin perder lo capturado — queda guardado como borrador"
          >
            Salir
          </Link>
          <button className="btn btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }} /> Guardando…
              </>
            ) : (
              <>
                <Icon name="check" size={14} /> Guardar compra
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
