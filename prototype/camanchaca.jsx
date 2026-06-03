// ============================================================
// Camanchaca — Módulo principal
// Shell con switcher SA / MX + tabs + routing a sub-módulos
//
// SA (Salmones Camanchaca S.A.):
//   Tabs: Contenedores | Pagos | Recepción | Calendario | Costos
//   Flujo: planeación (OC del vendedor) → factura → pago USD + costo importación MXN
//
// MX (Camanchaca México S.A. de C.V.):
//   Tabs: Compras | Pagos | Costos | Calendario
//   Flujo: llega factura → se da de alta → pagos parciales MXN crédito 30 días
// ============================================================

const { useState: useSCM, useMemo: useMemoSCM, useEffect: useEffSCM } = React;
const { SAOrdenForm, SAFacturaForm, SAETAEditor } = window;

// ── Helpers compartidos ────────────────────────────────────────────────────────
const fmtUSD_SCM = (n) => "$" + Number(n||0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMXN_SCM = (n) => "$" + Number(n||0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtKg_SCM  = (n) => Number(n||0).toLocaleString("es-MX") + " kg";
const fmtFch_SCM = (s) => { if (!s) return "—"; const d = new Date(s + "T12:00:00"); return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }); };

const SA_STATUS_STYLE = {
  "Planeado":     { bg: "#F3F4F6", color: "#6B7280" },
  "En tránsito":  { bg: "#DBEAFE", color: "#1E40AF" },
  "En Manzanillo":{ bg: "#EDE9FE", color: "#5B21B6" },
  "Entregado":    { bg: "#D1FAE5", color: "#065F46" },
};

