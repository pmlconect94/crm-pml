// ============================================================
// Camanchaca SA — Formularios
//   SAOrdenForm:   agregar orden del calendario del proveedor
//   SAFacturaForm: capturar factura con SKUs + ETA + vencimiento
//   Ambos se exportan a window y los usa camanchaca.jsx
// ============================================================

const { useState: useSAF, useEffect: useEffSAF } = React;

const fmtUSD_SAF = (n) => "$" + Number(n||0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const addDays = (dateStr, days) => {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

// ── Modal base ────────────────────────────────────────────────────────────────
const SAModal = ({ title, subtitle, width = 560, onClose, children, footer }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={{ background: "white", borderRadius: 16, padding: 28, width, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink-900)" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 3 }}>{subtitle}</div>}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-400)", fontSize: 20, lineHeight: 1, padding: 0 }}>✕</button>
      </div>
      <div>{children}</div>
      {footer && <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--ink-100)" }}>{footer}</div>}
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════════
// SAOrdenForm — Agregar orden del calendario (WhatsApp de Felipe)
// Captura: OC, descripción estimada, kg estimados, llegada estimada (texto libre)
// ════════════════════════════════════════════════════════════════════════════════
const SAOrdenForm = ({ onClose, prefill = {} }) => {
  const [form, setForm] = useSAF({
    ocProveedor:  prefill.ocProveedor  || "",
    desc:         prefill.desc         || "",
    kgEst:        prefill.kgEst        || "",
    llegadaEst:   prefill.llegadaEst   || "",
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.ocProveedor.trim() !== "";

  return (
    <SAModal
      title="Agregar orden del proveedor"
      subtitle="Información del calendario que Felipe manda por WhatsApp"
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={onClose} disabled={!valid}>
          <Icon name="check" size={13}/> Guardar orden
        </button>
      </>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label className="field-label">OC Proveedor <span style={{ color: "var(--red-500)" }}>*</span></label>
          <input className="field-input" value={form.ocProveedor} onChange={e => set("ocProveedor", e.target.value)} placeholder="Ej: 64650"/>
        </div>
        <div>
          <label className="field-label">Kg estimados</label>
          <input className="field-input" type="number" value={form.kgEst} onChange={e => set("kgEst", e.target.value)} placeholder="Ej: 14000"/>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label className="field-label">Descripción estimada</label>
          <input className="field-input" value={form.desc} onChange={e => set("desc", e.target.value)} placeholder="Ej: Salmon Premium Posta Origen"/>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label className="field-label">Llegada estimada <span style={{ fontSize: 11, color: "var(--ink-400)", fontWeight: 400 }}>(texto libre, como lo escribe Felipe)</span></label>
          <input className="field-input" value={form.llegadaEst} onChange={e => set("llegadaEst", e.target.value)} placeholder="Ej: mediados julio 2026"/>
        </div>
      </div>
      <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--ink-50)", borderRadius: 9, fontSize: 12, color: "var(--ink-500)" }}>
        Cuando llegue la factura formal, usa <strong>"Confirmar con factura →"</strong> en esta orden para capturar los SKUs, precios y ETAs oficiales.
      </div>
    </SAModal>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// SAFacturaForm — Capturar / confirmar una factura
// Paso 1: Datos generales (OC, factura, vencimiento, ETA, naviera)
// Paso 2: SKUs y precios USD
//
// Si viene con prefill.ocProveedor es una "confirmación" de una orden planeada.
// Si viene vacío es un contenedor nuevo directo.
//
// ETA Bodega = ETA Manzanillo + 7 días (auto, editable)
// ════════════════════════════════════════════════════════════════════════════════
const SAFacturaForm = ({ onClose, prefill = {} }) => {
  const data = window.CAMANCHACA_DATA;
  const [step, setStep] = useSAF(1);

  const [form, setForm] = useSAF({
    folioInterno:     prefill.folioInterno     || "CAM-009",
    ocProveedor:      prefill.ocProveedor      || "",
    factura:          "",
    fechaFactura:     "",
    fechaVencimiento: "",
    etaManzanillo:    "",
    etaBodega:        "",
    naviera:          "",
  });
  const [lineas, setLineas] = useSAF([]);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleManzanillo = (v) => {
    set("etaManzanillo", v);
    if (v) set("etaBodega", addDays(v, 7));
  };

  const addLinea  = ()        => setLineas(p => [...p, { code: "", kgCaja: 0, cajas: "", precioUSD: "" }]);
  const removeLinea = (i)     => setLineas(p => p.filter((_, idx) => idx !== i));
  const updateLinea = (i, k, v) => setLineas(p => p.map((l, idx) => {
    if (idx !== i) return l;
    const up = { ...l, [k]: v };
    if (k === "code") up.kgCaja = data.skus.find(s => s.code === v)?.kgCaja || 0;
    return up;
  }));

  const totalKg  = lineas.reduce((s, l) => s + (parseFloat(l.cajas)||0) * (l.kgCaja||0), 0);
  const totalUSD = lineas.reduce((s, l) => {
    const kg = (parseFloat(l.cajas)||0) * (l.kgCaja||0);
    return s + kg * (parseFloat(l.precioUSD)||0);
  }, 0);

  const step1Valid = form.ocProveedor && form.factura && form.fechaFactura;
  const step2Valid = lineas.some(l => l.code && parseFloat(l.cajas) > 0);

  const NAVIERAS = ["COSCO","HAPAG-LLOYD","CSAV","MAERSK","EVERGREEN","MSC","OOCL"];

  return (
    <SAModal
      title={prefill.ocProveedor ? `Confirmar factura — OC ${prefill.ocProveedor}` : "Nuevo contenedor con factura"}
      subtitle="Salmones Camanchaca, S.A. · Importación desde Chile"
      width={step === 2 ? 800 : 600}
      onClose={onClose}
      footer={
        step === 1
          ? <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!step1Valid}>
                Siguiente: SKUs <Icon name="arrowRight" size={13}/>
              </button></>
          : <><button className="btn btn-ghost" onClick={() => setStep(1)}><Icon name="chevLeft" size={13}/> Anterior</button>
              <button className="btn btn-primary" onClick={onClose} disabled={!step2Valid}>
                <Icon name="check" size={13}/> Guardar factura
              </button></>
      }
    >
      {/* Step tabs */}
      <div style={{ display: "flex", marginBottom: 20, borderRadius: 8, overflow: "hidden", border: "1px solid var(--ink-200)" }}>
        {[{ n: 1, label: "① Datos generales" }, { n: 2, label: "② Productos (SKUs)" }].map(s => (
          <button key={s.n} onClick={() => { if (s.n === 2 && step1Valid) setStep(2); if (s.n === 1) setStep(1); }}
            style={{ flex: 1, padding: "9px 0", fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "none",
              background: step === s.n ? "var(--blue-500)" : "white",
              color: step === s.n ? "white" : step1Valid || s.n === 1 ? "var(--ink-700)" : "var(--ink-300)",
              borderRight: s.n === 1 ? "1px solid var(--ink-200)" : "none",
            }}>{s.label}</button>
        ))}
      </div>

      {/* Paso 1 — Datos generales */}
      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label className="field-label">Folio interno (auto)</label>
            <input className="field-input" value={form.folioInterno} disabled style={{ background: "var(--ink-50)", fontFamily: "var(--font-mono)", fontWeight: 700 }}/>
          </div>
          <div>
            <label className="field-label">OC Proveedor <span style={{ color: "var(--red-500)" }}>*</span></label>
            <input className="field-input" value={form.ocProveedor} onChange={e => set("ocProveedor", e.target.value)} placeholder="64612"/>
          </div>
          <div>
            <label className="field-label">Número de factura <span style={{ color: "var(--red-500)" }}>*</span></label>
            <input className="field-input" value={form.factura} onChange={e => set("factura", e.target.value)} placeholder="36921"/>
          </div>
          <div>
            <label className="field-label">Fecha de factura <span style={{ color: "var(--red-500)" }}>*</span></label>
            <input className="field-input" type="date" value={form.fechaFactura} onChange={e => set("fechaFactura", e.target.value)}/>
          </div>
          <div>
            <label className="field-label">Fecha de vencimiento</label>
            <input className="field-input" type="date" value={form.fechaVencimiento} onChange={e => set("fechaVencimiento", e.target.value)}/>
          </div>
          <div>
            <label className="field-label">Naviera</label>
            <select className="field-input" value={form.naviera} onChange={e => set("naviera", e.target.value)}>
              <option value="">— Seleccionar —</option>
              {NAVIERAS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">ETA Manzanillo</label>
            <input className="field-input" type="date" value={form.etaManzanillo} onChange={e => handleManzanillo(e.target.value)}/>
          </div>
          <div>
            <label className="field-label">
              ETA Bodega
              <span style={{ fontSize: 10, color: "var(--blue-500)", fontWeight: 500, marginLeft: 6 }}>auto +7d · editable</span>
            </label>
            <input className="field-input" type="date" value={form.etaBodega} onChange={e => set("etaBodega", e.target.value)}/>
          </div>
          {form.etaManzanillo && (
            <div style={{ gridColumn: "1/-1", padding: "10px 14px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 9, fontSize: 12, color: "#1E40AF" }}>
              📦 ETA Bodega calculado: <strong>{form.etaBodega || "—"}</strong> (ETA Manzanillo + 7 días). Puedes ajustarlo si cambia.
            </div>
          )}
        </div>
      )}

      {/* Paso 2 — SKUs */}
      {step === 2 && (
        <div>
          {lineas.length === 0 && (
            <div style={{ padding: "32px", textAlign: "center", border: "1px dashed var(--ink-200)", borderRadius: 10, color: "var(--ink-400)", marginBottom: 14 }}>
              <Icon name="pkg" size={28}/>
              <div style={{ marginTop: 8, fontSize: 13 }}>Agrega los productos de la factura</div>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={addLinea}><Icon name="plus" size={12}/> Agregar primera línea</button>
            </div>
          )}
          {lineas.map((l, i) => {
            const kg  = (parseFloat(l.cajas)||0) * (l.kgCaja||0);
            const tot = kg * (parseFloat(l.precioUSD)||0);
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 70px 80px 110px 100px 28px", gap: 8, alignItems: "end", marginBottom: 10, padding: "12px 14px", background: "var(--ink-50)", borderRadius: 10 }}>
                <div>
                  <label className="field-label" style={{ fontSize: 10, marginBottom: 4 }}>SKU</label>
                  <select className="field-input" style={{ fontSize: 12 }} value={l.code} onChange={e => updateLinea(i, "code", e.target.value)}>
                    <option value="">— Seleccionar SKU —</option>
                    {data.skus.map(s => <option key={s.code} value={s.code}>{s.code} · {s.desc}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label" style={{ fontSize: 10, marginBottom: 4 }}>kg/Caja</label>
                  <input className="field-input" value={l.kgCaja || ""} readOnly style={{ background: "var(--ink-100)", fontSize: 12, cursor: "default", textAlign: "right", fontFamily: "var(--font-mono)" }}/>
                </div>
                <div>
                  <label className="field-label" style={{ fontSize: 10, marginBottom: 4 }}>Cajas</label>
                  <input className="field-input" type="number" min="0" value={l.cajas} onChange={e => updateLinea(i, "cajas", e.target.value)} style={{ fontSize: 12, textAlign: "right", fontFamily: "var(--font-mono)" }}/>
                </div>
                <div>
                  <label className="field-label" style={{ fontSize: 10, marginBottom: 4 }}>USD/kg</label>
                  <input className="field-input" type="number" step="0.001" min="0" value={l.precioUSD} onChange={e => updateLinea(i, "precioUSD", e.target.value)} style={{ fontSize: 12, textAlign: "right", fontFamily: "var(--font-mono)" }}/>
                </div>
                <div>
                  <label className="field-label" style={{ fontSize: 10, marginBottom: 4 }}>Total USD</label>
                  <div style={{ padding: "8px 10px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--blue-500)", textAlign: "right" }}>
                    {fmtUSD_SAF(tot)}
                  </div>
                </div>
                <button onClick={() => removeLinea(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red-500)", fontSize: 18, lineHeight: 1, padding: 0, marginBottom: 4 }}>✕</button>
              </div>
            );
          })}
          {lineas.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={addLinea} style={{ marginBottom: 14 }}>
              <Icon name="plus" size={12}/> Agregar línea
            </button>
          )}
          {lineas.some(l => l.code) && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "var(--ink-900)", borderRadius: 10 }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                {lineas.filter(l => l.code).length} SKUs · {Number(totalKg).toLocaleString("es-MX")} kg totales
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "var(--font-mono)", color: "white" }}>
                {fmtUSD_SAF(totalUSD)}
              </div>
            </div>
          )}
        </div>
      )}
    </SAModal>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// SAETAEditor — edición inline de ETAs en el detalle del contenedor
// ════════════════════════════════════════════════════════════════════════════════
const SAETAEditor = ({ etaManzanillo, etaBodega, onSave, onCancel }) => {
  const [manz, setManz] = useSAF(etaManzanillo || "");
  const [bod,  setBod]  = useSAF(etaBodega     || "");

  const handleManz = (v) => {
    setManz(v);
    if (v) setBod(addDays(v, 7));
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, padding: "12px 16px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10 }}>
      <div>
        <label className="field-label" style={{ fontSize: 10 }}>ETA Manzanillo</label>
        <input className="field-input" type="date" value={manz} onChange={e => handleManz(e.target.value)} style={{ width: 160 }}/>
      </div>
      <div>
        <label className="field-label" style={{ fontSize: 10 }}>ETA Bodega <span style={{ color: "var(--blue-500)" }}>+7d</span></label>
        <input className="field-input" type="date" value={bod} onChange={e => setBod(e.target.value)} style={{ width: 160 }}/>
      </div>
      <button className="btn btn-primary btn-sm" onClick={() => onSave(manz, bod)}>
        <Icon name="check" size={12}/> Guardar
      </button>
      <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancelar</button>
      <span style={{ fontSize: 11, color: "#92400E", marginLeft: 4 }}>ETA Bodega = Manzanillo + 7d (editable)</span>
    </div>
  );
};

Object.assign(window, { SAOrdenForm, SAFacturaForm, SAETAEditor });
