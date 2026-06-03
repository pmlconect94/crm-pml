// ============================================================
// Camanchaca SA — Módulo de Pagos (global)
// Muestra todos los pagos de todos los contenedores SA:
//   1. Pagos al proveedor en USD (completo o abonos)
//   2. Pagos a agencias importadoras en MXN
//   3. Forwards cambiarios
// ============================================================

const { useState: useSAP } = React;

const fmtUSD_SA = (n) => "$" + Number(n||0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMXN_SA = (n) => "$" + Number(n||0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFch_SA = (s) => { if (!s) return "—"; const d = new Date(s + "T12:00:00"); return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }); };

// ── SA: NC por descuento (USD) ────────────────────────────────────────
const CAMSANcModal = ({ folioPrefill, onClose }) => {
  const data  = window.CAMANCHACA_DATA;
  const conts = data.contenedoresSA.filter(c => c.factura);
  const [form, setForm] = useSAP({ folio: folioPrefill||"", montoUSD:"", motivo:"", fecha:"" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.folio && parseFloat(form.montoUSD)>0 && form.motivo && form.fecha;

  const handleSave = () => {
    const c = data.contenedoresSA.find(x => x.folioInterno === form.folio);
    if (!c) return;
    if (!c.nc) c.nc = [];
    c.nc.push({ id:`NC-CAM-${Date.now()}`, montoUSD:parseFloat(form.montoUSD), motivo:form.motivo, fecha:form.fecha, status:"Aplicada" });
    window.camRefresh();
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"white", borderRadius:16, padding:28, width:500, boxShadow:"0 24px 64px rgba(0,0,0,0.25)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
          <div><div style={{ fontSize:16, fontWeight:800 }}>Nota de crédito por descuento</div>
            <div style={{ fontSize:12, color:"var(--ink-500)", marginTop:3 }}>Salmones Camanchaca S.A. · Descuento en USD</div></div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-400)", fontSize:20 }}>✕</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label className="field-label">Contenedor <span style={{ color:"var(--red-500)" }}>*</span></label>
            <select className="field-input" value={form.folio} onChange={e=>set("folio",e.target.value)} disabled={!!folioPrefill} style={{ background:folioPrefill?"var(--ink-50)":"white" }}>
              <option value="">— Seleccionar —</option>
              {conts.map(c => <option key={c.folioInterno} value={c.folioInterno}>{c.folioInterno} · Fac.{c.factura}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Monto USD <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" type="number" step="0.01" value={form.montoUSD} onChange={e=>set("montoUSD",e.target.value)} placeholder="500.00"/>
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

// ── Formulario de pago de importación ─────────────────────────────────────────────
const ImportacionPagoModal = ({ onClose }) => {
  const data = window.CAMANCHACA_DATA;
  const conts = data.contenedoresSA.filter(c => c.factura);
  const [form, setForm] = useSAP({
    folio: "", razonSocial: "", razonCustom: "", montoMXN: "", fecha: "", observaciones: ""
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.folio && form.montoMXN && (form.razonSocial || form.razonCustom);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "white", borderRadius: 16, padding: 28, width: 520, boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Registrar pago de importación</div>
            <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 3 }}>Agencia aduanal · Pago en MXN</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-400)", fontSize: 20 }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label className="field-label">Contenedor / Factura <span style={{ color: "var(--red-500)" }}>*</span></label>
            <select className="field-input" value={form.folio} onChange={e => set("folio", e.target.value)}>
              <option value="">— Seleccionar contenedor —</option>
              {conts.map(c => (
                <option key={c.folioInterno} value={c.folioInterno}>
                  {c.folioInterno} · Fac. {c.factura} · {c.totalKg?.toLocaleString()} kg
                </option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label className="field-label">Razón social (agencia) <span style={{ color: "var(--red-500)" }}>*</span></label>
            <div style={{ display: "flex", gap: 8 }}>
              <select className="field-input" style={{ flex: 1 }} value={form.razonSocial} onChange={e => { set("razonSocial", e.target.value); set("razonCustom", ""); }}>
                <option value="">— Catálogo —</option>
                {data.importadoras.map(imp => <option key={imp} value={imp}>{imp}</option>)}
                <option value="__otro">Otra (escribir)</option>
              </select>
              {form.razonSocial === "__otro" && (
                <input className="field-input" style={{ flex: 1 }} value={form.razonCustom} onChange={e => set("razonCustom", e.target.value)} placeholder="Nombre de la agencia"/>
              )}
            </div>
          </div>
          <div>
            <label className="field-label">Monto MXN <span style={{ color: "var(--red-500)" }}>*</span></label>
            <input className="field-input" type="number" step="100" value={form.montoMXN} onChange={e => set("montoMXN", e.target.value)} placeholder="Ej: 50000"/>
          </div>
          <div>
            <label className="field-label">Fecha de pago</label>
            <input className="field-input" type="date" value={form.fecha} onChange={e => set("fecha", e.target.value)}/>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label className="field-label">Observaciones <span style={{ fontSize: 11, color: "var(--ink-400)", fontWeight: 400 }}>(opcional)</span></label>
            <input className="field-input" value={form.observaciones} onChange={e => set("observaciones", e.target.value)} placeholder="Ej: Pedimento 06/2026-001"/>
          </div>
        </div>

        <div style={{ padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, fontSize: 12, color: "#92400E", marginBottom: 20 }}>
          Este pago se sumará al costo FOB del contenedor para calcular el <strong>costo total internado</strong> en Central de Costos.
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => {
            const c = window.CAMANCHACA_DATA.contenedoresSA.find(x => x.folioInterno === form.folio);
            if (!c) return;
            if (!c.costoImportacion) c.costoImportacion = [];
            c.costoImportacion.push({
              id: `IMP-${Date.now()}`,
              razonSocial: form.razonSocial === "__otro" ? form.razonCustom : form.razonSocial,
              montoMXN: parseFloat(form.montoMXN),
              pagado: true,
              fecha: form.fecha || null,
              observaciones: form.observaciones || null,
            });
            window.camRefresh();
            onClose();
          }} disabled={!valid}>
            <Icon name="check" size={13}/> Registrar pago
          </button>
        </div>
      </div>
    </div>
  );
};

// ── SAPagoModal — Registrar pago al proveedor (USD) ──────────────────────────────
const SAPagoModal = ({ folioPrefill, onClose }) => {
  const data  = window.CAMANCHACA_DATA;
  const conts = data.contenedoresSA.filter(c => c.factura && c.totalUSD);
  const [form, setForm] = useSAP({ folio: folioPrefill || "", monto: "", tc: String(data.tcDelDia), banco: "", referencia: "", fecha: "", tipo: "abono" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const montoMXN = (parseFloat(form.monto)||0) * (parseFloat(form.tc)||0);
  const valid    = form.folio && parseFloat(form.monto) > 0 && parseFloat(form.tc) > 0 && form.banco && form.fecha;

  const handleSave = () => {
    const c = data.contenedoresSA.find(x => x.folioInterno === form.folio);
    if (!c) return;
    if (!c.pagos) c.pagos = [];
    c.pagos.push({ id: `CPAG-SA-${Date.now()}`, monto: parseFloat(form.monto), tc: parseFloat(form.tc), montoMXN, fecha: form.fecha, banco: form.banco, referencia: form.referencia, tipo: form.tipo });
    window.camRefresh();
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"white", borderRadius:16, padding:28, width:520, boxShadow:"0 24px 64px rgba(0,0,0,0.25)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800 }}>Registrar pago al proveedor</div>
            <div style={{ fontSize:12, color:"var(--ink-500)", marginTop:3 }}>Salmones Camanchaca S.A. · Pago en USD</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-400)", fontSize:20 }}>✕</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label className="field-label">Contenedor / Factura <span style={{ color:"var(--red-500)" }}>*</span></label>
            <select className="field-input" value={form.folio} onChange={e=>set("folio",e.target.value)} disabled={!!folioPrefill} style={{ background: folioPrefill ? "var(--ink-50)" : "white" }}>
              <option value="">— Seleccionar —</option>
              {conts.map(c => {
                const paid  = (c.pagos||[]).reduce((s,p)=>s+p.monto,0);
                const saldo = c.totalUSD - paid;
                return <option key={c.folioInterno} value={c.folioInterno}>{c.folioInterno} · Fac.{c.factura} · Saldo: ${saldo.toLocaleString("en-US",{minimumFractionDigits:2})}</option>;
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
            <input className="field-input" type="number" step="0.01" value={form.monto} onChange={e=>set("monto",e.target.value)} placeholder="Ej: 50000"/>
          </div>
          <div>
            <label className="field-label">TC <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" type="number" step="0.0001" value={form.tc} onChange={e=>set("tc",e.target.value)} placeholder={data.tcDelDia.toFixed(4)}/>
          </div>
          <div style={{ gridColumn:"1/-1", padding:"10px 14px", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:9, fontSize:13 }}>
            Equivalente MXN: <strong style={{ fontFamily:"var(--font-mono)", color:"var(--blue-500)" }}>${montoMXN.toLocaleString("es-MX",{minimumFractionDigits:2})}</strong>
          </div>
          <div>
            <label className="field-label">Banco <span style={{ color:"var(--red-500)" }}>*</span></label>
            <select className="field-input" value={form.banco} onChange={e=>set("banco",e.target.value)}>
              <option value="">—</option>
              {data.bancos.map(b=><option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Referencia / SWIFT</label>
            <input className="field-input" value={form.referencia} onChange={e=>set("referencia",e.target.value)} placeholder="TRF-12345"/>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!valid}>
            <Icon name="check" size={13}/> Registrar pago
          </button>
        </div>
      </div>
    </div>
  );
};

// ── SAForwardModal — Registrar forward cambiario ────────────────────────────
const SAForwardModal = ({ onClose }) => {
  const data  = window.CAMANCHACA_DATA;
  const conts = data.contenedoresSA.filter(c => c.factura && c.totalUSD);
  const [form, setForm] = useSAP({ folio:"", montoUSD:"", tcForward:"", fechaCierre:"", fechaEntrega:"", banco:"" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const montoMXN = (parseFloat(form.montoUSD)||0) * (parseFloat(form.tcForward)||0);
  const valid = form.folio && form.montoUSD && form.tcForward && form.fechaCierre && form.fechaEntrega && form.banco;

  const handleSave = () => {
    const c = data.contenedoresSA.find(x => x.folioInterno === form.folio);
    if (!c) return;
    if (!c.forwards) c.forwards = [];
    c.forwards.push({
      id: `FWD-CAM-${Date.now()}`, montoUSD: parseFloat(form.montoUSD), tcForward: parseFloat(form.tcForward),
      montoMXN, fechaCierre: form.fechaCierre, fechaEntrega: form.fechaEntrega, banco: form.banco, status: "Pendiente",
    });
    window.camRefresh();
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"white", borderRadius:16, padding:28, width:520, boxShadow:"0 24px 64px rgba(0,0,0,0.25)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div><div style={{ fontSize:16, fontWeight:800 }}>Registrar forward cambiario</div>
            <div style={{ fontSize:12, color:"var(--ink-500)", marginTop:3 }}>Cobertura de TC a futuro · MONEX o SANTANDER</div></div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-400)", fontSize:20 }}>✕</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label className="field-label">Contenedor / Factura <span style={{ color:"var(--red-500)" }}>*</span></label>
            <select className="field-input" value={form.folio} onChange={e=>set("folio",e.target.value)}>
              <option value="">— Seleccionar —</option>
              {conts.map(c => <option key={c.folioInterno} value={c.folioInterno}>{c.folioInterno} · Fac.{c.factura} · {fmtUSD_SA(c.totalUSD)}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Monto USD <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" type="number" step="0.01" value={form.montoUSD} onChange={e=>set("montoUSD",e.target.value)} placeholder="98640"/>
          </div>
          <div>
            <label className="field-label">TC Forward <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" type="number" step="0.0001" value={form.tcForward} onChange={e=>set("tcForward",e.target.value)} placeholder="17.7500"/>
          </div>
          <div style={{ gridColumn:"1/-1", padding:"10px 14px", background:"#EDE9FE", border:"1px solid #DDD6FE", borderRadius:9, fontSize:13 }}>
            MXN asegurado: <strong style={{ fontFamily:"var(--font-mono)", color:"#5B21B6" }}>${montoMXN.toLocaleString("es-MX",{minimumFractionDigits:2})}</strong>
          </div>
          <div>
            <label className="field-label">Fecha de cierre <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" type="date" value={form.fechaCierre} onChange={e=>set("fechaCierre",e.target.value)}/>
          </div>
          <div>
            <label className="field-label">Fecha de entrega <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" type="date" value={form.fechaEntrega} onChange={e=>set("fechaEntrega",e.target.value)}/>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label className="field-label">Banco <span style={{ color:"var(--red-500)" }}>*</span></label>
            <select className="field-input" value={form.banco} onChange={e=>set("banco",e.target.value)}>
              <option value="">—</option>
              {data.bancos.map(b=><option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!valid}>
            <Icon name="check" size={13}/> Guardar forward
          </button>
        </div>
      </div>
    </div>
  );
};

const SAGlobalPagos = () => {
  const data        = window.CAMANCHACA_DATA;
  const contenedores = data.contenedoresSA.filter(c => c.factura);
  const [subTab, setSubTab]           = useSAP("proveedor");
  const [showImpForm, setShowImpForm] = useSAP(false);
  const [showPagoForm, setShowPagoForm] = useSAP(false);
  const [showFwdForm, setShowFwdForm]   = useSAP(false);
  const [showNCForm,  setShowNCForm]    = useSAP(false);

  // Agrega todos los pagos al proveedor de todos los contenedores
  const todosLosPagos = contenedores.flatMap(c =>
    (c.pagos || []).map(p => ({ ...p, folio: c.folioInterno, factura: c.factura }))
  );

  // Todos los costos de importación de todos los contenedores
  const todosLosImp = contenedores.flatMap(c =>
    (c.costoImportacion || []).map(imp => ({ ...imp, folio: c.folioInterno, factura: c.factura }))
  );

  // Todos los forwards de todos los contenedores
  const todosLosForwards = contenedores.flatMap(c =>
    (c.forwards || []).map(f => ({ ...f, folio: c.folioInterno, factura: c.factura }))
  );

  // KPIs globales
  const totalFacturadoUSD = contenedores.reduce((s, c) => s + (c.totalUSD || 0), 0);
  const totalPagadoUSD    = todosLosPagos.reduce((s, p) => s + p.monto, 0);
  const saldoUSD          = totalFacturadoUSD - totalPagadoUSD;
  const totalImpMXN       = todosLosImp.reduce((s, i) => s + i.montoMXN, 0);
  const impPagadoMXN      = todosLosImp.filter(i => i.pagado).reduce((s, i) => s + i.montoMXN, 0);
  const impPendienteMXN   = totalImpMXN - impPagadoMXN;
  const totalForwardUSD   = todosLosForwards.reduce((s, f) => s + f.montoUSD, 0);

  const subTabs = [
    { id: "proveedor",   label: "Proveedor (USD)",         badge: todosLosPagos.length },
    { id: "importacion", label: "Importación (MXN)",       badge: todosLosImp.length },
    { id: "forwards",    label: "Forwards cambiarios",     badge: todosLosForwards.length },
    { id: "nc",          label: "Notas de crédito",        badge: contenedores.reduce((s,c)=>s+(c.nc||[]).length,0) || null },
    { id: "comparacion", label: "Comparación internación", badge: null },
  ];

  return (
    <div>
      {/* KPIs principales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total facturado",      value: fmtUSD_SA(totalFacturadoUSD), sub: "USD proveedor",         color: null },
          { label: "Pagado al proveedor",  value: fmtUSD_SA(totalPagadoUSD),    sub: "USD liquidados",        color: "var(--green-500)" },
          { label: "Saldo pendiente",      value: fmtUSD_SA(saldoUSD),           sub: "USD por liquidar",      color: saldoUSD > 0 ? "var(--amber-500)" : "var(--ink-400)" },
          { label: "Costo importación",    value: fmtMXN_SA(totalImpMXN),       sub: `${fmtMXN_SA(impPendienteMXN)} pendiente`, color: "var(--blue-500)" },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color || "var(--ink-900)", fontFamily: "var(--font-mono)" }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "var(--ink-400)", marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--ink-200)", marginBottom: 16 }}>
        {subTabs.map(t => {
          const active = subTab === t.id;
          return (
            <button key={t.id} onClick={() => setSubTab(t.id)} style={{
              padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: "none", background: "transparent",
              color: active ? "var(--blue-500)" : "var(--ink-600)",
              borderBottom: active ? "2px solid var(--blue-500)" : "2px solid transparent",
              marginBottom: -1, display: "flex", alignItems: "center", gap: 7,
            }}>
              {t.label}
              <span style={{ padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: active ? "var(--blue-500)" : "var(--ink-100)", color: active ? "white" : "var(--ink-500)" }}>
                {t.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Pagos al proveedor (USD) ── */}
      {subTab === "proveedor" && (
        <div>
          <div style={{ padding: "10px 14px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 9, fontSize: 12, color: "#1E40AF", marginBottom: 14 }}>
            Pagos en <strong>USD</strong> a Salmones Camanchaca S.A. (Chile). Pueden ser pago completo o abonos parciales. El TC capturado en cada pago se usa para calcular el costo promedio ponderado en Central de Costos.
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-700)" }}>Pagos al proveedor</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowPagoForm(true)}><Icon name="plus" size={12}/> Registrar pago</button>
            </div>
            {todosLosPagos.length > 0 ? (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Folio</th><th>Factura</th><th>ID Pago</th><th>Tipo</th>
                    <th style={{ textAlign: "right" }}>Monto USD</th>
                    <th style={{ textAlign: "right" }}>TC</th>
                    <th style={{ textAlign: "right" }}>Monto MXN</th>
                    <th>Banco</th><th>Referencia</th><th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {todosLosPagos.map(p => (
                    <tr key={p.id}>
                      <td className="mono fw-700">{p.folio}</td>
                      <td className="mono text-sm">{p.factura}</td>
                      <td className="mono text-xs" style={{ color: "var(--ink-500)" }}>{p.id}</td>
                      <td><span className="badge badge-blue">{p.tipo}</span></td>
                      <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "var(--blue-500)", textAlign: "right" }}>{fmtUSD_SA(p.monto)}</td>
                      <td style={{ textAlign: "right" }} className="mono">{p.tc.toFixed(4)}</td>
                      <td style={{ textAlign: "right" }} className="mono fw-600">{fmtMXN_SA(p.montoMXN)}</td>
                      <td className="text-sm">{p.banco}</td>
                      <td className="mono text-xs">{p.referencia}</td>
                      <td className="text-sm">{fmtFch_SA(p.fecha)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--ink-50)" }}>
                    <td colSpan={4} className="fw-700">TOTAL PAGADO</td>
                    <td style={{ textAlign: "right" }} className="mono fw-800" style={{ color: "var(--blue-500)", textAlign: "right", fontSize: 14 }}>{fmtUSD_SA(totalPagadoUSD)}</td>
                    <td colSpan={5}></td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-400)", fontSize: 13 }}>Sin pagos registrados aún</div>
            )}
          </div>
        </div>
      )}

      {/* ── Pagos importación (MXN) ── */}
      {subTab === "importacion" && (
        <div>
          <div style={{ padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, fontSize: 12, color: "#92400E", marginBottom: 14 }}>
            Pagos en <strong>MXN</strong> a agencias aduanales (LTP Importaciones, MAFA, etc.). Se suman al costo FOB del contenedor para calcular el <strong>costo total internado en bodega</strong>.
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-700)" }}>Pagos a agencias importadoras</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowImpForm(true)}>
                <Icon name="plus" size={12}/> Registrar pago importación
              </button>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Folio</th><th>Factura</th><th>Razón Social</th>
                  <th style={{ textAlign: "right" }}>Monto MXN</th>
                  <th>Fecha</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {todosLosImp.map((imp, i) => (
                  <tr key={i}>
                    <td className="mono fw-700">{imp.folio}</td>
                    <td className="mono text-sm">{imp.factura}</td>
                    <td className="fw-600 text-sm">{imp.razonSocial}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "var(--amber-500)", textAlign: "right" }}>{fmtMXN_SA(imp.montoMXN)}</td>
                    <td className="text-sm">{fmtFch_SA(imp.fecha)}</td>
                    <td>
                      <span className={`badge ${imp.pagado ? "badge-green" : "badge-amber"}`}>{imp.pagado ? "Pagado" : "Pendiente"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--ink-50)" }}>
                  <td colSpan={3} className="fw-700">TOTAL IMPORTACIÓN</td>
                  <td style={{ textAlign: "right" }} className="mono fw-800" style={{ color: "var(--amber-500)", textAlign: "right", fontSize: 14 }}>{fmtMXN_SA(totalImpMXN)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {showImpForm  && <ImportacionPagoModal onClose={() => setShowImpForm(false)}/>}
      {showPagoForm && <SAPagoModal onClose={() => setShowPagoForm(false)}/>}
      {showFwdForm  && <SAForwardModal onClose={() => setShowFwdForm(false)}/>}
      {showNCForm   && <CAMSANcModal onClose={() => setShowNCForm(false)}/>}

      {/* ── Forwards ── */}
      {subTab === "forwards" && (
        <div>
          <div style={{ padding: "10px 14px", background: "#EDE9FE", border: "1px solid #DDD6FE", borderRadius: 9, fontSize: 12, color: "#5B21B6", marginBottom: 14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span>Forwards cambiarios cerrados con MONEX o SANTANDER. Fijan el TC de pago al proveedor a futuro. El TC forward se usa en Central de Costos si aún no hay pagos reales.</span>
            <button className="btn btn-sm" style={{ background:"#5B21B6", color:"white", border:"none", marginLeft:12, flexShrink:0 }} onClick={() => setShowFwdForm(true)}>
              <Icon name="plus" size={12}/> Nuevo forward
            </button>
          </div>
          {todosLosForwards.length > 0 ? (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Folio</th><th>Factura</th><th>ID</th>
                    <th style={{ textAlign: "right" }}>Monto USD</th>
                    <th style={{ textAlign: "right" }}>TC Forward</th>
                    <th style={{ textAlign: "right" }}>MXN asegurado</th>
                    <th>Banco</th><th>F. Cierre</th><th>F. Entrega</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todosLosForwards.map(f => (
                    <tr key={f.id}>
                      <td className="mono fw-700">{f.folio}</td>
                      <td className="mono text-sm">{f.factura}</td>
                      <td className="mono text-xs" style={{ color: "var(--ink-500)" }}>{f.id}</td>
                      <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "var(--blue-500)", textAlign: "right" }}>{fmtUSD_SA(f.montoUSD)}</td>
                      <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "#5B21B6", textAlign: "right" }}>{f.tcForward.toFixed(4)}</td>
                      <td style={{ textAlign: "right" }} className="mono fw-600">{fmtMXN_SA(f.montoMXN)}</td>
                      <td className="text-sm">{f.banco}</td>
                      <td className="text-sm">{fmtFch_SA(f.fechaCierre)}</td>
                      <td className="text-sm">{fmtFch_SA(f.fechaEntrega)}</td>
                      <td>
                        <span className={`badge ${f.status === "Ejecutado" ? "badge-green" : "badge-violet"}`}>{f.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card" style={{ padding: "40px 32px", textAlign: "center", color: "var(--ink-400)" }}>
              <Icon name="shield" size={28}/>
              <div style={{ marginTop: 10, fontWeight: 600 }}>Sin forwards registrados</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Los forwards cambiarios aparecen aquí cuando se cierran en el banco.</div>
            </div>
          )}
        </div>
      )}

      {subTab === "comparacion" && <ComparacionInternacion contenedores={contenedores} data={data}/>}

      {/* ── Notas de crédito SA ── */}
      {subTab === "nc" && (() => {
        const allNC = contenedores.flatMap(c => (c.nc||[]).map(n => ({ ...n, folio:c.folioInterno, factura:c.factura })));
        const total = allNC.reduce((s,n)=>s+n.montoUSD,0);
        return (
          <div>
            <div style={{ padding:"10px 14px", background:"#FEF3C7", border:"1px solid #FDE68A", borderRadius:9, fontSize:12, color:"#92400E", marginBottom:14 }}>
              <strong>Notas de crédito por descuento</strong> — Se aplican al saldo pendiente del contenedor. En USD.
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
              {[{ label:"NCs totales", value:allNC.length }, { label:"Total descuentos USD", value:fmtUSD_SA(total), color:"var(--amber-500)" }, { label:"NCs aplicadas", value:allNC.filter(n=>n.status==="Aplicada").length, color:"var(--green-500)" }].map((k,i) => (
                <div key={i} className="card" style={{ padding:"14px 16px" }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--ink-500)", marginBottom:6 }}>{k.label}</div>
                  <div style={{ fontSize:20, fontWeight:800, fontFamily:"var(--font-mono)", color:k.color||"var(--ink-900)" }}>{k.value}</div>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding:0, overflow:"hidden" }}>
              <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--ink-100)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:12, fontWeight:700, color:"var(--ink-700)" }}>Historial de notas de crédito</span>
                <button className="btn btn-accent btn-sm" onClick={() => setShowNCForm(true)}><Icon name="plus" size={12}/> Nueva NC</button>
              </div>
              {allNC.length > 0 ? (
                <table className="tbl">
                  <thead><tr><th>Folio</th><th>Factura</th><th>ID NC</th><th style={{ textAlign:"right" }}>Monto USD</th><th>Motivo</th><th>Fecha</th><th>Status</th></tr></thead>
                  <tbody>
                    {allNC.map(n => (
                      <tr key={n.id}>
                        <td className="mono fw-700" style={{ color:"var(--blue-500)" }}>{n.folio}</td>
                        <td className="mono text-sm">{n.factura}</td>
                        <td className="mono text-xs" style={{ color:"var(--ink-500)" }}>{n.id}</td>
                        <td style={{ textAlign:"right" }} className="mono fw-700" style={{ color:"var(--amber-500)", textAlign:"right" }}>{fmtUSD_SA(n.montoUSD)}</td>
                        <td className="text-sm">{n.motivo}</td>
                        <td className="text-sm">{fmtFch_SA(n.fecha)}</td>
                        <td><span className="badge badge-green">{n.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding:"32px", textAlign:"center", color:"var(--ink-400)", fontSize:13 }}>Sin notas de crédito registradas</div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

const ComparacionInternacion = ({ contenedores, data }) => {
  const filas = contenedores.map(c => {
    const ps     = c.pagos || [];
    const paid   = ps.reduce((s, p) => s + p.monto, 0);
    const tc     = ps.length ? ps.reduce((s, p) => s + p.tc * p.monto, 0) / paid
                 : (c.forwards?.[0]?.tcForward || data.tcDelDia);
    const fobMXN = (c.totalUSD || 0) * tc;
    const impMXN = (c.costoImportacion || []).reduce((s, i) => s + i.montoMXN, 0);
    const totMXN = fobMXN + impMXN;
    const impKg  = c.totalKg ? impMXN / c.totalKg : 0;
    const totKg  = c.totalKg ? totMXN / c.totalKg : 0;
    const pctImp = fobMXN ? (impMXN / fobMXN * 100) : 0;
    return { ...c, tc, fobMXN, impMXN, totMXN, impKg, totKg, pctImp, agencies: c.costoImportacion || [] };
  });

  const totFOBusd = filas.reduce((s, f) => s + (f.totalUSD || 0), 0);
  const totImpMXN = filas.reduce((s, f) => s + f.impMXN, 0);
  const totTotMXN = filas.reduce((s, f) => s + f.totMXN, 0);
  const allAgencies = [...new Set(filas.flatMap(f => f.agencies.map(a => a.razonSocial)))];

  return (
    <div>
      <div style={{ padding: "10px 14px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 9, fontSize: 12, color: "#1E40AF", marginBottom: 14 }}>
        <span className="fw-700">Comparación de costo de internación por contenedor</span> — FOB (USD→MXN) + costo de importación desglosado por agencia = costo total internado en bodega.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total FOB (USD)",          value: fmtUSD_SA(totFOBusd),  color: "var(--blue-500)" },
          { label: "Total importación (MXN)",   value: fmtMXN_SA(totImpMXN),  color: "var(--amber-500)" },
          { label: "Total internado (MXN)",     value: fmtMXN_SA(totTotMXN),  strong: true },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: "14px 16px", background: k.strong ? "var(--ink-900)" : "white" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: k.strong ? "rgba(255,255,255,0.5)" : "var(--ink-500)", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--font-mono)", color: k.strong ? "white" : k.color || "var(--ink-900)" }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Folio</th><th>Factura</th>
              <th style={{ textAlign: "right" }}>Kg</th>
              <th style={{ textAlign: "right" }}>FOB USD</th>
              <th style={{ textAlign: "right" }}>TC</th>
              <th style={{ textAlign: "right" }}>FOB MXN</th>
              {allAgencies.map(a => <th key={a} style={{ textAlign: "right" }}>{a}</th>)}
              <th style={{ textAlign: "right" }}>Total Imp.</th>
              <th style={{ textAlign: "right" }}>% del FOB</th>
              <th style={{ textAlign: "right" }}>Total MXN/kg</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                <td className="mono fw-700" style={{ color: "var(--blue-500)" }}>{f.folioInterno}</td>
                <td className="mono text-sm">{f.factura}</td>
                <td style={{ textAlign: "right" }} className="mono">{f.totalKg?.toLocaleString()}</td>
                <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "var(--blue-500)", textAlign: "right" }}>{fmtUSD_SA(f.totalUSD)}</td>
                <td style={{ textAlign: "right" }} className="mono">{f.tc.toFixed(4)}</td>
                <td style={{ textAlign: "right" }} className="mono">{fmtMXN_SA(f.fobMXN)}</td>
                {allAgencies.map(a => {
                  const entry = f.agencies.find(ag => ag.razonSocial === a);
                  return (
                    <td key={a} style={{ textAlign: "right" }} className="mono" style={{ color: entry ? "var(--amber-500)" : "var(--ink-300)", textAlign: "right" }}>
                      {entry ? fmtMXN_SA(entry.montoMXN) : "—"}
                    </td>
                  );
                })}
                <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "var(--amber-500)", textAlign: "right" }}>{fmtMXN_SA(f.impMXN)}</td>
                <td style={{ textAlign: "right" }}>
                  <span style={{ padding: "2px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: f.pctImp > 12 ? "#FEE2E2" : f.pctImp > 8 ? "#FEF3C7" : "#D1FAE5",
                    color: f.pctImp > 12 ? "#991B1B" : f.pctImp > 8 ? "#92400E" : "#065F46" }}>
                    {f.pctImp.toFixed(1)}%
                  </span>
                </td>
                <td style={{ textAlign: "right" }} className="mono fw-800">{fmtMXN_SA(f.totKg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

Object.assign(window, { SAGlobalPagos, SAPagoModal });
