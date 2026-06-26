import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';
import { StatStrip } from '@/components/StatStrip';
import { useAuth } from '@/lib/auth';
import { fmtMXN, fmtKg, fmtFechaCorta } from '@/lib/format';
import { fetchComprasMX } from '@/features/camanchaca/mx-queries';
import type { CamCompraMXConProductos } from '@/types/database';

const toNum = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};
const fmtMXN4 = (n: number | null | undefined) =>
  n == null ? '—' : '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + ' MXN';

/** Una fuente de costo = una línea de una compra (precio MXN/kg + kg). */
type FuenteMX = {
  compra_id: string;
  folio: string;
  factura: string;
  fecha_factura: string;
  precio_mxn: number;
  kg: number;
};

type SkuCostoMX = {
  sku_id: string;
  descripcion: string;
  marca: string | null;
  talla: string | null;
  fuentes: FuenteMX[]; // ordenadas por fecha DESC (más nueva primero)
  totalKg: number;
};

/** Costo promedio ponderado sobre el stock, del más nuevo al más viejo (§6). */
function calcularPromedioMX(fuentes: FuenteMX[], stockKg: number) {
  let restante = stockKg;
  let sumMXN = 0;
  let sumKg = 0;
  const breakdown: (FuenteMX & { kgUsado: number })[] = [];
  for (const f of fuentes) {
    if (restante <= 0.0001) break;
    const usado = Math.min(f.kg, restante);
    sumMXN += f.precio_mxn * usado;
    sumKg += usado;
    restante -= usado;
    breakdown.push({ ...f, kgUsado: usado });
  }
  if (sumKg === 0) return null;
  return {
    avgMXN: sumMXN / sumKg,
    totalKg: sumKg,
    faltante: Math.max(0, restante),
    breakdown,
  };
}

function buildSkus(compras: CamCompraMXConProductos[]): SkuCostoMX[] {
  const map = new Map<string, SkuCostoMX>();
  for (const c of compras) {
    for (const linea of c.productos ?? []) {
      if (!linea.sku_id) continue;
      const kg = Number(linea.kg ?? 0);
      const precio = Number(linea.precio_mxn ?? 0);
      if (!map.has(linea.sku_id)) {
        map.set(linea.sku_id, {
          sku_id: linea.sku_id,
          descripcion: linea.descripcion ?? '—',
          marca: linea.marca ?? null,
          talla: linea.talla ?? null,
          fuentes: [],
          totalKg: 0,
        });
      }
      const sku = map.get(linea.sku_id)!;
      sku.fuentes.push({
        compra_id: c.id,
        folio: c.folio_interno,
        factura: c.factura_num,
        fecha_factura: c.fecha_factura,
        precio_mxn: precio,
        kg,
      });
      sku.totalKg += kg;
    }
  }
  for (const sku of map.values()) {
    sku.fuentes.sort((a, b) => (b.fecha_factura ?? '').localeCompare(a.fecha_factura ?? ''));
  }
  return Array.from(map.values()).sort((a, b) => b.totalKg - a.totalKg);
}

