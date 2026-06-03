// ============================================
// Blufin Seafood — Módulo de Facturas del Proveedor
// • Sube PDF → extrae líneas (simulado)
// • Compara vs contrato: precio, kg, descripción
// • Acepta / rechaza diferencias con trazabilidad
// ============================================

const { useState: useStateF, useMemo: useMemoF, useEffect: useEffectF, useRef: useRefF } = React;
const { Icon: IconF } = window;
const HOY_F = "2026-05-21";
const facFmt = { USD: window.fmtUSD, Fecha: window.fmtFecha, FechaCorta: window.fmtFechaCorta };

// ── Metadata de match ──────────────────────────────────────────────────────────
const MATCH_META = {
  ok:         { label: "OK",          color: "#059669", bg: "#D1FAE5", icon: "check" },
  diferente:  { label: "Diferencia",  color: "#D97706", bg: "#FEF3C7", icon: "alert" },
  nuevo:      { label: "Nueva línea", color: "#6B7280", bg: "#F3F4F6", icon: "plus"  },
};

const FAC_STATUS = {
  "Pendiente revisión": { bg: "#FEF3C7", color: "#92400E" },
  "Revisada":           { bg: "#E0F2FE", color: "#0369A1" },
  "Aprobada":           { bg: "#D1FAE5", color: "#065F46" },
};

