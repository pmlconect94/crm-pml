// ============================================================
// Camanchaca — Central de Costos
// Funciona para SA y MX (entity prop)
//
// SA: Muestra costo FOB (USD→MXN) + costo importación MXN = COSTO TOTAL INTERNADO
//     Búsqueda por SKU → últimos 5 contenedores → stock → costo promedio ponderado
//
// MX: Más simple. Solo MXN desde facturas directas.
//     Búsqueda por SKU → últimas 5 compras → stock → precio promedio ponderado
//
// Lógica costo promedio (SA):
//   tcEfectivo   = promedio ponderado de pagos reales | tcForward | tcDelDia
//   costoFOBmxn  = precioUSD × tcEfectivo
//   impKg        = (Σ costoImportacion.montoMXN) / totalKg del contenedor
//   costoTotalKg = costoFOBmxn + impKg
// ============================================================

const { useState: useCamC, useMemo: useMemoCC2, useEffect: useEffCC } = React;

const fmtUSD_CC = (n) => "$" + Number(n||0).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const fmtMXN_CC = (n) => "$" + Number(n||0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtKg_CC  = (n) => Number(n||0).toLocaleString("es-MX") + " kg";

// ── Construir fuentes por SKU para SA ──────────────────────────────────────────
const buildSASKUs = () => {
  const data   = window.CAMANCHACA_DATA;
  const conts  = data.contenedoresSA.filter(c => c.factura && c.productos.length > 0);

  const tcFor = (c) => {
    const ps = c.pagos || [];
    if (ps.length) return ps.reduce((s, p) => s + p.tc * p.monto, 0) / ps.reduce((s, p) => s + p.monto, 0);
    const fwd = (c.forwards || [])[0];
    return fwd?.tcForward || data.tcDelDia;
  };

  const skuMap = {};
  conts.forEach(c => {
    const tc       = tcFor(c);
    const totalImp = (c.costoImportacion || []).reduce((s, i) => s + i.montoMXN, 0);
    const impKg    = c.totalKg > 0 ? totalImp / c.totalKg : 0;

    c.productos.forEach(p => {
      const key = `${p.code}||${p.desc}`;
      if (!skuMap[key]) skuMap[key] = { key, code: p.code, desc: p.desc, kgCaja: p.kgCaja, fuentes: [] };
      skuMap[key].fuentes.push({
        folio:      c.folioInterno,
        factura:    c.factura,
        naviera:    c.naviera || "—",
        fecha:      c.etaBodega || c.etaManzanillo || "",
        status:     c.status,
        kg:         p.kg,
        precioUSD:  p.precioUSD,
        tc,
        costoFOBmxn: p.precioUSD * tc,
        impKg,
        costoTotalKg: p.precioUSD * tc + impKg,
      });
    });
  });

  Object.values(skuMap).forEach(sku =>
    sku.fuentes.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
  );
  return Object.values(skuMap);
};

// ── Construir fuentes por SKU para MX ──────────────────────────────────────────
const buildMXSKUs = () => {
  const data   = window.CAMANCHACA_DATA;
  const compras = data.comprasMX;
  const skuMap  = {};

  compras.forEach(c => {
    c.productos.forEach(p => {
      const key = `${p.code}||${p.desc}`;
      if (!skuMap[key]) skuMap[key] = { key, code: p.code, desc: p.desc, kgCaja: p.kgCaja, fuentes: [] };
      skuMap[key].fuentes.push({
        folio:     c.folioInterno,
        factura:   c.facturaNum,
        fecha:     c.fechaFactura || "",
        status:    c.status,
        kg:        p.kg,
        precioMXN: p.precioMXN,
      });
    });
  });

  Object.values(skuMap).forEach(sku =>
    sku.fuentes.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
  );
  return Object.values(skuMap);
};

// ── Cálculo promedio ponderado SA ────────────────────────────────────────────
const calcPromedioSA = (fuentes, stockKg) => {
  let remaining = stockKg;
  let sumUSD = 0, sumTC = 0, sumImp = 0, sumKg = 0;
  const breakdown = [];
  for (const f of fuentes) {
    if (remaining <= 0) break;
    const used = Math.min(f.kg, remaining);
    sumUSD += f.precioUSD * used;
    sumTC  += f.tc * used;
    sumImp += f.impKg * used;
    sumKg  += used;
    remaining -= used;
    breakdown.push({ ...f, kgUsado: used });
  }
  if (sumKg === 0) return null;
  const avgUSD = sumUSD / sumKg;
  const avgTC  = sumTC  / sumKg;
  const avgImp = sumImp / sumKg;
  return { avgUSD, avgTC, avgFOBmxn: avgUSD * avgTC, avgImp, avgTotal: avgUSD * avgTC + avgImp, totalKg: sumKg, breakdown };
};

// ── Cálculo promedio ponderado MX ────────────────────────────────────────────
const calcPromedioMX = (fuentes, stockKg) => {
  let remaining = stockKg;
  let sumMXN = 0, sumKg = 0;
  const breakdown = [];
  for (const f of fuentes) {
    if (remaining <= 0) break;
    const used = Math.min(f.kg, remaining);
    sumMXN += f.precioMXN * used;
    sumKg  += used;
    remaining -= used;
    breakdown.push({ ...f, kgUsado: used });
  }
  if (sumKg === 0) return null;
  return { avgMXN: sumMXN / sumKg, totalKg: sumKg, breakdown };
};

// ── Vista SA ─────────────────────────────────────────────────────────────────
const CostosSA = () => {
  const skus  = useMemoCC2(buildSASKUs, []);
  const [query,   setQuery]   = useCamC("");
  const [open,    setOpen]    = useCamC(false);
  const [selected, setSelected] = useCamC(null);
  const [stockInput, setStockInput] = useCamC("");

  useEffCC(() => {
    const saved = localStorage.getItem("cam_costos_sa_sku");
    if (saved && skus.find(s => s.key === saved)) setSelected(saved);
  }, []);

  const filtered = useMemoCC2(() => {
    const q = query.toLowerCase();
    return q ? skus.filter(s => s.desc.toLowerCase().includes(q) || s.code.includes(q)) : skus;
  }, [skus, query]);

  const activeSKU = selected ? skus.find(s => s.key === selected) : null;
  const last5     = activeSKU ? activeSKU.fuentes.slice(0, 5) : [];
  const stockKg   = parseFloat(stockInput) || 0;
  const resultado = activeSKU && stockKg > 0 ? calcPromedioSA(activeSKU.fuentes, stockKg) : null;
  const maxKg     = activeSKU ? activeSKU.fuentes.reduce((s, f) => s + f.kg, 0) : 0;

  const handleSelect = (sku) => {
    setSelected(sku.key); setQuery(sku.desc); setOpen(false); setStockInput("");
    localStorage.setItem("cam_costos_sa_sku", sku.key);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, fontSize: 12, color: "#92400E" }}>
        <span className="fw-700">Costo total internado en bodega</span> — Incluye el costo FOB (USD → MXN) más el costo de importación (agencia aduanal). Esto te da el verdadero costo de llevar el producto hasta tu bodega.
      </div>

      {/* Buscador */}
      <div style={{ position: "relative", maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "white", border: "1.5px solid var(--ink-300)", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          onClick={() => setOpen(true)}>
          <Icon name="search" size={15} style={{ color: "var(--ink-400)", flexShrink: 0 }}/>
          <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) setSelected(null); }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar por código o descripción…"
            style={{ border: "none", outline: "none", flex: 1, fontSize: 14, fontWeight: 500, background: "transparent", color: "var(--ink-900)" }}
          />
          {selected
            ? <button onClick={() => { setSelected(null); setQuery(""); setStockInput(""); localStorage.removeItem("cam_costos_sa_sku"); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-400)", fontSize: 16, padding: 0 }}>✕</button>
            : <span style={{ fontSize: 11, color: "var(--ink-400)", fontWeight: 500 }}>{skus.length} SKUs</span>
          }
        </div>
        {open && !selected && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)}/>
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "white", border: "1px solid var(--ink-200)", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 100, maxHeight: 280, overflowY: "auto" }}>
              {filtered.map(sku => (
                <button key={sku.key} onClick={() => handleSelect(sku)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left", borderBottom: "1px solid var(--ink-100)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F3F9FF"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{sku.desc}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2 }}>Código {sku.code} · {sku.kgCaja} kg/caja</div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--blue-500)", fontWeight: 600 }}>{sku.fuentes.length} cont.</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {activeSKU && (
        <>
          {/* Header SKU */}
          <div style={{ padding: "14px 18px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink-900)" }}>{activeSKU.desc}</div>
            <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
              Código {activeSKU.code} · {activeSKU.kgCaja} kg/caja
              <span style={{ marginLeft: 12, color: "var(--blue-500)", fontWeight: 600 }}>{activeSKU.fuentes.length} contenedores · {fmtKg_CC(maxKg)} total</span>
            </div>
          </div>

          {/* Últimos 5 contenedores */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-700)" }}>Últimos {Math.min(5, last5.length)} contenedores</span>
              <span style={{ fontSize: 11, color: "var(--ink-400)" }}>más reciente primero · referencia informativa</span>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th><th>Folio</th><th>Factura</th><th>Naviera</th><th>ETA Bodega</th>
                  <th style={{ textAlign: "right" }}>Kg</th>
                  <th style={{ textAlign: "right" }}>USD/kg</th>
                  <th style={{ textAlign: "right" }}>TC</th>
                  <th style={{ textAlign: "right" }}>FOB MXN/kg</th>
                  <th style={{ textAlign: "right" }}>Imp. MXN/kg</th>
                  <th style={{ textAlign: "right" }}>Total MXN/kg</th>
                </tr>
              </thead>
              <tbody>
                {last5.map((f, i) => (
                  <tr key={i} style={{ background: i === 0 ? "#F0F9FF" : "white" }}>
                    <td style={{ textAlign: "center" }}>
                      {i === 0 ? <span style={{ display: "inline-block", width: 18, height: 18, borderRadius: 999, background: "var(--blue-500)", color: "white", fontSize: 9, fontWeight: 800, lineHeight: "18px", textAlign: "center" }}>N</span>
                        : <span style={{ color: "var(--ink-400)", fontSize: 12 }}>{i+1}</span>}
                    </td>
                    <td className="mono fw-700">{f.folio}</td>
                    <td className="mono text-xs">{f.factura}</td>
                    <td className="text-sm">{f.naviera}</td>
                    <td className="text-sm">{f.fecha || "—"}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-600">{fmtKg_CC(f.kg)}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "var(--blue-500)", textAlign: "right" }}>{fmtUSD_CC(f.precioUSD)}</td>
                    <td style={{ textAlign: "right" }} className="mono">{f.tc.toFixed(4)}</td>
                    <td style={{ textAlign: "right" }} className="mono">{fmtMXN_CC(f.costoFOBmxn)}</td>
                    <td style={{ textAlign: "right" }} className="mono" style={{ color: "var(--amber-500)", textAlign: "right" }}>{fmtMXN_CC(f.impKg)}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-800" style={{ color: "var(--ink-900)", textAlign: "right" }}>{fmtMXN_CC(f.costoTotalKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calculadora */}
          <div className="card" style={{ padding: "20px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-800)", marginBottom: 4 }}>¿Cuántos kg tienes en bodega?</div>
            <div style={{ fontSize: 12, color: "var(--ink-500)", marginBottom: 16 }}>Calcula el costo promedio ponderado (FOB + importación) tomando del contenedor más nuevo al más viejo.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: resultado ? 20 : 0 }}>
              <div style={{ position: "relative", flex: "0 0 240px" }}>
                <input type="number" min={0} value={stockInput} onChange={e => setStockInput(e.target.value)}
                  placeholder="Ej: 9000"
                  style={{ width: "100%", padding: "12px 40px 12px 14px", borderRadius: 9, border: "1.5px solid var(--ink-300)", fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = "var(--blue-500)"}
                  onBlur={e => e.target.style.borderColor = "var(--ink-300)"}
                />
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--ink-500)", fontWeight: 600, pointerEvents: "none" }}>kg</span>
              </div>
              {stockInput && stockKg > maxKg && (
                <div style={{ fontSize: 12, color: "var(--red-500)", fontWeight: 600 }}>⚠ Excede {fmtKg_CC(maxKg)}</div>
              )}
            </div>

            {resultado && (
              <div>
                {/* KPIs resultado */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 14 }}>
                  {[
                    { label: "Stock eval.",  value: fmtKg_CC(resultado.totalKg),       color: null },
                    { label: "USD/kg FOB",   value: fmtUSD_CC(resultado.avgUSD),        color: "var(--blue-500)" },
                    { label: "TC promedio",  value: resultado.avgTC.toFixed(4),          color: null },
                    { label: "Imp. MXN/kg",  value: fmtMXN_CC(resultado.avgImp),        color: "var(--amber-500)" },
                    { label: "Total MXN/kg", value: fmtMXN_CC(resultado.avgTotal),       color: "var(--ink-900)", strong: true },
                  ].map((k, i) => (
                    <div key={i} style={{ background: k.strong ? "var(--ink-900)" : "var(--ink-50)", borderRadius: 10, padding: "12px 14px", border: "1px solid", borderColor: k.strong ? "var(--ink-900)" : "var(--ink-100)" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: k.strong ? "rgba(255,255,255,0.5)" : "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{k.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--font-mono)", color: k.strong ? "white" : k.color || "var(--ink-800)" }}>{k.value}</div>
                    </div>
                  ))}
                </div>

                {/* Valor total */}
                <div style={{ padding: "12px 16px", background: "var(--ink-900)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>Valor total internado del inventario consultado</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "white", fontFamily: "var(--font-mono)" }}>{fmtMXN_CC(resultado.totalKg * resultado.avgTotal)}</div>
                </div>

                {/* Desglose */}
                <div style={{ borderTop: "1px solid var(--ink-100)", paddingTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>Desglose — de dónde se tomaron los kg</div>
                  <table className="tbl" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Folio</th><th>Factura</th><th>ETA</th>
                        <th style={{ textAlign: "right" }}>Kg usados</th>
                        <th style={{ textAlign: "right" }}>%</th>
                        <th style={{ textAlign: "right" }}>USD/kg</th>
                        <th style={{ textAlign: "right" }}>Imp./kg</th>
                        <th style={{ textAlign: "right" }}>Total MXN/kg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.breakdown.map((f, i) => {
                        const pct = f.kgUsado / resultado.totalKg * 100;
                        return (
                          <tr key={i} style={{ background: i === 0 ? "#F0F9FF" : "white" }}>
                            <td className="mono fw-700">{f.folio}</td>
                            <td className="mono text-xs">{f.factura}</td>
                            <td className="text-sm">{f.fecha || "—"}</td>
                            <td style={{ textAlign: "right" }} className="mono fw-700">{fmtKg_CC(f.kgUsado)}</td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                                <div style={{ width: 40, height: 5, borderRadius: 999, background: "var(--ink-100)", overflow: "hidden" }}>
                                  <div style={{ width: `${pct}%`, height: "100%", background: "var(--blue-500)", borderRadius: 999 }}/>
                                </div>
                                <span className="mono text-sm">{pct.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "var(--blue-500)", textAlign: "right" }}>{fmtUSD_CC(f.precioUSD)}</td>
                            <td style={{ textAlign: "right" }} className="mono" style={{ color: "var(--amber-500)", textAlign: "right" }}>{fmtMXN_CC(f.impKg)}</td>
                            <td style={{ textAlign: "right" }} className="mono fw-800">{fmtMXN_CC(f.costoTotalKg)}</td>
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

      {!activeSKU && (
        <div style={{ padding: "64px 32px", textAlign: "center", color: "var(--ink-400)", background: "white", borderRadius: 12, border: "1px dashed var(--ink-200)" }}>
          <Icon name="search" size={32}/>
          <div style={{ marginTop: 12, fontSize: 16, fontWeight: 700, color: "var(--ink-600)" }}>Busca un SKU para comenzar</div>
          <div style={{ marginTop: 6, fontSize: 13 }}>Selecciona un producto para ver su historial de contenedores y calcular el costo total internado.</div>
        </div>
      )}
    </div>
  );
};

// ── Vista MX ─────────────────────────────────────────────────────────────────
const CostosMX = () => {
  const skus  = useMemoCC2(buildMXSKUs, []);
  const [query, setQuery]   = useCamC("");
  const [open,  setOpen]    = useCamC(false);
  const [selected, setSelected] = useCamC(null);
  const [stockInput, setStockInput] = useCamC("");

  const filtered = useMemoCC2(() => {
    const q = query.toLowerCase();
    return q ? skus.filter(s => s.desc.toLowerCase().includes(q) || s.code.includes(q)) : skus;
  }, [skus, query]);

  const activeSKU = selected ? skus.find(s => s.key === selected) : null;
  const last5     = activeSKU ? activeSKU.fuentes.slice(0, 5) : [];
  const stockKg   = parseFloat(stockInput) || 0;
  const resultado = activeSKU && stockKg > 0 ? calcPromedioMX(activeSKU.fuentes, stockKg) : null;
  const maxKg     = activeSKU ? activeSKU.fuentes.reduce((s, f) => s + f.kg, 0) : 0;

  const handleSelect = (sku) => {
    setSelected(sku.key); setQuery(sku.desc); setOpen(false); setStockInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ position: "relative", maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "white", border: "1.5px solid var(--ink-300)", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          onClick={() => setOpen(true)}>
          <Icon name="search" size={15} style={{ color: "var(--ink-400)", flexShrink: 0 }}/>
          <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) setSelected(null); }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar SKU de Camanchaca México…"
            style={{ border: "none", outline: "none", flex: 1, fontSize: 14, fontWeight: 500, background: "transparent" }}
          />
          {selected
            ? <button onClick={() => { setSelected(null); setQuery(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-400)", fontSize: 16, padding: 0 }}>✕</button>
            : <span style={{ fontSize: 11, color: "var(--ink-400)", fontWeight: 500 }}>{skus.length} SKUs</span>
          }
        </div>
        {open && !selected && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)}/>
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "white", border: "1px solid var(--ink-200)", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 100, maxHeight: 260, overflowY: "auto" }}>
              {filtered.map(sku => (
                <button key={sku.key} onClick={() => handleSelect(sku)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left", borderBottom: "1px solid var(--ink-100)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F0FDF4"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{sku.desc}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2 }}>Código {sku.code}</div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--green-500)", fontWeight: 600 }}>{sku.fuentes.length} compras</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {activeSKU && (
        <>
          <div style={{ padding: "14px 18px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{activeSKU.desc}</div>
            <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>Código {activeSKU.code} · {activeSKU.fuentes.length} compras · {fmtKg_CC(maxKg)} total</div>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", fontSize: 12, fontWeight: 700, color: "var(--ink-700)" }}>Últimas {Math.min(5, last5.length)} compras</div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th><th>Folio</th><th>Factura</th><th>Fecha</th>
                  <th style={{ textAlign: "right" }}>Kg</th>
                  <th style={{ textAlign: "right" }}>MXN/kg</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {last5.map((f, i) => (
                  <tr key={i} style={{ background: i === 0 ? "#F0FDF4" : "white" }}>
                    <td style={{ textAlign: "center" }}>
                      {i === 0 ? <span style={{ display: "inline-block", width: 18, height: 18, borderRadius: 999, background: "var(--green-500)", color: "white", fontSize: 9, fontWeight: 800, lineHeight: "18px", textAlign: "center" }}>N</span>
                        : <span style={{ color: "var(--ink-400)", fontSize: 12 }}>{i+1}</span>}
                    </td>
                    <td className="mono fw-700">{f.folio}</td>
                    <td className="mono text-sm">{f.factura}</td>
                    <td className="text-sm">{f.fecha || "—"}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-600">{fmtKg_CC(f.kg)}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-800" style={{ color: "var(--green-500)", textAlign: "right" }}>{fmtMXN_CC(f.precioMXN)}</td>
                    <td><span className={`badge ${f.status==="Liquidada"?"badge-green":"badge-amber"}`}>{f.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding: "20px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>¿Cuántos kg tienes en bodega?</div>
            <div style={{ fontSize: 12, color: "var(--ink-500)", marginBottom: 16 }}>Precio promedio ponderado en MXN, de la compra más reciente a la más antigua.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative", flex: "0 0 240px" }}>
                <input type="number" min={0} value={stockInput} onChange={e => setStockInput(e.target.value)} placeholder="Ej: 2000"
                  style={{ width: "100%", padding: "12px 40px 12px 14px", borderRadius: 9, border: "1.5px solid var(--ink-300)", fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = "var(--green-500)"}
                  onBlur={e => e.target.style.borderColor = "var(--ink-300)"}
                />
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--ink-500)", fontWeight: 600, pointerEvents: "none" }}>kg</span>
              </div>
            </div>
            {resultado && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 12 }}>
                  {[
                    { label: "Stock evaluado", value: fmtKg_CC(resultado.totalKg) },
                    { label: "MXN/kg promedio", value: fmtMXN_CC(resultado.avgMXN), color: "var(--green-500)" },
                    { label: "Valor total MXN", value: fmtMXN_CC(resultado.totalKg * resultado.avgMXN), strong: true },
                  ].map((k, i) => (
                    <div key={i} style={{ background: k.strong ? "var(--ink-900)" : "var(--ink-50)", borderRadius: 10, padding: "12px 14px", border: "1px solid", borderColor: k.strong ? "var(--ink-900)" : "var(--ink-100)" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: k.strong ? "rgba(255,255,255,0.5)" : "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{k.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--font-mono)", color: k.strong ? "white" : k.color || "var(--ink-900)" }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!activeSKU && (
        <div style={{ padding: "64px 32px", textAlign: "center", color: "var(--ink-400)", background: "white", borderRadius: 12, border: "1px dashed var(--ink-200)" }}>
          <Icon name="search" size={32}/>
          <div style={{ marginTop: 12, fontSize: 16, fontWeight: 700, color: "var(--ink-600)" }}>Busca un producto para comenzar</div>
        </div>
      )}
    </div>
  );
};

// ── Entry point ──────────────────────────────────────────────────────────────
const CamanchacaCostos = ({ entity }) => {
  return entity === "sa" ? <CostosSA /> : <CostosMX />;
};

Object.assign(window, { CamanchacaCostos });
