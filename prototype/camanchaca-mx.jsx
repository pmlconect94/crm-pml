// ============================================================
// Camanchaca México — Módulo MX
// Tabs: Compras | Pagos | Costos | Calendario
//
// MX es mucho más simple que SA:
//   - No hay planeación previa
//   - Todo en MXN con factura directa
//   - Entrada Intelisis, factura, SKUs, crédito 30 días
//   - Pagos parciales en MXN
// ============================================================

const { useState: useMXC, useMemo: useMemoMXC } = React;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtMXN_MX  = (n) => "$" + Number(n||0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFch_MX  = (s) => { if (!s) return "—"; const d = new Date(s + "T12:00:00"); return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }); };
const fmtKg_MX   = (n) => Number(n||0).toLocaleString("es-MX") + " kg";

const mxStatusBadge = (status) => {
  if (status === "Liquidada") return { bg: "#D1FAE5", color: "#065F46" };
  if (status === "Parcial")   return { bg: "#FEF3C7", color: "#92400E" };
  return { bg: "#FEE2E2", color: "#991B1B" };
};

// ── MX Compras — Lista + Detalle ─────────────────────────────────────────────
const MXCompras = () => {
  const data = window.CAMANCHACA_DATA;
  const [selected, setSelected] = useMXC(null);
  const [showNew,   setShowNew]  = useMXC(false);
  const [showAbono, setShowAbono] = useMXC(null); // folio de la compra a abonar

  // ── Estado formulario nueva compra ──
  const emptyForm = () => ({ folioInterno:"CAM-009", facturaNum:"", entradaIntelisis:"", fechaFactura:"" });
  const [newForm,  setNewForm]  = useMXC(emptyForm());
  const [lineas,   setLineas]   = useMXC([]);
  const setF = (k, v) => setNewForm(p => ({ ...p, [k]: v }));

  const addLinea    = ()        => setLineas(p => [...p, { code:"", kgCaja:0, cajas:"", precioMXN:"" }]);
  const removeLinea = (i)       => setLineas(p => p.filter((_, idx) => idx !== i));
  const updateLinea = (i, k, v) => setLineas(p => p.map((l, idx) => {
    if (idx !== i) return l;
    const up = { ...l, [k]: v };
    if (k === "code") up.kgCaja = (window.CAMANCHACA_DATA.skus.find(s => s.code === v)?.kgCaja) || 0;
    return up;
  }));

  const totalKg  = lineas.reduce((s, l) => s + (parseFloat(l.cajas)||0) * (l.kgCaja||0), 0);
  const totalMXN = lineas.reduce((s, l) => s + (parseFloat(l.cajas)||0) * (l.kgCaja||0) * (parseFloat(l.precioMXN)||0), 0);
  const vencAuto = newForm.fechaFactura ? (() => { const d = new Date(newForm.fechaFactura+"T12:00:00"); d.setDate(d.getDate()+30); return d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"}); })() : "—";
  const formStep1Valid = newForm.facturaNum && newForm.entradaIntelisis && newForm.fechaFactura;
  const [mxStep, setMxStep] = useMXC(1);

  const compras = data.comprasMX;
  const totalPendiente = compras.reduce((s, c) => s + c.saldoPendiente, 0);
  const totalVencido   = compras.filter(c => {
    if (!c.fechaVencimiento || c.status === "Liquidada") return false;
    return new Date(c.fechaVencimiento) < new Date();
  }).reduce((s, c) => s + c.saldoPendiente, 0);

  if (selected) {
    const c = compras.find(x => x.folioInterno === selected);
    if (!c) return null;
    const totalPagado = c.pagos.reduce((s, p) => s + p.monto, 0);
    const pct         = c.totalMXN ? (totalPagado / c.totalMXN * 100) : 0;
    const sc          = mxStatusBadge(c.status);
    const hoy         = new Date();
    const venc        = new Date(c.fechaVencimiento + "T12:00:00");
    const diasRestantes = Math.ceil((venc - hoy) / 86400000);

    return (
      <div>
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => setSelected(null)}>
          <Icon name="chevLeft" size={13}/> Regresar a compras
        </button>

        {/* Header */}
        <div className="card" style={{ padding: "18px 22px", marginBottom: 16, background: "linear-gradient(135deg, #F0FDF4 0%, #F9FAFB 100%)", border: "1px solid #BBF7D0" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: "var(--ink-900)", fontFamily: "var(--font-mono)" }}>{c.folioInterno}</span>
                <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>{c.status}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-600)", display: "flex", gap: 20, flexWrap: "wrap" }}>
                <span><span className="fw-600">Factura:</span> {c.facturaNum}</span>
                <span><span className="fw-600">Intelisis:</span> {c.entradaIntelisis}</span>
                <span><span className="fw-600">Fecha:</span> {fmtFch_MX(c.fechaFactura)}</span>
                <span><span className="fw-600">Vence:</span> {fmtFch_MX(c.fechaVencimiento)}
                  {c.status !== "Liquidada" && (
                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: diasRestantes < 0 ? "var(--red-500)" : diasRestantes < 5 ? "var(--amber-500)" : "var(--green-500)" }}>
                      ({diasRestantes < 0 ? `${Math.abs(diasRestantes)}d vencida` : `${diasRestantes}d restantes`})
                    </span>
                  )}
                </span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "var(--ink-500)", marginBottom: 2 }}>Total factura</div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "var(--font-mono)", color: "var(--green-500)" }}>{fmtMXN_MX(c.totalMXN)}</div>
              <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>MXN · Camanchaca México</div>
            </div>
          </div>

          {/* Barra de pago */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-500)", marginBottom: 6 }}>
              <span>Pagado: {fmtMXN_MX(totalPagado)}</span>
              <span>Pendiente: {fmtMXN_MX(c.saldoPendiente)}</span>
            </div>
            <div style={{ height: 6, background: "var(--ink-100)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? "var(--green-500)" : "var(--blue-500)", borderRadius: 999, transition: "width 0.4s" }}/>
            </div>
          </div>
        </div>

        {/* Productos */}
        <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", fontSize: 12, fontWeight: 700, color: "var(--ink-700)" }}>Productos</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Código</th><th>Descripción</th>
                <th style={{ textAlign: "right" }}>kg/Caja</th>
                <th style={{ textAlign: "right" }}>Cajas</th>
                <th style={{ textAlign: "right" }}>Kg</th>
                <th style={{ textAlign: "right" }}>MXN/kg</th>
                <th style={{ textAlign: "right" }}>Total MXN</th>
              </tr>
            </thead>
            <tbody>
              {c.productos.map((p, i) => (
                <tr key={i}>
                  <td className="mono fw-600">{p.code}</td>
                  <td className="fw-600 text-sm">{p.desc}</td>
                  <td style={{ textAlign: "right" }} className="mono">{p.kgCaja.toFixed(2)}</td>
                  <td style={{ textAlign: "right" }} className="mono">{p.cajas.toLocaleString()}</td>
                  <td style={{ textAlign: "right" }} className="mono fw-600">{fmtKg_MX(p.kg)}</td>
                  <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "var(--green-500)", textAlign: "right" }}>{fmtMXN_MX(p.precioMXN)}</td>
                  <td style={{ textAlign: "right" }} className="mono fw-700">{fmtMXN_MX(p.totalMXN)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--ink-50)" }}>
                <td colSpan={4} className="fw-700">TOTAL</td>
                <td style={{ textAlign: "right" }} className="mono fw-700">{fmtKg_MX(c.productos.reduce((s, p) => s + p.kg, 0))}</td>
                <td></td>
                <td style={{ textAlign: "right" }} className="mono fw-800" style={{ color: "var(--green-500)", textAlign: "right", fontSize: 14 }}>{fmtMXN_MX(c.totalMXN)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagos */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-700)" }}>Pagos</span>
            {c.status !== "Liquidada" && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowAbono(c.folioInterno)}><Icon name="plus" size={12}/> Registrar abono</button>
            )}
          </div>
          {c.pagos.length > 0 ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>ID</th>
                  <th style={{ textAlign: "right" }}>Monto MXN</th>
                  <th>Banco</th><th>Referencia</th><th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {c.pagos.map(p => (
                  <tr key={p.id}>
                    <td className="mono text-xs">{p.id}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "var(--green-500)", textAlign: "right" }}>{fmtMXN_MX(p.monto)}</td>
                    <td className="text-sm">{p.banco}</td>
                    <td className="mono text-xs">{p.referencia}</td>
                    <td className="text-sm">{fmtFch_MX(p.fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: "28px", textAlign: "center", color: "var(--ink-400)", fontSize: 13 }}>Sin pagos registrados</div>
          )}
        </div>
      {showAbono && <MXAbonoModal folioPrefill={showAbono===true?null:showAbono} onClose={() => setShowAbono(false)}/>}
      {showNC    && <MXNcModal    onClose={() => setShowNC(false)}/>}
      </div>
    );
  }

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Facturas",         value: compras.length,              sub: "total historial",      color: null },
          { label: "Pendiente pago",   value: fmtMXN_MX(totalPendiente),  sub: "MXN por liquidar",     color: "var(--amber-500)" },
          { label: "Vencido",          value: fmtMXN_MX(totalVencido),    sub: "MXN con atraso",       color: totalVencido > 0 ? "var(--red-500)" : "var(--ink-400)" },
          { label: "Crédito estándar", value: "30 días",                   sub: "Camanchaca México",    color: null },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color || "var(--ink-900)", fontFamily: "var(--font-mono)" }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "var(--ink-400)", marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-700)" }}>Compras — Camanchaca México, S.A. de C.V.</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
            <Icon name="plus" size={12}/> Nueva compra
          </button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Folio</th><th>Factura</th><th>Intelisis</th>
              <th>Fecha</th><th>Vence</th>
              <th style={{ textAlign: "right" }}>Total MXN</th>
              <th style={{ textAlign: "right" }}>Saldo</th>
              <th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {compras.map(c => {
              const sc = mxStatusBadge(c.status);
              const venc = new Date(c.fechaVencimiento + "T12:00:00");
              const vencida = c.status !== "Liquidada" && venc < new Date();
              return (
                <tr key={c.folioInterno} style={{ cursor: "pointer" }} onClick={() => setSelected(c.folioInterno)}>
                  <td className="mono fw-700">{c.folioInterno}</td>
                  <td className="mono text-sm">{c.facturaNum}</td>
                  <td className="mono text-xs" style={{ color: "var(--ink-500)" }}>{c.entradaIntelisis}</td>
                  <td className="text-sm">{fmtFch_MX(c.fechaFactura)}</td>
                  <td className="text-sm" style={{ color: vencida ? "var(--red-500)" : "inherit", fontWeight: vencida ? 700 : 400 }}>
                    {fmtFch_MX(c.fechaVencimiento)}
                  </td>
                  <td style={{ textAlign: "right" }} className="mono fw-600">{fmtMXN_MX(c.totalMXN)}</td>
                  <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: c.saldoPendiente > 0 ? "var(--amber-500)" : "var(--ink-400)", textAlign: "right" }}>
                    {c.saldoPendiente > 0 ? fmtMXN_MX(c.saldoPendiente) : "—"}
                  </td>
                  <td>
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.color }}>{c.status}</span>
                  </td>
                  <td><Icon name="chevRight" size={13} style={{ color: "var(--ink-400)" }}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal nueva compra — 2 pasos */}
      {showAbono && <MXAbonoModal folioPrefill={showAbono} onClose={() => setShowAbono(null)}/>}
      {showNew && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={e => { if(e.target===e.currentTarget){ setShowNew(false); setMxStep(1); setLineas([]); setNewForm(emptyForm()); }}}>
          <div style={{ background:"white", borderRadius:16, padding:28, width: mxStep===2?760:540, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,0.25)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:800 }}>Nueva compra — Camanchaca México</div>
                <div style={{ fontSize:12, color:"var(--ink-500)", marginTop:3 }}>Factura en MXN · Crédito 30 días · Intelisis</div>
              </div>
              <button onClick={()=>{ setShowNew(false); setMxStep(1); setLineas([]); setNewForm(emptyForm()); }} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-400)", fontSize:20 }}>✕</button>
            </div>

            {/* Step tabs */}
            <div style={{ display:"flex", marginBottom:20, borderRadius:8, overflow:"hidden", border:"1px solid var(--ink-200)" }}>
              {[{n:1,label:"① Datos generales"},{n:2,label:"② Productos (SKUs)"}].map(s => (
                <button key={s.n} onClick={()=>{ if(s.n===2&&formStep1Valid) setMxStep(2); if(s.n===1) setMxStep(1); }}
                  style={{ flex:1, padding:"9px 0", fontSize:12.5, fontWeight:600, cursor:"pointer", border:"none",
                    background: mxStep===s.n?"var(--green-500)":"white",
                    color: mxStep===s.n?"white": formStep1Valid||s.n===1?"var(--ink-700)":"var(--ink-300)",
                    borderRight: s.n===1?"1px solid var(--ink-200)":"none" }}>{s.label}</button>
              ))}
            </div>

            {/* Paso 1 */}
            {mxStep===1 && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <div>
                  <label className="field-label">Folio interno (auto)</label>
                  <input className="field-input" value={newForm.folioInterno} disabled style={{ background:"var(--ink-50)", fontFamily:"var(--font-mono)", fontWeight:700 }}/>
                </div>
                <div>
                  <label className="field-label">Número de factura <span style={{ color:"var(--red-500)" }}>*</span></label>
                  <input className="field-input" value={newForm.facturaNum} onChange={e=>setF("facturaNum",e.target.value)} placeholder="MX-9800"/>
                </div>
                <div>
                  <label className="field-label">Entrada Intelisis <span style={{ color:"var(--red-500)" }}>*</span></label>
                  <input className="field-input" value={newForm.entradaIntelisis} onChange={e=>setF("entradaIntelisis",e.target.value)} placeholder="EI-2026-0900"/>
                </div>
                <div>
                  <label className="field-label">Fecha de factura <span style={{ color:"var(--red-500)" }}>*</span></label>
                  <input className="field-input" type="date" value={newForm.fechaFactura} onChange={e=>setF("fechaFactura",e.target.value)}/>
                </div>
                {newForm.fechaFactura && (
                  <div style={{ gridColumn:"1/-1", padding:"10px 14px", background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:9, fontSize:12, color:"#065F46" }}>
                    📅 Vencimiento automático (30 días): <strong>{vencAuto}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Paso 2 — SKUs */}
            {mxStep===2 && (
              <div>
                {lineas.length===0 && (
                  <div style={{ padding:"32px", textAlign:"center", border:"1px dashed var(--ink-200)", borderRadius:10, color:"var(--ink-400)", marginBottom:14 }}>
                    <Icon name="pkg" size={28}/>
                    <div style={{ marginTop:8, fontSize:13 }}>Agrega los productos de la factura</div>
                    <button className="btn btn-primary" style={{ marginTop:12 }} onClick={addLinea}><Icon name="plus" size={12}/> Agregar primera línea</button>
                  </div>
                )}
                {lineas.map((l,i) => {
                  const kg  = (parseFloat(l.cajas)||0)*(l.kgCaja||0);
                  const tot = kg*(parseFloat(l.precioMXN)||0);
                  return (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"2fr 70px 80px 110px 100px 28px", gap:8, alignItems:"end", marginBottom:10, padding:"12px 14px", background:"var(--ink-50)", borderRadius:10 }}>
                      <div>
                        <label className="field-label" style={{ fontSize:10, marginBottom:4 }}>SKU</label>
                        <select className="field-input" style={{ fontSize:12 }} value={l.code} onChange={e=>updateLinea(i,"code",e.target.value)}>
                          <option value="">— Seleccionar SKU —</option>
                          {window.CAMANCHACA_DATA.skus.map(s=><option key={s.code} value={s.code}>{s.code} · {s.desc}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="field-label" style={{ fontSize:10, marginBottom:4 }}>kg/Caja</label>
                        <input className="field-input" value={l.kgCaja||""} readOnly style={{ background:"var(--ink-100)", fontSize:12, cursor:"default", textAlign:"right", fontFamily:"var(--font-mono)" }}/>
                      </div>
                      <div>
                        <label className="field-label" style={{ fontSize:10, marginBottom:4 }}>Cajas</label>
                        <input className="field-input" type="number" min="0" value={l.cajas} onChange={e=>updateLinea(i,"cajas",e.target.value)} style={{ fontSize:12, textAlign:"right", fontFamily:"var(--font-mono)" }}/>
                      </div>
                      <div>
                        <label className="field-label" style={{ fontSize:10, marginBottom:4 }}>MXN/kg</label>
                        <input className="field-input" type="number" step="0.01" min="0" value={l.precioMXN} onChange={e=>updateLinea(i,"precioMXN",e.target.value)} style={{ fontSize:12, textAlign:"right", fontFamily:"var(--font-mono)" }}/>
                      </div>
                      <div>
                        <label className="field-label" style={{ fontSize:10, marginBottom:4 }}>Total MXN</label>
                        <div style={{ padding:"8px 10px", background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:8, fontSize:12, fontWeight:700, fontFamily:"var(--font-mono)", color:"var(--green-500)", textAlign:"right" }}>
                          ${tot.toLocaleString("es-MX",{minimumFractionDigits:2})}
                        </div>
                      </div>
                      <button onClick={()=>removeLinea(i)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--red-500)", fontSize:18, lineHeight:1, padding:0, marginBottom:4 }}>✕</button>
                    </div>
                  );
                })}
                {lineas.length>0 && (
                  <button className="btn btn-outline btn-sm" onClick={addLinea} style={{ marginBottom:14 }}>
                    <Icon name="plus" size={12}/> Agregar línea
                  </button>
                )}
                {lineas.some(l=>l.code) && (
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px", background:"var(--ink-900)", borderRadius:10 }}>
                    <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)" }}>
                      {lineas.filter(l=>l.code).length} SKUs · {Number(totalKg).toLocaleString("es-MX")} kg
                    </div>
                    <div style={{ fontSize:22, fontWeight:900, fontFamily:"var(--font-mono)", color:"white" }}>
                      ${totalMXN.toLocaleString("es-MX",{minimumFractionDigits:2})}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:22, paddingTop:16, borderTop:"1px solid var(--ink-100)" }}>
              <button className="btn btn-ghost" onClick={()=>{ setShowNew(false); setMxStep(1); setLineas([]); setNewForm(emptyForm()); }}>Cancelar</button>
              {mxStep===1
                ? <button className="btn btn-primary" onClick={()=>setMxStep(2)} disabled={!formStep1Valid}>
                    Siguiente: SKUs <Icon name="arrowRight" size={13}/>
                  </button>
                : <><button className="btn btn-ghost" onClick={()=>setMxStep(1)}><Icon name="chevLeft" size={13}/> Anterior</button>
                   <button className="btn btn-primary" onClick={()=>{ setShowNew(false); setMxStep(1); setLineas([]); setNewForm(emptyForm()); }} disabled={!lineas.some(l=>l.code)}>
                     <Icon name="check" size={13}/> Guardar compra
                   </button></>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── MX Pagos globales ─────────────────────────────────────────────────────────
const MXPagosGlobal = () => {
  const data   = window.CAMANCHACA_DATA;
  const [showAbono, setShowAbono] = useMXC(false);
  const [showNC,    setShowNC]    = useMXC(false);
  const pagos  = data.comprasMX.flatMap(c => c.pagos.map(p => ({ ...p, folio: c.folioInterno, factura: c.facturaNum })));
  const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
  const pendiente   = data.comprasMX.reduce((s, c) => s + c.saldoPendiente, 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total pagado (historial)", value: fmtMXN_MX(totalPagado), color: "var(--green-500)" },
          { label: "Saldo pendiente",           value: fmtMXN_MX(pendiente),  color: "var(--amber-500)" },
          { label: "Pagos registrados",         value: pagos.length,           color: null },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color || "var(--ink-900)", fontFamily: "var(--font-mono)" }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-700)" }}>Todos los pagos — Camanchaca México</span>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn btn-accent btn-sm" onClick={() => setShowNC(true)}><Icon name="plus" size={12}/> Nueva NC</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAbono(true)}><Icon name="plus" size={12}/> Registrar abono</button>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>Folio</th><th>Factura</th><th>ID Pago</th><th style={{ textAlign: "right" }}>Monto MXN</th><th>Banco</th><th>Referencia</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            {pagos.map(p => (
              <tr key={p.id}>
                <td className="mono fw-700">{p.folio}</td>
                <td className="mono text-sm">{p.factura}</td>
                <td className="mono text-xs" style={{ color: "var(--ink-500)" }}>{p.id}</td>
                <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "var(--green-500)", textAlign: "right" }}>{fmtMXN_MX(p.monto)}</td>
                <td className="text-sm">{p.banco}</td>
                <td className="mono text-xs">{p.referencia}</td>
                <td className="text-sm">{fmtFch_MX(p.fecha)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAbono && <MXAbonoModal onClose={() => setShowAbono(false)}/>}
    </div>
  );
};

// ── MXAbonoModal — Registrar abono en MXN ────────────────────────────────
const MXAbonoModal = ({ folioPrefill, onClose }) => {
  const data    = window.CAMANCHACA_DATA;
  const pending = data.comprasMX.filter(c => c.status !== "Liquidada");
  const [form, setForm] = useMXC({ folio: folioPrefill || "", monto: "", banco: "", referencia: "", fecha: "" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.folio && parseFloat(form.monto) > 0 && form.banco && form.fecha;

  const handleSave = () => {
    const c = data.comprasMX.find(x => x.folioInterno === form.folio);
    if (!c) return;
    const monto = parseFloat(form.monto);
    c.pagos.push({ id: `MX-PAG-${Date.now()}`, monto, fecha: form.fecha, banco: form.banco, referencia: form.referencia });
    const totalPagado = c.pagos.reduce((s, p) => s + p.monto, 0);
    c.saldoPendiente = Math.max(0, c.totalMXN - totalPagado);
    c.status = c.saldoPendiente === 0 ? "Liquidada" : "Parcial";
    window.camRefresh();
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"white", borderRadius:16, padding:28, width:480, boxShadow:"0 24px 64px rgba(0,0,0,0.25)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800 }}>Registrar abono</div>
            <div style={{ fontSize:12, color:"var(--ink-500)", marginTop:3 }}>Camanchaca México S.A. de C.V. · Pago en MXN</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-400)", fontSize:20 }}>✕</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label className="field-label">Factura a abonar <span style={{ color:"var(--red-500)" }}>*</span></label>
            <select className="field-input" value={form.folio} onChange={e=>set("folio",e.target.value)} disabled={!!folioPrefill} style={{ background: folioPrefill ? "var(--ink-50)" : "white" }}>
              <option value="">— Seleccionar —</option>
              {pending.map(c => <option key={c.folioInterno} value={c.folioInterno}>
                {c.folioInterno} · {c.facturaNum} · Saldo: ${c.saldoPendiente.toLocaleString("es-MX",{minimumFractionDigits:2})}
              </option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Monto MXN <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" type="number" step="100" value={form.monto} onChange={e=>set("monto",e.target.value)} placeholder="Ej: 100000"/>
          </div>
          <div>
            <label className="field-label">Fecha <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" type="date" value={form.fecha} onChange={e=>set("fecha",e.target.value)}/>
          </div>
          <div>
            <label className="field-label">Banco <span style={{ color:"var(--red-500)" }}>*</span></label>
            <select className="field-input" value={form.banco} onChange={e=>set("banco",e.target.value)}>
              <option value="">—</option>
              {data.bancos.map(b=><option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label className="field-label">Referencia</label>
            <input className="field-input" value={form.referencia} onChange={e=>set("referencia",e.target.value)} placeholder="TRF-44000"/>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!valid}>
            <Icon name="check" size={13}/> Registrar abono
          </button>
        </div>
      </div>
    </div>
  );
};

// ── MXNcModal — NC por descuento en MXN ───────────────────────────────────
const MXNcModal = ({ folioPrefill, onClose }) => {
  const data    = window.CAMANCHACA_DATA;
  const compras = data.comprasMX;
  const [form, setForm] = useMXC({ folio: folioPrefill||"", montoMXN:"", motivo:"", fecha:"" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.folio && parseFloat(form.montoMXN)>0 && form.motivo && form.fecha;

  const fmtMXN_NC = (n) => "$" + Number(n||0).toLocaleString("es-MX", { minimumFractionDigits:2, maximumFractionDigits:2 });

  const handleSave = () => {
    const c = data.comprasMX.find(x => x.folioInterno === form.folio);
    if (!c) return;
    if (!c.nc) c.nc = [];
    const monto = parseFloat(form.montoMXN);
    c.nc.push({ id:`NC-MX-${Date.now()}`, montoMXN:monto, motivo:form.motivo, fecha:form.fecha, status:"Aplicada" });
    // Actualizar saldo: se descuenta del total
    c.saldoPendiente = Math.max(0, c.saldoPendiente - monto);
    if (c.saldoPendiente <= 0) c.status = "Liquidada";
    window.camRefresh();
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"white", borderRadius:16, padding:28, width:500, boxShadow:"0 24px 64px rgba(0,0,0,0.25)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
          <div><div style={{ fontSize:16, fontWeight:800 }}>Nota de crédito por descuento</div>
            <div style={{ fontSize:12, color:"var(--ink-500)", marginTop:3 }}>Camanchaca México S.A. de C.V. · Descuento en MXN</div></div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-400)", fontSize:20 }}>✕</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label className="field-label">Compra / Factura <span style={{ color:"var(--red-500)" }}>*</span></label>
            <select className="field-input" value={form.folio} onChange={e=>set("folio",e.target.value)} disabled={!!folioPrefill} style={{ background:folioPrefill?"var(--ink-50)":"white" }}>
              <option value="">— Seleccionar —</option>
              {compras.map(c => <option key={c.folioInterno} value={c.folioInterno}>{c.folioInterno} · {c.facturaNum} · {fmtMXN_NC(c.totalMXN)}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Monto MXN <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" type="number" step="100" value={form.montoMXN} onChange={e=>set("montoMXN",e.target.value)} placeholder="5000"/>
          </div>
          <div>
            <label className="field-label">Fecha <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" type="date" value={form.fecha} onChange={e=>set("fecha",e.target.value)}/>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label className="field-label">Motivo <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" value={form.motivo} onChange={e=>set("motivo",e.target.value)} placeholder="Ej: Diferencia de peso, calidad..."/>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={handleSave} disabled={!valid}><Icon name="check" size={13}/> Aplicar NC</button>
        </div>
      </div>
    </div>
  );
};



