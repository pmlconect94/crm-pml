// ============================================================
// Camanchaca SA — Recepción en bodega
// Aplica solo a SA (contenedores del exterior).
// MX no tiene módulo de recepción separado.
//
// Flujo:
//   1. Seleccionar contenedor SA con status "En Manzanillo" o "En tránsito"
//   2. Capturar kg recibidos por SKU vs kg contratados
//   3. Registrar diferencias y notas
// ============================================================

const { useState: useRecC, useEffect: useEffRec } = React;

const fmtFch_Rec = (s) => { if (!s) return "—"; const d = new Date(s + "T12:00:00"); return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }); };
const fmtKg_Rec  = (n) => Number(n||0).toLocaleString("es-MX") + " kg";

// ── RegistrarRecepcionModal ──────────────────────────────────────────────────
const RegistrarRecepcionModal = ({ folioPrefill, onClose }) => {
  const data     = window.CAMANCHACA_DATA;
  const BODEGAS  = ["FRIOMEX", "JALNAY", "ALMACEN GENERAL"];
  const pendientes = data.contenedoresSA.filter(c => c.factura && !c.recepcion && c.productos.length > 0);

  const [folio,  setFolio]  = useRecC(folioPrefill || "");
  const [fecha,  setFecha]  = useRecC("");
  const [bodega, setBodega] = useRecC("");
  const [lineas, setLineas] = useRecC([]);

  const cont = data.contenedoresSA.find(c => c.folioInterno === folio);

  // Cuando cambia el folio, inicializar lineas desde los productos del contenedor
  useEffRec(() => {
    if (cont && cont.productos.length > 0) {
      setLineas(cont.productos.map(p => ({ code: p.code, desc: p.desc, kgContratados: p.kg, kgRecibidos: "" })));
    } else {
      setLineas([]);
    }
  }, [folio]);

  const updateKg = (i, val) => setLineas(p => p.map((l, idx) => idx === i ? { ...l, kgRecibidos: val } : l));
  const totalContrat = lineas.reduce((s, l) => s + l.kgContratados, 0);
  const totalRecib   = lineas.reduce((s, l) => s + (parseFloat(l.kgRecibidos)||0), 0);
  const diferencia   = totalRecib - totalContrat;
  const valid = folio && fecha && bodega && lineas.length > 0 && lineas.every(l => l.kgRecibidos !== "");

  const handleSave = () => {
    const c = data.contenedoresSA.find(x => x.folioInterno === folio);
    if (!c) return;
    c.recepcion = {
      fecha, bodega,
      lineas: lineas.map(l => ({
        code: l.code, kgContratados: l.kgContratados,
        kgRecibidos: parseFloat(l.kgRecibidos),
        diferencia: parseFloat(l.kgRecibidos) - l.kgContratados,
      })),
    };
    c.status = "Entregado";
    window.camRefresh();
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"white", borderRadius:16, padding:28, width:640, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,0.25)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div><div style={{ fontSize:16, fontWeight:800 }}>Registrar recepción en bodega</div>
            <div style={{ fontSize:12, color:"var(--ink-500)", marginTop:3 }}>Salmones Camanchaca S.A. · Match de kg por SKU</div></div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-400)", fontSize:20 }}>✕</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:20 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label className="field-label">Contenedor <span style={{ color:"var(--red-500)" }}>*</span></label>
            <select className="field-input" value={folio} onChange={e=>setFolio(e.target.value)} disabled={!!folioPrefill} style={{ background: folioPrefill?"var(--ink-50)":"white" }}>
              <option value="">— Seleccionar —</option>
              {pendientes.map(c => <option key={c.folioInterno} value={c.folioInterno}>{c.folioInterno} · Fac.{c.factura} · {(c.totalKg||0).toLocaleString()} kg</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Fecha de recepción <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/>
          </div>
          <div style={{ gridColumn:"2/-1" }}>
            <label className="field-label">Bodega <span style={{ color:"var(--red-500)" }}>*</span></label>
            <select className="field-input" value={bodega} onChange={e=>setBodega(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {BODEGAS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        {/* Líneas por SKU */}
        {lineas.length > 0 && (
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-700)", marginBottom:10 }}>Kg recibidos por SKU</div>
            <div className="card" style={{ padding:0, overflow:"hidden", marginBottom:16 }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Código</th><th>Descripción</th>
                    <th style={{ textAlign:"right" }}>Kg contratados</th>
                    <th style={{ textAlign:"right" }}>Kg recibidos</th>
                    <th style={{ textAlign:"right" }}>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => {
                    const rec = parseFloat(l.kgRecibidos)||0;
                    const dif = rec - l.kgContratados;
                    return (
                      <tr key={i}>
                        <td className="mono fw-600">{l.code}</td>
                        <td className="text-sm fw-600">{l.desc}</td>
                        <td style={{ textAlign:"right" }} className="mono">{fmtKg_Rec(l.kgContratados)}</td>
                        <td style={{ textAlign:"right" }}>
                          <input type="number" step="0.1" min="0" value={l.kgRecibidos} onChange={e=>updateKg(i,e.target.value)}
                            style={{ width:110, padding:"5px 8px", borderRadius:7, border:"1.5px solid var(--ink-300)", fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, textAlign:"right" }}
                          />
                        </td>
                        <td style={{ textAlign:"right" }} className="mono fw-700" style={{ color: dif===0?"var(--ink-400)":dif<0?"var(--amber-500)":"var(--green-500)", textAlign:"right" }}>
                          {l.kgRecibidos!=="" ? (dif>=0?"+":"")+fmtKg_Rec(dif) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background:"var(--ink-50)" }}>
                    <td colSpan={2} className="fw-700">TOTAL</td>
                    <td style={{ textAlign:"right" }} className="mono fw-700">{fmtKg_Rec(totalContrat)}</td>
                    <td style={{ textAlign:"right" }} className="mono fw-700">{totalRecib>0?fmtKg_Rec(totalRecib):"—"}</td>
                    <td style={{ textAlign:"right" }} className="mono fw-800" style={{ color: diferencia===0?"var(--green-500)":"var(--amber-500)", textAlign:"right", fontSize:14 }}>
                      {totalRecib>0?(diferencia>=0?"+":"")+fmtKg_Rec(diferencia):"—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {!folio && (
          <div style={{ padding:"24px", textAlign:"center", color:"var(--ink-400)", border:"1px dashed var(--ink-200)", borderRadius:10, marginBottom:16 }}>
            Selecciona un contenedor para ver sus SKUs y capturar los kg recibidos.
          </div>
        )}

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!valid}>
            <Icon name="check" size={13}/> Guardar recepción
          </button>
        </div>
      </div>
    </div>
  );
};


const CamanchacaRecepcion = () => {
  const data   = window.CAMANCHACA_DATA;
  const skuDesc = (code) => data.skus.find(s => s.code === code)?.desc || "—";
  const [view, setView] = useRecC("historial"); // historial | nueva
  const [selectedFolio, setSelectedFolio] = useRecC(null);
  const [showRecepForm, setShowRecepForm] = useRecC(null); // folio a recibir

  // Contenedores ya recibidos (con recepcion registrada)
  const recibidos  = data.contenedoresSA.filter(c => c.recepcion);
  // Contenedores pendientes de recepción
  const pendientes = data.contenedoresSA.filter(c => !c.recepcion && c.factura && (c.status === "En tránsito" || c.status === "En Manzanillo" || c.status === "Entregado"));

  if (selectedFolio) {
    const c   = data.contenedoresSA.find(x => x.folioInterno === selectedFolio);
    const rec = c?.recepcion;
    if (!c || !rec) return null;
    const totalContrat = rec.lineas.reduce((s, l) => s + l.kgContratados, 0);
    const totalRecib   = rec.lineas.reduce((s, l) => s + l.kgRecibidos, 0);
    const diferencia   = totalRecib - totalContrat;

    return (
      <div>
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => setSelectedFolio(null)}>
          <Icon name="chevLeft" size={13}/> Regresar
        </button>
        <div className="card" style={{ padding: "18px 22px", marginBottom: 16, background: "linear-gradient(135deg, #F0FDF4 0%, #F9FAFB 100%)", border: "1px solid #BBF7D0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{c.folioInterno} — Recepción</div>
              <div style={{ fontSize: 13, color: "var(--ink-600)", display: "flex", gap: 20, flexWrap: "wrap" }}>
                <span><span className="fw-600">Factura:</span> {c.factura}</span>
                <span><span className="fw-600">Fecha recepción:</span> {fmtFch_Rec(rec.fecha)}</span>
                <span><span className="fw-600">Bodega:</span> {rec.bodega}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "var(--ink-500)" }}>Diferencia total</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: diferencia === 0 ? "var(--green-500)" : diferencia < 0 ? "var(--amber-500)" : "var(--blue-500)", fontFamily: "var(--font-mono)" }}>
                {diferencia >= 0 ? "+" : ""}{fmtKg_Rec(diferencia)}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", fontSize: 12, fontWeight: 700 }}>Detalle por SKU</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th style={{ textAlign: "right" }}>Kg contratados</th>
                <th style={{ textAlign: "right" }}>Kg recibidos</th>
                <th style={{ textAlign: "right" }}>Diferencia</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {rec.lineas.map((l, i) => {
                const dif = l.kgRecibidos - l.kgContratados;
                return (
                  <tr key={i}>
                    <td className="mono fw-600">{l.code}</td>
                    <td className="text-sm fw-600">{skuDesc(l.code)}</td>
                    <td style={{ textAlign: "right" }} className="mono">{fmtKg_Rec(l.kgContratados)}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-700">{fmtKg_Rec(l.kgRecibidos)}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: dif === 0 ? "var(--ink-400)" : dif < 0 ? "var(--amber-500)" : "var(--green-500)", textAlign: "right" }}>
                      {dif >= 0 ? "+" : ""}{fmtKg_Rec(dif)}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--ink-500)" }}>{l.observaciones || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--ink-50)" }}>
                <td className="fw-700" colSpan={2}>TOTAL</td>
                <td style={{ textAlign: "right" }} className="mono fw-700">{fmtKg_Rec(totalContrat)}</td>
                <td style={{ textAlign: "right" }} className="mono fw-700">{fmtKg_Rec(totalRecib)}</td>
                <td style={{ textAlign: "right" }} className="mono fw-800" style={{ color: diferencia === 0 ? "var(--green-500)" : "var(--amber-500)", textAlign: "right", fontSize: 14 }}>
                  {diferencia >= 0 ? "+" : ""}{fmtKg_Rec(diferencia)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--ink-200)", marginBottom: 16 }}>
        {[{ id: "historial", label: `Historial (${recibidos.length})` }, { id: "nueva", label: `Pendientes (${pendientes.length})` }].map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: "none", background: "transparent",
            color: view === t.id ? "var(--blue-500)" : "var(--ink-600)",
            borderBottom: view === t.id ? "2px solid var(--blue-500)" : "2px solid transparent",
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Historial */}
      {view === "historial" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", fontSize: 12, fontWeight: 700, color: "var(--ink-700)" }}>
            Recepciones registradas
          </div>
          {recibidos.length > 0 ? (
            <table className="tbl">
              <thead>
                <tr><th>Folio</th><th>Factura</th><th>Fecha recepción</th><th>Bodega</th><th style={{ textAlign: "right" }}>Kg contratados</th><th style={{ textAlign: "right" }}>Kg recibidos</th><th style={{ textAlign: "right" }}>Diferencia</th><th></th></tr>
              </thead>
              <tbody>
                {recibidos.map(c => {
                  const rec = c.recepcion;
                  const kgC = rec.lineas.reduce((s, l) => s + l.kgContratados, 0);
                  const kgR = rec.lineas.reduce((s, l) => s + l.kgRecibidos, 0);
                  const dif = kgR - kgC;
                  return (
                    <tr key={c.folioInterno} style={{ cursor: "pointer" }} onClick={() => setSelectedFolio(c.folioInterno)}>
                      <td className="mono fw-700">{c.folioInterno}</td>
                      <td className="mono text-sm">{c.factura}</td>
                      <td className="text-sm">{fmtFch_Rec(rec.fecha)}</td>
                      <td className="text-sm">{rec.bodega}</td>
                      <td style={{ textAlign: "right" }} className="mono">{fmtKg_Rec(kgC)}</td>
                      <td style={{ textAlign: "right" }} className="mono fw-700">{fmtKg_Rec(kgR)}</td>
                      <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: dif === 0 ? "var(--ink-400)" : dif < 0 ? "var(--amber-500)" : "var(--green-500)", textAlign: "right" }}>
                        {dif >= 0 ? "+" : ""}{fmtKg_Rec(dif)}
                      </td>
                      <td><Icon name="chevRight" size={13} style={{ color: "var(--ink-400)" }}/></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-400)", fontSize: 13 }}>Sin recepciones registradas</div>
          )}
        </div>
      )}

      {/* Pendientes */}
      {view === "nueva" && (
        <div>
          {pendientes.length > 0 ? (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", fontSize: 12, fontWeight: 700, color: "var(--ink-700)" }}>Contenedores pendientes de recibir</div>
              <table className="tbl">
                <thead>
                  <tr><th>Folio</th><th>OC</th><th>Factura</th><th>Naviera</th><th>ETA Bodega</th><th style={{ textAlign: "right" }}>Kg estimados</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {pendientes.map(c => (
                    <tr key={c.folioInterno}>
                      <td className="mono fw-700">{c.folioInterno}</td>
                      <td className="mono text-sm">{c.ocProveedor}</td>
                      <td className="mono text-sm">{c.factura || "—"}</td>
                      <td className="text-sm">{c.naviera || "—"}</td>
                      <td className="text-sm">{fmtFch_Rec(c.etaBodega)}</td>
                      <td style={{ textAlign: "right" }} className="mono fw-600">{fmtKg_Rec(c.totalKg)}</td>
                      <td><span className="badge badge-blue">{c.status}</span></td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowRecepForm(c.folioInterno)}>Registrar recepción</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card" style={{ padding: "40px 32px", textAlign: "center", color: "var(--ink-400)" }}>
              <Icon name="check" size={32}/>
              <div style={{ marginTop: 10, fontWeight: 600 }}>Sin contenedores pendientes de recepción</div>
            </div>
          )}
        </div>
      )}
      {showRecepForm && <RegistrarRecepcionModal folioPrefill={showRecepForm} onClose={() => setShowRecepForm(null)}/>}
    </div>
  );
};

Object.assign(window, { CamanchacaRecepcion });
