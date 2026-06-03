// ============================================================
// Central de Costos — Blufin Seafood
// Tabs: Inventario & Costo Promedio | Histórico de Precios
// ============================================================

const { useState: useStateCC, useMemo: useMemoCC, useEffect: useEffectCC } = React;
const { Icon: IconCC } = window;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtUSD4 = (n) => "$" + Number(n||0).toLocaleString("en-US",{minimumFractionDigits:4,maximumFractionDigits:4});
const fmtUSD2 = (n) => "$" + Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtMXN  = (n) => "$" + Number(n||0).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtKgCC = (n) => Number(n||0).toLocaleString("es-MX") + " kg";
const fmtFchCC= (s) => { if(!s)return"—"; const d=new Date(s+"T12:00:00"); return d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"}); };

// ── Build SKU list from BLUFIN_DATA ──────────────────────────────────────────
const buildSKUs = () => {
  const contratos = window.BLUFIN_DATA?.contratos || [];
  const pagos     = window.BLUFIN_DATA?.pagos     || [];
  const forwards  = window.BLUFIN_DATA?.forwards  || [];

  const tcFor = (folio) => {
    const ps = pagos.filter(p => p.contrato === folio);
    const fwd = forwards.find(f => f.contrato === folio);
    if (ps.length) return ps.reduce((s,p)=>s+p.tc*p.montoUSD,0) / ps.reduce((s,p)=>s+p.montoUSD,0);
    return fwd?.tcForward || contratos.find(c=>c.folio===folio)?.tcPonderado || 17.85;
  };

  const skuMap = {};
  contratos.forEach(c => {
    const tc = tcFor(c.folio);
    (c.productos||[]).forEach(p => {
      const key = `${p.desc}||${p.marca}||${p.talla}`;
      if (!skuMap[key]) skuMap[key] = { key, desc:p.desc, marca:p.marca, talla:p.talla, pct:p.pct, fuentes:[] };
      skuMap[key].fuentes.push({
        folio: c.folio,
        contenedor: c.contenedor || "—",
        naviera: c.naviera || "—",
        fecha: c.etaBodega || c.etaPuerto || "",
        status: c.status,
        kg: p.kg,
        precioUSD: p.precio,
        tc,
        precioMXN: p.precio * tc,
      });
    });
  });

  // Sort each SKU's fuentes newest → oldest
  Object.values(skuMap).forEach(sku => {
    sku.fuentes.sort((a,b) => (b.fecha||"").localeCompare(a.fecha||""));
  });

  return Object.values(skuMap);
};

// ── Weighted average calculation (newest → oldest) ────────────────────────────
const calcPromedio = (fuentes, stockKg) => {
  let remaining = stockKg;
  let sumUSD = 0, sumTC = 0, sumKg = 0;
  const breakdown = [];

  for (const f of fuentes) {
    if (remaining <= 0) break;
    const used = Math.min(f.kg, remaining);
    sumUSD += f.precioUSD * used;
    sumTC  += f.tc * used;
    sumKg  += used;
    remaining -= used;
    breakdown.push({ ...f, kgUsado: used });
  }

  if (sumKg === 0) return null;
  const avgUSD = sumUSD / sumKg;
  const avgTC  = sumTC  / sumKg;
  return { avgUSD, avgTC, avgMXN: avgUSD * avgTC, totalKg: sumKg, breakdown };
};

// ════════════════════════════════════════════════════════════════════════════════
// TAB 1 — Inventario & Costo Promedio
// ════════════════════════════════════════════════════════════════════════════════
const InventarioView = () => {
  const skus = useMemoCC(buildSKUs, []);

  const [query,       setQuery]       = useStateCC("");
  const [open,        setOpen]        = useStateCC(false);
  const [selected,    setSelected]    = useStateCC(null);   // SKU key
  const [stockInput,  setStockInput]  = useStateCC("");

  // Persist last selection
  useEffectCC(() => {
    const saved = localStorage.getItem("costos_selected_sku");
    if (saved && skus.find(s => s.key === saved)) setSelected(saved);
  }, []);

  const filteredSKUs = useMemoCC(() => {
    const q = query.toLowerCase();
    if (!q) return skus;
    return skus.filter(s =>
      s.desc.toLowerCase().includes(q) ||
      s.marca.toLowerCase().includes(q) ||
      (s.talla||"").toLowerCase().includes(q)
    );
  }, [skus, query]);

  const activeSKU = selected ? skus.find(s => s.key === selected) : null;

  // Last 5 containers
  const last5 = activeSKU ? activeSKU.fuentes.slice(0, 5) : [];

  const stockKg     = parseFloat(stockInput.replace(/,/g,"")) || 0;
  const resultado   = activeSKU && stockKg > 0 ? calcPromedio(activeSKU.fuentes, stockKg) : null;
  const maxKg       = activeSKU ? activeSKU.fuentes.reduce((s,f)=>s+f.kg,0) : 0;

  const handleSelect = (sku) => {
    setSelected(sku.key);
    setQuery(sku.desc);
    setOpen(false);
    setStockInput("");
    localStorage.setItem("costos_selected_sku", sku.key);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery("");
    setStockInput("");
    localStorage.removeItem("costos_selected_sku");
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* ── BUSCADOR ── */}
      <div style={{ position:"relative", maxWidth:560 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"white", border:"1.5px solid var(--ink-300)", borderRadius:10, boxShadow:"0 1px 4px rgba(0,0,0,0.06)", cursor:"text" }}
          onClick={() => { setOpen(true); }}>
          <IconCC name="search" size={15} style={{ color:"var(--ink-400)", flexShrink:0 }} />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) setSelected(null); }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar producto, marca o talla…"
            style={{ border:"none", outline:"none", flex:1, fontSize:14, fontWeight:500, background:"transparent", color:"var(--ink-900)" }}
          />
          {selected
            ? <button onClick={handleClear} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--ink-400)",fontSize:16,lineHeight:1,padding:0 }}>✕</button>
            : <span style={{ fontSize:11, color:"var(--ink-400)", fontWeight:500 }}>{skus.length} productos</span>
          }
        </div>

        {/* Dropdown */}
        {open && !selected && (
          <>
            <div style={{ position:"fixed", inset:0, zIndex:99 }} onClick={() => setOpen(false)} />
            <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, background:"white", border:"1px solid var(--ink-200)", borderRadius:10, boxShadow:"0 8px 32px rgba(0,0,0,0.12)", zIndex:100, maxHeight:320, overflowY:"auto" }}>
              {filteredSKUs.length === 0
                ? <div style={{ padding:"20px 16px", textAlign:"center", color:"var(--ink-400)", fontSize:13 }}>Sin resultados</div>
                : filteredSKUs.map(sku => (
                  <button key={sku.key} onClick={() => handleSelect(sku)}
                    style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"11px 16px", border:"none", background:"none", cursor:"pointer", textAlign:"left", borderBottom:"1px solid var(--ink-100)" }}
                    onMouseEnter={e => e.currentTarget.style.background="#F3F9FF"}
                    onMouseLeave={e => e.currentTarget.style.background="none"}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:"var(--ink-900)" }}>{sku.desc}</div>
                      <div style={{ fontSize:11, color:"var(--ink-500)", marginTop:2 }}>
                        {sku.marca}{sku.pct?" · "+sku.pct:""}{sku.talla?" · "+sku.talla:""}
                      </div>
                    </div>
                    <div style={{ fontSize:11, color:"var(--blue-500)", fontWeight:600, flexShrink:0, marginLeft:12 }}>
                      {sku.fuentes.length} cont.
                    </div>
                  </button>
                ))
              }
            </div>
          </>
        )}
      </div>

      {/* ── PRODUCTO SELECCIONADO ── */}
      {activeSKU && (
        <>
          {/* Header del producto */}
          <div style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:10 }}>
            <div style={{ width:42, height:42, borderRadius:8, background:"var(--blue-500)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <IconCC name="pkg" size={20} style={{ color:"white" }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, color:"var(--ink-900)", letterSpacing:"-0.01em" }}>{activeSKU.desc}</div>
              <div style={{ fontSize:12, color:"var(--ink-500)", marginTop:2 }}>
                {activeSKU.marca}{activeSKU.pct?" · "+activeSKU.pct:""}{activeSKU.talla?" · "+activeSKU.talla:""}
                <span style={{ marginLeft:10, color:"var(--blue-500)", fontWeight:600 }}>{activeSKU.fuentes.length} contenedores en historial</span>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:11, color:"var(--ink-500)" }}>Total disponible en historial</div>
              <div style={{ fontSize:16, fontWeight:800, color:"var(--ink-900)", fontFamily:"var(--font-mono)" }}>{fmtKgCC(maxKg)}</div>
            </div>
          </div>

          {/* ── ÚLTIMOS 5 CONTENEDORES ── */}
          <div className="card" style={{ padding:0, overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--ink-100)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-700)", letterSpacing:"0.04em", textTransform:"uppercase" }}>
                Últimos {Math.min(5, last5.length)} contenedores — más reciente primero
              </div>
              <span style={{ fontSize:11, color:"var(--ink-400)" }}>referencia informativa</span>
            </div>
            <table className="tbl" style={{ margin:0 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Folio</th>
                  <th>Contenedor</th>
                  <th>Naviera</th>
                  <th>Fecha bodega</th>
                  <th style={{ textAlign:"right" }}>Kg</th>
                  <th style={{ textAlign:"right" }}>Precio USD/kg</th>
                  <th style={{ textAlign:"right" }}>TC</th>
                  <th style={{ textAlign:"right" }}>Precio MXN/kg</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {last5.map((f, i) => (
                  <tr key={i} style={{ background: i === 0 ? "#F0F9FF" : "white" }}>
                    <td style={{ textAlign:"center" }}>
                      {i === 0
                        ? <span style={{ display:"inline-block", width:20, height:20, borderRadius:999, background:"var(--blue-500)", color:"white", fontSize:10, fontWeight:800, lineHeight:"20px", textAlign:"center" }}>N</span>
                        : <span style={{ color:"var(--ink-400)", fontSize:12 }}>{i+1}</span>
                      }
                    </td>
                    <td className="mono fw-600 text-sm">{f.folio}</td>
                    <td className="mono text-xs">{f.contenedor}</td>
                    <td className="text-sm">{f.naviera}</td>
                    <td className="text-sm">{fmtFchCC(f.fecha)}</td>
                    <td style={{ textAlign:"right" }} className="mono fw-600">{fmtKgCC(f.kg)}</td>
                    <td style={{ textAlign:"right" }} className="mono fw-700" style={{ color:"var(--blue-500)", textAlign:"right" }}>{fmtUSD4(f.precioUSD)}</td>
                    <td style={{ textAlign:"right" }} className="mono">{f.tc.toFixed(4)}</td>
                    <td style={{ textAlign:"right" }} className="mono fw-700">{fmtMXN(f.precioMXN)}</td>
                    <td>
                      <span style={{ padding:"2px 7px", borderRadius:999, fontSize:10, fontWeight:600,
                        background: f.status==="Entregado"?"#D1FAE5":f.status==="En tránsito"?"#DBEAFE":"#F3F4F6",
                        color:      f.status==="Entregado"?"#065F46":f.status==="En tránsito"?"#1E40AF":"#6B7280" }}>
                        {f.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── CALCULADORA DE STOCK ── */}
          <div className="card" style={{ padding:"20px 22px" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--ink-800)", marginBottom:4 }}>
              ¿Cuántos kg tienes en bodega?
            </div>
            <div style={{ fontSize:12, color:"var(--ink-500)", marginBottom:16 }}>
              Ingresa tu stock actual y calcularemos el costo promedio ponderado tomando del contenedor más nuevo al más viejo.
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom: resultado ? 20 : 0 }}>
              <div style={{ position:"relative", flex:"0 0 280px" }}>
                <input
                  type="number"
                  min={0}
                  max={maxKg}
                  step={100}
                  value={stockInput}
                  onChange={e => setStockInput(e.target.value)}
                  placeholder="Ej: 12000"
                  style={{ width:"100%", padding:"12px 48px 12px 14px", borderRadius:9, border:"1.5px solid var(--ink-300)", fontFamily:"var(--font-mono)", fontSize:18, fontWeight:700, color:"var(--ink-900)", outline:"none", boxSizing:"border-box" }}
                  onFocus={e => e.target.style.borderColor="var(--blue-500)"}
                  onBlur={e => e.target.style.borderColor="var(--ink-300)"}
                />
                <span style={{ position:"absolute", right:13, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"var(--ink-500)", fontWeight:600, pointerEvents:"none" }}>kg</span>
              </div>
              {stockInput && stockKg > maxKg && (
                <div style={{ fontSize:12, color:"#DC2626", fontWeight:600 }}>
                  ⚠ Excede los {fmtKgCC(maxKg)} del historial
                </div>
              )}
            </div>

            {/* ── RESULTADO ── */}
            {resultado && (
              <div style={{ marginTop:4 }}>
                {/* KPIs resultado */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12, marginBottom:16 }}>
                  {[
                    { label:"Stock evaluado",   value: fmtKgCC(resultado.totalKg),          sub:"kg calculados",            color: null },
                    { label:"Precio prom. USD",  value: fmtUSD4(resultado.avgUSD),           sub:"por kilogramo",            color: "var(--blue-500)" },
                    { label:"TC promedio",        value: resultado.avgTC.toFixed(4),          sub:"ponderado por volumen",    color: null },
                    { label:"Costo prom. MXN",   value: fmtMXN(resultado.avgMXN),            sub:"por kilogramo",            color: "var(--ink-900)" },
                  ].map((k,i) => (
                    <div key={i} style={{ background: i===1||i===3 ? "#EFF6FF" : "var(--ink-50)", borderRadius:10, padding:"13px 15px", border:"1px solid", borderColor: i===1||i===3 ? "#BFDBFE" : "var(--ink-100)" }}>
                      <div style={{ fontSize:10, fontWeight:700, color:"var(--ink-500)", letterSpacing:"0.05em", textTransform:"uppercase", marginBottom:5 }}>{k.label}</div>
                      <div style={{ fontSize:16, fontWeight:800, fontFamily:"var(--font-mono)", color:k.color||"var(--ink-800)", lineHeight:1 }}>{k.value}</div>
                      <div style={{ fontSize:11, color:"var(--ink-400)", marginTop:4 }}>{k.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Valor total */}
                <div style={{ padding:"12px 16px", background:"var(--ink-900)", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)", fontWeight:600 }}>Valor total del inventario consultado</div>
                  <div style={{ fontSize:22, fontWeight:800, color:"white", fontFamily:"var(--font-mono)" }}>
                    {fmtMXN(resultado.totalKg * resultado.avgMXN)}
                  </div>
                </div>

                {/* Desglose por contenedor */}
                <div style={{ borderTop:"1px solid var(--ink-100)", paddingTop:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--ink-500)", letterSpacing:"0.05em", textTransform:"uppercase", marginBottom:10 }}>
                    Desglose — de dónde se tomaron los kg
                  </div>
                  <table className="tbl" style={{ margin:0 }}>
                    <thead>
                      <tr>
                        <th>Contenedor</th>
                        <th>Folio</th>
                        <th>Fecha</th>
                        <th style={{ textAlign:"right" }}>Kg usados</th>
                        <th style={{ textAlign:"right" }}>Kg totales</th>
                        <th style={{ textAlign:"right" }}>% del total</th>
                        <th style={{ textAlign:"right" }}>USD/kg</th>
                        <th style={{ textAlign:"right" }}>MXN/kg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.breakdown.map((f, i) => {
                        const pct = (f.kgUsado / resultado.totalKg * 100);
                        return (
                          <tr key={i} style={{ background: i===0?"#F0F9FF":"white" }}>
                            <td className="mono text-xs">{f.contenedor}</td>
                            <td className="mono fw-600 text-sm">{f.folio}</td>
                            <td className="text-sm">{fmtFchCC(f.fecha)}</td>
                            <td style={{ textAlign:"right" }} className="mono fw-700">{fmtKgCC(f.kgUsado)}</td>
                            <td style={{ textAlign:"right" }} className="mono" style={{ color:"var(--ink-400)", textAlign:"right" }}>{fmtKgCC(f.kg)}</td>
                            <td style={{ textAlign:"right" }}>
                              <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:7 }}>
                                <div style={{ width:52, height:6, borderRadius:999, background:"var(--ink-100)", overflow:"hidden" }}>
                                  <div style={{ width:`${pct}%`, height:"100%", background:"var(--blue-500)", borderRadius:999 }} />
                                </div>
                                <span className="mono text-sm">{pct.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td style={{ textAlign:"right" }} className="mono fw-700" style={{ color:"var(--blue-500)", textAlign:"right" }}>{fmtUSD4(f.precioUSD)}</td>
                            <td style={{ textAlign:"right" }} className="mono fw-700">{fmtMXN(f.precioMXN)}</td>
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

      {/* Empty state */}
      {!activeSKU && (
        <div style={{ padding:"64px 32px", textAlign:"center", color:"var(--ink-400)", background:"white", borderRadius:12, border:"1px dashed var(--ink-200)" }}>
          <IconCC name="search" size={32} />
          <div style={{ marginTop:12, fontSize:16, fontWeight:700, color:"var(--ink-600)" }}>Busca un producto para comenzar</div>
          <div style={{ marginTop:6, fontSize:13 }}>Selecciona una mercancía para ver sus contenedores y calcular el costo promedio de tu stock.</div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// Historial de precios mock
// ════════════════════════════════════════════════════════════════════════════════
const HIST_PRECIOS = [
  { producto:"TILAPIA FILLET 95% BULK", marca:"BLUFIN",      talla:"5-7",    precios:[
    { mes:"Ago 2025", usd:3.280 },{ mes:"Oct 2025", usd:3.320 },{ mes:"Ene 2026", usd:3.420 },
    { mes:"Mar 2026", usd:3.460 },{ mes:"Abr 2026", usd:3.480 },{ mes:"May 2026", usd:3.480 },
  ]},
  { producto:"TILAPIA FILLET 90%",      marca:"KAYFISH",     talla:"5-7",    precios:[
    { mes:"Ago 2025", usd:3.050 },{ mes:"Oct 2025", usd:3.100 },{ mes:"Ene 2026", usd:3.170 },
    { mes:"Mar 2026", usd:3.200 },{ mes:"Abr 2026", usd:3.230 },{ mes:"May 2026", usd:3.230 },
  ]},
  { producto:"TILAPIA ENTERA 90%",      marca:"BLUFIN",      talla:"350-550",precios:[
    { mes:"Ago 2025", usd:1.950 },{ mes:"Oct 2025", usd:1.980 },{ mes:"Ene 2026", usd:2.010 },
    { mes:"Mar 2026", usd:2.020 },{ mes:"Abr 2026", usd:2.030 },{ mes:"May 2026", usd:2.090 },
  ]},
  { producto:"CAMARON CPUD 70%",        marca:"CHIAPANECO",  talla:"41-50",  precios:[
    { mes:"Ago 2025", usd:6.200 },{ mes:"Oct 2025", usd:6.350 },{ mes:"Ene 2026", usd:6.480 },
    { mes:"Mar 2026", usd:6.550 },{ mes:"May 2026", usd:6.630 },
  ]},
  { producto:"TILAPIA FILLET 95%",      marca:"BLUFIN",      talla:"3-5",    precios:[
    { mes:"Oct 2025", usd:3.350 },{ mes:"Ene 2026", usd:3.390 },
    { mes:"Mar 2026", usd:3.450 },{ mes:"Abr 2026", usd:3.480 },
  ]},
];

// ════════════════════════════════════════════════════════════════════════════════
// TAB 2 — Histórico de Precios
// ════════════════════════════════════════════════════════════════════════════════
const PreciosView = () => (
  <div>
    <div style={{ marginBottom:14, padding:"12px 16px", borderRadius:10, background:"#FFFBEB", border:"1px solid #FDE68A", fontSize:12, color:"#92400E" }}>
      <span className="fw-700">Tendencia de precios FOB (USD/kg)</span> — Evolución de precio por compra. Útil para negociar: si el proveedor sube más rápido que el mercado, es momento de cotizar con otros.
    </div>
    <div className="card">
      <table className="tbl">
        <thead>
          <tr>
            <th>Producto</th><th>Marca</th><th>Talla</th>
            {["Ago'25","Oct'25","Ene'26","Mar'26","Abr'26","May'26"].map(m=><th key={m} style={{ textAlign:"right" }}>{m}</th>)}
            <th style={{ textAlign:"right" }}>Cambio 6m</th>
          </tr>
        </thead>
        <tbody>
          {HIST_PRECIOS.map((p,i) => {
            const vals  = p.precios;
            const first = vals[0]?.usd;
            const last  = vals[vals.length-1]?.usd;
            const cambio= ((last-first)/first)*100;
            const meses = ["Ago 2025","Oct 2025","Ene 2026","Mar 2026","Abr 2026","May 2026"];
            return (
              <tr key={i}>
                <td className="fw-600 text-sm">{p.producto}</td>
                <td><span className="badge badge-gray" style={{ fontSize:10 }}>{p.marca}</span></td>
                <td className="mono text-sm">{p.talla}</td>
                {meses.map(m => {
                  const entry = p.precios.find(x => x.mes === m);
                  const idx   = p.precios.indexOf(entry);
                  const prev  = idx > 0 ? p.precios[idx-1] : null;
                  const up    = prev && entry && entry.usd > prev.usd;
                  const down  = prev && entry && entry.usd < prev.usd;
                  return (
                    <td key={m} style={{ textAlign:"right" }} className="mono">
                      {entry ? (
                        <span style={{ color: up?"#DC2626":down?"#059669":"var(--ink-700)", fontWeight:600 }}>
                          {up?"▲":down?"▼":""} ${entry.usd.toFixed(3)}
                        </span>
                      ) : <span className="muted">—</span>}
                    </td>
                  );
                })}
                <td style={{ textAlign:"right" }}>
                  <span style={{ padding:"2px 8px", borderRadius:999, fontSize:11, fontWeight:700,
                    background: cambio>3?"#FEE2E2":cambio>0?"#FEF3C7":"#D1FAE5",
                    color:      cambio>3?"#DC2626":cambio>0?"#92400E":"#065F46" }}>
                    {cambio>=0?"+":""}{cambio.toFixed(1)}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════════
// MAIN — CostosModule
// ════════════════════════════════════════════════════════════════════════════════
const COSTOS_TABS = [
  { id:"inventario", label:"Inventario & Costo Promedio", icon:"warehouse" },
  { id:"precios",    label:"Histórico de Precios",        icon:"sales"     },
];

const CostosModule = () => {
  const [tab, setTab] = useStateCC("inventario");
  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display:"flex", gap:2, borderBottom:"1px solid var(--ink-200)", marginBottom:20 }}>
        {COSTOS_TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:"9px 16px", fontSize:12, fontWeight:600, cursor:"pointer", border:"none", background:"transparent",
              color: active ? "var(--blue-500)" : "var(--ink-600)",
              borderBottom: active ? "2px solid var(--blue-500)" : "2px solid transparent",
              marginBottom:-1, display:"flex", alignItems:"center", gap:6, transition:"color 0.15s"
            }}>
              <IconCC name={t.icon} size={13} /> {t.label}
            </button>
          );
        })}
      </div>
      {tab === "inventario" && <InventarioView />}
      {tab === "precios"    && <PreciosView />}
    </div>
  );
};

Object.assign(window, { CostosModule });
