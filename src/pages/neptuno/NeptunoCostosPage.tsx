/**
 * Central de costos Neptuno: inventario + costo promedio ponderado por SKU,
 * costo por factura e histórico de precios. Las cantidades de la factura SON
 * el inventario (no hay recepción separada). Sin forwards.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { useAuth } from '@/lib/auth';
import { fmtMXN, fmtUSD, fmtKg, fmtFechaCorta } from '@/lib/format';
import { getTcDelDiaInfo } from '@/lib/tc';
import {
  fetchCostosData,
  calcularPromedio,
  type SkuCosto,
  type FacturaCosto,
} from '@/features/neptuno/costos-queries';

const fmtUSD4 = (n: number | null | undefined) =>
  n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const toNum = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

type View = 'inventario' | 'facturas' | 'precios';

export function NeptunoCostosPage() {
  const { empresaId } = useAuth();
  const [view, setView] = useState<View>('inventario');
  const [tcInput, setTcInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['neptuno_costos', empresaId],
    queryFn: () => fetchCostosData(empresaId),
  });
  const skus = data?.skus ?? [];
  const facturas = data?.facturas ?? [];
  const sugerido = data?.tcDelDiaSugerido ?? null;

  const { data: tcInfo } = useQuery({
    queryKey: ['tc-del-dia'],
    queryFn: getTcDelDiaInfo,
    staleTime: 1000 * 60 * 60,
  });
  const tcLive = tcInfo?.tc ?? null;

  const tcTouchedRef = useRef(false);
  useEffect(() => {
    if (tcLive != null && !tcTouchedRef.current) setTcInput(tcLive.toFixed(4));
  }, [tcLive]);
  useEffect(() => {
    if (tcLive == null && sugerido != null && !tcTouchedRef.current) {
      setTcInput((prev) => (prev === '' ? sugerido.toFixed(4) : prev));
    }
  }, [tcLive, sugerido]);

  const tcEstimado = (() => {
    const n = toNum(tcInput);
    return n > 0 ? n : null;
  })();

  return (
    <>
      <PageEnter style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
          Central de costos
        </h2>
        <p className="page-subtitle">
          Costo promedio ponderado por SKU, costo por factura y evolución del precio FOB
        </p>
      </PageEnter>

      {/* TC del día estimado */}
      <div
        className="hstack"
        style={{
          gap: 10,
          marginBottom: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'color-mix(in srgb, var(--amber-500) 6%, white)',
          border: '1px solid color-mix(in srgb, var(--amber-500) 24%, white)',
          borderRadius: 'var(--r-md)',
        }}
      >
        <span className="text-xs fw-700" style={{ color: '#92400E', whiteSpace: 'nowrap' }}>
          TC del día (estimado)
        </span>
        <input
          type="number"
          step="0.0001"
          min="0"
          value={tcInput}
          onChange={(e) => {
            tcTouchedRef.current = true;
            setTcInput(e.target.value);
          }}
          placeholder="18.0000"
          className="field-input mono"
          style={{ width: 120, fontSize: 13, fontWeight: 700, padding: '6px 10px' }}
        />
        <span className="text-xs" style={{ color: '#92400E', flex: 1, minWidth: 240 }}>
          Se usa en las facturas SIN pagos todavía — esos costos salen en{' '}
          <strong>ámbar</strong> como ESTIMADOS al día de hoy.
          {tcInfo != null ? (
            <>
              {' '}Tomado automáticamente de la tasa de mercado del{' '}
              <span className="fw-700">{fmtFechaCorta(tcInfo.fecha)}</span>.
            </>
          ) : sugerido != null ? (
            <>
              {' '}Sugerido (último pago): <span className="mono fw-700">{sugerido.toFixed(4)}</span>.
            </>
          ) : null}
        </span>
      </div>

      <div className="tabs" style={{ marginBottom: 12 }}>
        {(
          [
            { id: 'inventario', label: 'Inventario & Costo Promedio', icon: 'trend-up' },
            { id: 'facturas', label: 'Por factura', icon: 'receipt' },
            { id: 'precios', label: 'Histórico de Precios', icon: 'file-text' },
          ] as const
        ).map((t) => (
          <button key={t.id} className={`tab ${view === t.id ? 'active' : ''}`} onClick={() => setView(t.id)}>
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card">
          <div style={{ padding: 20 }}>
            <div className="skeleton-bar" style={{ width: '40%', marginBottom: 10 }} />
            <div className="skeleton-bar" style={{ width: '70%' }} />
          </div>
        </div>
      ) : facturas.length === 0 ? (
        <div className="card">
          <div className="empty">
            <Icon name="trend-up" size={36} />
            <div className="empty-title">Sin datos de costos todavía</div>
            <p className="muted">
              Cuando haya facturas con productos capturados, aquí podrás calcular el costo promedio
              ponderado de tu stock y el costo por factura.
            </p>
          </div>
        </div>
      ) : view === 'inventario' ? (
        <InventarioView skus={skus} tcEstimado={tcEstimado} />
      ) : view === 'facturas' ? (
        <FacturasView facturas={facturas} tcEstimado={tcEstimado} />
      ) : (
        <PreciosView skus={skus} />
      )}
    </>
  );
}

