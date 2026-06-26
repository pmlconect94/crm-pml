import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { useAuth } from '@/lib/auth';
import { getTcDelDiaInfo } from '@/lib/tc';
import { fmtMXN, fmtUSD, fmtKg, fmtFechaCorta } from '@/lib/format';
import {
  fetchCostosDataSA,
  calcularPromedioSA,
  type SkuCostoSA,
  type ContenedorCostoSA,
} from '@/features/camanchaca/sa-costos-queries';

const fmtUSD4 = (n: number | null | undefined) =>
  n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const toNum = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

type View = 'inventario' | 'contenedores';

export function CamSACostosPage() {
  const { empresaId } = useAuth();
  const [view, setView] = useState<View>('inventario');
  const [tcInput, setTcInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['cam_sa_costos', empresaId],
    queryFn: () => fetchCostosDataSA(empresaId),
  });
  const skus = data?.skus ?? [];
  const contenedores = data?.contenedores ?? [];
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
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Central de costos</h2>
        <p className="page-subtitle">
          Costo promedio ponderado por SKU y costo total internado (FOB + importación) por contenedor
        </p>
      </PageEnter>

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
        <span className="text-xs fw-700" style={{ color: '#92400E', whiteSpace: 'nowrap' }}>TC del día (estimado)</span>
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
          Se usa en los contenedores SIN TC oficial — esos costos salen en <strong>ámbar</strong> como ESTIMADOS.
          {tcInfo != null && (
            <>
              {' '}Tomado de la tasa de mercado del <span className="fw-700">{fmtFechaCorta(tcInfo.fecha)}</span>.
            </>
          )}
        </span>
      </div>

      <div className="tabs" style={{ marginBottom: 12 }}>
        {(
          [
            { id: 'inventario', label: 'Inventario & Costo Promedio', icon: 'trend-up' },
            { id: 'contenedores', label: 'Por contenedor', icon: 'package' },
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
      ) : contenedores.length === 0 ? (
        <div className="card">
          <div className="empty">
            <Icon name="trend-up" size={36} />
            <div className="empty-title">Sin datos de costos todavía</div>
            <p className="muted">
              Cuando haya contenedores con productos capturados, aquí podrás calcular el costo promedio
              ponderado de tu stock y el costo total internado por contenedor.
            </p>
          </div>
        </div>
      ) : view === 'inventario' ? (
        <InventarioView skus={skus} tcEstimado={tcEstimado} />
      ) : (
        <ContenedoresView contenedores={contenedores} tcEstimado={tcEstimado} />
      )}
    </>
  );
}

/* ─── Inventario & Costo Promedio ─────────────────────────────────── */