export function CamMXCostosPage() {
  const { empresaId } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [stockInput, setStockInput] = useState('');

  const { data: compras = [], isLoading } = useQuery({
    queryKey: ['cam_mx_compras', empresaId],
    queryFn: () => fetchComprasMX(empresaId),
  });

  const skus = useMemo(() => buildSkus(compras), [compras]);

  const filtered = useMemo(() => {
    if (!search) return skus;
    const s = search.toLowerCase();
    return skus.filter(
      (k) =>
        k.descripcion.toLowerCase().includes(s) ||
        (k.marca ?? '').toLowerCase().includes(s) ||
        (k.talla ?? '').toLowerCase().includes(s),
    );
  }, [skus, search]);

  const sku = useMemo(() => skus.find((k) => k.sku_id === selectedSku) ?? null, [skus, selectedSku]);
  const stockKg = toNum(stockInput);
  const promedio = useMemo(
    () => (sku && stockKg > 0 ? calcularPromedioMX(sku.fuentes, stockKg) : null),
    [sku, stockKg],
  );

  const kpis = useMemo(() => {
    const totalKg = skus.reduce((s, k) => s + k.totalKg, 0);
    const valorTotal = compras.reduce(
      (s, c) => s + (c.productos ?? []).reduce((v, p) => v + Number(p.total_mxn ?? 0), 0),
      0,
    );
    return { numSkus: skus.length, totalKg, valorTotal };
  }, [skus, compras]);

  return (
    <>
      <PageEnter style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
          Central de costos
        </h2>
        <p className="page-subtitle">
          Costo promedio ponderado por SKU en MXN — precio directo de factura, sin TC ni importación
        </p>
      </PageEnter>

      <StatStrip
        stats={[
          { value: kpis.numSkus, label: 'SKUs comprados' },
          { value: fmtKg(kpis.totalKg), label: 'kg comprados' },
          { value: fmtMXN(kpis.valorTotal), label: 'valor comprado' },
        ]}
      />

      <div className="grid grid-2" style={{ gap: 16, alignItems: 'start' }}>
        {/* Lista de SKUs */}
        <div className="card">
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--ink-100)' }}>
            <div
              className="hstack"
              style={{
                gap: 8,
                padding: '6px 10px',
                background: 'var(--ink-50)',
                borderRadius: 8,
                border: '1px solid var(--ink-200)',
              }}
            >
              <Icon name="search" size={14} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar SKU, marca, talla…"
                style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13 }}
              />
            </div>
          </div>
          {isLoading ? (
            <div style={{ padding: 20 }}>
              <div className="skeleton-bar" style={{ width: '60%', marginBottom: 10 }} />
              <div className="skeleton-bar" style={{ width: '40%' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <Icon name="package" size={34} />
              <div className="empty-title">Sin productos</div>
              <p className="muted">
                {skus.length === 0
                  ? 'Captura compras con SKU para ver costos aquí.'
                  : 'Ningún SKU coincide con tu búsqueda.'}
              </p>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th style={{ textAlign: 'right' }}>Kg comprados</th>
                  <th style={{ textAlign: 'right' }}>Último MXN/kg</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((k) => {
                  const ultimo = k.fuentes[0]?.precio_mxn ?? null;
                  const sel = selectedSku === k.sku_id;
                  return (
                    <tr
                      key={k.sku_id}
                      onClick={() => {
                        setSelectedSku(k.sku_id);
                        setStockInput('');
                      }}
                      style={{ cursor: 'pointer', background: sel ? 'color-mix(in srgb, var(--camanchaca) 8%, white)' : undefined }}
                    >
                      <td>
                        <div className="fw-600 text-sm">{k.descripcion}</div>
                        <div className="text-xs muted">
                          {k.marca ?? '—'}{k.talla ? ` · ${k.talla}` : ''} · {k.fuentes.length} compra{k.fuentes.length === 1 ? '' : 's'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">{fmtKg(k.totalKg)}</td>
                      <td style={{ textAlign: 'right' }} className="mono fw-600">{ultimo != null ? fmtMXN(ultimo) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detalle del SKU + costo promedio */}
        <div className="card" style={{ padding: 16 }}>
          {!sku ? (
            <div className="empty" style={{ padding: '36px 16px' }}>
              <Icon name="calculator" size={34} />
              <div className="empty-title">Elige un SKU</div>
              <p className="muted">Selecciona un producto de la lista para calcular su costo promedio.</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <div className="fw-700" style={{ fontSize: 14 }}>{sku.descripcion}</div>
                <div className="text-xs muted">
                  {sku.marca ?? '—'}{sku.talla ? ` · ${sku.talla}` : ''} · {fmtKg(sku.totalKg)} en {sku.fuentes.length} compra{sku.fuentes.length === 1 ? '' : 's'}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="field-label">Kg en bodega (manual)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  className="field-input mono"
                  value={stockInput}
                  onChange={(e) => setStockInput(e.target.value)}
                  placeholder="Captura los kg que tienes en bodega"
                />
                <div className="text-xs muted" style={{ marginTop: 4 }}>
                  El costo se toma de las compras más recientes hacia las más viejas, hasta cubrir el stock.
                </div>
              </div>

              {promedio ? (
                <>
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 'var(--r-md)',
                      background: 'color-mix(in srgb, var(--camanchaca) 8%, white)',
                      border: '1px solid color-mix(in srgb, var(--camanchaca) 24%, white)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div className="kpi-label">Costo promedio</div>
                      <div className="mono fw-700" style={{ fontSize: 18, color: 'var(--camanchaca)' }}>
                        {fmtMXN4(promedio.avgMXN)}/kg
                      </div>
                    </div>
                    <div>
                      <div className="kpi-label">Valor del stock</div>
                      <div className="mono fw-700" style={{ fontSize: 18 }}>
                        {fmtMXN(promedio.avgMXN * promedio.totalKg)}
                      </div>
                    </div>
                  </div>

                  {promedio.faltante > 0.001 && (
                    <div
                      className="text-xs"
                      style={{
                        marginBottom: 12,
                        padding: '8px 12px',
                        borderRadius: 'var(--r-sm)',
                        background: 'color-mix(in srgb, var(--amber-500) 10%, white)',
                        color: '#92400E',
                      }}
                    >
                      El stock capturado excede el historial de compras por {fmtKg(promedio.faltante)} —
                      el promedio se calculó solo sobre {fmtKg(promedio.totalKg)}.
                    </div>
                  )}

                  <div className="text-xs fw-700" style={{ color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Desglose por compra
                  </div>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Compra</th>
                        <th>Fecha</th>
                        <th style={{ textAlign: 'right' }}>MXN/kg</th>
                        <th style={{ textAlign: 'right' }}>Kg usados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promedio.breakdown.map((b, i) => (
                        <tr key={i}>
                          <td className="mono text-sm fw-600">{b.folio}</td>
                          <td className="text-sm">{fmtFechaCorta(b.fecha_factura)}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{fmtMXN(b.precio_mxn)}</td>
                          <td style={{ textAlign: 'right' }} className="mono fw-600">{fmtKg(b.kgUsado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <>
                  <div className="text-xs fw-700" style={{ color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Historial de precios ({sku.fuentes.length})
                  </div>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Compra</th>
                        <th>Fecha</th>
                        <th style={{ textAlign: 'right' }}>MXN/kg</th>
                        <th style={{ textAlign: 'right' }}>Kg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sku.fuentes.map((f, i) => (
                        <tr key={i}>
                          <td className="mono text-sm fw-600">{f.folio}</td>
                          <td className="text-sm">{fmtFechaCorta(f.fecha_factura)}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{fmtMXN(f.precio_mxn)}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{fmtKg(f.kg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
