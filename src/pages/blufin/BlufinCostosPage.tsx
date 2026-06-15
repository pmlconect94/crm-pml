import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { PageEnter, SPRING } from '@/components/motion';
import { useAuth } from '@/lib/auth';
import { fmtMXN, fmtKg, fmtFechaCorta } from '@/lib/format';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';
import {
  fetchCostosData,
  calcularPromedio,
  type SkuCosto,
  type FuenteCosto,
} from '@/features/blufin/costos-queries';

const fmtUSD4 = (n: number | null | undefined) =>
  n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const toNum = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

type View = 'inventario' | 'precios';

export function BlufinCostosPage() {
  const { empresaId } = useAuth();
  const [view, setView] = useState<View>('inventario');

  const { data: skus = [], isLoading } = useQuery({
    queryKey: ['blufin_costos', empresaId],
    queryFn: () => fetchCostosData(empresaId),
  });

  return (
    <>
      <PageEnter style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
          Central de costos
        </h2>
        <p className="page-subtitle">
          Costo promedio ponderado por SKU y evolución del precio FOB del proveedor
        </p>
      </PageEnter>

      <div className="tabs" style={{ marginBottom: 12 }}>
        {(
          [
            { id: 'inventario', label: 'Inventario & Costo Promedio', icon: 'trend-up' },
            { id: 'precios', label: 'Histórico de Precios', icon: 'file-text' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            className={`tab ${view === t.id ? 'active' : ''}`}
            onClick={() => setView(t.id)}
          >
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
      ) : skus.length === 0 ? (
        <div className="card">
          <div className="empty">
            <Icon name="trend-up" size={36} />
            <div className="empty-title">Sin datos de costos todavía</div>
            <p className="muted">
              Cuando haya contratos con productos capturados, aquí podrás calcular el costo promedio
              ponderado de tu stock.
            </p>
          </div>
        </div>
      ) : view === 'inventario' ? (
        <InventarioView skus={skus} />
      ) : (
        <PreciosView skus={skus} />
      )}
    </>
  );
}

/* ─── Tab 1 — Inventario & Costo Promedio ─────────────────────────── */

function InventarioView({ skus }: { skus: SkuCosto[] }) {
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

  const productos = useMemo(
    () => Array.from(new Set(skus.map((s) => s.producto ?? '—'))).sort(),
    [skus],
  );

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
  const last5 = activeSku ? activeSku.fuentes.slice(0, 5) : [];
  const stockKg = toNum(stockInput);
  const resultado = activeSku && stockKg > 0 ? calcularPromedio(activeSku.fuentes, stockKg) : null;

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
      {/* Filtro por producto */}
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
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Buscador */}
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
            style={{
              border: 'none',
              outline: 'none',
              flex: 1,
              fontSize: 13,
              fontWeight: 500,
              background: 'transparent',
              color: 'var(--ink-900)',
            }}
          />
          {selectedId ? (
            <button
              onClick={limpiar}
              className="btn btn-ghost btn-sm"
              style={{ padding: 4 }}
              aria-label="Limpiar"
            >
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
                  className="costos-sku-option"
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
                      <span className="mono" style={{ color: 'var(--blue-500)' }}>
                        {s.code}
                      </span>{' '}
                      {s.descripcion}
                    </div>
                    <div className="text-xs muted" style={{ marginTop: 2 }}>
                      {fmtKg(s.totalKg)} en {s.fuentes.length} contenedor
                      {s.fuentes.length !== 1 ? 'es' : ''}
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
              Selecciona un SKU para ver sus contenedores y calcular el costo promedio de tu stock.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Cabecera del producto */}
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
                <span className="mono" style={{ color: 'var(--blue-500)' }}>
                  {activeSku.code}
                </span>{' '}
                {activeSku.descripcion}
              </div>
              <div className="text-xs muted" style={{ marginTop: 2 }}>
                {activeSku.fuentes.length} contenedor{activeSku.fuentes.length !== 1 ? 'es' : ''} en
                historial
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="text-xs muted">Total en historial</div>
              <div className="mono fw-700" style={{ fontSize: 15 }}>
                {fmtKg(activeSku.totalKg)}
              </div>
            </div>
          </div>

          {/* Últimos contenedores */}
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
              <span className="fw-700 text-sm">
                Últimos {Math.min(5, last5.length)} contenedores — más reciente primero
              </span>
              <span className="text-xs muted">referencia informativa</span>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 34 }}>#</th>
                  <th>Folio</th>
                  <th>Contenedor</th>
                  <th>ETA bodega</th>
                  <th style={{ textAlign: 'right' }}>Kg</th>
                  <th style={{ textAlign: 'right' }}>USD/kg</th>
                  <th style={{ textAlign: 'right' }}>TC</th>
                  <th style={{ textAlign: 'right' }}>MXN/kg</th>
                </tr>
              </thead>
              <tbody>
                {last5.map((f, i) => (
                  <tr key={f.contrato_id} style={i === 0 ? { background: 'var(--ink-50)' } : undefined}>
                    <td>
                      {i === 0 ? (
                        <span
                          className="mono"
                          style={{
                            display: 'inline-block',
                            width: 20,
                            height: 18,
                            borderRadius: 999,
                            background: 'var(--blue-500)',
                            color: 'white',
                            fontSize: 9,
                            fontWeight: 800,
                            lineHeight: '18px',
                            textAlign: 'center',
                          }}
                          title="Más reciente"
                        >
                          N
                        </span>
                      ) : (
                        <span className="muted text-sm">{i + 1}</span>
                      )}
                    </td>
                    <td className="mono fw-600 text-sm">{f.folio}</td>
                    <td className="mono text-xs">{f.contenedor ?? '—'}</td>
                    <td className="text-sm">{fmtFechaCorta(f.eta_bodega)}</td>
                    <td style={{ textAlign: 'right' }} className="mono fw-600">
                      {fmtKg(f.kg)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--blue-500)' }} className="mono fw-700">
                      {fmtUSD4(f.precio_usd)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <TcCell f={f} />
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono fw-700">
                      {f.tc != null ? fmtMXN(f.precio_usd * f.tc) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calculadora de stock */}
          <div className="card" style={{ padding: 18 }}>
            <div className="fw-700 text-sm">¿Cuántos kg tienes en bodega?</div>
            <p className="text-xs muted" style={{ margin: '4px 0 14px' }}>
              Calculamos el costo promedio ponderado tomando del contenedor más nuevo al más viejo.
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
                <span
                  className="text-xs muted"
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 600,
                    pointerEvents: 'none',
                  }}
                >
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
                  <ResultKpi
                    label="Precio prom. USD"
                    value={fmtUSD4(resultado.avgUSD)}
                    sub="por kilogramo"
                    accent
                  />
                  <ResultKpi
                    label="TC promedio"
                    value={resultado.avgTC != null ? resultado.avgTC.toFixed(4) : '—'}
                    sub={resultado.avgTC != null ? 'ponderado por volumen' : 'sin pagos ni forward'}
                  />
                  <ResultKpi
                    label="Costo prom. MXN"
                    value={resultado.avgMXN != null ? fmtMXN(resultado.avgMXN) : '—'}
                    sub="por kilogramo"
                    accent
                  />
                </div>

                {resultado.sinTC > 0 && (
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
                    {fmtKg(resultado.sinTC)} de tu stock vienen de contenedores sin TC (sin pagos ni
                    forward ni TC del día). El costo MXN se calcula solo con los kg que sí tienen TC.
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

                {/* Desglose */}
                <div style={{ borderTop: '1px solid var(--ink-100)', paddingTop: 12 }}>
                  <div
                    className="text-xs fw-700"
                    style={{
                      color: 'var(--ink-500)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    Desglose — de dónde se tomaron los kg
                  </div>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Folio</th>
                        <th>Contenedor</th>
                        <th>ETA bodega</th>
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
                          <tr key={f.contrato_id} style={i === 0 ? { background: 'var(--ink-50)' } : undefined}>
                            <td className="mono fw-600 text-sm">{f.folio}</td>
                            <td className="mono text-xs">{f.contenedor ?? '—'}</td>
                            <td className="text-sm">{fmtFechaCorta(f.eta_bodega)}</td>
                            <td style={{ textAlign: 'right' }} className="mono fw-700">
                              {fmtKg(f.kgUsado)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div
                                className="hstack"
                                style={{ gap: 7, justifyContent: 'flex-end' }}
                              >
                                <div
                                  style={{
                                    width: 48,
                                    height: 6,
                                    borderRadius: 999,
                                    background: 'var(--ink-100)',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      background: 'var(--blue-500)',
                                    }}
                                  />
                                </div>
                                <span className="mono text-sm">{pct.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--blue-500)' }} className="mono fw-700">
                              {fmtUSD4(f.precio_usd)}
                            </td>
                            <td style={{ textAlign: 'right' }} className="mono fw-700">
                              {f.tc != null ? fmtMXN(f.precio_usd * f.tc) : '—'}
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

const TC_ORIGEN_LABEL: Record<string, string> = {
  pagos: 'Promedio ponderado de pagos reales',
  forward: 'TC del forward cambiario',
  ponderado: 'TC ponderado del contrato',
  ninguno: 'Sin TC disponible (falta pago, forward o TC del día)',
};

function TcCell({ f }: { f: FuenteCosto }) {
  if (f.tc == null) {
    return (
      <span className="text-xs muted" title={TC_ORIGEN_LABEL.ninguno}>
        —
      </span>
    );
  }
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

function ResultKpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--r-sm)',
        background: accent ? 'color-mix(in srgb, var(--blue-500) 5%, white)' : 'var(--ink-50)',
        border: '1px solid ' + (accent ? 'color-mix(in srgb, var(--blue-500) 22%, white)' : 'var(--ink-100)'),
      }}
    >
      <div className="kpi-label">{label}</div>
      <div
        className="mono fw-700"
        style={{ fontSize: 16, color: accent ? 'var(--blue-500)' : 'var(--ink-900)', lineHeight: 1.1 }}
      >
        {value}
      </div>
      <div className="text-xs muted" style={{ marginTop: 3 }}>
        {sub}
      </div>
    </div>
  );
}

/* ─── Tab 2 — Histórico de Precios ────────────────────────────────── */

function PreciosView({ skus }: { skus: SkuCosto[] }) {
  const [detalle, setDetalle] = useState<SkuCosto | null>(null);

  // Por SKU: precios a lo largo del tiempo (fuentes ordenadas por fecha ASC).
  const filas = useMemo(() => {
    return skus
      .map((s) => {
        const puntos = [...s.fuentes]
          .filter((f) => f.precio_usd > 0)
          .sort((a, b) => (a.fecha_contrato ?? '').localeCompare(b.fecha_contrato ?? ''));
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
          <p className="muted">Captura contratos con precios para ver la evolución del precio FOB.</p>
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
        <span className="fw-700">Tendencia de precio FOB (USD/kg)</span> — evolución del precio por
        compra. Haz clic en una fila para ver las gráficas en USD y MXN y el detalle de compras.
      </div>

      <SkuPrecioDetalle sku={detalle} onClose={() => setDetalle(null)} />

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
              <th style={{ width: 32 }}></th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ sku, puntos }) => {
              const primero = puntos[0].precio_usd;
              const ultimo = puntos[puntos.length - 1].precio_usd;
              const cambio = primero > 0 ? ((ultimo - primero) / primero) * 100 : 0;
              return (
                <tr
                  key={sku.sku_id}
                  onClick={() => setDetalle(sku)}
                  className="costos-precio-row"
                  style={{ cursor: 'pointer' }}
                >
                  <td className="mono fw-600 text-sm" style={{ color: 'var(--blue-500)' }}>
                    {sku.code}
                  </td>
                  <td className="text-sm fw-600">{sku.descripcion}</td>
                  <td style={{ textAlign: 'right' }} className="mono">
                    {fmtUSD4(primero)}
                  </td>
                  <td style={{ textAlign: 'right' }} className="mono fw-700">
                    {fmtUSD4(ultimo)}
                  </td>
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
                            title={`${fmtFechaCorta(p.fecha_contrato)} · ${fmtUSD4(p.precio_usd)} · ${p.folio}`}
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
                  <td style={{ textAlign: 'right', color: 'var(--ink-400)' }}>
                    <Icon name="chevron-right" size={14} />
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

/* ─── Mini gráfica de líneas (SVG, sin dependencias) ──────────────── */

function MiniLineChart({
  data,
  color,
  fmtY,
}: {
  data: { label: string; y: number }[];
  color: string;
  fmtY: (n: number) => string;
}) {
  if (data.length === 0) {
    return (
      <div className="text-xs muted" style={{ padding: 20, textAlign: 'center' }}>
        Sin datos
      </div>
    );
  }
  const W = 360;
  const H = 140;
  const padL = 6;
  const padR = 6;
  const padT = 16;
  const padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const ys = data.map((d) => d.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || Math.abs(max) || 1;
  const xFor = (i: number) =>
    data.length <= 1 ? padL + innerW / 2 : padL + (i / (data.length - 1)) * innerW;
  const yFor = (v: number) => padT + innerH - ((v - min) / span) * innerH;
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(d.y).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* línea base */}
      <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="var(--ink-200)" strokeWidth={1} />
      {/* etiquetas max/min */}
      <text x={padL} y={padT - 4} fontSize={9} fill="var(--ink-400)" fontFamily="var(--font-mono)">
        {fmtY(max)}
      </text>
      <text x={padL} y={padT + innerH + 13} fontSize={9} fill="var(--ink-400)" fontFamily="var(--font-mono)">
        {fmtY(min)}
      </text>
      {data.length > 1 && (
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xFor(i)} cy={yFor(d.y)} r={3.5} fill={color} />
          {(i === 0 || i === data.length - 1) && (
            <text
              x={xFor(i)}
              y={H - 8}
              fontSize={9}
              fill="var(--ink-500)"
              textAnchor={i === 0 ? 'start' : 'end'}
              fontFamily="var(--font-mono)"
            >
              {d.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ─── Tarjeta de detalle de precios por SKU ───────────────────────── */

function SkuPrecioDetalle({ sku, onClose }: { sku: SkuCosto | null; onClose: () => void }) {
  const backdrop = useBackdropDismiss(onClose);
  // Compras ordenadas por fecha de entrega (más reciente primero) para la tabla,
  // y ASC para las gráficas.
  const ordenadasDesc = sku
    ? [...sku.fuentes].sort((a, b) => (b.eta_bodega ?? '').localeCompare(a.eta_bodega ?? ''))
    : [];
  const ultimas6 = ordenadasDesc.slice(0, 6);
  const asc = [...ordenadasDesc].reverse();
  const puntosUSD = asc.filter((f) => f.precio_usd > 0).map((f) => ({
    label: fmtFechaCorta(f.eta_bodega ?? f.fecha_contrato),
    y: f.precio_usd,
  }));
  const puntosMXN = asc
    .filter((f) => f.precio_usd > 0 && f.tc != null)
    .map((f) => ({ label: fmtFechaCorta(f.eta_bodega ?? f.fecha_contrato), y: f.precio_usd * (f.tc as number) }));

  return (
    <AnimatePresence>
      {sku && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          {...backdrop}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 37, 64, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 100,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={SPRING.snappy}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-xl)',
              maxWidth: 820,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid var(--ink-100)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  <span className="mono" style={{ color: 'var(--blue-500)' }}>
                    {sku.code}
                  </span>{' '}
                  {sku.descripcion}
                </h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  {sku.fuentes.length} compra{sku.fuentes.length !== 1 ? 's' : ''} en historial ·
                  evolución del precio por fecha de entrega
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                <Icon name="x" size={14} />
              </button>
            </div>

            <div style={{ padding: 22 }}>
              {/* Gráficas */}
              <div className="grid grid-2" style={{ gap: 12, marginBottom: 16 }}>
                <div className="card" style={{ padding: 14 }}>
                  <div className="text-xs fw-700" style={{ marginBottom: 6, color: 'var(--blue-500)' }}>
                    Precio FOB — USD/kg
                  </div>
                  <MiniLineChart data={puntosUSD} color="var(--blue-500)" fmtY={(n) => fmtUSD4(n)} />
                </div>
                <div className="card" style={{ padding: 14 }}>
                  <div className="text-xs fw-700" style={{ marginBottom: 6, color: 'var(--ink-900)' }}>
                    Costo — MXN/kg
                  </div>
                  {puntosMXN.length > 0 ? (
                    <MiniLineChart data={puntosMXN} color="var(--navy-900)" fmtY={(n) => fmtMXN(n)} />
                  ) : (
                    <div className="text-xs muted" style={{ padding: 20, textAlign: 'center' }}>
                      Sin TC en las compras — captura pagos o forwards para ver el costo en MXN.
                    </div>
                  )}
                </div>
              </div>

              {/* Últimas compras */}
              <div className="text-xs fw-700" style={{ marginBottom: 8, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Últimas {ultimas6.length} compra{ultimas6.length !== 1 ? 's' : ''}
              </div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Entrega</th>
                    <th style={{ textAlign: 'right' }}>Kg</th>
                    <th style={{ textAlign: 'right' }}>USD/kg</th>
                    <th style={{ textAlign: 'right' }}>TC</th>
                    <th style={{ textAlign: 'right' }}>MXN/kg</th>
                    <th>Nota de crédito</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimas6.map((f) => (
                    <tr key={f.contrato_id}>
                      <td className="mono fw-600 text-sm">{f.folio}</td>
                      <td className="text-sm">{fmtFechaCorta(f.eta_bodega ?? f.fecha_contrato)}</td>
                      <td style={{ textAlign: 'right' }} className="mono fw-600">
                        {fmtKg(f.kg)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--blue-500)' }} className="mono fw-700">
                        {fmtUSD4(f.precio_usd)}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">
                        {f.tc != null ? f.tc.toFixed(4) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono fw-700">
                        {f.tc != null ? fmtMXN(f.precio_usd * f.tc) : '—'}
                      </td>
                      <td className="text-xs muted">— (módulo NC pendiente)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
