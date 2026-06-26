/**
 * Alta de una factura Neptuno con líneas SKU-first (igual que Blufin: se elige
 * el SKU y su ficha se copia como snapshot; solo se captura kg↔cajas + precio).
 * El número de factura es el identificador. Borrador automático con useDraft.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { createFactura, fetchCatalogos } from '@/features/neptuno/queries';
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
const addDiasISO = (iso: string, n: number) => {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

type FacturaDraft = {
  facturaNum: string;
  entradaIntelisis: string;
  fechaFactura: string;
  fechaVencimiento: string;
  observaciones: string;
  lineas: LineaProducto[];
};

export function NeptunoNuevaFacturaPage() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: cat } = useQuery({
    queryKey: ['neptuno_catalogos', empresaId],
    queryFn: () => fetchCatalogos(empresaId),
  });

  const [facturaNum, setFacturaNum] = useState('');
  const [entradaIntelisis, setEntradaIntelisis] = useState('');
  const [fechaFactura, setFechaFactura] = useState(hoyISO());
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState<LineaProducto[]>([emptyLinea()]);

  // ── Borrador automático ──
  const draftKey = `crm:draft:neptuno-nueva-factura:${empresaId}`;

  const draftSnapshot = useMemo<FacturaDraft>(
    () => ({
      facturaNum,
      entradaIntelisis,
      fechaFactura,
      fechaVencimiento,
      observaciones,
      lineas,
    }),
    [facturaNum, entradaIntelisis, fechaFactura, fechaVencimiento, observaciones, lineas],
  );

  const applyDraft = (d: FacturaDraft) => {
    setFacturaNum(d.facturaNum ?? '');
    setEntradaIntelisis(d.entradaIntelisis ?? '');
    setFechaFactura(d.fechaFactura ?? hoyISO());
    setFechaVencimiento(d.fechaVencimiento ?? '');
    setObservaciones(d.observaciones ?? '');
    setLineas(d.lineas?.length ? d.lineas : [emptyLinea()]);
  };

  const draft = useDraft(draftKey, draftSnapshot, applyDraft);

  const resetForm = () => {
    draft.clear();
    setFacturaNum('');
    setEntradaIntelisis('');
    setFechaFactura(hoyISO());
    setFechaVencimiento('');
    setObservaciones('');
    setLineas([emptyLinea()]);
  };

  const hasContent =
    facturaNum.trim() !== '' ||
    entradaIntelisis !== '' ||
    observaciones !== '' ||
    lineas.some((l) => l.sku_id || l.skuText || toNum(l.kg) > 0 || toNum(l.precio_usd) > 0);

  const totales = useMemo(() => {
    const totalKg = lineas.reduce((s, l) => s + toNum(l.kg), 0);
    const totalUsd = lineas.reduce((s, l) => s + toNum(l.kg) * toNum(l.precio_usd), 0);
    return { totalKg, totalUsd };
  }, [lineas]);

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
      const lineasValidas = lineas.filter((l) => l.sku_id && toNum(l.kg) > 0);
      if (lineasValidas.length === 0) {
        throw new Error('Agrega al menos una línea con SKU elegido y kg capturados');
      }

      await createFactura(
        {
          empresa_id: empresaId,
          factura_num: facturaNum.trim(),
          entrada_intelisis: entradaIntelisis.trim() || null,
          fecha_factura: fechaFactura,
          fecha_vencimiento: fechaVencimiento || null,
          status: 'Pendiente',
          total_usd: totales.totalUsd,
          total_kg: totales.totalKg,
          saldo_usd: totales.totalUsd,
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
    },
    onSuccess: () => {
      toast.success(`Factura ${facturaNum} creada correctamente`);
      draft.clear();
      qc.invalidateQueries({ queryKey: ['neptuno_facturas'] });
      qc.invalidateQueries({ queryKey: ['neptuno_facturas_pendientes'] });
      navigate('/app/importaciones/neptuno/facturas');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <>
      <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nueva factura</h2>
          <p className="page-subtitle">Captura de una factura Neptuno (USD)</p>
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
          <Link to="/app/importaciones/neptuno/facturas" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
            <Icon name="arrow-left" size={13} /> Volver a facturas
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Información de la factura</h3>
            <p className="card-subtitle">El número de factura es el identificador del proveedor</p>
          </div>
        </div>
        <div className="card-body grid grid-3">
          <div>
            <label className="field-label"># Factura *</label>
            <input
              className="field-input mono"
              value={facturaNum}
              onChange={(e) => setFacturaNum(e.target.value.toUpperCase())}
              placeholder="NEP-2026-001"
            />
          </div>
          <div>
            <label className="field-label">Entrada Intelisis</label>
            <input
              className="field-input mono"
              value={entradaIntelisis}
              onChange={(e) => setEntradaIntelisis(e.target.value.toUpperCase())}
              placeholder="EI-2026-0900"
            />
          </div>
          <div></div>
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
              Fecha vencimiento
              {fechaFactura && (
                <button
                  type="button"
                  className="text-xs"
                  style={{ marginLeft: 6, color: 'var(--blue-500)', fontWeight: 400 }}
                  onClick={() => setFechaVencimiento(addDiasISO(fechaFactura, 30))}
                  title="Calcular como fecha factura + 30 días"
                >
                  +30d
                </button>
              )}
            </label>
            <input
              type="date"
              className="field-input"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Líneas de producto */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Productos de la factura</h3>
            <p className="card-subtitle">
              Elige el SKU y su ficha se llena sola — captura únicamente kg (o cajas) y precio
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setLineas((p) => [...p, emptyLinea()])}>
            <Icon name="plus" size={13} /> Agregar línea
          </button>
        </div>
        <datalist id="nep-sku-catalog">
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
                        list="nep-sku-catalog"
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
                        title={
                          sinSku ? 'Primero elige el SKU' : 'Al editar cajas, los kg se calculan automáticamente'
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
                <td className="mono fw-700" style={{ textAlign: 'right', fontSize: 14, color: 'var(--blue-500)' }}>
                  {fmtUSD(totales.totalUsd)}
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
            placeholder="Notas internas sobre la factura…"
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
            to="/app/importaciones/neptuno/facturas"
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
                <Icon name="check" size={14} /> Guardar factura
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