const FacStatusPill = ({ status }) => {
  const m = FAC_STATUS[status] || FAC_STATUS["Pendiente revisión"];
  return (
    <span style={{ padding: "3px 9px", borderRadius: 999, background: m.bg, color: m.color, fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
};

// ── Modal: Subir Factura ───────────────────────────────────────────────────────
const SubirFacturaModal = ({ open, onClose, onProcessed }) => {
  const [phase, setPhase] = useStateF("upload"); // upload | processing | done
  const [archivo, setArchivo] = useStateF(null);
  const [contrato, setContrato] = useStateF("");
  const [progress, setProgress] = useStateF(0);
  const fileRef = useRefF();

  useEffectF(() => {
    if (open) { setPhase("upload"); setArchivo(null); setContrato(""); setProgress(0); }
  }, [open]);

  const handleProcess = () => {
    setPhase("processing");
    let p = 0;
    const t = setInterval(() => {
      p += Math.random() * 18 + 8;
      if (p >= 100) { p = 100; clearInterval(t); setTimeout(() => { setPhase("done"); }, 400); }
      setProgress(Math.min(p, 100));
    }, 220);
  };

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,37,64,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 16, maxWidth: 480, width: "100%", overflow: "hidden", boxShadow: "0 24px 48px rgba(10,37,64,0.25)" }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--ink-200)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Subir factura del proveedor</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 20, color: "var(--ink-400)", cursor: "pointer" }}>✕</button>
        </div>

        {phase === "upload" && (
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Drop zone */}
            <div onClick={() => fileRef.current?.click()}
              style={{ border: "2px dashed " + (archivo ? "var(--blue-500)" : "var(--ink-300)"), borderRadius: 12, padding: "28px 20px", textAlign: "center", cursor: "pointer", background: archivo ? "#EFF6FF" : "var(--ink-50)", transition: "all 0.2s" }}>
              <IconF name="download" size={28} style={{ color: archivo ? "var(--blue-500)" : "var(--ink-400)" }} />
              {archivo ? (
                <div style={{ marginTop: 10 }}>
                  <div className="fw-700" style={{ color: "var(--blue-500)" }}>{archivo.name}</div>
                  <div className="text-xs muted">PDF seleccionado · clic para cambiar</div>
                </div>
              ) : (
                <div style={{ marginTop: 10 }}>
                  <div className="fw-600">Arrastra el PDF o haz clic para seleccionar</div>
                  <div className="text-xs muted">Factura PDF del proveedor</div>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }}
                onChange={e => { if (e.target.files[0]) setArchivo(e.target.files[0]); }} />
            </div>
            {/* Contrato */}
            <div>
              <label className="field-label">Contrato asociado *</label>
              <select className="field-input mono" value={contrato} onChange={e => setContrato(e.target.value)}>
                <option value="">— Selecciona el contrato —</option>
                {window.BLUFIN_DATA.contratos.map(c => (
                  <option key={c.folio} value={c.folio}>{c.folio} · {facFmt.USD(c.totalUSD)} · {c.productos[0].marca} · {c.status}</option>
                ))}
              </select>
            </div>
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "#EFF6FF", border: "1px solid #BAE0FF", fontSize: 12, color: "#1E40AF" }}>
              <strong>¿Qué revisa el sistema?</strong> Precio por kg, cantidad (kg), descripción del producto y totales. Las diferencias se destacan para tu revisión.
            </div>
          </div>
        )}

        {phase === "processing" && (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 999, background: "var(--ink-100)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", animation: "spin 1.2s linear infinite" }}>
              <IconF name="clock" size={26} />
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div className="fw-700" style={{ marginBottom: 8 }}>Extrayendo líneas de la factura…</div>
            <div style={{ height: 6, borderRadius: 999, background: "var(--ink-100)", overflow: "hidden", maxWidth: 280, margin: "0 auto" }}>
              <div style={{ height: "100%", borderRadius: 999, background: "var(--blue-500)", width: progress + "%", transition: "width 0.3s" }} />
            </div>
            <div className="text-xs muted" style={{ marginTop: 8 }}>{Math.round(progress)}%</div>
          </div>
        )}

        {phase === "done" && (
          <div style={{ padding: "32px 24px", textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 999, background: "#D1FAE5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <IconF name="check" size={26} />
            </div>
            <div className="fw-700" style={{ fontSize: 16, marginBottom: 6 }}>Factura procesada</div>
            <div className="text-sm muted">Se encontraron diferencias — revísalas antes de aprobar.</div>
          </div>
        )}

        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--ink-200)", display: "flex", justifyContent: "flex-end", gap: 8, background: "var(--ink-50)" }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          {phase === "upload" && (
            <button className="btn btn-primary btn-sm" onClick={handleProcess} disabled={!archivo || !contrato}>
              <IconF name="check" size={13} /> Procesar factura
            </button>
          )}
          {phase === "done" && (
            <button className="btn btn-primary btn-sm" onClick={() => { onProcessed(); onClose(); }}>
              Ver comparación →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Detalle de factura: comparación ───────────────────────────────────────────
const FacturaDetalle = ({ factura, onBack }) => {
  const [lineas, setLineas] = useStateF(factura.lineas.map(l => ({ ...l })));

  const pendientes = lineas.filter(l => l.aceptado === null).length;
  const aceptadas  = lineas.filter(l => l.aceptado === true).length;
  const rechazadas = lineas.filter(l => l.aceptado === false).length;

  const setAceptado = (id, valor) => setLineas(prev => prev.map(l => l.id === id ? { ...l, aceptado: valor, revisadoPor: "Ricardo Núñez", revisadoAt: new Date().toISOString() } : l));

  const totalFactura   = lineas.reduce((s, l) => s + l.total_factura, 0);
  const totalContrato  = lineas.reduce((s, l) => s + l.total_contrato, 0);
  const diferenciaMonto = totalFactura - totalContrato;

  return (
    <div>
      {/* Cabecera */}
      <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 10 }}>
            ← Volver a facturas
          </button>
          <div className="hstack" style={{ gap: 10, marginBottom: 4 }}>
            <span className="mono fw-700" style={{ fontSize: 16 }}>{factura.folioFactura}</span>
            <FacStatusPill status={factura.status} />
          </div>
          <div className="text-sm muted">
            {factura.proveedor} · {facFmt.FechaCorta(factura.fechaFactura)} · Contrato: <span className="mono fw-600">{factura.contratoAsociado}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, textAlign: "right" }}>
          {[
            { label: "Total contrato", value: facFmt.USD(totalContrato), color: "var(--ink-900)" },
            { label: "Total factura",  value: facFmt.USD(totalFactura),  color: "var(--ink-900)" },
            { label: "Diferencia",     value: (diferenciaMonto >= 0 ? "+" : "") + facFmt.USD(diferenciaMonto), color: diferenciaMonto < 0 ? "#DC2626" : diferenciaMonto > 0 ? "#D97706" : "#059669" },
          ].map((item, i) => (
            <div key={i} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--ink-200)", background: "var(--ink-50)" }}>
              <div className="text-xs muted">{item.label}</div>
              <div className="mono fw-700" style={{ fontSize: 15, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Progreso de revisión */}
      <div style={{ padding: "12px 16px", borderRadius: 10, background: "var(--ink-50)", border: "1px solid var(--ink-200)", marginBottom: 16, display: "flex", gap: 20, alignItems: "center" }}>
        <div className="text-sm fw-700">Revisión: {aceptadas + rechazadas} de {lineas.length} líneas</div>
        <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--ink-200)", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 999, background: "var(--blue-500)", width: ((aceptadas + rechazadas) / lineas.length * 100) + "%" }} />
        </div>
        <div className="hstack" style={{ gap: 12 }}>
          {[
            { label: "Pendientes", value: pendientes, color: "#D97706" },
            { label: "Aceptadas",  value: aceptadas,  color: "#059669" },
            { label: "Rechazadas", value: rechazadas, color: "#DC2626" },
          ].map((item, i) => (
            <div key={i} className="text-xs fw-700" style={{ color: item.color }}>
              {item.value} {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Líneas de comparación */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {lineas.map(linea => {
          const matchM = MATCH_META[linea.match] || MATCH_META.ok;
          const isOk = linea.match === "ok";
          const borderColor = linea.aceptado === true ? "#BBF7D0" : linea.aceptado === false ? "#E5E7EB" : linea.match === "diferente" ? "#FED7AA" : "var(--ink-200)";
          const bgColor = linea.aceptado === true ? "#F0FDF4" : linea.aceptado === false ? "#F9FAFB" : "white";

          return (
            <div key={linea.id} style={{ borderRadius: 12, border: "1px solid " + borderColor, background: bgColor, overflow: "hidden", opacity: linea.aceptado === false ? 0.6 : 1 }}>
              {/* Header de línea */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid " + borderColor, display: "flex", justifyContent: "space-between", alignItems: "center", background: isOk ? "#F0FDF4" : linea.aceptado !== null ? bgColor : "#FFFBEB" }}>
                <div className="hstack" style={{ gap: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: matchM.bg, color: matchM.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <IconF name={matchM.icon} size={11} />
                  </div>
                  <div>
                    <div className="hstack" style={{ gap: 8 }}>
                      <span className="mono fw-700 text-sm">{linea.sku_factura}</span>
                      <span style={{ padding: "1px 7px", borderRadius: 999, background: matchM.bg, color: matchM.color, fontSize: 10, fontWeight: 700 }}>{matchM.label}</span>
                      {linea.aceptado === true  && <span className="badge badge-green"  style={{ fontSize: 10 }}>✓ Aceptado</span>}
                      {linea.aceptado === false && <span className="badge badge-gray"   style={{ fontSize: 10 }}>✗ No aplica</span>}
                    </div>
                    <div className="text-xs muted" style={{ marginTop: 2 }}>{linea.descripcion_factura}</div>
                  </div>
                </div>
                {!isOk && linea.aceptado === null && (
                  <div className="hstack" style={{ gap: 6 }}>
                    <button onClick={() => setAceptado(linea.id, false)}
                      style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid var(--ink-300)", background: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--ink-700)" }}>
                      ✗ No aplicar
                    </button>
                    <button onClick={() => setAceptado(linea.id, true)}
                      style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "#059669", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      ✓ Aceptar cambios
                    </button>
                  </div>
                )}
                {linea.aceptado !== null && !isOk && (
                  <button onClick={() => setAceptado(linea.id, null)}
                    style={{ fontSize: 11, color: "var(--ink-500)", background: "transparent", border: "1px solid var(--ink-200)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                    Revertir
                  </button>
                )}
              </div>

              {/* Tabla de comparación */}
              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 1fr 1fr", gap: 0, fontSize: 12 }}>
                  {/* Encabezados */}
                  {["", "Descripción / SKU", "Kg", "Precio USD/kg", "Total USD"].map((h, i) => (
                    <div key={i} style={{ padding: "4px 8px", background: "var(--ink-50)", fontWeight: 700, color: "var(--ink-500)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--ink-200)", borderRight: i < 4 ? "1px solid var(--ink-200)" : undefined }}>{h}</div>
                  ))}
                  {/* Fila contrato */}
                  <div style={{ padding: "8px 8px", borderBottom: "1px solid var(--ink-100)", borderRight: "1px solid var(--ink-200)", fontSize: 11, fontWeight: 700, color: "var(--blue-500)", display: "flex", alignItems: "center" }}>Contrato</div>
                  <div style={{ padding: "8px 8px", borderBottom: "1px solid var(--ink-100)", borderRight: "1px solid var(--ink-200)", display: "flex", alignItems: "center" }}>
                    <div><div className="fw-600">{linea.sku_contrato}</div><div style={{ color: "var(--ink-500)", fontSize: 11 }}>{linea.descripcion_contrato}</div></div>
                  </div>
                  <div style={{ padding: "8px 8px", borderBottom: "1px solid var(--ink-100)", borderRight: "1px solid var(--ink-200)", fontFamily: "monospace", fontWeight: 600, display: "flex", alignItems: "center" }}>{linea.kg_contrato.toLocaleString("es-MX")} kg</div>
                  <div style={{ padding: "8px 8px", borderBottom: "1px solid var(--ink-100)", borderRight: "1px solid var(--ink-200)", fontFamily: "monospace", fontWeight: 600, display: "flex", alignItems: "center" }}>${linea.precio_contrato.toFixed(4)}</div>
                  <div style={{ padding: "8px 8px", borderBottom: "1px solid var(--ink-100)", fontFamily: "monospace", fontWeight: 600, display: "flex", alignItems: "center" }}>{facFmt.USD(linea.total_contrato)}</div>
                  {/* Fila factura */}
                  <div style={{ padding: "8px 8px", borderRight: "1px solid var(--ink-200)", fontSize: 11, fontWeight: 700, color: "#D97706", display: "flex", alignItems: "center" }}>Factura</div>
                  <div style={{ padding: "8px 8px", borderRight: "1px solid var(--ink-200)", display: "flex", alignItems: "center" }}>
                    <div>
                      <div className={"fw-600" + (linea.diferencias?.some(d => d.tipo === "descripcion") ? " " : "")} style={{ color: linea.diferencias?.some(d => d.tipo === "descripcion") ? "#D97706" : "inherit" }}>
                        {linea.sku_factura} {linea.diferencias?.some(d => d.tipo === "descripcion") && <span style={{ fontSize: 10 }}>⚠</span>}
                      </div>
                      <div style={{ color: "var(--ink-500)", fontSize: 11 }}>{linea.descripcion_factura}</div>
                    </div>
                  </div>
                  <div style={{ padding: "8px 8px", borderRight: "1px solid var(--ink-200)", fontFamily: "monospace", fontWeight: 600, display: "flex", alignItems: "center" }}>{linea.kg_factura.toLocaleString("es-MX")} kg</div>
                  <div style={{ padding: "8px 8px", borderRight: "1px solid var(--ink-200)", display: "flex", alignItems: "center" }}>
                    <span className="mono fw-600" style={{ color: linea.diferencias?.some(d => d.tipo === "precio") ? "#DC2626" : "inherit" }}>
                      ${linea.precio_factura.toFixed(4)}
                      {linea.diferencias?.some(d => d.tipo === "precio") && (
                        <span style={{ fontSize: 10, color: "#DC2626", marginLeft: 4 }}>Δ{(linea.precio_factura - linea.precio_contrato).toFixed(4)}</span>
                      )}
                    </span>
                  </div>
                  <div style={{ padding: "8px 8px", fontFamily: "monospace", fontWeight: 600, display: "flex", alignItems: "center" }}>
                    <span style={{ color: linea.total_factura !== linea.total_contrato ? "#DC2626" : "#059669" }}>
                      {facFmt.USD(linea.total_factura)}
                    </span>
                  </div>
                </div>

                {/* Diferencias detalladas */}
                {linea.diferencias?.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {linea.diferencias.map((d, i) => (
                      <div key={i} style={{ padding: "5px 10px", borderRadius: 7, background: "#FFF7ED", border: "1px solid #FED7AA", fontSize: 11 }}>
                        <span style={{ fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {d.tipo === "precio" ? "Precio" : "Descripción"}:
                        </span>
                        <span style={{ color: "#92400E", marginLeft: 4 }}>
                          {d.tipo === "precio"
                            ? `$${d.valorContrato} → $${d.valorFactura} (${d.delta > 0 ? "+" : ""}${d.delta.toFixed(4)} USD/kg)`
                            : `"${d.valorContrato?.substring(0, 30)}…" → "${d.valorFactura?.substring(0, 30)}…"`
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Nota de revisión */}
                {linea.notaRevision && (
                  <div className="text-xs muted" style={{ marginTop: 8, fontStyle: "italic" }}>Nota: {linea.notaRevision}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer de acciones */}
      {pendientes === 0 && (
        <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 10, background: "#F0FDF4", border: "1px solid #BBF7D0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="fw-700 text-sm" style={{ color: "#065F46" }}>✓ Revisión completa — {aceptadas} aceptadas, {rechazadas} sin aplicar</div>
            <div className="text-xs" style={{ color: "#065F46", opacity: 0.8 }}>Los cambios aceptados actualizan el contrato y quedan en el historial de auditoría.</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={onBack}>
            <IconF name="check" size={13} /> Guardar revisión
          </button>
        </div>
      )}
    </div>
  );
};

// ── Vista principal ────────────────────────────────────────────────────────────
const FacturasView = () => {
  const [subirOpen, setSubirOpen] = useStateF(false);
  const [detalleId, setDetalleId] = useStateF(null);
  const [localFacturas, setLocalFacturas] = useStateF(window.BLUFIN_DATA.facturas || []);

  const facturaDetalle = localFacturas.find(f => f.id === detalleId);

  const kpis = useMemoF(() => {
    const pendientes = localFacturas.filter(f => f.status === "Pendiente revisión").length;
    const totalDifMonto = localFacturas.reduce((s, f) => s + Math.abs(f.diferenciaMonto || 0), 0);
    const lineasPend = localFacturas.flatMap(f => f.lineas).filter(l => l.aceptado === null && l.match !== "ok").length;
    return [
      { label: "Por revisar",    value: String(pendientes), sub: "Facturas con diferencias", accent: pendientes > 0 ? "amber" : null },
      { label: "Total facturas", value: String(localFacturas.length), sub: "En el sistema" },
      { label: "Diferencia total", value: facFmt.USD(totalDifMonto), sub: "Suma de diferencias detectadas", accent: totalDifMonto > 0 ? "amber" : null },
      { label: "Líneas pendientes", value: String(lineasPend), sub: "Sin aceptar / rechazar" },
    ];
  }, [localFacturas]);

  if (facturaDetalle) {
    return <FacturaDetalle factura={facturaDetalle} onBack={() => setDetalleId(null)} />;
  }

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} className="kpi" style={{ background: k.accent === "amber" ? "linear-gradient(135deg,#FFFBEB 0%,#FEF3C7 100%)" : undefined, borderColor: k.accent === "amber" ? "#FDE68A" : undefined }}>
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-value">{k.value}</span>
            <span className="text-xs muted" style={{ marginTop: 2 }}>{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Lista de facturas */}
      <div className="card">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="hstack" style={{ gap: 8 }}>
            <span className="fw-700" style={{ fontSize: 14 }}>Facturas del proveedor</span>
            <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "var(--ink-100)", color: "var(--ink-600)", fontWeight: 700 }}>{localFacturas.length}</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setSubirOpen(true)}>
            <IconF name="plus" size={13} /> Subir factura PDF
          </button>
        </div>

        {localFacturas.length === 0 ? (
          <div style={{ padding: "48px 32px", textAlign: "center", color: "var(--ink-400)" }}>
            <IconF name="receipt" size={32} />
            <div style={{ marginTop: 12, fontWeight: 600 }}>Sin facturas subidas</div>
            <div className="text-sm muted" style={{ marginTop: 4 }}>Sube el PDF de la factura del proveedor para compararla con el contrato.</div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 16 }} onClick={() => setSubirOpen(true)}>
              <IconF name="plus" size={13} /> Subir primera factura
            </button>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Folio factura</th>
                <th>Contrato</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th>Subida</th>
                <th style={{ textAlign: "right" }}>Total contrato</th>
                <th style={{ textAlign: "right" }}>Total factura</th>
                <th style={{ textAlign: "right" }}>Diferencia</th>
                <th>Líneas</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {localFacturas.map(f => {
                const lineasDif  = f.lineas.filter(l => l.match === "diferente").length;
                const pendRev    = f.lineas.filter(l => l.aceptado === null && l.match !== "ok").length;
                const dif        = f.diferenciaMonto || 0;
                return (
                  <tr key={f.id} style={{ cursor: "pointer" }} onClick={() => setDetalleId(f.id)}>
                    <td className="mono text-sm fw-700">{f.folioFactura}</td>
                    <td className="mono text-sm">{f.contratoAsociado}</td>
                    <td className="text-sm">{f.proveedor}</td>
                    <td className="text-sm">{facFmt.FechaCorta(f.fechaFactura)}</td>
                    <td className="text-sm">{facFmt.FechaCorta(f.fechaSubida)}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-600">{facFmt.USD(f.totalContrato)}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-600">{facFmt.USD(f.totalFactura)}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className="mono fw-700" style={{ color: dif < 0 ? "#DC2626" : dif > 0 ? "#D97706" : "#059669" }}>
                        {dif >= 0 ? "+" : ""}{facFmt.USD(dif)}
                      </span>
                    </td>
                    <td>
                      <div className="hstack" style={{ gap: 4 }}>
                        <span className="badge badge-gray" style={{ fontSize: 10 }}>{f.lineas.length} líneas</span>
                        {lineasDif > 0 && <span className="badge badge-amber" style={{ fontSize: 10 }}>{lineasDif} dif.</span>}
                        {pendRev > 0  && <span className="badge badge-amber" style={{ fontSize: 10 }}>{pendRev} pend.</span>}
                      </div>
                    </td>
                    <td><FacStatusPill status={f.status} /></td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setDetalleId(f.id); }}>
                        Revisar →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <SubirFacturaModal open={subirOpen} onClose={() => setSubirOpen(false)} onProcessed={() => {}} />
    </>
  );
};

Object.assign(window, { FacturasView });
