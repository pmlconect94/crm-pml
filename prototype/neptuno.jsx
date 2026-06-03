// ============================================================
// Neptuno Seafood — Módulo completo
// Tabs: Facturas | Pagos | Notas de Crédito | Costos | Calendario
//
// Diferencias vs Camanchaca SA:
//   - Sin folio interno (facturaNum ES el identificador)
//   - Sin planeación / OC de referencia
//   - Se da de alta cuando llega la factura
//   - USD directo a bodega (sin costo de importación separado)
//   - NC por descuento (simplificadas)
// ============================================================

const { useState: useNEP, useMemo: useMemoNEP, useEffect: useEffNEP } = React;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtUSD_N  = (n) => "$" + Number(n||0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtUSD2_N = (n) => "$" + Number(n||0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMXN_N  = (n) => "$" + Number(n||0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtKg_N   = (n) => Number(n||0).toLocaleString("es-MX") + " kg";
const fmtFch_N  = (s) => { if (!s) return "—"; const d = new Date(s + "T12:00:00"); return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }); };

const NEP_STATUS = {
  "Pendiente": { bg: "#FEE2E2", color: "#991B1B" },
  "Parcial":   { bg: "#FEF3C7", color: "#92400E" },
  "Liquidada": { bg: "#D1FAE5", color: "#065F46" },
};

// ════════════════════════════════════════════════════════════════════════════════
// Modal base
// ════════════════════════════════════════════════════════════════════════════════
const NepModal = ({ title, subtitle, width = 540, onClose, children, footer }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={{ background:"white", borderRadius:16, padding:28, width, maxWidth:"95vw", maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,0.25)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:800 }}>{title}</div>
          {subtitle && <div style={{ fontSize:12, color:"var(--ink-500)", marginTop:3 }}>{subtitle}</div>}
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-400)", fontSize:20, lineHeight:1 }}>✕</button>
      </div>
      {children}
      {footer && <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20, paddingTop:16, borderTop:"1px solid var(--ink-100)" }}>{footer}</div>}
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════════
// Formulario — Nueva factura
// ════════════════════════════════════════════════════════════════════════════════
const NepFacturaForm = ({ onClose }) => {
  const data  = window.NEPTUNO_DATA;
  const [step, setStep] = useNEP(1);
  const [form, setForm] = useNEP({ facturaNum:"", fechaFactura:"", fechaVencimiento:"", entradaIntelisis:"" });
  const [lineas, setLineas] = useNEP([]);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addLinea    = ()        => setLineas(p => [...p, { code:"", kgCaja:0, cajas:"", precioUSD:"" }]);
  const removeLinea = (i)       => setLineas(p => p.filter((_,idx) => idx !== i));
  const updateLinea = (i, k, v) => setLineas(p => p.map((l, idx) => {
    if (idx !== i) return l;
    const up = { ...l, [k]: v };
    if (k === "code") up.kgCaja = data.skus.find(s => s.code === v)?.kgCaja || 0;
    return up;
  }));

  const totalKg  = lineas.reduce((s, l) => s + (parseFloat(l.cajas)||0) * (l.kgCaja||0), 0);
  const totalUSD = lineas.reduce((s, l) => s + (parseFloat(l.cajas)||0) * (l.kgCaja||0) * (parseFloat(l.precioUSD)||0), 0);
  const step1Valid = form.facturaNum && form.fechaFactura;

  const handleSave = () => {
    data.facturas.push({
      facturaNum: form.facturaNum, fechaFactura: form.fechaFactura,
      fechaVencimiento: form.fechaVencimiento, entradaIntelisis: form.entradaIntelisis,
      status: "Pendiente", totalUSD, totalKg,
      productos: lineas.filter(l => l.code).map(l => ({
        code: l.code, desc: data.skus.find(s => s.code === l.code)?.desc || "",
        kgCaja: l.kgCaja, cajas: parseInt(l.cajas)||0,
        kg: (parseInt(l.cajas)||0) * l.kgCaja,
        precioUSD: parseFloat(l.precioUSD)||0,
        totalUSD: (parseInt(l.cajas)||0) * l.kgCaja * (parseFloat(l.precioUSD)||0),
      })),
      pagos: [], nc: [],
    });
    window.neptunoRefresh();
    onClose();
  };

  return (
    <NepModal title="Alta de factura — Neptuno Seafood" subtitle="Vigo, España · Se da de alta cuando llega la factura" width={step===2?800:560}
      onClose={onClose}
      footer={
        step === 1
          ? <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!step1Valid}>Siguiente: Productos →</button></>
          : <><button className="btn btn-ghost" onClick={() => setStep(1)}>← Anterior</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!lineas.some(l=>l.code)}>
                <Icon name="check" size={13}/> Guardar factura
              </button></>
      }
    >
      {/* Step tabs */}
      <div style={{ display:"flex", marginBottom:20, borderRadius:8, overflow:"hidden", border:"1px solid var(--ink-200)" }}>
        {[{n:1,label:"① Datos generales"},{n:2,label:"② Productos (SKUs)"}].map(s => (
          <button key={s.n} onClick={() => { if(s.n===2&&step1Valid) setStep(2); if(s.n===1) setStep(1); }}
            style={{ flex:1, padding:"9px 0", fontSize:12.5, fontWeight:600, cursor:"pointer", border:"none",
              background: step===s.n?"#0EA5A1":"white",
              color: step===s.n?"white": step1Valid||s.n===1?"var(--ink-700)":"var(--ink-300)",
              borderRight: s.n===1?"1px solid var(--ink-200)":"none" }}>{s.label}</button>
        ))}
      </div>

      {step === 1 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div>
            <label className="field-label">Número de factura <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" value={form.facturaNum} onChange={e=>set("facturaNum",e.target.value)} placeholder="NEP-2026-006"/>
          </div>
          <div>
            <label className="field-label">Entrada Intelisis</label>
            <input className="field-input" value={form.entradaIntelisis} onChange={e=>set("entradaIntelisis",e.target.value)} placeholder="EI-2026-0900"/>
          </div>
          <div>
            <label className="field-label">Fecha de factura <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" type="date" value={form.fechaFactura} onChange={e=>set("fechaFactura",e.target.value)}/>
          </div>
          <div>
            <label className="field-label">Fecha de vencimiento</label>
            <input className="field-input" type="date" value={form.fechaVencimiento} onChange={e=>set("fechaVencimiento",e.target.value)}/>
          </div>
          <div style={{ gridColumn:"1/-1", padding:"10px 14px", background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:9, fontSize:12, color:"#065F46" }}>
            Sin OC ni folio interno — la factura es el identificador principal.
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          {lineas.length === 0 && (
            <div style={{ padding:"32px", textAlign:"center", border:"1px dashed var(--ink-200)", borderRadius:10, color:"var(--ink-400)", marginBottom:14 }}>
              <Icon name="pkg" size={28}/>
              <div style={{ marginTop:8, fontSize:13 }}>Agrega los productos de la factura</div>
              <button className="btn btn-primary" style={{ marginTop:12 }} onClick={addLinea}><Icon name="plus" size={12}/> Agregar primera línea</button>
            </div>
          )}
          {lineas.map((l, i) => {
            const kg  = (parseFloat(l.cajas)||0) * (l.kgCaja||0);
            const tot = kg * (parseFloat(l.precioUSD)||0);
            return (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"2fr 70px 80px 110px 100px 28px", gap:8, alignItems:"end", marginBottom:10, padding:"12px 14px", background:"var(--ink-50)", borderRadius:10 }}>
                <div>
                  <label className="field-label" style={{ fontSize:10, marginBottom:4 }}>SKU</label>
                  <select className="field-input" style={{ fontSize:12 }} value={l.code} onChange={e=>updateLinea(i,"code",e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {data.skus.map(s => <option key={s.code} value={s.code}>{s.code} · {s.desc}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label" style={{ fontSize:10, marginBottom:4 }}>kg/Caja</label>
                  <input className="field-input" value={l.kgCaja||""} readOnly style={{ background:"var(--ink-100)", fontSize:12, textAlign:"right", fontFamily:"var(--font-mono)" }}/>
                </div>
                <div>
                  <label className="field-label" style={{ fontSize:10, marginBottom:4 }}>Cajas</label>
                  <input className="field-input" type="number" min="0" value={l.cajas} onChange={e=>updateLinea(i,"cajas",e.target.value)} style={{ fontSize:12, textAlign:"right", fontFamily:"var(--font-mono)" }}/>
                </div>
                <div>
                  <label className="field-label" style={{ fontSize:10, marginBottom:4 }}>USD/kg</label>
                  <input className="field-input" type="number" step="0.001" min="0" value={l.precioUSD} onChange={e=>updateLinea(i,"precioUSD",e.target.value)} style={{ fontSize:12, textAlign:"right", fontFamily:"var(--font-mono)" }}/>
                </div>
                <div>
                  <label className="field-label" style={{ fontSize:10, marginBottom:4 }}>Total USD</label>
                  <div style={{ padding:"8px 10px", background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:8, fontSize:12, fontWeight:700, fontFamily:"var(--font-mono)", color:"#0EA5A1", textAlign:"right" }}>
                    {fmtUSD2_N(tot)}
                  </div>
                </div>
                <button onClick={()=>removeLinea(i)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--red-500)", fontSize:18, lineHeight:1, padding:0, marginBottom:4 }}>✕</button>
              </div>
            );
          })}
          {lineas.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={addLinea} style={{ marginBottom:14 }}>
              <Icon name="plus" size={12}/> Agregar línea
            </button>
          )}
          {lineas.some(l=>l.code) && (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px", background:"var(--ink-900)", borderRadius:10 }}>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)" }}>{lineas.filter(l=>l.code).length} SKUs · {fmtKg_N(totalKg)}</div>
              <div style={{ fontSize:22, fontWeight:900, fontFamily:"var(--font-mono)", color:"white" }}>{fmtUSD2_N(totalUSD)}</div>
            </div>
          )}
        </div>
      )}
    </NepModal>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// Formulario — Pago USD