/* ─── TC / MXN helpers ────────────────────────────────────────────── */

const TC_ORIGEN_LABEL: Record<string, string> = {
  pagos: 'Promedio ponderado de pagos reales',
  ninguno: 'Sin TC disponible (falta pago o TC del día)',
};

function TcCell({ f, tcEstimado }: { f: { tc: number | null; tc_origen: string }; tcEstimado?: number | null }) {
  if (f.tc != null) {
    return (
      <span
        className="mono"
        title={TC_ORIGEN_LABEL[f.tc_origen]}
        style={{ borderBottom: '1px dotted var(--ink-300)', cursor: 'help' }}
      >
        {f.tc.toFixed(4)}
      </span>
    );
  }
  if (tcEstimado != null && tcEstimado > 0) {
    return (
      <span
        className="mono"
        title="TC estimado del día (no oficial) — la factura aún no tiene pagos"
        style={{ color: 'var(--amber-500)', borderBottom: '1px dotted var(--amber-500)', cursor: 'help' }}
      >
        {tcEstimado.toFixed(4)}<span className="text-xs"> est.</span>
      </span>
    );
  }
  return (
    <span className="text-xs muted" title={TC_ORIGEN_LABEL.ninguno}>
      —
    </span>
  );
}

function MxnKgCell({ precioUsd, tcReal, tcEstimado }: { precioUsd: number; tcReal: number | null; tcEstimado: number | null }) {
  if (tcReal != null) return <>{fmtMXN(precioUsd * tcReal)}</>;
  if (tcEstimado != null && tcEstimado > 0) {
    return (
      <span style={{ color: 'var(--amber-500)' }} title="Estimado con el TC del día (no oficial)">
        {fmtMXN(precioUsd * tcEstimado)}<span className="text-xs"> est.</span>
      </span>
    );
  }
  return <>—</>;
}

/* ─── Tab 1 — Inventario & Costo Promedio ─────────────────────────── */

