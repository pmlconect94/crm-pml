// ============================================
// Blufin Seafood — Bulk PDF upload
// 3 variaciones del flujo:
//   A · Tabla de revisión (todos visibles, editable inline)
//   B · Wizard (uno por uno, apruebo y avanzo)
//   C · Split view (PDF + formulario editable + navegador)
// ============================================

const { useState: useStateBulk, useEffect: useEffectBulk, useRef: useRefBulk, useMemo: useMemoBulk } = React;
const { fmtUSD: $fmtUSD, fmtKg: $fmtKg, fmtFecha: $fmtFecha, fmtFechaCorta: $fmtFechaCorta, StatusPill: $StatusPill, Field: $Field } = window;

// ============================================
// PDF DROP ZONE — Empty state
// ============================================
const PDFDropZone = ({ onUpload }) => {
  const [dragging, setDragging] = useStateBulk(false);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); onUpload(); }}
      style={{
        border: "2px dashed " + (dragging ? "var(--blue-500)" : "var(--ink-300)"),
        background: dragging ? "#E6F4FF" : "#F8FAFC",
        borderRadius: 16, padding: 64, textAlign: "center",
        transition: "all 0.2s",
      }}
    >
      <div style={{
        width: 64, height: 64, borderRadius: 16, background: "white", margin: "0 auto 16px",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--blue-500)", boxShadow: "0 4px 12px rgba(0,115,230,0.12)",
      }}>
        <Icon name="download" size={28} />
      </div>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Arrastra el PDF o haz clic para subirlo</h3>
      <p className="muted" style={{ marginTop: 8, fontSize: 13, maxWidth: 480, margin: "8px auto 0" }}>
        Sube el contrato marco con todas las órdenes de compra. El sistema detectará cada orden, extraerá los campos y te dejará revisarlos antes de guardar.
      </p>
      <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onUpload}>
        <Icon name="plus" size={14} /> Seleccionar PDF
      </button>
      <div className="text-xs muted" style={{ marginTop: 16 }}>
        Formatos soportados: PDF · Máximo 50MB · Hasta 50 órdenes por archivo
      </div>

      {/* Tips */}
      <div style={{
        marginTop: 32, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 720, margin: "32px auto 0",
        textAlign: "left",
      }}>
        {[
          { icon: "check", title: "Extracción inteligente", text: "Reconocemos folio MCO-CV, marca, talla, kg, precios y fechas." },
          { icon: "alert", title: "Campos con baja confianza", text: "Resaltamos en amarillo/rojo los que necesitan tu revisión." },
          { icon: "shield", title: "Duplicados detectados", text: "Si un folio ya existe en sistema te avisamos antes de guardar." },
        ].map((t, i) => (
          <div key={i} style={{ padding: 12, background: "white", borderRadius: 10, border: "1px solid var(--ink-200)" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--blue-50)", color: "var(--blue-500)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
              <Icon name={t.icon} size={14} />
            </div>
            <div className="fw-700 text-sm">{t.title}</div>
            <div className="text-xs muted" style={{ marginTop: 2 }}>{t.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// PROCESSING STATE
// ============================================
const ProcessingState = ({ onDone }) => {
  const [step, setStep] = useStateBulk(0);
  const steps = [
    "Subiendo PDF…",
    "Detectando órdenes de compra…",
    "Extrayendo folios y fechas…",
    "Leyendo productos y precios…",
    "Validando contra catálogos y duplicados…",
  ];
  useEffectBulk(() => {
    if (step < steps.length - 1) {
      const t = setTimeout(() => setStep(s => s + 1), 600);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(onDone, 700);
      return () => clearTimeout(t);
    }
  }, [step]);

  return (
    <div style={{ padding: 64, textAlign: "center", background: "white", borderRadius: 16, border: "1px solid var(--ink-200)" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 999, margin: "0 auto 20px",
        background: "conic-gradient(var(--blue-500) " + ((step + 1) / steps.length * 360) + "deg, var(--ink-100) 0)",
        display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
      }}>
        <div style={{ width: 56, height: 56, borderRadius: 999, background: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: "var(--blue-500)" }}>
          {Math.round((step + 1) / steps.length * 100)}%
        </div>
      </div>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Procesando contratos…</h3>
      <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
        {steps[step]}
      </div>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", maxWidth: 360, margin: "24px auto 0" }}>
        {steps.map((s, i) => (
          <div key={i} className="hstack" style={{ gap: 8, fontSize: 12, color: i <= step ? "var(--ink-700)" : "var(--ink-400)" }}>
            <span style={{
              width: 14, height: 14, borderRadius: 999,
              background: i < step ? "var(--green-500)" : i === step ? "var(--blue-500)" : "var(--ink-200)",
              display: "inline-flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 9,
            }}>
              {i < step && <Icon name="check" size={9} />}
            </span>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// Helpers de confianza
// ============================================
const confColor = (conf) => {
  if (conf >= 0.9) return null; // OK, no highlight
  if (conf >= 0.75) return "warn"; // yellow
  return "low"; // red
};
const confBg = (conf) => {
  if (conf >= 0.9) return null;
  if (conf >= 0.75) return "#FEF3C7";
  return "#FEE2E2";
};
const confBorder = (conf) => {
  if (conf >= 0.9) return null;
  if (conf >= 0.75) return "1px solid #FDE68A";
  return "1px solid #FCA5A5";
};
const isLow = (contract, fieldPath) => {
  if (!contract.lowFields) return false;
  return contract.lowFields.includes(fieldPath);
};

// ============================================
// Banner común post-extracción
// ============================================
const ExtractionBanner = ({ contratos, onDiscard }) => {
  const lowConfCount = contratos.filter(c => c.confidence < 0.9).length;
  const dupCount = contratos.filter(c => c.duplicate).length;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        <div style={{ padding: 14, borderRadius: 12, background: "#D1FAE5", border: "1px solid #6EE7B7" }}>
          <div className="text-xs fw-700" style={{ color: "#065F46", letterSpacing: "0.04em", textTransform: "uppercase" }}>Detectados</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#065F46", marginTop: 4 }}>{contratos.length}</div>
          <div className="text-xs" style={{ color: "#065F46" }}>órdenes de compra</div>
        </div>
        <div style={{ padding: 14, borderRadius: 12, background: lowConfCount ? "#FEF3C7" : "var(--ink-50)", border: "1px solid " + (lowConfCount ? "#FDE68A" : "var(--ink-200)") }}>
          <div className="text-xs fw-700" style={{ color: lowConfCount ? "#92400E" : "var(--ink-500)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Revisión</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: lowConfCount ? "#92400E" : "var(--ink-700)", marginTop: 4 }}>{lowConfCount}</div>
          <div className="text-xs" style={{ color: lowConfCount ? "#92400E" : "var(--ink-500)" }}>con baja confianza</div>
        </div>
        <div style={{ padding: 14, borderRadius: 12, background: dupCount ? "#FEE2E2" : "var(--ink-50)", border: "1px solid " + (dupCount ? "#FCA5A5" : "var(--ink-200)") }}>
          <div className="text-xs fw-700" style={{ color: dupCount ? "#991B1B" : "var(--ink-500)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Duplicados</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: dupCount ? "#991B1B" : "var(--ink-700)", marginTop: 4 }}>{dupCount}</div>
          <div className="text-xs" style={{ color: dupCount ? "#991B1B" : "var(--ink-500)" }}>folios ya existen</div>
        </div>
        <div style={{ padding: 14, borderRadius: 12, background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
          <div className="text-xs fw-700 muted" style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>Total a guardar</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink-700)", marginTop: 4 }}>
            ${(contratos.filter(c => !c.duplicate).reduce((s, c) => s + c.totalUSD, 0) / 1000).toFixed(1)}K
          </div>
          <div className="text-xs muted">USD comprometido</div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// File pill (muestra archivo cargado)
// ============================================
const FilePill = ({ onChange }) => (
  <div className="hstack" style={{ gap: 10, padding: "10px 14px", background: "#E6F4FF", borderRadius: 10, border: "1px solid #BAE0FF", marginBottom: 16 }}>
    <div style={{ width: 32, height: 32, borderRadius: 8, background: "white", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--blue-500)" }}>
      <Icon name="receipt" size={14} />
    </div>
    <div style={{ flex: 1 }}>
      <div className="fw-700 text-sm">contratos_blufin_mayo_2026.pdf</div>
      <div className="text-xs muted">2.4 MB · 21 páginas · 17 órdenes detectadas</div>
    </div>
    <button className="btn btn-ghost btn-sm" onClick={onChange}>Cambiar PDF</button>
  </div>
);

// ============================================
// VARIATION A — TABLE REVIEW
// Todos los contratos visibles en tabla. Editar inline.
// ============================================
const BulkTableReview = ({ contratos, setContratos, onSave, onCancel, onChangePDF }) => {
  const [editing, setEditing] = useStateBulk(null); // {row, field}
  const [included, setIncluded] = useStateBulk(() => new Set(contratos.filter(c => !c.duplicate).map(c => c.folio)));
  const [expanded, setExpanded] = useStateBulk(() => new Set(contratos.filter(c => c.confidence < 0.9 || c.duplicate).map(c => c.folio)));
  const cat = window.BLUFIN_DATA.catalogos;

  const toggleExpand = (folio) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(folio)) n.delete(folio); else n.add(folio);
      return n;
    });
  };

  const updateProducto = (folio, pi, key, val) => {
    setContratos(prev => prev.map(c => c.folio === folio ? { ...c, productos: c.productos.map((p, j) => j === pi ? { ...p, [key]: val } : p) } : c));
  };
  const removeProducto = (folio, pi) => {
    setContratos(prev => prev.map(c => c.folio === folio ? { ...c, productos: c.productos.filter((_, j) => j !== pi) } : c));
  };
  const addProducto = (folio) => {
    setContratos(prev => prev.map(c => c.folio === folio ? { ...c, productos: [...c.productos, { desc: "", marca: cat.marcasPropiasActivas[0], talla: "", kg: 0, precio: 0, conf: 1.0 }] } : c));
  };

  const toggleInclude = (folio) => {
    setIncluded(prev => {
      const n = new Set(prev);
      if (n.has(folio)) n.delete(folio); else n.add(folio);
      return n;
    });
  };

  const updateField = (folio, field, val) => {
    setContratos(prev => prev.map(c => c.folio === folio ? { ...c, [field]: val } : c));
  };

  const totalSelected = contratos.filter(c => included.has(c.folio)).length;
  const totalUSD = contratos.filter(c => included.has(c.folio)).reduce((s, c) => s + c.totalUSD, 0);
  const totalKg = contratos.filter(c => included.has(c.folio)).reduce((s, c) => s + c.totalKg, 0);

  return (
    <div>
      <FilePill onChange={onChangePDF} />

      {/* Banner verde */}
      <div style={{
        padding: 14, borderRadius: 12, background: "#D1FAE5", border: "1px solid #6EE7B7",
        marginBottom: 16, display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "white", display: "flex", alignItems: "center", justifyContent: "center", color: "#065F46" }}>
          <Icon name="check" size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="fw-700" style={{ fontSize: 14, color: "#065F46" }}>
            Se extrajeron {contratos.length} órdenes de compra del PDF
          </div>
          <div className="text-sm" style={{ color: "#065F46" }}>
            Haz clic en cualquier fila para <strong>desplegar todos los productos</strong> y editarlos. Los campos resaltados en amarillo/rojo tienen baja confianza.
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ color: "#065F46" }} onClick={() => setExpanded(new Set(contratos.map(c => c.folio)))}>
          Expandir todo
        </button>
        <button className="btn btn-ghost btn-sm" style={{ color: "#065F46" }} onClick={() => setExpanded(new Set())}>
          Colapsar todo
        </button>
      </div>

      <ExtractionBanner contratos={contratos} />

      {/* Tabla principal */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--ink-200)", background: "var(--ink-50)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="hstack" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={included.size === contratos.filter(c => !c.duplicate).length}
              onChange={e => setIncluded(e.target.checked ? new Set(contratos.filter(c => !c.duplicate).map(c => c.folio)) : new Set())}
            />
            <span className="text-sm fw-600">{totalSelected} seleccionados de {contratos.length}</span>
          </div>
          <div className="hstack" style={{ gap: 12 }}>
            <span className="text-xs muted">Click en cualquier celda para editar</span>
          </div>
        </div>
        <div style={{ overflow: "auto", maxHeight: "60vh" }}>
          <table className="tbl" style={{ minWidth: 1200 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ width: 28 }}></th>
                <th style={{ width: 28 }}></th>
                <th>Confianza</th>
                <th>Folio</th>
                <th>Fecha contrato</th>
                <th>Producto principal</th>
                <th>Marca</th>
                <th style={{ textAlign: "right" }}>Kg</th>
                <th style={{ textAlign: "right" }}>USD/kg</th>
                <th style={{ textAlign: "right" }}>Total USD</th>
                <th>ETA puerto</th>
                <th>Anticipo</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c, idx) => {
                const principal = c.productos[0];
                const dup = c.duplicate;
                const incl = included.has(c.folio);
                const isExpanded = expanded.has(c.folio);
                const numLowProd = c.productos.filter(p => p.conf < 0.9).length;
                return (
                  <React.Fragment key={c.folio + idx}>
                  <tr style={{
                    opacity: incl ? 1 : 0.5,
                    background: isExpanded ? "var(--blue-50)" : dup ? "rgba(254,226,226,0.3)" : undefined,
                    cursor: "pointer",
                  }}
                  onClick={() => toggleExpand(c.folio)}>
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={incl} onChange={() => toggleInclude(c.folio)} disabled={dup} />
                    </td>
                    <td>
                      <Icon name={isExpanded ? "chevDown" : "chevRight"} size={14} />
                    </td>
                    <td>
                      {dup ? (
                        <span className="badge badge-red" title="Folio ya existe">⚠ Duplicado</span>
                      ) : c.confidence < 0.75 ? (
                        <span className="badge badge-red">⚠ {(c.confidence * 100).toFixed(0)}%</span>
                      ) : c.confidence < 0.9 ? (
                        <span className="badge badge-amber">⚠ {(c.confidence * 100).toFixed(0)}%</span>
                      ) : (
                        <span className="badge badge-green">✓ {(c.confidence * 100).toFixed(0)}%</span>
                      )}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <EditableCell
                        value={c.folio}
                        onChange={v => updateField(c.folio, "folio", v)}
                        mono
                        bold
                        warn={isLow(c, "folio")}
                      />
                    </td>
                    <td onClick={e => e.stopPropagation()}><EditableCell value={c.fecha} onChange={v => updateField(c.folio, "fecha", v)} type="date" /></td>
                    <td>
                      <div className="text-sm fw-600">{principal.desc.substring(0, 26)}</div>
                      <div className="text-xs muted">
                        {principal.talla}
                        {c.productos.length > 1 && (
                          <span style={{ color: "var(--blue-500)", fontWeight: 600 }}> · +{c.productos.length - 1} más</span>
                        )}
                        {numLowProd > 0 && (
                          <span style={{ color: "var(--amber-500)", fontWeight: 600 }}> · ⚠ {numLowProd} con baja conf.</span>
                        )}
                      </div>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <EditableCell value={principal.marca} onChange={v => {
                        setContratos(prev => prev.map(x => x.folio === c.folio ? { ...x, productos: x.productos.map((p, i) => i === 0 ? { ...p, marca: v } : p) } : x));
                      }} />
                    </td>
                    <td style={{ textAlign: "right" }} className="mono fw-600">{$fmtKg(c.totalKg)}</td>
                    <td style={{ textAlign: "right" }} className="mono">${principal.precio.toFixed(3)}</td>
                    <td style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
                      <EditableCell
                        value={c.totalUSD}
                        onChange={v => updateField(c.folio, "totalUSD", parseFloat(v))}
                        type="number"
                        mono
                        bold
                        align="right"
                        format={v => $fmtUSD(v)}
                        warn={isLow(c, "totalUSD")}
                      />
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <EditableCell value={c.etaPuerto} onChange={v => updateField(c.folio, "etaPuerto", v)} type="date" />
                    </td>
                    <td>
                      <div className="mono text-sm fw-600">{$fmtUSD(c.anticipo)}</div>
                      <div className="text-xs muted">{$fmtFechaCorta(c.anticipoFecha)}</div>
                    </td>
                    <td>
                      <div className="mono text-sm fw-600">{$fmtUSD(c.totalUSD - c.anticipo)}</div>
                      <div className="text-xs muted">{$fmtFechaCorta(c.saldoFecha)}</div>
                    </td>
                  </tr>
                  {/* Expanded row - productos */}
                  {isExpanded && (
                    <tr style={{ background: "#F8FAFC" }}>
                      <td colSpan={13} style={{ padding: 0 }}>
                        <div style={{ padding: "12px 20px 16px 56px" }}>
                          <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                            <div>
                              <div className="text-xs fw-700" style={{ color: "var(--ink-700)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                Productos del contrato · {c.productos.length} item{c.productos.length > 1 ? "s" : ""}
                              </div>
                              <div className="text-xs muted" style={{ marginTop: 2 }}>
                                Edita los campos directamente · los marcados en amarillo/rojo necesitan revisión
                              </div>
                            </div>
                            <button className="btn btn-outline btn-sm" onClick={() => addProducto(c.folio)}>
                              <Icon name="plus" size={12} /> Agregar producto
                            </button>
                          </div>
                          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, background: "white", borderRadius: 10, overflow: "hidden", border: "1px solid var(--ink-200)" }}>
                            <thead>
                              <tr style={{ background: "var(--ink-100)" }}>
                                <th style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, textAlign: "left", color: "var(--ink-500)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Descripción</th>
                                <th style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, textAlign: "left", color: "var(--ink-500)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Marca</th>
                                <th style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, textAlign: "left", color: "var(--ink-500)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Talla</th>
                                <th style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, textAlign: "right", color: "var(--ink-500)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Kg</th>
                                <th style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, textAlign: "right", color: "var(--ink-500)", letterSpacing: "0.04em", textTransform: "uppercase" }}>USD/kg</th>
                                <th style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, textAlign: "right", color: "var(--ink-500)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Subtotal</th>
                                <th style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, textAlign: "left", color: "var(--ink-500)", letterSpacing: "0.04em", textTransform: "uppercase" }}>SKU Intelisis</th>
                                <th style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, textAlign: "left", color: "var(--ink-500)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Conf.</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {c.productos.map((p, pi) => {
                                const lowKg = p.conf < 0.9 || isLow(c, `productos.${pi}.kg`);
                                const lowPrecio = p.conf < 0.9 || isLow(c, `productos.${pi}.precio`);
                                const subtotal = (p.kg || 0) * (p.precio || 0);
                                return (
                                  <tr key={pi} style={{ borderTop: pi > 0 ? "1px solid var(--ink-100)" : "none" }}>
                                    <td style={{ padding: "6px 10px", borderTop: pi > 0 ? "1px solid var(--ink-100)" : "none" }}>
                                      <input className="field-input" style={{ padding: "5px 8px", fontSize: 12 }}
                                        value={p.desc} onChange={e => updateProducto(c.folio, pi, "desc", e.target.value)} />
                                    </td>
                                    <td style={{ padding: "6px 10px", borderTop: pi > 0 ? "1px solid var(--ink-100)" : "none" }}>
                                      <select className="field-input" style={{ padding: "5px 8px", fontSize: 12, minWidth: 110 }}
                                        value={p.marca} onChange={e => updateProducto(c.folio, pi, "marca", e.target.value)}>
                                        {[...cat.marcasPropiasActivas, ...cat.marcasTerceros].map(m => <option key={m}>{m}</option>)}
                                      </select>
                                    </td>
                                    <td style={{ padding: "6px 10px", borderTop: pi > 0 ? "1px solid var(--ink-100)" : "none" }}>
                                      <input className="field-input mono" style={{ padding: "5px 8px", fontSize: 12, width: 80 }}
                                        value={p.talla} onChange={e => updateProducto(c.folio, pi, "talla", e.target.value)} />
                                    </td>
                                    <td style={{ padding: "6px 10px", borderTop: pi > 0 ? "1px solid var(--ink-100)" : "none", textAlign: "right" }}>
                                      <input type="number" step="0.001" className="field-input mono"
                                        style={{ padding: "5px 8px", fontSize: 12, textAlign: "right", width: 100,
                                          background: lowKg ? "#FEF3C7" : undefined,
                                          borderColor: lowKg ? "#FDE68A" : undefined }}
                                        value={p.kg} onChange={e => updateProducto(c.folio, pi, "kg", parseFloat(e.target.value) || 0)} />
                                    </td>
                                    <td style={{ padding: "6px 10px", borderTop: pi > 0 ? "1px solid var(--ink-100)" : "none", textAlign: "right" }}>
                                      <input type="number" step="0.001" className="field-input mono"
                                        style={{ padding: "5px 8px", fontSize: 12, textAlign: "right", width: 90,
                                          background: lowPrecio ? "#FEF3C7" : undefined,
                                          borderColor: lowPrecio ? "#FDE68A" : undefined }}
                                        value={p.precio} onChange={e => updateProducto(c.folio, pi, "precio", parseFloat(e.target.value) || 0)} />
                                    </td>
                                    <td style={{ padding: "6px 10px", borderTop: pi > 0 ? "1px solid var(--ink-100)" : "none", textAlign: "right" }} className="mono fw-600">
                                      {$fmtUSD(subtotal)}
                                    </td>
                                    <td style={{ padding: "6px 10px", borderTop: pi > 0 ? "1px solid var(--ink-100)" : "none" }}>
                                      <button style={{
                                        padding: "3px 8px", borderRadius: 6,
                                        background: "var(--blue-100)", color: "var(--blue-500)",
                                        fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
                                        border: "1px solid transparent", cursor: "pointer",
                                        display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
                                      }} title="SKU sugerido automáticamente">
                                        {p.marca && p.talla ? `30${1000 + pi} ${p.marca.substring(0, 5)} ${p.talla}` : "Sugerir SKU"}
                                        <Icon name="chevDown" size={9} />
                                      </button>
                                    </td>
                                    <td style={{ padding: "6px 10px", borderTop: pi > 0 ? "1px solid var(--ink-100)" : "none" }}>
                                      {p.conf >= 0.9 ? (
                                        <span style={{ fontSize: 11, color: "var(--green-500)", fontWeight: 600 }}>✓ OK</span>
                                      ) : p.conf >= 0.75 ? (
                                        <span style={{ fontSize: 11, color: "var(--amber-500)", fontWeight: 600 }}>⚠ {(p.conf * 100).toFixed(0)}%</span>
                                      ) : (
                                        <span style={{ fontSize: 11, color: "var(--red-500)", fontWeight: 600 }}>⚠ {(p.conf * 100).toFixed(0)}%</span>
                                      )}
                                    </td>
                                    <td style={{ padding: "6px 10px", borderTop: pi > 0 ? "1px solid var(--ink-100)" : "none" }}>
                                      <button onClick={() => removeProducto(c.folio, pi)}
                                        disabled={c.productos.length === 1}
                                        style={{ background: "transparent", border: "none", color: "var(--ink-400)", cursor: c.productos.length === 1 ? "not-allowed" : "pointer", padding: 4, opacity: c.productos.length === 1 ? 0.3 : 1 }}
                                        title="Eliminar producto">✕</button>
                                    </td>
                                  </tr>
                                );
                              })}
                              <tr style={{ background: "var(--ink-50)", fontWeight: 700, borderTop: "1px solid var(--ink-200)" }}>
                                <td colSpan={3} style={{ padding: "6px 10px", textAlign: "right", color: "var(--ink-700)", fontSize: 11 }}>TOTAL CONTRATO</td>
                                <td style={{ padding: "6px 10px", textAlign: "right" }} className="mono">
                                  {$fmtKg(c.productos.reduce((s, p) => s + (p.kg || 0), 0))}
                                </td>
                                <td></td>
                                <td style={{ padding: "6px 10px", textAlign: "right" }} className="mono">
                                  {$fmtUSD(c.productos.reduce((s, p) => s + (p.kg || 0) * (p.precio || 0), 0))}
                                </td>
                                <td colSpan={3}></td>
                              </tr>
                            </tbody>
                          </table>
                          {numLowProd > 0 && (
                            <div style={{ marginTop: 8, padding: "8px 12px", background: "#FEF3C7", borderRadius: 8, border: "1px solid #FDE68A", fontSize: 12, color: "#92400E" }}>
                              <Icon name="alert" size={12} /> <strong>{numLowProd} producto{numLowProd > 1 ? "s" : ""}</strong> con baja confianza. Verifica los kg y precio contra el PDF original — son los datos que más suelen leerse mal.
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky footer */}
      <div style={{
        position: "sticky", bottom: 0, marginTop: 16,
        background: "white", border: "1px solid var(--ink-200)", borderRadius: 12,
        padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center",
        boxShadow: "0 -4px 12px rgba(10,37,64,0.06)",
      }}>
        <div className="hstack" style={{ gap: 24 }}>
          <div>
            <div className="text-xs muted">Contratos a crear</div>
            <div className="fw-700" style={{ fontSize: 18 }}>{totalSelected}</div>
          </div>
          <div style={{ width: 1, height: 32, background: "var(--ink-200)" }} />
          <div>
            <div className="text-xs muted">Kg totales</div>
            <div className="fw-700 mono" style={{ fontSize: 18 }}>{$fmtKg(totalKg)}</div>
          </div>
          <div style={{ width: 1, height: 32, background: "var(--ink-200)" }} />
          <div>
            <div className="text-xs muted">USD comprometido</div>
            <div className="fw-700 mono" style={{ fontSize: 18 }}>{$fmtUSD(totalUSD)}</div>
          </div>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={onSave}>
            <Icon name="check" size={13} /> Guardar {totalSelected} contratos
          </button>
        </div>
      </div>
    </div>
  );
};

// EditableCell — inline editor
const EditableCell = ({ value, onChange, type = "text", mono, bold, align, format, warn }) => {
  const [editing, setEditing] = useStateBulk(false);
  const [v, setV] = useStateBulk(value);
  useEffectBulk(() => setV(value), [value]);
  const commit = () => { setEditing(false); onChange(v); };
  const display = format ? format(value) : value;
  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        value={v}
        onChange={e => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        style={{
          padding: "4px 6px", border: "1px solid var(--blue-500)", borderRadius: 6,
          fontSize: 13, fontFamily: mono ? "var(--font-mono)" : "inherit",
          fontWeight: bold ? 600 : 400, width: "100%",
          textAlign: align || "left",
          background: "white",
        }}
      />
    );
  }
  return (
    <div
      onClick={() => setEditing(true)}
      style={{
        padding: "4px 6px", borderRadius: 6, cursor: "text",
        fontFamily: mono ? "var(--font-mono)" : "inherit",
        fontWeight: bold ? 600 : 400,
        background: warn ? "#FEF3C7" : "transparent",
        border: warn ? "1px solid #FDE68A" : "1px solid transparent",
        textAlign: align || "left",
      }}
      title="Click para editar"
    >
      {display || <span className="muted">—</span>}
    </div>
  );
};

// ============================================
// VARIATION B — WIZARD
// Uno por uno: foto del contrato, edito, apruebo y avanzo
// ============================================
const BulkWizard = ({ contratos, setContratos, onSave, onCancel, onChangePDF }) => {
  const [idx, setIdx] = useStateBulk(0);
  const [approved, setApproved] = useStateBulk(() => new Set());
  const [skipped, setSkipped] = useStateBulk(() => new Set());

  const current = contratos[idx];
  const cat = window.BLUFIN_DATA.catalogos;

  const updateCurrent = (key, val) => {
    setContratos(prev => prev.map((c, i) => i === idx ? { ...c, [key]: val } : c));
  };
  const updateProd = (pi, key, val) => {
    setContratos(prev => prev.map((c, i) => i === idx ? { ...c, productos: c.productos.map((p, j) => j === pi ? { ...p, [key]: val } : p) } : c));
  };

  const approveCurrent = () => {
    const n = new Set(approved); n.add(current.folio); setApproved(n);
    const s = new Set(skipped); s.delete(current.folio); setSkipped(s);
    if (idx < contratos.length - 1) setIdx(idx + 1);
  };
  const skipCurrent = () => {
    const s = new Set(skipped); s.add(current.folio); setSkipped(s);
    if (idx < contratos.length - 1) setIdx(idx + 1);
  };

  const status = (i) => {
    const f = contratos[i].folio;
    if (approved.has(f)) return "approved";
    if (skipped.has(f)) return "skipped";
    if (i === idx) return "current";
    if (i < idx) return "passed";
    return "pending";
  };

  return (
    <div>
      <FilePill onChange={onChangePDF} />

      {/* Banner de progreso */}
      <div style={{
        padding: 14, borderRadius: 12, background: "white", border: "1px solid var(--ink-200)",
        marginBottom: 16, display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ flex: 1 }}>
          <div className="fw-700" style={{ fontSize: 14 }}>
            Contrato {idx + 1} de {contratos.length}
          </div>
          <div className="text-sm muted">
            Revisa, edita si hace falta, y aprueba para pasar al siguiente.
          </div>
        </div>
        <div className="hstack" style={{ gap: 12, fontSize: 12 }}>
          <span className="badge badge-green">✓ {approved.size} aprobados</span>
          <span className="badge badge-amber">⏭ {skipped.size} omitidos</span>
          <span className="badge badge-gray">{contratos.length - approved.size - skipped.size} pendientes</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16 }}>
        {/* Sidebar de navegación */}
        <div className="card" style={{ padding: 8, maxHeight: "70vh", overflow: "auto", position: "sticky", top: 24, alignSelf: "flex-start" }}>
          {contratos.map((c, i) => {
            const s = status(i);
            const bg = s === "current" ? "var(--blue-50)" : s === "approved" ? "transparent" : s === "skipped" ? "transparent" : "transparent";
            const dot = s === "approved" ? "var(--green-500)" : s === "skipped" ? "var(--amber-500)" : s === "current" ? "var(--blue-500)" : "var(--ink-300)";
            const dotInner = s === "approved" ? <Icon name="check" size={9} stroke={3} /> : s === "skipped" ? "⏭" : null;
            return (
              <div
                key={c.folio + i}
                onClick={() => setIdx(i)}
                style={{
                  padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                  background: bg,
                  borderLeft: s === "current" ? "3px solid var(--blue-500)" : "3px solid transparent",
                  marginBottom: 2,
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 999, background: dot, color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>{dotInner || (i + 1)}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="mono text-xs fw-600" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.folio}</div>
                  <div className="text-xs muted" style={{ fontSize: 10 }}>{c.productos[0].marca} · {$fmtKg(c.totalKg)}</div>
                </div>
                {c.confidence < 0.9 && <span style={{ width: 6, height: 6, borderRadius: 999, background: c.confidence < 0.75 ? "var(--red-500)" : "var(--amber-500)", flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>

        {/* Wizard form */}
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header" style={{ background: current.duplicate ? "#FEE2E2" : current.confidence < 0.75 ? "#FEE2E2" : current.confidence < 0.9 ? "#FEF3C7" : "transparent" }}>
              <div>
                <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
                  <span className="mono fw-700" style={{ fontSize: 16 }}>{current.folio}</span>
                  {current.duplicate && <span className="badge badge-red">⚠ Folio ya existe en sistema</span>}
                  {!current.duplicate && current.confidence < 0.75 && <span className="badge badge-red">⚠ Confianza {(current.confidence * 100).toFixed(0)}% — revisar</span>}
                  {!current.duplicate && current.confidence >= 0.75 && current.confidence < 0.9 && <span className="badge badge-amber">⚠ Confianza {(current.confidence * 100).toFixed(0)}%</span>}
                  {current.confidence >= 0.9 && !current.duplicate && <span className="badge badge-green">✓ Confianza {(current.confidence * 100).toFixed(0)}%</span>}
                </div>
                <div className="text-sm muted">Página {idx + 5} del PDF · {current.productos.length} producto{current.productos.length > 1 ? "s" : ""}</div>
              </div>
              <div className="hstack" style={{ gap: 6 }}>
                <button className="btn btn-ghost btn-sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Anterior</button>
                <button className="btn btn-ghost btn-sm" disabled={idx === contratos.length - 1} onClick={() => setIdx(idx + 1)}>Siguiente →</button>
              </div>
            </div>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <WizardField label="Folio" warn={isLow(current, "folio")}>
                  <input className="field-input mono" value={current.folio} onChange={e => updateCurrent("folio", e.target.value)} />
                </WizardField>
                <WizardField label="Fecha contrato">
                  <input type="date" className="field-input" value={current.fecha} onChange={e => updateCurrent("fecha", e.target.value)} />
                </WizardField>
                <WizardField label="ETA puerto">
                  <input type="date" className="field-input" value={current.etaPuerto} onChange={e => updateCurrent("etaPuerto", e.target.value)} />
                </WizardField>
                <WizardField label="Total USD" warn={isLow(current, "totalUSD")}>
                  <input type="number" step="0.01" className="field-input mono" value={current.totalUSD} onChange={e => updateCurrent("totalUSD", parseFloat(e.target.value))} />
                </WizardField>
                <WizardField label="Anticipo USD (10%)">
                  <input type="number" step="0.01" className="field-input mono" value={current.anticipo} onChange={e => updateCurrent("anticipo", parseFloat(e.target.value))} />
                </WizardField>
                <WizardField label="Saldo USD (90%)">
                  <input type="number" step="0.01" className="field-input mono" disabled value={(current.totalUSD - current.anticipo).toFixed(2)} />
                </WizardField>
                <WizardField label="Fecha anticipo">
                  <input type="date" className="field-input" value={current.anticipoFecha} onChange={e => updateCurrent("anticipoFecha", e.target.value)} />
                </WizardField>
                <WizardField label="Fecha liquidación">
                  <input type="date" className="field-input" value={current.saldoFecha} onChange={e => updateCurrent("saldoFecha", e.target.value)} />
                </WizardField>
                <WizardField label="Domicilio entrega">
                  <input className="field-input" value={current.domicilio} onChange={e => updateCurrent("domicilio", e.target.value)} />
                </WizardField>
              </div>

              {/* Productos */}
              <div style={{ marginTop: 20 }}>
                <div className="hstack" style={{ marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Productos detectados</h4>
                </div>
                <table className="tbl" style={{ background: "var(--ink-50)", borderRadius: 8, overflow: "hidden" }}>
                  <thead>
                    <tr>
                      <th>Descripción</th>
                      <th>Marca</th>
                      <th>Talla</th>
                      <th style={{ textAlign: "right" }}>Kg</th>
                      <th style={{ textAlign: "right" }}>USD/kg</th>
                      <th style={{ textAlign: "right" }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.productos.map((p, pi) => {
                      const lowKg = isLow(current, `productos.${pi}.kg`) || p.conf < 0.9;
                      const lowPrecio = isLow(current, `productos.${pi}.precio`) || p.conf < 0.9;
                      return (
                        <tr key={pi}>
                          <td>
                            <input className="field-input" style={{ padding: "4px 6px", fontSize: 12 }} value={p.desc} onChange={e => updateProd(pi, "desc", e.target.value)} />
                          </td>
                          <td>
                            <select className="field-input" style={{ padding: "4px 6px", fontSize: 12 }} value={p.marca} onChange={e => updateProd(pi, "marca", e.target.value)}>
                              {[...cat.marcasPropiasActivas, ...cat.marcasTerceros].map(m => <option key={m}>{m}</option>)}
                            </select>
                          </td>
                          <td>
                            <input className="field-input mono" style={{ padding: "4px 6px", fontSize: 12, width: 80 }} value={p.talla} onChange={e => updateProd(pi, "talla", e.target.value)} />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <input type="number" className="field-input mono" style={{ padding: "4px 6px", fontSize: 12, textAlign: "right", width: 90, background: lowKg ? "#FEF3C7" : undefined, border: lowKg ? "1px solid #FDE68A" : undefined }} value={p.kg} onChange={e => updateProd(pi, "kg", parseFloat(e.target.value))} />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <input type="number" step="0.001" className="field-input mono" style={{ padding: "4px 6px", fontSize: 12, textAlign: "right", width: 80, background: lowPrecio ? "#FEF3C7" : undefined, border: lowPrecio ? "1px solid #FDE68A" : undefined }} value={p.precio} onChange={e => updateProd(pi, "precio", parseFloat(e.target.value))} />
                          </td>
                          <td style={{ textAlign: "right" }} className="mono fw-600">{$fmtUSD(p.kg * p.precio)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {current.lowFields && (
                  <div style={{ marginTop: 8, padding: 10, background: "#FEF3C7", borderRadius: 8, border: "1px solid #FDE68A", fontSize: 12, color: "#92400E" }}>
                    <Icon name="alert" size={12} /> <strong>Atención:</strong> los campos resaltados en amarillo fueron detectados con baja confianza. Verifícalos contra el PDF original antes de aprobar.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="card">
            <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="hstack" style={{ gap: 10 }}>
                <button className="btn btn-ghost btn-sm" onClick={skipCurrent}>
                  Omitir este
                </button>
                <span className="text-xs muted">|</span>
                <button className="btn btn-outline btn-sm" onClick={onCancel}>Cancelar todo</button>
              </div>
              <div className="hstack" style={{ gap: 8 }}>
                {idx < contratos.length - 1 ? (
                  <>
                    <button className="btn btn-outline btn-sm" onClick={approveCurrent}>
                      <Icon name="check" size={13} /> Aprobar y siguiente →
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-outline btn-sm" onClick={approveCurrent} disabled={approved.has(current.folio)}>
                      <Icon name="check" size={13} /> Aprobar último
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={onSave}>
                      Guardar {approved.size + (approved.has(current.folio) ? 0 : 1)} contratos →
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const WizardField = ({ label, warn, children }) => (
  <div>
    <div className="hstack" style={{ marginBottom: 4, gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-700)" }}>{label}</label>
      {warn && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#FEF3C7", color: "#92400E", fontWeight: 700, letterSpacing: "0.04em" }}>REVISAR</span>}
    </div>
    {React.cloneElement(children, {
      style: { ...(children.props.style || {}), background: warn ? "#FFFBEB" : undefined, borderColor: warn ? "#FDE68A" : undefined }
    })}
  </div>
);

// ============================================
// VARIATION C — SPLIT VIEW
// PDF a la izq, formulario a la der, navegación entre contratos
// ============================================
const BulkSplit = ({ contratos, setContratos, onSave, onCancel, onChangePDF }) => {
  const [idx, setIdx] = useStateBulk(0);
  const [reviewed, setReviewed] = useStateBulk(() => new Set());
  const current = contratos[idx];
  const cat = window.BLUFIN_DATA.catalogos;

  const updateCurrent = (key, val) => {
    setContratos(prev => prev.map((c, i) => i === idx ? { ...c, [key]: val } : c));
  };
  const updateProd = (pi, key, val) => {
    setContratos(prev => prev.map((c, i) => i === idx ? { ...c, productos: c.productos.map((p, j) => j === pi ? { ...p, [key]: val } : p) } : c));
  };

  const markReviewed = () => {
    const n = new Set(reviewed); n.add(current.folio); setReviewed(n);
    if (idx < contratos.length - 1) setIdx(idx + 1);
  };

  return (
    <div>
      <FilePill onChange={onChangePDF} />

      {/* Progress bar */}
      <div style={{
        padding: "10px 14px", borderRadius: 10, background: "white", border: "1px solid var(--ink-200)",
        marginBottom: 12, display: "flex", alignItems: "center", gap: 12,
      }}>
        <div className="hstack" style={{ gap: 6, flex: 1 }}>
          {contratos.map((c, i) => (
            <div
              key={c.folio + i}
              onClick={() => setIdx(i)}
              style={{
                flex: 1, height: 6, borderRadius: 999,
                background: reviewed.has(c.folio) ? "var(--green-500)" : i === idx ? "var(--blue-500)" : "var(--ink-200)",
                cursor: "pointer", transition: "background 0.2s",
              }}
              title={c.folio}
            />
          ))}
        </div>
        <div className="text-sm fw-600 muted" style={{ minWidth: 100, textAlign: "right" }}>
          {reviewed.size} / {contratos.length} revisados
        </div>
      </div>

      {/* Split layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, height: "calc(100vh - 280px)", minHeight: 600 }}>
        {/* PDF preview placeholder (left) */}
        <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--ink-200)", background: "var(--ink-50)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="hstack" style={{ gap: 8 }}>
              <Icon name="receipt" size={14} />
              <span className="fw-600 text-sm">Vista del PDF — Página {idx + 5}</span>
            </div>
            <div className="hstack" style={{ gap: 4 }}>
              <button className="btn btn-ghost btn-sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>←</button>
              <span className="text-xs muted">{idx + 1} / {contratos.length}</span>
              <button className="btn btn-ghost btn-sm" disabled={idx === contratos.length - 1} onClick={() => setIdx(idx + 1)}>→</button>
              <button className="btn btn-ghost btn-sm" title="Abrir en pestaña nueva"><Icon name="globe" size={12} /></button>
            </div>
          </div>
          {/* Faux PDF page */}
          <div style={{ flex: 1, background: "var(--ink-100)", overflow: "auto", padding: 16 }}>
            <div style={{ background: "white", boxShadow: "0 4px 16px rgba(10,37,64,0.12)", padding: 32, maxWidth: 600, margin: "0 auto", fontSize: 10, color: "var(--ink-800)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 16 }}>ORDEN DE COMPRA {idx + 1} DE {contratos.length}</div>
              <div style={{ borderTop: "1px solid var(--ink-300)", borderBottom: "1px solid var(--ink-300)", padding: "8px 0", marginBottom: 12, fontSize: 9, color: "var(--ink-600)", lineHeight: 1.4 }}>
                TÉRMINOS GENERALES Y CONDICIONES — El comprador se compromete a realizar como anticipo del 10% del monto pactado y liquidar el 90% pendiente. Los costos sobre importación del producto forman parte del costo de venta total...
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 12 }}>
                <tbody>
                  <tr><td style={{ fontWeight: 700, padding: "4px 8px", border: "1px solid var(--ink-300)", background: "var(--ink-50)", width: "30%" }}>NÚMERO:</td><td style={{ padding: "4px 8px", border: "1px solid var(--ink-300)", fontFamily: "monospace" }}>{current.folio}</td></tr>
                  <tr><td style={{ fontWeight: 700, padding: "4px 8px", border: "1px solid var(--ink-300)", background: "var(--ink-50)" }}>FECHA:</td><td style={{ padding: "4px 8px", border: "1px solid var(--ink-300)" }}>{current.fecha.split("-").reverse().join("/")}</td></tr>
                  <tr><td style={{ fontWeight: 700, padding: "4px 8px", border: "1px solid var(--ink-300)", background: "var(--ink-50)" }}>VENDEDOR</td><td style={{ padding: "4px 8px", border: "1px solid var(--ink-300)" }}>MENITA COMERCIAL OCEANICA</td></tr>
                  <tr><td style={{ fontWeight: 700, padding: "4px 8px", border: "1px solid var(--ink-300)", background: "var(--ink-50)" }}>COMPRADOR</td><td style={{ padding: "4px 8px", border: "1px solid var(--ink-300)" }}>PRODUCTOS MARINOS LIZARRAGA</td></tr>
                </tbody>
              </table>
              {current.productos.map((p, pi) => (
                <div key={pi} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "var(--ink-600)", marginBottom: 4 }}>Descripción del producto</div>
                  <div style={{ fontSize: 9, marginBottom: 6, lineHeight: 1.3 }}>{p.desc} (OREOCHROMIS MOSSAMBICUS) - SIZE BEFORE GLAZING, 90% NET WEIGHT WITH 10% GLAZE.</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
                    <thead>
                      <tr style={{ background: "var(--ink-100)" }}>
                        <th style={{ padding: "3px 6px", border: "1px solid var(--ink-300)" }}>MARCA</th>
                        <th style={{ padding: "3px 6px", border: "1px solid var(--ink-300)" }}>TALLA</th>
                        <th style={{ padding: "3px 6px", border: "1px solid var(--ink-300)" }}>VOLUMEN</th>
                        <th style={{ padding: "3px 6px", border: "1px solid var(--ink-300)" }}>PRECIO</th>
                        <th style={{ padding: "3px 6px", border: "1px solid var(--ink-300)" }}>IMP. TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: "3px 6px", border: "1px solid var(--ink-300)" }}>{p.marca}</td>
                        <td style={{ padding: "3px 6px", border: "1px solid var(--ink-300)" }}>{p.talla}</td>
                        <td style={{ padding: "3px 6px", border: "1px solid var(--ink-300)", background: p.conf < 0.9 ? "#FEF3C7" : undefined }}>{p.kg} KG</td>
                        <td style={{ padding: "3px 6px", border: "1px solid var(--ink-300)", background: p.conf < 0.9 ? "#FEF3C7" : undefined }}>${p.precio}</td>
                        <td style={{ padding: "3px 6px", border: "1px solid var(--ink-300)" }}>${(p.kg * p.precio).toLocaleString("en-US", { minimumFractionDigits: 3 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginTop: 12 }}>
                <tbody>
                  <tr><td style={{ fontWeight: 700, padding: "4px 8px", border: "1px solid var(--ink-300)", background: "var(--ink-50)" }}>IMPORTE TOTAL</td><td style={{ padding: "4px 8px", border: "1px solid var(--ink-300)", fontFamily: "monospace" }}>${current.totalUSD.toFixed(2)}</td></tr>
                  <tr><td style={{ fontWeight: 700, padding: "4px 8px", border: "1px solid var(--ink-300)", background: "var(--ink-50)" }}>ANTICIPO</td><td style={{ padding: "4px 8px", border: "1px solid var(--ink-300)", fontFamily: "monospace" }}>${current.anticipo.toFixed(2)} — fecha {current.anticipoFecha}</td></tr>
                  <tr><td style={{ fontWeight: 700, padding: "4px 8px", border: "1px solid var(--ink-300)", background: "var(--ink-50)" }}>SALDO</td><td style={{ padding: "4px 8px", border: "1px solid var(--ink-300)", fontFamily: "monospace" }}>${(current.totalUSD - current.anticipo).toFixed(2)} — fecha liq. {current.saldoFecha}</td></tr>
                  <tr><td style={{ fontWeight: 700, padding: "4px 8px", border: "1px solid var(--ink-300)", background: "var(--ink-50)" }}>LLEGADA PUERTO</td><td style={{ padding: "4px 8px", border: "1px solid var(--ink-300)" }}>{current.etaPuerto}</td></tr>
                  <tr><td style={{ fontWeight: 700, padding: "4px 8px", border: "1px solid var(--ink-300)", background: "var(--ink-50)" }}>DOMICILIO</td><td style={{ padding: "4px 8px", border: "1px solid var(--ink-300)" }}>{current.domicilio}</td></tr>
                </tbody>
              </table>
              <div style={{ marginTop: 24, paddingTop: 12, borderTop: "1px solid var(--ink-300)", fontSize: 8, color: "var(--ink-500)", textAlign: "center" }}>
                _____ LA VENDEDORA E.FIRMA _____ EL COMPRADOR E.FIRMA _____<br />
                Volcán Paricutín No.4881, Col. El Colli Ejidal, C.P.45070 Zapopan, Jalisco · menita.com.mx
              </div>
            </div>
          </div>
        </div>

        {/* Form (right) */}
        <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--ink-200)", background: current.duplicate ? "#FEE2E2" : current.confidence < 0.9 ? "#FEF3C7" : "var(--ink-50)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="hstack" style={{ gap: 10 }}>
              <span className="mono fw-700">{current.folio}</span>
              {current.duplicate && <span className="badge badge-red">⚠ Folio duplicado</span>}
              {!current.duplicate && current.confidence < 0.75 && <span className="badge badge-red">⚠ {(current.confidence * 100).toFixed(0)}%</span>}
              {!current.duplicate && current.confidence >= 0.75 && current.confidence < 0.9 && <span className="badge badge-amber">⚠ {(current.confidence * 100).toFixed(0)}%</span>}
              {current.confidence >= 0.9 && !current.duplicate && <span className="badge badge-green">✓ {(current.confidence * 100).toFixed(0)}%</span>}
            </div>
            {reviewed.has(current.folio) && <span className="badge badge-green">✓ Revisado</span>}
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            <div className="text-xs fw-700" style={{ color: "var(--ink-500)", letterSpacing: "0.06em", marginBottom: 10 }}>INFORMACIÓN GENERAL</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <WizardField label="Folio" warn={isLow(current, "folio")}>
                <input className="field-input mono" value={current.folio} onChange={e => updateCurrent("folio", e.target.value)} />
              </WizardField>
              <WizardField label="Fecha">
                <input type="date" className="field-input" value={current.fecha} onChange={e => updateCurrent("fecha", e.target.value)} />
              </WizardField>
              <WizardField label="ETA puerto">
                <input type="date" className="field-input" value={current.etaPuerto} onChange={e => updateCurrent("etaPuerto", e.target.value)} />
              </WizardField>
              <WizardField label="Total USD" warn={isLow(current, "totalUSD")}>
                <input type="number" step="0.01" className="field-input mono" value={current.totalUSD} onChange={e => updateCurrent("totalUSD", parseFloat(e.target.value))} />
              </WizardField>
              <WizardField label="Anticipo">
                <input type="number" step="0.01" className="field-input mono" value={current.anticipo} onChange={e => updateCurrent("anticipo", parseFloat(e.target.value))} />
              </WizardField>
              <WizardField label="Saldo">
                <input className="field-input mono" disabled value={"$" + (current.totalUSD - current.anticipo).toFixed(2)} />
              </WizardField>
              <WizardField label="Fecha anticipo">
                <input type="date" className="field-input" value={current.anticipoFecha} onChange={e => updateCurrent("anticipoFecha", e.target.value)} />
              </WizardField>
              <WizardField label="Fecha liquidación">
                <input type="date" className="field-input" value={current.saldoFecha} onChange={e => updateCurrent("saldoFecha", e.target.value)} />
              </WizardField>
            </div>

            <div className="text-xs fw-700" style={{ color: "var(--ink-500)", letterSpacing: "0.06em", marginBottom: 10 }}>PRODUCTOS ({current.productos.length})</div>
            {current.productos.map((p, pi) => (
              <div key={pi} style={{ padding: 12, background: "var(--ink-50)", borderRadius: 10, border: "1px solid var(--ink-200)", marginBottom: 10 }}>
                <div className="text-xs muted" style={{ marginBottom: 6 }}>{p.desc}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.8fr 0.8fr", gap: 8 }}>
                  <WizardField label="Marca">
                    <select className="field-input" style={{ fontSize: 12, padding: "6px 8px" }} value={p.marca} onChange={e => updateProd(pi, "marca", e.target.value)}>
                      {[...cat.marcasPropiasActivas, ...cat.marcasTerceros].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </WizardField>
                  <WizardField label="Talla">
                    <input className="field-input mono" style={{ fontSize: 12, padding: "6px 8px" }} value={p.talla} onChange={e => updateProd(pi, "talla", e.target.value)} />
                  </WizardField>
                  <WizardField label="Kg" warn={p.conf < 0.9 || isLow(current, `productos.${pi}.kg`)}>
                    <input type="number" className="field-input mono" style={{ fontSize: 12, padding: "6px 8px" }} value={p.kg} onChange={e => updateProd(pi, "kg", parseFloat(e.target.value))} />
                  </WizardField>
                  <WizardField label="USD/kg" warn={p.conf < 0.9 || isLow(current, `productos.${pi}.precio`)}>
                    <input type="number" step="0.001" className="field-input mono" style={{ fontSize: 12, padding: "6px 8px" }} value={p.precio} onChange={e => updateProd(pi, "precio", parseFloat(e.target.value))} />
                  </WizardField>
                </div>
              </div>
            ))}

            <WizardField label="Domicilio entrega">
              <input className="field-input" value={current.domicilio} onChange={e => updateCurrent("domicilio", e.target.value)} />
            </WizardField>
          </div>
          {/* Footer of right panel */}
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--ink-200)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--ink-50)" }}>
            <button className="btn btn-ghost btn-sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Anterior</button>
            <button className="btn btn-outline btn-sm" onClick={markReviewed}>
              <Icon name="check" size={12} /> Marcar revisado y siguiente →
            </button>
          </div>
        </div>
      </div>

      {/* Global save bar */}
      <div style={{
        marginTop: 16, padding: "12px 16px", background: "white", borderRadius: 12, border: "1px solid var(--ink-200)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        boxShadow: "0 -2px 8px rgba(10,37,64,0.04)",
      }}>
        <div className="text-sm muted">
          <span className="fw-700" style={{ color: "var(--ink-900)" }}>{reviewed.size}</span> de {contratos.length} revisados ·
          <span className="fw-700" style={{ color: "var(--ink-900)" }}> {$fmtUSD(contratos.filter(c => !c.duplicate).reduce((s, c) => s + c.totalUSD, 0))}</span> USD totales
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={onSave}>
            <Icon name="check" size={13} /> Guardar {contratos.filter(c => !c.duplicate).length} contratos
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN BULK FLOW WRAPPER
// ============================================
const BlufinBulk = ({ setView }) => {
  const [phase, setPhase] = useStateBulk("upload"); // upload | processing | review
  const [contratos, setContratos] = useStateBulk([]);

  // El tweak determina qué variación mostrar — se lee del estado global
  const variation = window.__blufinBulkVariation || "table";

  const startUpload = () => {
    setPhase("processing");
  };
  const onProcessed = () => {
    // Copiar contratos extraídos del mock
    setContratos(JSON.parse(JSON.stringify(window.BLUFIN_DATA.contratosExtraidos)));
    setPhase("review");
  };

  return (
    <div>
      {phase === "upload" && <PDFDropZone onUpload={startUpload} />}
      {phase === "processing" && <ProcessingState onDone={onProcessed} />}
      {phase === "review" && variation === "table" && (
        <BulkTableReview
          contratos={contratos}
          setContratos={setContratos}
          onSave={() => setView("list")}
          onCancel={() => setView("list")}
          onChangePDF={() => setPhase("upload")}
        />
      )}
      {phase === "review" && variation === "wizard" && (
        <BulkWizard
          contratos={contratos}
          setContratos={setContratos}
          onSave={() => setView("list")}
          onCancel={() => setView("list")}
          onChangePDF={() => setPhase("upload")}
        />
      )}
      {phase === "review" && variation === "split" && (
        <BulkSplit
          contratos={contratos}
          setContratos={setContratos}
          onSave={() => setView("list")}
          onCancel={() => setView("list")}
          onChangePDF={() => setPhase("upload")}
        />
      )}
    </div>
  );
};

Object.assign(window, { BlufinBulk });