// ════════════════════════════════════════════════════════════════════════════════
const NepPagoModal = ({ facturaPrefill, onClose }) => {
  const data     = window.NEPTUNO_DATA;
  const pending  = data.facturas.filter(f => f.status !== "Liquidada");
  const [form, setForm] = useNEP({ facturaNum: facturaPrefill||"", monto:"", tc: String(data.tcDelDia), banco:"", referencia:"", fecha:"", tipo:"abono" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const montoMXN = (parseFloat(form.monto)||0) * (parseFloat(form.tc)||0);
  const valid = form.facturaNum && parseFloat(form.monto)>0 && parseFloat(form.tc)>0 && form.banco && form.fecha;

  const handleSave = () => {
    const f = data.facturas.find(x => x.facturaNum === form.facturaNum);
    if (!f) return;
    f.pagos.push({ id:`NPAG-${Date.now()}`, monto:parseFloat(form.monto), tc:parseFloat(form.tc), montoMXN, fecha:form.fecha, banco:form.banco, referencia:form.referencia, tipo:form.tipo });
    const paid = f.pagos.reduce((s,p)=>s+p.monto,0);
    const nc   = (f.nc||[]).reduce((s,n)=>s+n.montoUSD,0);
    f.status = (f.totalUSD - nc - paid) <= 0.01 ? "Liquidada" : paid > 0 ? "Parcial" : "Pendiente";
    window.neptunoRefresh();
    onClose();
  };

  return (
    <NepModal title="Registrar pago al proveedor" subtitle="Neptuno Seafood S.L. · Pago en USD" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={!valid}><Icon name="check" size={13}/> Registrar pago</button>
      </>}
    >
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
        <div style={{ gridColumn:"1/-1" }}>
          <label className="field-label">Factura <span style={{ color:"var(--red-500)" }}>*</span></label>
          <select className="field-input" value={form.facturaNum} onChange={e=>set("facturaNum",e.target.value)} disabled={!!facturaPrefill} style={{ background:facturaPrefill?"var(--ink-50)":"white" }}>
            <option value="">— Seleccionar —</option>
            {pending.map(f => {
              const paid  = (f.pagos||[]).reduce((s,p)=>s+p.monto,0);
              const nc    = (f.nc||[]).reduce((s,n)=>s+n.montoUSD,0);
              const saldo = f.totalUSD - nc - paid;
              return <option key={f.facturaNum} value={f.facturaNum}>{f.facturaNum} · Saldo: {fmtUSD2_N(saldo)}</option>;
            })}
          </select>
        </div>
        <div>
          <label className="field-label">Tipo</label>
          <select className="field-input" value={form.tipo} onChange={e=>set("tipo",e.target.value)}>
            <option value="abono">Abono parcial</option>
            <option value="completo">Pago completo</option>
          </select>
        </div>
        <div>
          <label className="field-label">Fecha <span style={{ color:"var(--red-500)" }}>*</span></label>
          <input className="field-input" type="date" value={form.fecha} onChange={e=>set("fecha",e.target.value)}/>
        </div>
        <div>
          <label className="field-label">Monto USD <span style={{ color:"var(--red-500)" }}>*</span></label>
          <input className="field-input" type="number" step="0.01" value={form.monto} onChange={e=>set("monto",e.target.value)} placeholder="50000"/>
        </div>
        <div>
          <label className="field-label">TC <span style={{ color:"var(--red-500)" }}>*</span></label>
          <input className="field-input" type="number" step="0.0001" value={form.tc} onChange={e=>set("tc",e.target.value)}/>
        </div>
        <div style={{ gridColumn:"1/-1", padding:"10px 14px", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:9, fontSize:13 }}>
          Equivalente MXN: <strong style={{ fontFamily:"var(--font-mono)", color:"var(--blue-500)" }}>{fmtMXN_N(montoMXN)}</strong>
        </div>
        <div>
          <label className="field-label">Banco <span style={{ color:"var(--red-500)" }}>*</span></label>
          <select className="field-input" value={form.banco} onChange={e=>set("banco",e.target.value)}>
            <option value="">—</option>
            {data.bancos.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Referencia</label>
          <input className="field-input" value={form.referencia} onChange={e=>set("referencia",e.target.value)} placeholder="TRF-NEP-006"/>
        </div>
      </div>
    </NepModal>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// Formulario — Nota de Crédito por Descuento
// ════════════════════════════════════════════════════════════════════════════════
const NepNCModal = ({ facturaPrefill, onClose }) => {
  const data    = window.NEPTUNO_DATA;
  const all     = data.facturas;
  const [form, setForm] = useNEP({ facturaNum: facturaPrefill||"", montoUSD:"", motivo:"", fecha:"" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.facturaNum && parseFloat(form.montoUSD)>0 && form.motivo && form.fecha;

  const handleSave = () => {
    const f = data.facturas.find(x => x.facturaNum === form.facturaNum);
    if (!f) return;
    if (!f.nc) f.nc = [];
    f.nc.push({ id:`NC-NEP-${Date.now()}`, montoUSD:parseFloat(form.montoUSD), motivo:form.motivo, fecha:form.fecha, status:"Aplicada" });
    const paid = (f.pagos||[]).reduce((s,p)=>s+p.monto,0);
    const nc   = f.nc.reduce((s,n)=>s+n.montoUSD,0);
    f.status = (f.totalUSD - nc - paid) <= 0.01 ? "Liquidada" : paid > 0 ? "Parcial" : "Pendiente";
    window.neptunoRefresh();
    onClose();
  };

  return (
    <NepModal title="Nota de crédito por descuento" subtitle="Neptuno Seafood S.L. · Descuento en USD" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={!valid}><Icon name="check" size={13}/> Aplicar nota de crédito</button>
      </>}
    >
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
        <div style={{ gridColumn:"1/-1" }}>
          <label className="field-label">Factura <span style={{ color:"var(--red-500)" }}>*</span></label>
          <select className="field-input" value={form.facturaNum} onChange={e=>set("facturaNum",e.target.value)} disabled={!!facturaPrefill} style={{ background:facturaPrefill?"var(--ink-50)":"white" }}>
            <option value="">— Seleccionar —</option>
            {all.map(f => <option key={f.facturaNum} value={f.facturaNum}>{f.facturaNum} · {fmtUSD2_N(f.totalUSD)}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Monto USD <span style={{ color:"var(--red-500)" }}>*</span></label>
          <input className="field-input" type="number" step="0.01" value={form.montoUSD} onChange={e=>set("montoUSD",e.target.value)} placeholder="1500.00"/>
        </div>
        <div>
          <label className="field-label">Fecha <span style={{ color:"var(--red-500)" }}>*</span></label>
          <input className="field-input" type="date" value={form.fecha} onChange={e=>set("fecha",e.target.value)}/>
        </div>
        <div style={{ gridColumn:"1/-1" }}>
          <label className="field-label">Motivo del descuento <span style={{ color:"var(--red-500)" }}>*</span></label>
          <input className="field-input" value={form.motivo} onChange={e=>set("motivo",e.target.value)} placeholder="Ej: Diferencia de peso, calidad, presentación..."/>
        </div>
      </div>
    </NepModal>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// NepFacturaDetail — detalle de una factura (componente separado para cumplir Rules of Hooks)
const NepFacturaDetail = ({ facturaNum, onBack }) => {
  const data  = window.NEPTUNO_DATA;
  const [sec,      setSec]      = useNEP("productos");
  const [showPago, setShowPago] = useNEP(false);
  const [showNC,   setShowNC]   = useNEP(false);
  const f = data.facturas.find(x => x.facturaNum === facturaNum);
  if (!f) return null;
  const paid  = (f.pagos||[]).reduce((s,p)=>s+p.monto,0);
  const ncAmt = (f.nc||[]).reduce((s,n)=>s+n.montoUSD,0);
  const saldo = f.totalUSD - ncAmt - paid;
  const pct   = f.totalUSD ? (paid/f.totalUSD*100) : 0;
  const hoy   = new Date();
  const venc  = f.fechaVencimiento ? new Date(f.fechaVencimiento+"T12:00:00") : null;
  const dias  = venc ? Math.ceil((venc-hoy)/86400000) : null;
  const sc    = NEP_STATUS[f.status] || NEP_STATUS["Pendiente"];
  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom:16 }} onClick={onBack}><Icon name="chevLeft" size={13}/> Regresar</button>
      <div className="card" style={{ padding:"18px 22px", marginBottom:16, background:"linear-gradient(135deg,#F0FDF4,#F9FAFB)", border:"1px solid #BBF7D0" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <span style={{ fontSize:20, fontWeight:900, fontFamily:"var(--font-mono)" }}>{f.facturaNum}</span>
              <span style={{ padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, background:sc.bg, color:sc.color }}>{f.status}</span>
              {(f.nc||[]).length > 0 && <span style={{ padding:"3px 8px", borderRadius:999, fontSize:10, fontWeight:700, background:"#FEE2E2", color:"#991B1B" }}>NC aplicada</span>}
            </div>
            <div style={{ fontSize:13, color:"var(--ink-600)", display:"flex", gap:18, flexWrap:"wrap" }}>
              <span><b>Fecha:</b> {fmtFch_N(f.fechaFactura)}</span>
              
              {f.fechaVencimiento && (<span><b>Vence:</b> {fmtFch_N(f.fechaVencimiento)}{dias!==null&&<span style={{ marginLeft:6, fontSize:11, fontWeight:700, color:dias<0?"var(--red-500)":dias<7?"var(--amber-500)":"var(--green-500)" }}>({dias<0?Math.abs(dias)+"d vencida":dias+"d"})</span>}</span>)}
              <span><b>Kg:</b> {fmtKg_N(f.totalKg)}</span>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:"var(--ink-500)", marginBottom:2 }}>Total factura</div>
            <div style={{ fontSize:24, fontWeight:900, fontFamily:"var(--font-mono)", color:"#0EA5A1" }}>{fmtUSD2_N(f.totalUSD)}</div>
          </div>
        </div>
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--ink-500)", marginBottom:6 }}>
            <span>Pagado: {fmtUSD2_N(paid)}{ncAmt>0?" (+ NC: "+fmtUSD2_N(ncAmt)+")":""}</span><span>Saldo: {fmtUSD2_N(saldo)}</span>
          </div>
          <div style={{ height:6, background:"var(--ink-100)", borderRadius:999, overflow:"hidden" }}><div style={{ height:"100%", width:Math.min(pct,100)+"%", background:pct>=100?"var(--green-500)":"#0EA5A1", borderRadius:999 }}/></div>
        </div>
      </div>
      <div style={{ display:"flex", gap:2, borderBottom:"1px solid var(--ink-200)", marginBottom:16 }}>
        {[{id:"productos",label:"Productos"},{id:"pagos",label:"Pagos"},{id:"nc",label:"Notas de crédito"}].map(t => (
          <button key={t.id} onClick={()=>setSec(t.id)} style={{ padding:"8px 14px", fontSize:12, fontWeight:600, cursor:"pointer", border:"none", background:"transparent", color:sec===t.id?"#0EA5A1":"var(--ink-600)", borderBottom:sec===t.id?"2px solid #0EA5A1":"2px solid transparent", marginBottom:-1 }}>{t.label}</button>
        ))}
      </div>
      {sec==="productos" && <div className="card" style={{ padding:0, overflow:"hidden" }}><table className="tbl"><thead><tr><th>Código</th><th>Descripción</th><th style={{ textAlign:"right" }}>kg/Caja</th><th style={{ textAlign:"right" }}>Cajas</th><th style={{ textAlign:"right" }}>Kg</th><th style={{ textAlign:"right" }}>USD/kg</th><th style={{ textAlign:"right" }}>Total USD</th></tr></thead><tbody>{f.productos.map((p,i)=><tr key={i}><td className="mono fw-600">{p.code}</td><td className="fw-600 text-sm">{p.desc}</td><td style={{ textAlign:"right" }} className="mono">{p.kgCaja.toFixed(2)}</td><td style={{ textAlign:"right" }} className="mono">{p.cajas.toLocaleString()}</td><td style={{ textAlign:"right" }} className="mono fw-600">{fmtKg_N(p.kg)}</td><td style={{ textAlign:"right" }} className="mono fw-700" style={{ color:"#0EA5A1",textAlign:"right" }}>{fmtUSD_N(p.precioUSD)}</td><td style={{ textAlign:"right" }} className="mono fw-700">{fmtUSD2_N(p.totalUSD)}</td></tr>)}</tbody><tfoot><tr style={{ background:"var(--ink-50)" }}><td colSpan={4} className="fw-700">TOTAL</td><td style={{ textAlign:"right" }} className="mono fw-700">{fmtKg_N(f.totalKg)}</td><td></td><td style={{ textAlign:"right" }} className="mono fw-800" style={{ color:"#0EA5A1",textAlign:"right",fontSize:14 }}>{fmtUSD2_N(f.totalUSD)}</td></tr></tfoot></table></div>}
      {sec==="pagos" && (<div><div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:14 }}>{[{label:"Total factura",value:fmtUSD2_N(f.totalUSD)},{label:"Pagado",value:fmtUSD2_N(paid),color:"var(--green-500)"},{label:"Saldo",value:fmtUSD2_N(saldo),color:saldo>0.01?"var(--amber-500)":"var(--ink-400)"}].map((k,i)=><div key={i} className="card" style={{ padding:"14px 16px" }}><div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--ink-500)", marginBottom:6 }}>{k.label}</div><div style={{ fontSize:20, fontWeight:800, fontFamily:"var(--font-mono)", color:k.color||"var(--ink-900)" }}>{k.value}</div></div>)}</div><div className="card" style={{ padding:0, overflow:"hidden" }}><div style={{ padding:"12px 16px", borderBottom:"1px solid var(--ink-100)", display:"flex", justifyContent:"space-between", alignItems:"center" }}><span style={{ fontSize:12, fontWeight:700, color:"var(--ink-700)" }}>Pagos al proveedor (USD)</span>{saldo>0.01&&<button className="btn btn-primary btn-sm" onClick={()=>setShowPago(true)}><Icon name="plus" size={12}/> Registrar pago</button>}</div>{f.pagos.length>0?<table className="tbl"><thead><tr><th>ID</th><th>Tipo</th><th style={{ textAlign:"right" }}>USD</th><th style={{ textAlign:"right" }}>TC</th><th style={{ textAlign:"right" }}>MXN</th><th>Banco</th><th>Referencia</th><th>Fecha</th></tr></thead><tbody>{f.pagos.map(p=><tr key={p.id}><td className="mono text-xs" style={{ color:"var(--ink-500)" }}>{p.id}</td><td><span className="badge badge-blue">{p.tipo}</span></td><td style={{ textAlign:"right" }} className="mono fw-700" style={{ color:"#0EA5A1",textAlign:"right" }}>{fmtUSD2_N(p.monto)}</td><td style={{ textAlign:"right" }} className="mono">{p.tc.toFixed(4)}</td><td style={{ textAlign:"right" }} className="mono">{fmtMXN_N(p.montoMXN)}</td><td className="text-sm">{p.banco}</td><td className="mono text-xs">{p.referencia}</td><td className="text-sm">{fmtFch_N(p.fecha)}</td></tr>)}</tbody></table>:<div style={{ padding:"28px", textAlign:"center", color:"var(--ink-400)", fontSize:13 }}>Sin pagos registrados</div>}</div></div>)}
      {sec==="nc" && (<div><div style={{ padding:"10px 14px", background:"#FEF3C7", border:"1px solid #FDE68A", borderRadius:9, fontSize:12, color:"#92400E", marginBottom:14 }}>Notas de crédito por descuento. El monto USD se descuenta del saldo pendiente.</div><div className="card" style={{ padding:0, overflow:"hidden" }}><div style={{ padding:"12px 16px", borderBottom:"1px solid var(--ink-100)", display:"flex", justifyContent:"space-between", alignItems:"center" }}><span style={{ fontSize:12, fontWeight:700 }}>Notas de crédito</span><button className="btn btn-accent btn-sm" onClick={()=>setShowNC(true)}><Icon name="plus" size={12}/> Nueva NC</button></div>{(f.nc||[]).length>0?<table className="tbl"><thead><tr><th>ID</th><th style={{ textAlign:"right" }}>Monto USD</th><th>Motivo</th><th>Fecha</th><th>Status</th></tr></thead><tbody>{f.nc.map(n=><tr key={n.id}><td className="mono text-xs" style={{ color:"var(--ink-500)" }}>{n.id}</td><td style={{ textAlign:"right" }} className="mono fw-700" style={{ color:"var(--amber-500)",textAlign:"right" }}>{fmtUSD2_N(n.montoUSD)}</td><td className="text-sm">{n.motivo}</td><td className="text-sm">{fmtFch_N(n.fecha)}</td><td><span className="badge badge-green">{n.status}</span></td></tr>)}</tbody></table>:<div style={{ padding:"28px", textAlign:"center", color:"var(--ink-400)", fontSize:13 }}>Sin notas de crédito</div>}</div></div>)}
      {showPago && <NepPagoModal facturaPrefill={f.facturaNum} onClose={()=>setShowPago(false)}/>}
      {showNC   && <NepNCModal   facturaPrefill={f.facturaNum} onClose={()=>setShowNC(false)}/>}
    </div>
  );
};

// Tab: Facturas (lista)
// ════════════════════════════════════════════════════════════════════════════════
const NepFacturas = () => {
  const data = window.NEPTUNO_DATA;
  const [selected, setSelected] = useNEP(null);
  const [showNew,  setShowNew]  = useNEP(false);

  if (selected) return <NepFacturaDetail facturaNum={selected} onBack={()=>setSelected(null)}/>;

  const facturas = data.facturas;
  const totPend  = facturas.reduce((s,f) => {
    const paid = (f.pagos||[]).reduce((a,p)=>a+p.monto,0);
    const nc   = (f.nc||[]).reduce((a,n)=>a+n.montoUSD,0);
    return s + Math.max(0, f.totalUSD - nc - paid);
  }, 0);

  return (
    <div>
      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"Facturas totales",   value:facturas.length,              sub:"historial completo",    color:null },
          { label:"Saldo pendiente",    value:fmtUSD2_N(totPend),           sub:"USD por liquidar",      color:totPend>0?"var(--amber-500)":"var(--ink-400)" },
          { label:"NCs aplicadas",      value:facturas.reduce((s,f)=>s+(f.nc||[]).length,0), sub:"notas de crédito", color:null },
          { label:"TC del día",         value:data.tcDelDia.toFixed(3),     sub:"referencia",            color:null },
        ].map((k,i) => (
          <div key={i} className="card" style={{ padding:"14px 16px" }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--ink-500)", marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:20, fontWeight:800, fontFamily:"var(--font-mono)", color:k.color||"var(--ink-900)" }}>{k.value}</div>
            <div style={{ fontSize:11, color:"var(--ink-400)", marginTop:4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--ink-100)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:12, fontWeight:700, color:"var(--ink-700)" }}>Neptuno Seafood S.L. — Vigo, España</span>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowNew(true)}><Icon name="plus" size={12}/> Alta de factura</button>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>Factura</th><th>Fecha</th><th>Vencimiento</th><th style={{ textAlign:"right" }}>Kg</th><th style={{ textAlign:"right" }}>Total USD</th><th style={{ textAlign:"right" }}>Saldo USD</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {facturas.map(f => {
              const paid  = (f.pagos||[]).reduce((s,p)=>s+p.monto,0);
              const nc    = (f.nc||[]).reduce((s,n)=>s+n.montoUSD,0);
              const saldo = Math.max(0, f.totalUSD - nc - paid);
              const sc    = NEP_STATUS[f.status] || NEP_STATUS["Pendiente"];
              return (
                <tr key={f.facturaNum} style={{ cursor:"pointer" }} onClick={()=>setSelected(f.facturaNum)}
                  onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                  onMouseLeave={e=>e.currentTarget.style.background="white"}>
                  <td className="mono fw-700" style={{ color:"#0EA5A1" }}>{f.facturaNum}</td>
                  <td className="text-sm">{fmtFch_N(f.fechaFactura)}</td>
                  <td className="text-sm">{fmtFch_N(f.fechaVencimiento)}</td>
                  <td style={{ textAlign:"right" }} className="mono">{fmtKg_N(f.totalKg)}</td>
                  <td style={{ textAlign:"right" }} className="mono fw-700" style={{ color:"#0EA5A1", textAlign:"right" }}>{fmtUSD2_N(f.totalUSD)}</td>
                  <td style={{ textAlign:"right" }} className="mono fw-700" style={{ color:saldo>0?"var(--amber-500)":"var(--ink-300)", textAlign:"right" }}>{saldo>0?fmtUSD2_N(saldo):"—"}</td>
                  <td><span style={{ padding:"2px 8px", borderRadius:999, fontSize:10, fontWeight:700, background:sc.bg, color:sc.color }}>{f.status}</span></td>
                  <td><Icon name="chevRight" size={13} style={{ color:"var(--ink-400)" }}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showNew && <NepFacturaForm onClose={()=>setShowNew(false)}/>}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// Tab: Pagos globales
// ════════════════════════════════════════════════════════════════════════════════
const NepPagosGlobal = () => {
  const data  = window.NEPTUNO_DATA;
  const [showPago, setShowPago] = useNEP(false);
  const pagos = data.facturas.flatMap(f => (f.pagos||[]).map(p => ({ ...p, facturaNum:f.facturaNum })));
  const total = pagos.reduce((s,p)=>s+p.monto,0);

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"Total pagado",   value:fmtUSD2_N(total), color:"var(--green-500)" },
          { label:"Pagos registrados", value:pagos.length, color:null },
          { label:"TC del día",    value:data.tcDelDia.toFixed(3), color:null },
        ].map((k,i) => (
          <div key={i} className="card" style={{ padding:"14px 16px" }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--ink-500)", marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:20, fontWeight:800, fontFamily:"var(--font-mono)", color:k.color||"var(--ink-900)" }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--ink-100)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:12, fontWeight:700, color:"var(--ink-700)" }}>Todos los pagos — Neptuno Seafood</span>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowPago(true)}><Icon name="plus" size={12}/> Registrar pago</button>
        </div>
        {pagos.length > 0 ? (
          <table className="tbl">
            <thead><tr><th>Factura</th><th>ID</th><th>Tipo</th><th style={{ textAlign:"right" }}>USD</th><th style={{ textAlign:"right" }}>TC</th><th style={{ textAlign:"right" }}>MXN</th><th>Banco</th><th>Referencia</th><th>Fecha</th></tr></thead>
            <tbody>
              {pagos.map(p => (
                <tr key={p.id}>
                  <td className="mono fw-700" style={{ color:"#0EA5A1" }}>{p.facturaNum}</td>
                  <td className="mono text-xs" style={{ color:"var(--ink-500)" }}>{p.id}</td>
                  <td><span className="badge badge-blue">{p.tipo}</span></td>
                  <td style={{ textAlign:"right" }} className="mono fw-700" style={{ color:"#0EA5A1", textAlign:"right" }}>{fmtUSD2_N(p.monto)}</td>
                  <td style={{ textAlign:"right" }} className="mono">{p.tc.toFixed(4)}</td>
                  <td style={{ textAlign:"right" }} className="mono">{fmtMXN_N(p.montoMXN)}</td>
                  <td className="text-sm">{p.banco}</td>
                  <td className="mono text-xs">{p.referencia}</td>
                  <td className="text-sm">{fmtFch_N(p.fecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding:"32px", textAlign:"center", color:"var(--ink-400)" }}>Sin pagos registrados</div>
        )}
      </div>
      {showPago && <NepPagoModal onClose={()=>setShowPago(false)}/>}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// Tab: Notas de Crédito global
// ════════════════════════════════════════════════════════════════════════════════
const NepNotasCredito = () => {
  const data = window.NEPTUNO_DATA;
  const [showNC, setShowNC] = useNEP(false);
  const ncs  = data.facturas.flatMap(f => (f.nc||[]).map(n => ({ ...n, facturaNum:f.facturaNum })));
  const total = ncs.reduce((s,n)=>s+n.montoUSD,0);

  return (
    <div>
      <div style={{ padding:"10px 14px", background:"#FEF3C7", border:"1px solid #FDE68A", borderRadius:9, fontSize:12, color:"#92400E", marginBottom:14 }}>
        <strong>Notas de crédito por descuento</strong> — Se aplican directamente al saldo de la factura. Ejemplo: diferencia de peso, calidad inferior, presentación incorrecta.
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
        {[
          { label:"NCs totales", value:ncs.length, color:null },
          { label:"Total descuentos", value:fmtUSD2_N(total), color:"var(--amber-500)" },
          { label:"NCs aplicadas", value:ncs.filter(n=>n.status==="Aplicada").length, color:"var(--green-500)" },
        ].map((k,i) => (
          <div key={i} className="card" style={{ padding:"14px 16px" }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--ink-500)", marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:20, fontWeight:800, fontFamily:"var(--font-mono)", color:k.color||"var(--ink-900)" }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--ink-100)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:12, fontWeight:700, color:"var(--ink-700)" }}>Historial de notas de crédito</span>
          <button className="btn btn-accent btn-sm" onClick={()=>setShowNC(true)}><Icon name="plus" size={12}/> Nueva NC</button>
        </div>
        {ncs.length > 0 ? (
          <table className="tbl">
            <thead><tr><th>Factura</th><th>ID</th><th style={{ textAlign:"right" }}>Monto USD</th><th>Motivo</th><th>Fecha</th><th>Status</th></tr></thead>
            <tbody>
              {ncs.map(n => (
                <tr key={n.id}>
                  <td className="mono fw-700" style={{ color:"#0EA5A1" }}>{n.facturaNum}</td>
                  <td className="mono text-xs" style={{ color:"var(--ink-500)" }}>{n.id}</td>
                  <td style={{ textAlign:"right" }} className="mono fw-700" style={{ color:"var(--amber-500)", textAlign:"right" }}>{fmtUSD2_N(n.montoUSD)}</td>
                  <td className="text-sm">{n.motivo}</td>
                  <td className="text-sm">{fmtFch_N(n.fecha)}</td>
                  <td><span className="badge badge-green">{n.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding:"32px", textAlign:"center", color:"var(--ink-400)", fontSize:13 }}>Sin notas de crédito</div>
        )}
      </div>
      {showNC && <NepNCModal onClose={()=>setShowNC(false)}/>}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// Tab: Costos
// ════════════════════════════════════════════════════════════════════════════════
const NepCostos = () => {
  const data  = window.NEPTUNO_DATA;
  const [query,     setQuery]     = useNEP("");
  const [open,      setOpen]      = useNEP(false);
  const [selected,  setSelected]  = useNEP(null);
  const [stockInput,setStockInput]= useNEP("");

  // Build SKU map: desc → fuentes ordered newest first
  const skuMap = useMemoNEP(() => {
    const m = {};
    data.facturas.filter(f => f.productos.length > 0).forEach(f => {
      const pagos  = f.pagos||[];
      const paid   = pagos.reduce((s,p)=>s+p.monto,0);
      const tc     = pagos.length ? pagos.reduce((s,p)=>s+p.tc*p.monto,0)/paid : data.tcDelDia;
      f.productos.forEach(p => {
        const key = `${p.code}||${p.desc}`;
        if (!m[key]) m[key] = { key, code:p.code, desc:p.desc, fuentes:[] };
        m[key].fuentes.push({ facturaNum:f.facturaNum, fecha:f.fechaFactura, kg:p.kg, precioUSD:p.precioUSD, tc, precioMXN:p.precioUSD*tc });
      });
    });
    Object.values(m).forEach(s => s.fuentes.sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||"")));
    return Object.values(m);
  }, []);

  const filtered = skuMap.filter(s => !query || s.desc.toLowerCase().includes(query.toLowerCase()) || s.code.toLowerCase().includes(query.toLowerCase()));
  const active   = selected ? skuMap.find(s=>s.key===selected) : null;
  const last5    = active ? active.fuentes.slice(0,5) : [];
  const stockKg  = parseFloat(stockInput)||0;

  const resultado = active && stockKg>0 ? (() => {
    let rem=stockKg, sumUSD=0, sumTC=0, sumKg=0; const bd=[];
    for (const f of active.fuentes) {
      if(rem<=0) break;
      const used = Math.min(f.kg, rem);
      sumUSD+=f.precioUSD*used; sumTC+=f.tc*used; sumKg+=used; rem-=used;
      bd.push({...f,kgUsado:used});
    }
    if(!sumKg) return null;
    return { avgUSD:sumUSD/sumKg, avgTC:sumTC/sumKg, avgMXN:(sumUSD/sumKg)*(sumTC/sumKg), totalKg:sumKg, bd };
  })() : null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ position:"relative", maxWidth:520 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"white", border:"1.5px solid var(--ink-300)", borderRadius:10, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }} onClick={()=>setOpen(true)}>
          <Icon name="search" size={15} style={{ color:"var(--ink-400)", flexShrink:0 }}/>
          <input value={query} onChange={e=>{setQuery(e.target.value);setOpen(true);if(!e.target.value)setSelected(null);}} onFocus={()=>setOpen(true)}
            placeholder="Buscar SKU…" style={{ border:"none", outline:"none", flex:1, fontSize:14, fontWeight:500, background:"transparent" }}/>
          {selected && <button onClick={()=>{setSelected(null);setQuery("");}} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-400)", fontSize:16, padding:0 }}>✕</button>}
        </div>
        {open && !selected && (
          <><div style={{ position:"fixed", inset:0, zIndex:99 }} onClick={()=>setOpen(false)}/>
            <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, background:"white", border:"1px solid var(--ink-200)", borderRadius:10, boxShadow:"0 8px 32px rgba(0,0,0,0.12)", zIndex:100, maxHeight:280, overflowY:"auto" }}>
              {filtered.map(s => (
                <button key={s.key} onClick={()=>{setSelected(s.key);setQuery(s.desc);setOpen(false);setStockInput("");}}
                  style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"10px 16px", border:"none", background:"none", cursor:"pointer", textAlign:"left", borderBottom:"1px solid var(--ink-100)" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#F0FDF4"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                  <div><div style={{ fontSize:13, fontWeight:700 }}>{s.desc}</div><div style={{ fontSize:11, color:"var(--ink-500)", marginTop:2 }}>{s.code}</div></div>
                  <span style={{ fontSize:11, color:"#0EA5A1", fontWeight:600 }}>{s.fuentes.length} facturas</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {active && (
        <>
          <div style={{ padding:"14px 18px", background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10 }}>
            <div style={{ fontSize:15, fontWeight:800 }}>{active.desc}</div>
            <div style={{ fontSize:12, color:"var(--ink-500)", marginTop:2 }}>{active.code} · {active.fuentes.length} facturas · {fmtKg_N(active.fuentes.reduce((s,f)=>s+f.kg,0))} total</div>
          </div>

          <div className="card" style={{ padding:0, overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--ink-100)", display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, fontWeight:700 }}>Últimas {Math.min(5,last5.length)} facturas</span>
              <span style={{ fontSize:11, color:"var(--ink-400)" }}>más reciente primero</span>
            </div>
            <table className="tbl">
              <thead><tr><th>#</th><th>Factura</th><th>Fecha</th><th style={{ textAlign:"right" }}>Kg</th><th style={{ textAlign:"right" }}>USD/kg</th><th style={{ textAlign:"right" }}>TC</th><th style={{ textAlign:"right" }}>MXN/kg</th></tr></thead>
              <tbody>
                {last5.map((f,i) => (
                  <tr key={i} style={{ background:i===0?"#F0FDF4":"white" }}>
                    <td style={{ textAlign:"center" }}>{i===0?<span style={{ display:"inline-block", width:18, height:18, borderRadius:999, background:"#0EA5A1", color:"white", fontSize:9, fontWeight:800, lineHeight:"18px", textAlign:"center" }}>N</span>:<span style={{ color:"var(--ink-400)", fontSize:12 }}>{i+1}</span>}</td>
                    <td className="mono fw-700" style={{ color:"#0EA5A1" }}>{f.facturaNum}</td>
                    <td className="text-sm">{fmtFch_N(f.fecha)}</td>
                    <td style={{ textAlign:"right" }} className="mono fw-600">{fmtKg_N(f.kg)}</td>
                    <td style={{ textAlign:"right" }} className="mono fw-700" style={{ color:"#0EA5A1", textAlign:"right" }}>{fmtUSD_N(f.precioUSD)}</td>
                    <td style={{ textAlign:"right" }} className="mono">{f.tc.toFixed(4)}</td>
                    <td style={{ textAlign:"right" }} className="mono fw-700">{fmtMXN_N(f.precioMXN)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding:"20px 22px" }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>¿Cuántos kg tienes en bodega?</div>
            <div style={{ fontSize:12, color:"var(--ink-500)", marginBottom:16 }}>Costo promedio ponderado (USD→MXN) del más nuevo al más viejo.</div>
            <div style={{ position:"relative", flex:"0 0 240px", width:240 }}>
              <input type="number" min={0} value={stockInput} onChange={e=>setStockInput(e.target.value)} placeholder="Ej: 5000"
                style={{ width:"100%", padding:"12px 40px 12px 14px", borderRadius:9, border:"1.5px solid var(--ink-300)", fontFamily:"var(--font-mono)", fontSize:18, fontWeight:700, outline:"none", boxSizing:"border-box" }}
                onFocus={e=>e.target.style.borderColor="#0EA5A1"} onBlur={e=>e.target.style.borderColor="var(--ink-300)"}/>
              <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"var(--ink-500)", fontWeight:600, pointerEvents:"none" }}>kg</span>
            </div>

            {resultado && (
              <div style={{ marginTop:20 }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:12 }}>
                  {[
                    { label:"Stock eval.",  value:fmtKg_N(resultado.totalKg),   color:null },
                    { label:"USD/kg",       value:fmtUSD_N(resultado.avgUSD),    color:"#0EA5A1" },
                    { label:"TC promedio",  value:resultado.avgTC.toFixed(4),    color:null },
                    { label:"MXN/kg",       value:fmtMXN_N(resultado.avgMXN),   strong:true },
                  ].map((k,i) => (
                    <div key={i} style={{ background:k.strong?"var(--ink-900)":"var(--ink-50)", borderRadius:10, padding:"12px 14px", border:"1px solid", borderColor:k.strong?"var(--ink-900)":"var(--ink-100)" }}>
                      <div style={{ fontSize:9, fontWeight:700, color:k.strong?"rgba(255,255,255,0.5)":"var(--ink-500)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5 }}>{k.label}</div>
                      <div style={{ fontSize:14, fontWeight:800, fontFamily:"var(--font-mono)", color:k.strong?"white":k.color||"var(--ink-900)" }}>{k.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding:"12px 16px", background:"var(--ink-900)", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>Valor total del inventario consultado</div>
                  <div style={{ fontSize:20, fontWeight:900, fontFamily:"var(--font-mono)", color:"white" }}>{fmtMXN_N(resultado.totalKg*resultado.avgMXN)}</div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!active && (
        <div style={{ padding:"64px 32px", textAlign:"center", color:"var(--ink-400)", background:"white", borderRadius:12, border:"1px dashed var(--ink-200)" }}>
          <Icon name="search" size={32}/>
          <div style={{ marginTop:12, fontSize:16, fontWeight:700, color:"var(--ink-600)" }}>Busca un SKU para comenzar</div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// Tab: Calendario — Vencimientos
// ════════════════════════════════════════════════════════════════════════════════
const NepCalendario = () => {
  const data = window.NEPTUNO_DATA;
  const hoy  = new Date();
  const pend = data.facturas.filter(f => f.status !== "Liquidada" && f.fechaVencimiento);
  pend.sort((a,b)=>a.fechaVencimiento.localeCompare(b.fechaVencimiento));

  return (
    <div>
      <div style={{ padding:"10px 14px", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:9, fontSize:12, color:"#1E40AF", marginBottom:14 }}>
        Vencimientos de facturas pendientes. Neptuno Seafood S.L.
      </div>
      <div className="card" style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--ink-100)", fontSize:12, fontWeight:700, color:"var(--ink-700)" }}>
          Facturas con saldo pendiente — {pend.length}
        </div>
        {pend.length > 0 ? (
          <table className="tbl">
            <thead><tr><th>Factura</th><th>Fecha factura</th><th>Vencimiento</th><th>Días</th><th style={{ textAlign:"right" }}>Saldo USD</th><th>Status</th></tr></thead>
            <tbody>
              {pend.map(f => {
                const paid  = (f.pagos||[]).reduce((s,p)=>s+p.monto,0);
                const nc    = (f.nc||[]).reduce((s,n)=>s+n.montoUSD,0);
                const saldo = Math.max(0, f.totalUSD - nc - paid);
                const venc  = new Date(f.fechaVencimiento+"T12:00:00");
                const dias  = Math.ceil((venc-hoy)/86400000);
                const vencida = dias < 0;
                return (
                  <tr key={f.facturaNum}>
                    <td className="mono fw-700" style={{ color:"#0EA5A1" }}>{f.facturaNum}</td>
                    <td className="text-sm">{fmtFch_N(f.fechaFactura)}</td>
                    <td className="text-sm" style={{ color:vencida?"var(--red-500)":"inherit", fontWeight:vencida?700:400 }}>{fmtFch_N(f.fechaVencimiento)}</td>
                    <td style={{ fontWeight:700, fontSize:12, color:vencida?"var(--red-500)":dias<7?"var(--amber-500)":"var(--green-500)" }}>{vencida?`−${Math.abs(dias)}d`:`+${dias}d`}</td>
                    <td style={{ textAlign:"right" }} className="mono fw-700" style={{ color:"var(--amber-500)", textAlign:"right" }}>{fmtUSD2_N(saldo)}</td>
                    <td><span style={{ padding:"2px 8px", borderRadius:999, fontSize:10, fontWeight:700, background:NEP_STATUS[f.status]?.bg, color:NEP_STATUS[f.status]?.color }}>{f.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding:"32px", textAlign:"center", color:"var(--ink-400)", fontSize:13 }}>✓ Todas las facturas liquidadas</div>
        )}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// NeptunoModule — Shell principal
// ════════════════════════════════════════════════════════════════════════════════
const NEP_TABS = [
  { id:"facturas",   label:"Facturas",         icon:"doc"      },
  { id:"pagos",      label:"Pagos",            icon:"payments" },
  { id:"nc",         label:"Notas de crédito", icon:"shield"   },
  { id:"costos",     label:"Central de Costos",icon:"sales"    },
  { id:"calendario", label:"Calendario",       icon:"calendar" },
  { id:"catalogo",   label:"Productos",        icon:"pkg"      },
];

const NeptunoModule = () => {
  const [tab, setTab] = useNEP("facturas");
  const [refreshKey, setRefreshKey] = useNEP(0);

  useEffNEP(() => {
    const h = () => setRefreshKey(k=>k+1);
    window.addEventListener('nep-data-changed', h);
    return () => window.removeEventListener('nep-data-changed', h);
  }, []);

  return (
    <div>
      <div className="page-header">
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:160, height:80, borderRadius:10, background:"white", border:"1px solid var(--ink-100)", display:"flex", alignItems:"center", justifyContent:"center", padding:"6px", flexShrink:0, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
            <img src="assets/neptuno-logo.png" alt="Neptuno Seafood" style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain" }}/>
          </div>
          <div>
            <h1 className="page-title">Neptuno Seafood</h1>
            <p className="page-subtitle">🇲🇽 Neptuno Alimentos del Mar — Tijuana, Baja California · Importación USD · Entrega directa en bodega</p>
          </div>
        </div>
      </div>

      <div style={{ display:"flex", gap:0, borderBottom:"1.5px solid var(--ink-200)", marginBottom:20 }}>
        {NEP_TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"10px 18px", fontSize:12.5, fontWeight:600, cursor:"pointer", border:"none", background:"transparent", color: active?"#0EA5A1":"var(--ink-600)", borderBottom: active?"2px solid #0EA5A1":"2px solid transparent", marginBottom:-1.5, display:"flex", alignItems:"center", gap:6 }}>
              <Icon name={t.icon} size={13}/> {t.label}
            </button>
          );
        })}
      </div>

      <div key={refreshKey}>
        {tab === "facturas"   && <NepFacturas/>}
        {tab === "pagos"      && <NepPagosGlobal/>}
        {tab === "nc"         && <NepNotasCredito/>}
        {tab === "costos"     && <NepCostos/>}
        {tab === "calendario" && <NepCalendario/>}
        {tab === "catalogo"   && <SkuCatalogo
          skus={window.NEPTUNO_DATA.skus}
          onRefresh={() => setRefreshKey(k=>k+1)}
          categorias={["Pez Espada","Merluza","Bacalao","Pulpo","Calamar","Otros"]}
          accentColor="#0EA5A1"
        />}
      </div>
    </div>
  );
};

Object.assign(window, { NeptunoModule });