function InventarioView({ skus, tcEstimado }: { skus: SkuCosto[]; tcEstimado: number | null }) {
  const [query, setQuery] = useState('');
  const [prodFilter, setProdFilter] = useState('Todos');
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stockInput, setStockInput] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const productos = useMemo(() => Array.from(new Set(skus.map((s) => s.producto ?? '—'))).sort(), [skus]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skus.filter((s) => {
      if (prodFilter !== 'Todos' && (s.producto ?? '—') !== prodFilter) return false;
      if (!q) return true;
      return (
        s.descripcion.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.producto ?? '').toLowerCase().includes(q) ||
        (s.marca ?? '').toLowerCase().includes(q) ||
        (s.talla ?? '').toLowerCase().includes(q)
      );
    });
  }, [skus, query, prodFilter]);

  const activeSku = selectedId ? skus.find((s) => s.sku_id === selectedId) ?? null : null;
  const fuentes = activeSku ? activeSku.fuentes : [];
  const last5 = fuentes.slice(0, 5);
  const stockKg = toNum(stockInput);
  const resultado = activeSku && stockKg > 0 ? calcularPromedio(fuentes, stockKg, tcEstimado) : null;

  const seleccionar = (s: SkuCosto) => {
    setSelectedId(s.sku_id);
    setQuery(s.descripcion);
    setOpen(false);
    setStockInput('');
  };
  const limpiar = () => {
    setSelectedId(null);
    setQuery('');
    setStockInput('');
  };

  return (
    <div className="vstack" style={{ gap: 12 }}>
      <div className="hstack" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span className="text-xs muted fw-600" style={{ alignSelf: 'center' }}>
          Producto:
        </span>
        <select
          className="field-input"
          value={prodFilter}
          onChange={(e) => {
            setProdFilter(e.target.value);
            if (e.target.value !== 'Todos') {
              setSelectedId(null);
              setQuery('');
            }
          }}
          style={{ width: 'auto', minWidth: 180, padding: '6px 10px', fontSize: 12 }}
        >
          <option value="Todos">Todos los productos</option>
          {productos.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div ref={boxRef} style={{ position: 'relative', maxWidth: 560 }}>
        <div
          className="hstack"
          style={{
            gap: 8,
            padding: '9px 12px',
            background: 'white',
            border: '1px solid var(--ink-200)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-sm)',
          }}
          onClick={() => setOpen(true)}
        >
          <Icon name="search" size={14} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              if (!e.target.value) setSelectedId(null);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar producto, marca o talla…"
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, fontWeight: 500, background: 'transparent', color: 'var(--ink-900)' }}
          />
          {selectedId ? (
            <button onClick={limpiar} className="btn btn-ghost btn-sm" style={{ padding: 4 }} aria-label="Limpiar">
              <Icon name="x" size={13} />
            </button>
          ) : (
            <span className="text-xs muted">{skus.length} SKUs</span>
          )}
        </div>

        {open && !selectedId && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              background: 'white',
              border: '1px solid var(--ink-200)',
              borderRadius: 'var(--r-md)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 50,
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: '18px 16px', textAlign: 'center' }} className="text-sm muted">
                Sin resultados
              </div>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.sku_id}
                  onClick={() => seleccionar(s)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 14px',
                    border: 'none',
                    borderBottom: '1px solid var(--ink-100)',
                    background: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <div className="text-sm fw-700" style={{ color: 'var(--ink-900)' }}>
                      <span className="mono" style={{ color: 'var(--blue-500)' }}>{s.code}</span> {s.descripcion}
                    </div>
                    <div className="text-xs muted" style={{ marginTop: 2 }}>
                      {fmtKg(s.totalKg)} en {s.fuentes.length} factura{s.fuentes.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <Icon name="chevron-right" size={14} />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {!activeSku ? (
        <div className="card">
          <div className="empty">
            <Icon name="search" size={34} />
            <div className="empty-title">Busca un producto para comenzar</div>
            <p className="muted">
              Selecciona un SKU para ver sus facturas y calcular el costo promedio de tu stock.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div
            className="hstack"
            style={{
              gap: 14,
              padding: '12px 16px',
              background: 'color-mix(in srgb, var(--blue-500) 5%, white)',
              border: '1px solid color-mix(in srgb, var(--blue-500) 22%, white)',
              borderRadius: 'var(--r-md)',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--r-sm)',
                background: 'var(--blue-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="package" size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="fw-700" style={{ fontSize: 14 }}>
                <span className="mono" style={{ color: 'var(--blue-500)' }}>{activeSku.code}</span> {activeSku.descripcion}
              </div>
              <div className="text-xs muted" style={{ marginTop: 2 }}>
                {activeSku.fuentes.length} factura{activeSku.fuentes.length !== 1 ? 's' : ''} en historial
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="text-xs muted">Total en historial</div>
              <div className="mono fw-700" style={{ fontSize: 15 }}>{fmtKg(activeSku.totalKg)}</div>
            </div>
          </div>

          <div className="card">
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--ink-100)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span className="fw-700 text-sm">Últimas {last5.length} facturas — más reciente primero</span>
              <span className="text-xs muted">referencia informativa</span>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 34 }}>#</th>
                  <th>Factura</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Kg</th>
                  <th style={{ textAlign: 'right' }}>USD/kg</th>
                  <th style={{ textAlign: 'right' }}>TC</th>
                  <th style={{ textAlign: 'right' }}>MXN/kg</th>
                </tr>
              </thead>
              <tbody>
                {last5.map((f, i) => (
                  <tr key={f.factura_id} style={i === 0 ? { background: 'var(--ink-50)' } : undefined}>
                    <td>{i === 0 ? <span className="mono" style={{ display: 'inline-block', width: 20, height: 18, borderRadius: 999, background: 'var(--blue-500)', color: 'white', fontSize: 9, fontWeight: 800, lineHeight: '18px', textAlign: 'center' }} title="Más reciente">N</span> : <span className="muted text-sm">{i + 1}</span>}</td>
                    <td className="mono fw-600 text-sm">{f.factura_num}</td>
                    <td className="text-sm">{fmtFechaCorta(f.fecha_factura)}</td>
                    <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtKg(f.kg)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--blue-500)' }} className="mono fw-700">{fmtUSD4(f.precio_usd)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <TcCell f={f} tcEstimado={tcEstimado} />
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono fw-700">
                      <MxnKgCell precioUsd={f.precio_usd} tcReal={f.tc} tcEstimado={tcEstimado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calculadora */}
          <div className="card" style={{ padding: 18 }}>
            <div className="fw-700 text-sm">¿Cuántos kg tienes en bodega?</div>
            <p className="text-xs muted" style={{ margin: '4px 0 14px' }}>
              Calculamos el costo promedio ponderado tomando de la factura más nueva a la más vieja.
            </p>

            <div className="hstack" style={{ gap: 12, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 260 }}>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={stockInput}
                  onChange={(e) => setStockInput(e.target.value)}
                  placeholder="Ej: 12000"
                  className="field-input mono"
                  style={{ fontSize: 17, fontWeight: 700, padding: '10px 40px 10px 12px' }}
                />
                <span className="text-xs muted" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 600, pointerEvents: 'none' }}>
                  kg
                </span>
              </div>
              {resultado && resultado.faltante > 0.01 && (
                <div className="text-xs fw-600" style={{ color: 'var(--amber-500)' }}>
                  El historial solo cubre {fmtKg(resultado.totalKg)} — faltan {fmtKg(resultado.faltante)}
                </div>
              )}
            </div>

            {resultado && (
              <div style={{ marginTop: 16 }}>
                <div className="grid grid-4" style={{ gap: 12, marginBottom: 12 }}>
                  <ResultKpi label="Stock evaluado" value={fmtKg(resultado.totalKg)} sub="kg calculados" />
                  <ResultKpi label="Precio prom. USD" value={fmtUSD4(resultado.avgUSD)} sub="por kilogramo" accent />
                  <ResultKpi
                    label="TC promedio"
                    value={resultado.avgTC != null ? resultado.avgTC.toFixed(4) : '—'}
                    sub={resultado.avgTC == null ? 'sin pagos' : resultado.usaEstimado ? 'incluye TC estimado del día' : 'ponderado por volumen'}
                    amber={resultado.usaEstimado}
                  />
                  <ResultKpi
                    label={resultado.usaEstimado ? 'Costo prom. MXN (estimado)' : 'Costo prom. MXN'}
                    value={resultado.avgMXN != null ? fmtMXN(resultado.avgMXN) : '—'}
                    sub="por kilogramo"
                    accent={!resultado.usaEstimado}
                    amber={resultado.usaEstimado}
                  />
                </div>

                {resultado.usaEstimado && (
                  <div
                    className="text-xs"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--r-sm)',
                      background: 'color-mix(in srgb, var(--amber-500) 8%, white)',
                      border: '1px solid color-mix(in srgb, var(--amber-500) 28%, white)',
                      color: '#92400E',
                      marginBottom: 12,
                    }}
                  >
                    <strong>Costo MXN ESTIMADO:</strong> {fmtKg(resultado.kgEstimado)} de tu stock vienen de
                    facturas sin pagos todavía — se usó el <strong>TC del día</strong> para estimarlos.
                  </div>
                )}

                {resultado.avgMXN != null && (
                  <div
                    className="hstack"
                    style={{
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'var(--navy-900)',
                      borderRadius: 'var(--r-sm)',
                      marginBottom: 14,
                    }}
                  >
                    <span className="text-xs fw-600" style={{ color: 'rgba(255,255,255,0.65)' }}>
                      Valor total del inventario consultado
                    </span>
                    <span className="mono fw-700" style={{ fontSize: 20, color: 'white' }}>
                      {fmtMXN(resultado.totalKg * resultado.avgMXN)}
                    </span>
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--ink-100)', paddingTop: 12 }}>
                  <div className="text-xs fw-700" style={{ color: 'var(--ink-500)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Desglose — de dónde se tomaron los kg
                  </div>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Factura</th>
                        <th>Fecha</th>
                        <th style={{ textAlign: 'right' }}>Kg usados</th>
                        <th style={{ textAlign: 'right' }}>% del stock</th>
                        <th style={{ textAlign: 'right' }}>USD/kg</th>
                        <th style={{ textAlign: 'right' }}>MXN/kg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.breakdown.map((f, i) => {
                        const pct = (f.kgUsado / resultado.totalKg) * 100;
                        return (
                          <tr key={f.factura_id} style={i === 0 ? { background: 'var(--ink-50)' } : undefined}>
                            <td className="mono fw-600 text-sm">{f.factura_num}</td>
                            <td className="text-sm">{fmtFechaCorta(f.fecha_factura)}</td>
                            <td style={{ textAlign: 'right' }} className="mono fw-700">{fmtKg(f.kgUsado)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="hstack" style={{ gap: 7, justifyContent: 'flex-end' }}>
                                <div style={{ width: 48, height: 6, borderRadius: 999, background: 'var(--ink-100)', overflow: 'hidden' }}>
                                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--blue-500)' }} />
                                </div>
                                <span className="mono text-sm">{pct.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--blue-500)' }} className="mono fw-700">{fmtUSD4(f.precio_usd)}</td>
                            <td style={{ textAlign: 'right' }} className="mono fw-700">
                              <MxnKgCell precioUsd={f.precio_usd} tcReal={f.tc} tcEstimado={tcEstimado} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ResultKpi({ label, value, sub, accent, amber }: { label: string; value: string; sub: string; accent?: boolean; amber?: boolean }) {
  const bg = amber
    ? 'color-mix(in srgb, var(--amber-500) 8%, white)'
    : accent
      ? 'color-mix(in srgb, var(--blue-500) 5%, white)'
      : 'var(--ink-50)';
  const border = amber
    ? 'color-mix(in srgb, var(--amber-500) 30%, white)'
    : accent
      ? 'color-mix(in srgb, var(--blue-500) 22%, white)'
      : 'var(--ink-100)';
  const valueColor = amber ? 'var(--amber-500)' : accent ? 'var(--blue-500)' : 'var(--ink-900)';
  return (
    <div style={{ padding: '12px 14px', borderRadius: 'var(--r-sm)', background: bg, border: '1px solid ' + border }}>
      <div className="kpi-label">{label}</div>
      <div className="mono fw-700" style={{ fontSize: 16, color: valueColor, lineHeight: 1.1 }}>{value}</div>
      <div className="text-xs muted" style={{ marginTop: 3 }}>{sub}</div>
    </div>
  );
}

/* ─── Tab — Por factura ───────────────────────────────────────────── */

function FacturasView({ facturas, tcEstimado }: { facturas: FacturaCosto[]; tcEstimado: number | null }) {
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return facturas;
    return facturas.filter((c) => c.factura_num.toLowerCase().includes(q));
  }, [facturas, query]);

  return (
    <div className="vstack" style={{ gap: 12 }}>
      <div
        className="hstack"
        style={{
          gap: 8,
          padding: '9px 12px',
          background: 'white',
          border: '1px solid var(--ink-200)',
          borderRadius: 'var(--r-md)',
          boxShadow: 'var(--shadow-sm)',
          maxWidth: 560,
        }}
      >
        <Icon name="search" size={14} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar factura…"
          style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, fontWeight: 500, background: 'transparent', color: 'var(--ink-900)' }}
        />
        <span className="text-xs muted">{filtered.length} de {facturas.length}</span>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ minWidth: 820 }}>
          <thead>
            <tr>
              <th>Factura</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Kg</th>
              <th style={{ textAlign: 'right' }}>Total USD</th>
              <th style={{ textAlign: 'right' }}>TC</th>
              <th style={{ textAlign: 'right' }}>MXN/kg</th>
              <th style={{ textAlign: 'right' }}>Total MXN</th>
              <th style={{ width: 28 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const tcUsado = c.tc ?? (tcEstimado != null && tcEstimado > 0 ? tcEstimado : null);
              const esEstimado = c.tc == null && tcUsado != null;
              const totalMxn = tcUsado != null ? c.total_usd * tcUsado : null;
              const avgUsdKg = c.total_kg > 0 ? c.total_usd / c.total_kg : 0;
              const open = expandedId === c.factura_id;
              return (
                <Fragment key={c.factura_id}>
                  <tr
                    onClick={() => setExpandedId(open ? null : c.factura_id)}
                    style={{ cursor: 'pointer', background: open ? 'var(--ink-50)' : undefined }}
                    title="Clic para ver el detalle por producto"
                  >
                    <td className="mono fw-600 text-sm">{c.factura_num}</td>
                    <td>
                      {c.liquidada ? (
                        <span className="badge badge-green">Liquidada</span>
                      ) : (
                        <span className="badge badge-amber">{c.status}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtKg(c.total_kg)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--blue-500)' }} className="mono fw-700">{fmtUSD(c.total_usd)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <TcCell f={{ tc: c.tc, tc_origen: c.tc_origen }} tcEstimado={tcEstimado} />
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono fw-700">
                      <MxnKgCell precioUsd={avgUsdKg} tcReal={c.tc} tcEstimado={tcEstimado} />
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono fw-700">
                      {totalMxn != null ? (
                        esEstimado ? (
                          <span style={{ color: 'var(--amber-500)' }} title="Estimado con el TC del día (no oficial)">
                            {fmtMXN(totalMxn)}<span className="text-xs"> est.</span>
                          </span>
                        ) : (
                          fmtMXN(totalMxn)
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--ink-400)' }}>
                      <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={8} style={{ background: 'var(--ink-50)', padding: 0 }}>
                        <div style={{ padding: '10px 16px' }}>
                          <div className="text-xs fw-700" style={{ color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                            Detalle — {c.lineas.length} producto{c.lineas.length !== 1 ? 's' : ''}
                            {esEstimado && <span style={{ color: 'var(--amber-500)' }}> · precios MXN ESTIMADOS (TC del día)</span>}
                          </div>
                          <table className="tbl" style={{ background: 'white' }}>
                            <thead>
                              <tr>
                                <th>Producto</th>
                                <th style={{ textAlign: 'right' }}>Kg</th>
                                <th style={{ textAlign: 'right' }}>USD/kg</th>
                                <th style={{ textAlign: 'right' }}>MXN/kg</th>
                                <th style={{ textAlign: 'right' }}>Total MXN</th>
                              </tr>
                            </thead>
                            <tbody>
                              {c.lineas.map((l, i) => (
                                <tr key={i}>
                                  <td className="text-sm fw-600">{l.descripcion}</td>
                                  <td style={{ textAlign: 'right' }} className="mono">{fmtKg(l.kg)}</td>
                                  <td style={{ textAlign: 'right', color: 'var(--blue-500)' }} className="mono fw-700">{fmtUSD4(l.precio_usd)}</td>
                                  <td style={{ textAlign: 'right' }} className="mono fw-700">
                                    <MxnKgCell precioUsd={l.precio_usd} tcReal={c.tc} tcEstimado={tcEstimado} />
                                  </td>
                                  <td style={{ textAlign: 'right' }} className="mono fw-700">
                                    {tcUsado != null ? (
                                      esEstimado ? (
                                        <span style={{ color: 'var(--amber-500)' }}>
                                          {fmtMXN(l.total_usd * tcUsado)}<span className="text-xs"> est.</span>
                                        </span>
                                      ) : (
                                        fmtMXN(l.total_usd * tcUsado)
                                      )
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {!c.liquidada && (
                            <div className="text-xs muted" style={{ marginTop: 8 }}>
                              {esEstimado
                                ? 'Esta factura aún no está liquidada: el costo en pesos es ESTIMADO con el TC del día. Quedará oficial al registrar los pagos.'
                                : 'TC tomado de pagos. El costo será oficial al liquidar el saldo.'}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Tab — Histórico de Precios ──────────────────────────────────── */

function PreciosView({ skus }: { skus: SkuCosto[] }) {
  const filas = useMemo(() => {
    return skus
      .map((s) => {
        const puntos = [...s.fuentes]
          .filter((f) => f.precio_usd > 0)
          .sort((a, b) => (a.fecha_factura ?? '').localeCompare(b.fecha_factura ?? ''));
        return { sku: s, puntos };
      })
      .filter((r) => r.puntos.length > 0);
  }, [skus]);

  if (filas.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="file-text" size={34} />
          <div className="empty-title">Sin precios para graficar</div>
          <p className="muted">Captura facturas con precios para ver la evolución del precio FOB.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="text-xs"
        style={{
          padding: '10px 14px',
          borderRadius: 'var(--r-md)',
          background: 'color-mix(in srgb, var(--amber-500) 8%, white)',
          border: '1px solid color-mix(in srgb, var(--amber-500) 26%, white)',
          color: '#92400E',
          marginBottom: 12,
        }}
      >
        <span className="fw-700">Tendencia de precio FOB (USD/kg)</span> — evolución del precio por factura.
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Producto</th>
              <th style={{ textAlign: 'right' }}>Primer precio</th>
              <th style={{ textAlign: 'right' }}>Último precio</th>
              <th>Trayectoria</th>
              <th style={{ textAlign: 'right' }}>Cambio</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ sku, puntos }) => {
              const primero = puntos[0].precio_usd;
              const ultimo = puntos[puntos.length - 1].precio_usd;
              const cambio = primero > 0 ? ((ultimo - primero) / primero) * 100 : 0;
              return (
                <tr key={sku.sku_id}>
                  <td className="mono fw-600 text-sm" style={{ color: 'var(--blue-500)' }}>{sku.code}</td>
                  <td className="text-sm fw-600">{sku.descripcion}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{fmtUSD4(primero)}</td>
                  <td style={{ textAlign: 'right' }} className="mono fw-700">{fmtUSD4(ultimo)}</td>
                  <td>
                    <div className="hstack" style={{ gap: 3, flexWrap: 'wrap' }}>
                      {puntos.map((p, i) => {
                        const prev = i > 0 ? puntos[i - 1].precio_usd : null;
                        const up = prev != null && p.precio_usd > prev;
                        const down = prev != null && p.precio_usd < prev;
                        return (
                          <span
                            key={i}
                            className="mono text-xs"
                            title={`${fmtFechaCorta(p.fecha_factura)} · ${fmtUSD4(p.precio_usd)} · ${p.factura_num}`}
                            style={{
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: 'var(--ink-50)',
                              color: up ? 'var(--red-500)' : down ? 'var(--green-500)' : 'var(--ink-600)',
                              fontWeight: 600,
                            }}
                          >
                            {up ? '▲' : down ? '▼' : ''}
                            {p.precio_usd.toFixed(3)}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {puntos.length > 1 ? (
                      <span
                        className="badge"
                        style={{
                          background:
                            cambio > 3
                              ? 'color-mix(in srgb, var(--red-500) 14%, white)'
                              : cambio > 0
                                ? 'color-mix(in srgb, var(--amber-500) 16%, white)'
                                : 'color-mix(in srgb, var(--green-500) 14%, white)',
                          color: cambio > 3 ? '#991B1B' : cambio > 0 ? '#92400E' : '#065F46',
                        }}
                      >
                        {cambio >= 0 ? '+' : ''}
                        {cambio.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-xs muted">1 compra</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