function InventarioView({ skus, tcEstimado }: { skus: SkuCostoSA[]; tcEstimado: number | null }) {
  const [query, setQuery] = useState('');
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skus;
    return skus.filter(
      (s) =>
        s.descripcion.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.producto ?? '').toLowerCase().includes(q),
    );
  }, [skus, query]);

  const activeSku = selectedId ? skus.find((s) => s.sku_id === selectedId) ?? null : null;
  const llegados = activeSku ? activeSku.fuentes.filter((f) => f.llego) : [];
  const futuros = activeSku ? activeSku.fuentes.filter((f) => !f.llego) : [];
  const last5 = llegados.slice(0, 5);
  const stockKg = toNum(stockInput);
  const resultado = activeSku && stockKg > 0 ? calcularPromedioSA(llegados, stockKg, tcEstimado) : null;

  const seleccionar = (s: SkuCostoSA) => {
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
      <div className="card" style={{ padding: 14 }}>
        <label className="field-label">Producto</label>
        <div ref={boxRef} style={{ position: 'relative', maxWidth: 480 }}>
          <div
            className="hstack"
            style={{ gap: 8, padding: '6px 10px', background: 'var(--ink-50)', borderRadius: 'var(--r-sm)', border: '1px solid var(--ink-200)' }}
          >
            <Icon name="search" size={14} />
            <input
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                setSelectedId(null);
              }}
              placeholder="Busca el SKU por código o descripción…"
              style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13 }}
            />
            {selectedId && (
              <button onClick={limpiar} className="btn btn-ghost btn-sm" style={{ padding: 4 }} aria-label="Limpiar">
                <Icon name="x" size={13} />
              </button>
            )}
          </div>
          {open && filtered.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                background: 'white',
                border: '1px solid var(--ink-200)',
                borderRadius: 'var(--r-md)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 30,
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              {filtered.slice(0, 40).map((s) => (
                <button
                  key={s.sku_id}
                  onClick={() => seleccionar(s)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-50)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    border: 'none',
                    background: 'white',
                    cursor: 'pointer',
                  }}
                >
                  <div className="text-sm fw-600">{s.descripcion}</div>
                  <div className="text-xs muted mono">
                    {s.code} · {fmtKg(s.totalKg)} en historial
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {activeSku && (
          <div style={{ marginTop: 12, maxWidth: 280 }}>
            <label className="field-label">Kg en bodega (stock)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              className="field-input mono"
              value={stockInput}
              onChange={(e) => setStockInput(e.target.value)}
              placeholder="0.000"
            />
          </div>
        )}
      </div>

      {!activeSku ? (
        <div className="card">
          <div className="empty">
            <Icon name="search" size={34} />
            <div className="empty-title">Elige un producto</div>
            <p className="muted">Busca un SKU para ver sus últimos contenedores recibidos y calcular el costo promedio.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ink-100)' }}>
              <span className="fw-700" style={{ fontSize: 13 }}>Últimos contenedores recibidos</span>
              <span className="text-xs muted" style={{ marginLeft: 8 }}>(del más nuevo al más viejo)</span>
            </div>
            {last5.length === 0 ? (
              <div className="empty">
                <Icon name="package" size={32} />
                <div className="empty-title">Sin contenedores recibidos</div>
                <p className="muted">Este SKU aún no tiene contenedores que hayan llegado a bodega.</p>
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Contenedor</th>
                    <th>Llegó</th>
                    <th style={{ textAlign: 'right' }}>Kg</th>
                    <th style={{ textAlign: 'right' }}>USD/kg</th>
                    <th style={{ textAlign: 'right' }}>TC</th>
                    <th style={{ textAlign: 'right' }}>MXN/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {last5.map((f) => {
                    const tcUsado = f.tc ?? tcEstimado;
                    const estimado = f.tc == null && tcEstimado != null;
                    return (
                      <tr key={f.contenedor_id}>
                        <td>
                          <div className="mono fw-600 text-sm">{f.folio}</div>
                          <div className="text-xs muted">{f.contenedor ?? '—'}</div>
                        </td>
                        <td className="text-sm">{fmtFechaCorta(f.llegada_real ?? f.eta_bodega)}</td>
                        <td style={{ textAlign: 'right' }} className="mono">{fmtKg(f.kg)}</td>
                        <td style={{ textAlign: 'right' }} className="mono">{fmtUSD4(f.precio_usd)}</td>
                        <td style={{ textAlign: 'right' }} className="mono" title={f.tc != null ? `TC ${f.tc_origen}` : 'TC del día (estimado)'}>
                          {tcUsado != null ? (
                            <span style={{ color: estimado ? '#92400E' : 'var(--ink-900)' }}>
                              {tcUsado.toFixed(4)}{estimado && <span className="text-xs"> est.</span>}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ textAlign: 'right', color: estimado ? '#92400E' : 'var(--ink-900)' }} className="mono">
                          {tcUsado != null ? fmtMXN(f.precio_usd * tcUsado) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {stockKg > 0 && resultado && (
            <div className="card" style={{ padding: 16 }}>
              <div className="fw-700" style={{ fontSize: 13, marginBottom: 10 }}>
                Costo promedio ponderado para {fmtKg(stockKg)}
              </div>
              <div className="grid grid-4" style={{ gap: 10 }}>
                {[
                  { label: 'Costo USD/kg', value: fmtUSD4(resultado.avgUSD), color: 'var(--ink-900)' },
                  { label: 'TC promedio', value: resultado.avgTC != null ? resultado.avgTC.toFixed(4) : '—', color: 'var(--ink-900)' },
                  { label: 'Costo MXN/kg', value: resultado.avgMXN != null ? fmtMXN(resultado.avgMXN) : '—', color: resultado.usaEstimado ? '#92400E' : 'var(--blue-500)' },
                  { label: 'Valor total', value: resultado.avgMXN != null ? fmtMXN(resultado.avgMXN * resultado.totalKg) : '—', color: 'var(--blue-500)' },
                ].map((k) => (
                  <div key={k.label} style={{ padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'var(--ink-50)', border: '1px solid var(--ink-100)' }}>
                    <div className="kpi-label">{k.label}</div>
                    <div className="mono fw-700" style={{ fontSize: 15, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>
              {resultado.faltante > 0.001 && (
                <div className="text-xs" style={{ color: 'var(--amber-500)', marginTop: 10, fontWeight: 600 }}>
                  El stock ({fmtKg(stockKg)}) excede el historial recibido — faltan {fmtKg(resultado.faltante)} sin cubrir.
                </div>
              )}
              {resultado.sinTC > 0 && (
                <div className="text-xs muted" style={{ marginTop: 6 }}>
                  {fmtKg(resultado.sinTC)} sin TC (ni estimado) — no entran al costo MXN.
                </div>
              )}
              {resultado.usaEstimado && (
                <div className="text-xs" style={{ color: '#92400E', marginTop: 6 }}>
                  {fmtKg(resultado.kgEstimado)} usan el TC del día estimado — costo MXN aproximado.
                </div>
              )}
            </div>
          )}

          {futuros.length > 0 && (
            <div className="card">
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ink-100)' }}>
                <span className="fw-700" style={{ fontSize: 13 }}>Futuras cargas</span>
                <span className="text-xs muted" style={{ marginLeft: 8 }}>(no han llegado — no cuentan para el costo)</span>
              </div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Contenedor</th>
                    <th>ETA bodega</th>
                    <th style={{ textAlign: 'right' }}>Kg</th>
                    <th style={{ textAlign: 'right' }}>USD/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {futuros.map((f) => (
                    <tr key={f.contenedor_id}>
                      <td className="mono fw-600 text-sm">{f.folio}</td>
                      <td className="text-sm">{fmtFechaCorta(f.eta_bodega)}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{fmtKg(f.kg)}</td>
                      <td style={{ textAlign: 'right' }} className="mono">{fmtUSD4(f.precio_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Por contenedor (costo total internado) ──────────────────────── */

function ContenedoresView({ contenedores, tcEstimado }: { contenedores: ContenedorCostoSA[]; tcEstimado: number | null }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtrados = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return contenedores;
    return contenedores.filter(
      (c) =>
        c.folio.toLowerCase().includes(s) ||
        (c.contenedor ?? '').toLowerCase().includes(s) ||
        (c.naviera ?? '').toLowerCase().includes(s),
    );
  }, [contenedores, search]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="vstack" style={{ gap: 10 }}>
      <div
        className="hstack"
        style={{ gap: 8, padding: '7px 12px', background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 'var(--r-md)' }}
      >
        <Icon name="search" size={14} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar folio, contenedor o naviera…"
          style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13, color: 'var(--ink-900)' }}
        />
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 26 }}></th>
              <th>Contenedor</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>FOB USD</th>
              <th style={{ textAlign: 'right' }}>Importación</th>
              <th style={{ textAlign: 'right' }}>Total internado</th>
              <th style={{ textAlign: 'right' }}>Costo MXN/kg</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => {
              const isExp = expanded.has(c.contenedor_id);
              const tcUsado = c.tc ?? tcEstimado;
              const estimado = c.tc == null && tcEstimado != null;
              const fobMxn = tcUsado != null ? c.total_usd * tcUsado : null;
              const totalMxn = fobMxn != null ? fobMxn + c.costoImportacionMxn : null;
              const costoKg = totalMxn != null && c.total_kg > 0 ? totalMxn / c.total_kg : null;
              const colMxn = estimado ? '#92400E' : 'var(--blue-500)';
              return (
                <FragmentRow key={c.contenedor_id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => toggle(c.contenedor_id)}>
                    <td className="muted" style={{ textAlign: 'center' }}>
                      <Icon name={isExp ? 'chevron-down' : 'chevron-right'} size={13} />
                    </td>
                    <td>
                      <div className="mono fw-600 text-sm">{c.folio}</div>
                      <div className="text-xs muted">{c.contenedor ?? '—'}{c.naviera ? ` · ${c.naviera}` : ''}</div>
                    </td>
                    <td>
                      {c.liquidado ? (
                        <span className="badge badge-green">Liquidado</span>
                      ) : c.llego ? (
                        <span className="badge badge-amber">Pendiente</span>
                      ) : (
                        <span className="badge badge-blue">En camino</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtUSD(c.total_usd)}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{c.costoImportacionMxn > 0 ? fmtMXN(c.costoImportacionMxn) : <span className="muted">—</span>}</td>
                    <td style={{ textAlign: 'right', color: colMxn }} className="mono fw-600">
                      {totalMxn != null ? fmtMXN(totalMxn) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', color: colMxn }} className="mono fw-700">
                      {costoKg != null ? (
                        <>
                          {fmtMXN(costoKg)}
                          {estimado && <span className="text-xs"> est.</span>}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                  {isExp && (
                    <tr>
                      <td colSpan={7} style={{ padding: 0, background: 'var(--ink-50)' }}>
                        <table className="tbl" style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th>Producto</th>
                              <th style={{ textAlign: 'right' }}>Kg</th>
                              <th style={{ textAlign: 'right' }}>USD/kg</th>
                              <th style={{ textAlign: 'right' }}>Total USD</th>
                              <th style={{ textAlign: 'right' }}>MXN/kg</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.lineas.map((l, i) => (
                              <tr key={i}>
                                <td className="text-sm fw-600">{l.descripcion}</td>
                                <td style={{ textAlign: 'right' }} className="mono">{fmtKg(l.kg)}</td>
                                <td style={{ textAlign: 'right' }} className="mono">{fmtUSD4(l.precio_usd)}</td>
                                <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtUSD(l.total_usd)}</td>
                                <td style={{ textAlign: 'right', color: colMxn }} className="mono">
                                  {tcUsado != null ? fmtMXN(l.precio_usd * tcUsado) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {c.costosPorAgencia.length > 0 && (
                          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--ink-100)' }}>
                            <span className="text-xs fw-700" style={{ color: 'var(--ink-500)' }}>COSTO IMPORTACIÓN:</span>{' '}
                            {c.costosPorAgencia.map((a, i) => (
                              <span key={i} className="text-xs" style={{ marginRight: 12 }}>
                                {a.agencia}: <span className="mono fw-600">{fmtMXN(a.monto_mxn)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