// ════════════════════════════════════════════════════════════════════════════════
// SA — Lista de contenedores (tab principal de Contenedores)
// ════════════════════════════════════════════════════════════════════════════════
const SAContenedoresList = ({ onSelect }) => {
  const data  = window.CAMANCHACA_DATA;
  const [subView,    setSubView]    = useSCM("contenedores");
  const [showNew,    setShowNew]    = useSCM(false);
  const [showOrden,  setShowOrden]  = useSCM(false);
  const [confirmOC,  setConfirmOC]  = useSCM(null); // OC a confirmar con factura

  const conts = data.contenedoresSA;
  const totalPendUSD = conts.reduce((s, c) => {
    const paid = (c.pagos || []).reduce((a, p) => a + p.monto, 0);
    return s + Math.max(0, (c.totalUSD || 0) - paid);
  }, 0);
  const enTransito = conts.filter(c => c.status === "En tránsito" || c.status === "En Manzanillo").length;

  return (
    <div>
      {/* Sub-tabs: Contenedores vs Planeación */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--ink-200)", marginBottom: 20 }}>
        {[
          { id: "contenedores", label: "Contenedores" },
          { id: "ordenes",      label: "Planeación de órdenes" },
        ].map(t => (
          <button key={t.id} onClick={() => setSubView(t.id)} style={{
            padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: "none", background: "transparent",
            color: subView === t.id ? "var(--blue-500)" : "var(--ink-500)",
            borderBottom: subView === t.id ? "2px solid var(--blue-500)" : "2px solid transparent",
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Vista: Contenedores ── */}
      {subView === "contenedores" && (
        <div>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Contenedores totales", value: conts.length,               sub: "historial SA",        color: null },
              { label: "En camino",            value: enTransito,                  sub: "tránsito + Manzanillo", color: "var(--blue-500)" },
              { label: "Saldo proveedor",      value: fmtUSD_SCM(totalPendUSD),   sub: "USD por pagar",       color: totalPendUSD > 0 ? "var(--amber-500)" : "var(--ink-400)" },
              { label: "TC del día",           value: data.tcDelDia.toFixed(3),    sub: "referencia",          color: null },
            ].map((k, i) => (
              <div key={i} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.color || "var(--ink-900)", fontFamily: "var(--font-mono)" }}>{k.value}</div>
                <div style={{ fontSize: 11, color: "var(--ink-400)", marginTop: 4 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Tabla */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-700)" }}>Salmones Camanchaca, S.A. — Chile</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
                <Icon name="plus" size={12}/> Capturar factura
              </button>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Folio</th><th>OC Proveedor</th><th>Factura</th>
                  <th>Naviera</th><th>ETA Bodega</th>
                  <th style={{ textAlign: "right" }}>Kg</th>
                  <th style={{ textAlign: "right" }}>Total USD</th>
                  <th style={{ textAlign: "right" }}>Imp. MXN</th>
                  <th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {conts.map(c => {
                  const totalImp = (c.costoImportacion || []).reduce((s, i) => s + i.montoMXN, 0);
                  const paid     = (c.pagos || []).reduce((s, p) => s + p.monto, 0);
                  const sc       = SA_STATUS_STYLE[c.status] || { bg: "#F3F4F6", color: "#6B7280" };
                  const saldo    = (c.totalUSD || 0) - paid;
                  return (
                    <tr key={c.folioInterno} style={{ cursor: "pointer" }}
                      onClick={() => onSelect(c.folioInterno)}
                      onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                      onMouseLeave={e => e.currentTarget.style.background = "white"}>
                      <td className="mono fw-700" style={{ color: "var(--blue-500)" }}>{c.folioInterno}</td>
                      <td className="mono text-sm">{c.ocProveedor}</td>
                      <td className="text-sm">
                        {c.factura
                          ? <span className="mono fw-600">{c.factura}</span>
                          : <span style={{ color: "var(--ink-400)", fontSize: 11, fontStyle: "italic" }}>Sin factura</span>}
                      </td>
                      <td className="text-sm">{c.naviera || "—"}</td>
                      <td className="text-sm">{fmtFch_SCM(c.etaBodega)}</td>
                      <td style={{ textAlign: "right" }} className="mono">{fmtKg_SCM(c.totalKg)}</td>
                      <td style={{ textAlign: "right" }}>
                        {c.totalUSD
                          ? <div>
                              <div className="mono fw-700" style={{ color: "var(--blue-500)" }}>{fmtUSD_SCM(c.totalUSD)}</div>
                              {saldo > 0.01 && <div style={{ fontSize: 10, color: "var(--amber-500)", fontWeight: 600 }}>Saldo: {fmtUSD_SCM(saldo)}</div>}
                            </div>
                          : <span className="muted">—</span>}
                      </td>
                      <td style={{ textAlign: "right" }} className="mono" style={{ color: totalImp > 0 ? "var(--amber-500)" : "var(--ink-400)", textAlign: "right" }}>
                        {totalImp > 0 ? fmtMXN_SCM(totalImp) : "—"}
                      </td>
                      <td>
                        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.color }}>
                          {c.status}
                        </span>
                      </td>
                      <td><Icon name="chevRight" size={13} style={{ color: "var(--ink-400)" }}/></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Vista: Planeación ── */}
      {subView === "ordenes" && (
        <div>
          <div style={{ padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, fontSize: 12, color: "#92400E", marginBottom: 14 }}>
            <span className="fw-700">Calendario del vendedor en Chile (Felipe)</span> — Se captura la información que manda por WhatsApp antes de que llegue la factura formal. Una vez que llega la factura, el contenedor se confirma y se vincula con el folio interno.
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-700)" }}>Órdenes del calendario — {data.ordenesPlaneadas.length} registradas</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowOrden(true)}><Icon name="plus" size={12}/> Agregar orden</button>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>OC Proveedor</th><th>Descripción estimada</th>
                  <th style={{ textAlign: "right" }}>Kg estimados</th>
                  <th>Llegada estimada</th>
                  <th>Folio interno</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {data.ordenesPlaneadas.map(op => (
                  <tr key={op.id}>
                    <td className="mono fw-700">{op.ocProveedor}</td>
                    <td className="fw-600 text-sm">{op.desc}</td>
                    <td style={{ textAlign: "right" }} className="mono">{fmtKg_SCM(op.kgEst)}</td>
                    <td className="text-sm">{op.llegadaEst}</td>
                    <td>
                      {op.folioInterno
                        ? <span className="mono fw-700" style={{ color: "var(--blue-500)" }}>{op.folioInterno}</span>
                        : <span style={{ fontSize: 11, color: "var(--ink-400)", fontStyle: "italic" }}>Por asignar</span>}
                    </td>
                    <td>
                      <span className={`badge ${op.status === "confirmado" ? "badge-green" : "badge-gray"}`}>
                        {op.status === "confirmado" ? "Confirmado" : "Planeado"}
                      </span>
                    </td>
                    <td>
                      {op.status !== "confirmado" && (
                        <button className="btn btn-accent btn-sm" style={{ fontSize: 11 }}
                          onClick={() => setConfirmOC(op.ocProveedor)}>
                          Confirmar con factura →
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNew    && <SAFacturaForm onClose={() => setShowNew(false)} />}
      {showOrden  && <SAOrdenForm  onClose={() => setShowOrden(false)} />}
      {confirmOC  && <SAFacturaForm prefill={{ ocProveedor: confirmOC }} onClose={() => setConfirmOC(null)} />}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// SA — Detalle de un contenedor
// ════════════════════════════════════════════════════════════════════════════════
const SAContenedorDetalle = ({ folioInterno, onBack }) => {
  const data = window.CAMANCHACA_DATA;
  const c    = data.contenedoresSA.find(x => x.folioInterno === folioInterno);
  const [section,     setSection]     = useSCM("productos");
  const [editingETA,  setEditingETA]  = useSCM(false);
  const [showFactura, setShowFactura] = useSCM(false);
  if (!c) return null;

  const totalPagado   = (c.pagos || []).reduce((s, p) => s + p.monto, 0);
  const saldoUSD      = (c.totalUSD || 0) - totalPagado;
  const totalImpMXN   = (c.costoImportacion || []).reduce((s, i) => s + i.montoMXN, 0);
  const tcEfectivo    = (c.pagos || []).length
    ? (c.pagos.reduce((s, p) => s + p.tc * p.monto, 0) / totalPagado)
    : ((c.forwards || [])[0]?.tcForward || data.tcDelDia);
  const costoFOBmxn   = (c.totalUSD || 0) * tcEfectivo;
  const costoTotalMXN = costoFOBmxn + totalImpMXN;
  const costoKgFOB    = c.totalKg ? costoFOBmxn / c.totalKg : 0;
  const costoKgImp    = c.totalKg ? totalImpMXN / c.totalKg : 0;
  const costoKgTotal  = costoKgFOB + costoKgImp;
  const costoKgUSD    = c.totalKg ? (c.totalUSD || 0) / c.totalKg : 0;
  const sc            = SA_STATUS_STYLE[c.status] || { bg: "#F3F4F6", color: "#6B7280" };

  const sections = [
    { id: "productos",    label: "Productos" },
    { id: "pagos",        label: "Pagos proveedor" },
    { id: "importacion",  label: "Costo importación" },
    ...(c.descuento ? [{ id: "descuento", label: "Descuento" }] : []),
  ];

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={onBack}>
        <Icon name="chevLeft" size={13}/> Regresar a contenedores
      </button>

      {/* Header */}
      <div className="card" style={{ padding: "18px 22px", marginBottom: 16, background: "linear-gradient(135deg, #EFF6FF 0%, #F9FAFB 100%)", border: "1px solid #BFDBFE" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: c.totalUSD ? 16 : 0 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 900, fontFamily: "var(--font-mono)", color: "var(--ink-900)" }}>{c.folioInterno}</span>
              <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>{c.status}</span>
              {c.descuento && <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: "#FEE2E2", color: "#991B1B" }}>Descuento aplicado</span>}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-600)", display: "flex", gap: 18, flexWrap: "wrap" }}>
              <span><span className="fw-600">OC:</span> {c.ocProveedor}</span>
              {c.factura   && <span><span className="fw-600">Factura:</span> {c.factura}</span>}
              {c.naviera   && <span><span className="fw-600">Naviera:</span> {c.naviera}</span>}
              <span><span className="fw-600">ETA Manzanillo:</span> {fmtFch_SCM(c.etaManzanillo)}</span>
              <span><span className="fw-600">ETA Bodega:</span> {fmtFch_SCM(c.etaBodega)}</span>
              <span><span className="fw-600">Kg:</span> {fmtKg_SCM(c.totalKg)}</span>
              {c.fechaVencimiento && <span><span className="fw-600">Vence:</span> {fmtFch_SCM(c.fechaVencimiento)}</span>}
            </div>
          </div>
          {c.totalUSD && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "var(--ink-500)", marginBottom: 2 }}>Total factura (USD)</div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "var(--font-mono)", color: "var(--blue-500)" }}>{fmtUSD_SCM(c.totalUSD)}</div>
            </div>
          )}
        </div>

        {/* Resumen de costos — solo si tiene factura */}
        {c.totalUSD && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, paddingTop: 14, borderTop: "1px solid #BFDBFE" }}>
            {[
              { label: "USD/kg (FOB)",      value: "$" + costoKgUSD.toFixed(4), color: "var(--blue-500)" },
              { label: "TC efectivo",        value: tcEfectivo.toFixed(4),        color: null },
              { label: "FOB MXN/kg",         value: fmtMXN_SCM(costoKgFOB),      color: null },
              { label: "Imp. MXN/kg",        value: fmtMXN_SCM(costoKgImp),      color: "#92400E", amber: true },
              { label: "Costo total MXN/kg", value: fmtMXN_SCM(costoKgTotal),    strong: true },
            ].map((k, i) => (
              <div key={i} style={{
                background: k.strong ? "var(--ink-900)" : k.amber ? "#FEF3C7" : "white",
                borderRadius: 8, padding: "10px 12px", border: "1px solid",
                borderColor: k.strong ? "var(--ink-900)" : k.amber ? "#FDE68A" : "var(--ink-200)",
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: k.strong ? "rgba(255,255,255,0.5)" : "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "var(--font-mono)", color: k.strong ? "white" : k.amber ? "#92400E" : k.color || "var(--ink-900)" }}>{k.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sección tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--ink-200)", marginBottom: 16 }}>
        {sections.map(t => (
          <button key={t.id} onClick={() => setSection(t.id)} style={{
            padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: "none", background: "transparent",
            color: section === t.id ? "var(--blue-500)" : "var(--ink-500)",
            borderBottom: section === t.id ? "2px solid var(--blue-500)" : "2px solid transparent",
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Productos ── */}
      {section === "productos" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {c.factura && c.productos.length > 0 ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Código</th><th>Descripción</th>
                  <th style={{ textAlign: "right" }}>kg/Caja</th>
                  <th style={{ textAlign: "right" }}>Cajas</th>
                  <th style={{ textAlign: "right" }}>Kg</th>
                  <th style={{ textAlign: "right" }}>USD/kg</th>
                  <th style={{ textAlign: "right" }}>Total USD</th>
                </tr>
              </thead>
              <tbody>
                {c.productos.map((p, i) => (
                  <tr key={i}>
                    <td className="mono fw-600">{p.code}</td>
                    <td className="fw-600 text-sm">{p.desc}</td>
                    <td style={{ textAlign: "right" }} className="mono">{p.kgCaja.toFixed(2)}</td>
                    <td style={{ textAlign: "right" }} className="mono">{p.cajas.toLocaleString()}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-600">{fmtKg_SCM(p.kg)}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "var(--blue-500)", textAlign: "right" }}>{fmtUSD_SCM(p.precioUSD)}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-700">{fmtUSD_SCM(p.totalUSD)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--ink-50)" }}>
                  <td colSpan={4} className="fw-700">TOTAL</td>
                  <td style={{ textAlign: "right" }} className="mono fw-700">{fmtKg_SCM(c.totalKg)}</td>
                  <td></td>
                  <td style={{ textAlign: "right" }} className="mono fw-800" style={{ color: "var(--blue-500)", textAlign: "right", fontSize: 14 }}>{fmtUSD_SCM(c.totalUSD)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div style={{ padding: "40px 32px", textAlign: "center", color: "var(--ink-400)" }}>
              <Icon name="doc" size={28}/>
              <div style={{ marginTop: 10, fontWeight: 600 }}>Factura pendiente</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Cuando llegue la factura de Camanchaca Chile, captura los SKUs, precios, ETA y vencimiento.</div>
              <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setShowFactura(true)}>
                Capturar factura
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Pagos proveedor ── */}
      {section === "pagos" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Total factura",   value: fmtUSD_SCM(c.totalUSD || 0), color: null },
              { label: "Pagado",          value: fmtUSD_SCM(totalPagado),      color: "var(--green-500)" },
              { label: "Saldo pendiente", value: fmtUSD_SCM(saldoUSD),         color: saldoUSD > 0.01 ? "var(--amber-500)" : "var(--ink-400)" },
            ].map((k, i) => (
              <div key={i} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-500)", marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "var(--font-mono)", color: k.color || "var(--ink-900)" }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Forwards */}
          {(c.forwards || []).length > 0 && (
            <div style={{ padding: "14px 18px", background: "#EDE9FE", border: "1px solid #DDD6FE", borderRadius: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#5B21B6", marginBottom: 8 }}>Forwards cambiarios</div>
              {c.forwards.map(f => (
                <div key={f.id} style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, alignItems: "center" }}>
                  <span><span className="fw-600">Monto:</span> {fmtUSD_SCM(f.montoUSD)}</span>
                  <span><span className="fw-600">TC Forward:</span> <span style={{ color: "#5B21B6", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{f.tcForward.toFixed(4)}</span></span>
                  <span><span className="fw-600">MXN asegurado:</span> {fmtMXN_SCM(f.montoMXN)}</span>
                  <span><span className="fw-600">Banco:</span> {f.banco}</span>
                  <span><span className="fw-600">Entrega:</span> {fmtFch_SCM(f.fechaEntrega)}</span>
                  <span className={`badge ${f.status === "Ejecutado" ? "badge-green" : "badge-violet"}`}>{f.status}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>Pagos al proveedor (USD)</span>
              {saldoUSD > 0.01 && <button className="btn btn-primary btn-sm"><Icon name="plus" size={12}/> Registrar pago</button>}
            </div>
            {(c.pagos || []).length > 0 ? (
              <table className="tbl">
                <thead>
                  <tr><th>ID</th><th>Tipo</th><th style={{ textAlign: "right" }}>USD</th><th style={{ textAlign: "right" }}>TC</th><th style={{ textAlign: "right" }}>MXN</th><th>Banco</th><th>Referencia</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                  {c.pagos.map(p => (
                    <tr key={p.id}>
                      <td className="mono text-xs" style={{ color: "var(--ink-500)" }}>{p.id}</td>
                      <td><span className="badge badge-blue">{p.tipo}</span></td>
                      <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "var(--blue-500)", textAlign: "right" }}>{fmtUSD_SCM(p.monto)}</td>
                      <td style={{ textAlign: "right" }} className="mono">{p.tc.toFixed(4)}</td>
                      <td style={{ textAlign: "right" }} className="mono fw-600">{fmtMXN_SCM(p.montoMXN)}</td>
                      <td className="text-sm">{p.banco}</td>
                      <td className="mono text-xs">{p.referencia}</td>
                      <td className="text-sm">{fmtFch_SCM(p.fecha)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: "28px", textAlign: "center", color: "var(--ink-400)", fontSize: 13 }}>Sin pagos registrados aún</div>
            )}
          </div>
        </div>
      )}

      {/* ── Costo importación ── */}
      {section === "importacion" && (
        <div>
          <div style={{ padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, fontSize: 12, color: "#92400E", marginBottom: 14 }}>
            Pagos en <strong>MXN</strong> a agencias aduanales que gestionan la importación en Manzanillo. Se suman al costo FOB para obtener el <strong>costo total internado en bodega</strong>. Pueden ser una o varias agencias.
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>Agencias importadoras</span>
              <button className="btn btn-primary btn-sm"><Icon name="plus" size={12}/> Agregar agencia</button>
            </div>
            {(c.costoImportacion || []).length > 0 ? (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Razón Social</th>
                    <th style={{ textAlign: "right" }}>Monto MXN</th>
                    <th>Fecha pago</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {c.costoImportacion.map((imp, i) => (
                    <tr key={i}>
                      <td className="fw-600 text-sm">{imp.razonSocial}</td>
                      <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "var(--amber-500)", textAlign: "right" }}>{fmtMXN_SCM(imp.montoMXN)}</td>
                      <td className="text-sm">{fmtFch_SCM(imp.fecha)}</td>
                      <td><span className={`badge ${imp.pagado ? "badge-green" : "badge-amber"}`}>{imp.pagado ? "Pagado" : "Pendiente"}</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--ink-50)" }}>
                    <td className="fw-700">TOTAL IMPORTACIÓN</td>
                    <td style={{ textAlign: "right" }} className="mono fw-800" style={{ color: "var(--amber-500)", textAlign: "right", fontSize: 14 }}>{fmtMXN_SCM(totalImpMXN)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <div style={{ padding: "28px", textAlign: "center", color: "var(--ink-400)", fontSize: 13 }}>Sin costos de importación registrados</div>
            )}
          </div>
        </div>
      )}

      {/* ── Descuento ── */}
      {section === "descuento" && c.descuento && (
        <div className="card" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Descuento de mercancía</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { label: "Monto USD", value: fmtUSD_SCM(c.descuento.montoUSD), color: "var(--red-500)" },
              { label: "Motivo",    value: c.descuento.motivo },
              { label: "Fecha",     value: fmtFch_SCM(c.descuento.fecha) },
            ].map((k, i) => (
              <div key={i}>
                <div style={{ fontSize: 11, color: "var(--ink-500)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 14, fontWeight: k.color ? 800 : 500, color: k.color || "var(--ink-900)", fontFamily: k.color ? "var(--font-mono)" : "inherit" }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {showFactura && (
        <SAFacturaForm
          prefill={{ folioInterno: c.folioInterno, ocProveedor: c.ocProveedor }}
          onClose={() => setShowFactura(false)}
        />
      )}
    </div>
  );
};
// ════════════════════════════════════════════════════════════════════════════════
const CamanchacaModule = () => {
  const [entity,   setEntity]   = useSCM("sa");
  const [tab,      setTab]      = useSCM("contenedores");
  const [selectedFolio, setSelectedFolio] = useSCM(null);
  const [refreshKey, setRefreshKey] = useSCM(0);

  // Escucha cambios de datos de cualquier formulario
  useEffSCM(() => {
    const h = () => setRefreshKey(k => k + 1);
    window.addEventListener('cam-data-changed', h);
    return () => window.removeEventListener('cam-data-changed', h);
  }, []);

  const SA_TABS = [
    { id: "contenedores", label: "Contenedores",      icon: "ship"      },
    { id: "pagos",        label: "Pagos",             icon: "payments"  },
    { id: "recepcion",    label: "Recepción",         icon: "warehouse" },
    { id: "calendario",   label: "Calendario",        icon: "calendar"  },
    { id: "costos",       label: "Central de Costos", icon: "sales"     },
    { id: "catalogo",     label: "Productos",         icon: "pkg"       },
  ];
  const MX_TABS = [
    { id: "compras",    label: "Compras",             icon: "doc"      },
    { id: "pagos",      label: "Pagos",               icon: "payments" },
    { id: "costos",     label: "Central de Costos",   icon: "sales"    },
    { id: "calendario", label: "Calendario",          icon: "calendar" },
    { id: "catalogo",   label: "Productos",           icon: "pkg"      },
  ];

  const tabs = entity === "sa" ? SA_TABS : MX_TABS;

  const switchEntity = (e) => {
    setEntity(e);
    setTab(e === "sa" ? "contenedores" : "compras");
    setSelectedFolio(null);
  };
  const switchTab = (t) => { setTab(t); setSelectedFolio(null); };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:160, height:80, borderRadius:10, background:"white", border:"1px solid var(--ink-100)", display:"flex", alignItems:"center", justifyContent:"center", padding:"6px 10px", flexShrink:0, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
            <img src="assets/camanchaca-logo.png" alt="Camanchaca" style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain" }}/>
          </div>
          <div>
            <h1 className="page-title">Camanchaca</h1>
            <p className="page-subtitle">
              {entity === "sa"
                ? "🇨🇱 Salmones Camanchaca, S.A. — Puerto Montt, Chile · Importación USD · Entrega Manzanillo"
                : "🇲🇽 Camanchaca México, S.A. de C.V. — Compras directas MXN · Crédito 30 días"}
            </p>
          </div>
        </div>

        {/* Switcher SA / MX */}
        <div style={{ display: "flex", background: "var(--ink-100)", borderRadius: 10, padding: 4, gap: 4, alignSelf: "center" }}>
          {[
            { id: "sa", label: "🇨🇱 Camanchaca S.A." },
            { id: "mx", label: "🇲🇽 Camanchaca México" },
          ].map(e => (
            <button key={e.id} onClick={() => switchEntity(e.id)} style={{
              padding: "8px 16px", borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              background: entity === e.id ? "white" : "transparent",
              color:      entity === e.id ? "var(--ink-900)" : "var(--ink-500)",
              boxShadow:  entity === e.id ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              transition: "all 0.15s",
            }}>{e.label}</button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1.5px solid var(--ink-200)", marginBottom: 20 }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => switchTab(t.id)} style={{
              padding: "10px 18px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              border: "none", background: "transparent",
              color: active ? "var(--blue-500)" : "var(--ink-600)",
              borderBottom: active ? "2px solid var(--blue-500)" : "2px solid transparent",
              marginBottom: -1.5, display: "flex", alignItems: "center", gap: 6, transition: "color 0.15s",
            }}>
              <Icon name={t.icon} size={13}/> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── SA content ── */}
      {entity === "sa" && (
        <div key={refreshKey}>
          {tab === "contenedores" && !selectedFolio && <SAContenedoresList onSelect={setSelectedFolio}/>}
          {tab === "contenedores" && selectedFolio  && <SAContenedorDetalle folioInterno={selectedFolio} onBack={() => setSelectedFolio(null)}/>}
          {tab === "pagos"       && <SAGlobalPagos/>}
          {tab === "recepcion"   && <CamanchacaRecepcion/>}
          {tab === "calendario"  && <CamanchacaCalendario entity="sa"/>}
          {tab === "costos"      && <CamanchacaCostos entity="sa"/>}
          {tab === "catalogo"    && <SkuCatalogo
            skus={window.CAMANCHACA_DATA.skus}
            onRefresh={() => setRefreshKey(k=>k+1)}
            categorias={["Salmón Reserva","Salmón Premium","Salmón Café","Ahumados","Otros"]}
            accentColor="#0EA5A1"
          />}
        </div>
      )}

      {/* ── MX content ── */}
      {entity === "mx" && (
        <div key={refreshKey}>
          {tab === "compras"    && <MXCompras/>}
          {tab === "pagos"      && <MXPagosGlobal/>}
          {tab === "costos"     && <CamanchacaCostos entity="mx"/>}
          {tab === "catalogo"  && <SkuCatalogo
            skus={window.CAMANCHACA_DATA.skus}
            onRefresh={() => setRefreshKey(k=>k+1)}
            categorias={["Salmón Reserva","Salmón Premium","Salmón Café","Ahumados","Otros"]}
            accentColor="#0EA5A1"
          />}
          {tab === "calendario" && <CamanchacaCalendario entity="mx"/>}
        </div>
      )}
    </div>
  );
};

Object.assign(window, { CamanchacaModule, SAContenedoresList, SAContenedorDetalle });
