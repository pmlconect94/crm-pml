// ============================================
// Blufin Seafood — Módulo de Notas de Crédito
// Flujo: Sin monto → Pendiente → Parcial → Aplicada
// folioInterno: consecutivo interno (NC-0001…)
// folioTimbrado: se captura cuando llega la NC timbrada
// ============================================

const { useState: useStateNC, useMemo: useMemoNC, useEffect: useEffectNC } = React;
const { Icon: IconNC } = window;
const HOY_NC = "2026-05-21";
const ncFmt = { USD: window.fmtUSD, Fecha: window.fmtFecha, FechaCorta: window.fmtFechaCorta };
const fmtMXNnc = (n) => "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Metadata ──────────────────────────────────────────────────────────────────

const RAZON_META = {
  presentacion: { label: "Presentación pactada", shortLabel: "Presentación", icon: "alert",  color: "#D97706", bg: "#FEF3C7", text: "#92400E", desc: "El contrato pactó paletizado pero llegó a granel" },
  descuento:    { label: "Descuento de producto", shortLabel: "Descuento",    icon: "dollar", color: "#059669", bg: "#D1FAE5", text: "#065F46", desc: "Descuento acordado sobre la mercancía recibida" },
  faltante:     { label: "Mercancía faltante",    shortLabel: "Faltante",     icon: "alert",  color: "#DC2626", bg: "#FEE2E2", text: "#991B1B", desc: "Llegaron menos kg de los facturados" },
};

const NC_STATUS = {
  "Sin monto": { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF" },
  "Pendiente": { bg: "#FEF3C7", color: "#92400E", dot: "#D97706" },
  "Parcial":   { bg: "#E0F2FE", color: "#0369A1", dot: "#0EA5E9" },
  "Aplicada":  { bg: "#D1FAE5", color: "#065F46", dot: "#059669" },
};

// ── Atoms ──────────────────────────────────────────────────────────────────────

const NCStatusPill = ({ status }) => {
  const m = NC_STATUS[status] || NC_STATUS["Sin monto"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, background: m.bg, color: m.color, fontSize: 11, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: m.dot }} />{status}
    </span>
  );
};

const RazonPill = ({ razon }) => {
  const m = RAZON_META[razon];
  if (!m) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, background: m.bg, color: m.text, fontSize: 11, fontWeight: 600 }}>
      {m.shortLabel}
    </span>
  );
};

// ── Modal: Capturar Monto ──────────────────────────────────────────────────────
// Se usa cuando el proveedor ya comunicó el monto de la NC

const CapturarMontoModal = ({ open, onClose, nc }) => {
  const [montoUSD, setMontoUSD] = useStateNC("");
  const [tc, setTC] = useStateNC(window.BLUFIN_DATA.tcDelDia);
  const [nota, setNota] = useStateNC("");

  useEffectNC(() => {
    if (open && nc) {
      setMontoUSD("");
      setTC(window.BLUFIN_DATA.tcDelDia);
      setNota("");
    }
  }, [open, nc?.id]);

  if (!open || !nc) return null;

  const monto = parseFloat(montoUSD) || 0;
  const montoMXN = monto * (parseFloat(tc) || 0);
  const razonM = RAZON_META[nc.razon];
  const canSave = monto > 0 && tc;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,37,64,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1001 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 16, maxWidth: 480, width: "100%", overflow: "hidden", boxShadow: "0 24px 48px rgba(10,37,64,0.25)" }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--ink-200)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
              <span className="mono fw-700" style={{ fontSize: 14 }}>{nc.folioInterno}</span>
              <RazonPill razon={nc.razon} />
            </div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Capturar monto de la NC</h2>
            <div className="text-sm muted" style={{ marginTop: 2 }}>El proveedor comunicó el monto — regístralo aquí.</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 20, color: "var(--ink-400)", cursor: "pointer" }}>✕</button>
        </div>

        {/* Contexto de la NC */}
        <div style={{ padding: "12px 22px", background: razonM.bg, borderBottom: "1px solid " + razonM.color + "44" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><div className="text-xs muted">Contrato origen</div><div className="mono fw-700">{nc.contratoOrigen}</div></div>
            <div>
              <div className="text-xs muted">Razón</div>
              <div className="fw-700 text-sm" style={{ color: razonM.text }}>
                {nc.razon === "presentacion" ? `${nc.presentacionPactada} → ${nc.presentacionRecibida}` :
                 nc.razon === "faltante"     ? `${nc.kgFaltantes?.toLocaleString("es-MX")} kg faltantes` :
                 nc.descripcionDescuento}
              </div>
            </div>
          </div>
          {nc.skuOrigen && <div className="text-xs muted" style={{ marginTop: 6 }}>SKU: <span className="mono fw-600">{nc.skuOrigen}</span></div>}
          {nc.recepcionOrigen && <div className="text-xs muted" style={{ marginTop: 2 }}>Generada en: <span className="mono fw-600">{nc.recepcionOrigen}</span></div>}
        </div>

        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="field-label">Monto notificado por el proveedor (USD) *</label>
            <input type="number" step="0.01" className="field-input mono" value={montoUSD} onChange={e => setMontoUSD(e.target.value)} placeholder="0.00" autoFocus />
          </div>
          <div>
            <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <label className="field-label" style={{ margin: 0 }}>TC de referencia</label>
              <span className="text-xs muted">día: <span className="mono fw-600">{window.BLUFIN_DATA.tcDelDia.toFixed(4)}</span></span>
            </div>
            <input type="number" step="0.0001" className="field-input mono" value={tc} onChange={e => setTC(e.target.value)} />
          </div>
          {monto > 0 && (
            <div style={{ padding: 12, borderRadius: 8, background: "#FFF7ED", border: "1px solid #FED7AA" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><div className="text-xs muted">Monto NC USD</div><div className="mono fw-700" style={{ color: "#DC2626", fontSize: 17 }}>−{ncFmt.USD(monto)}</div></div>
                <div><div className="text-xs muted">Equivalente MXN</div><div className="mono fw-700" style={{ color: "var(--blue-500)", fontSize: 17 }}>−{fmtMXNnc(montoMXN)}</div></div>
              </div>
            </div>
          )}
          <div>
            <label className="field-label">Nota (opcional)</label>
            <input className="field-input" value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej. Monto confirmado por correo de José Luis el 21 mayo" />
          </div>
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--ink-200)", display: "flex", justifyContent: "space-between", background: "var(--ink-50)" }}>
          <div className="text-xs muted">Por <span className="fw-600">Ricardo Núñez</span></div>
          <div className="hstack" style={{ gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={onClose} disabled={!canSave}>
              <IconNC name="check" size={13} /> Guardar monto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Modal: Aplicar NC ──────────────────────────────────────────────────────────

const AplicarNCModal = ({ open, onClose, nc }) => {
  const [destino, setDestino] = useStateNC("mismo");
  const [folioDestino, setFolioDestino] = useStateNC("");
  const [montoAplicar, setMontoAplicar] = useStateNC("");
  const [fecha, setFecha] = useStateNC(HOY_NC);
  const [nota, setNota] = useStateNC("");

  useEffectNC(() => {
    if (open && nc) {
      setDestino("mismo");
      setFolioDestino(nc.contratoOrigen);
      setMontoAplicar(nc.saldoPendienteUSD?.toFixed(2) || "");
      setFecha(HOY_NC);
      setNota("");
    }
  }, [open, nc?.id]);

  if (!open || !nc) return null;

  const razonM = RAZON_META[nc.razon];
  const monto = parseFloat(montoAplicar) || 0;
  const excede = monto > (nc.saldoPendienteUSD || 0) + 0.001;
  const saldoRestante = Math.max(0, (nc.saldoPendienteUSD || 0) - monto);
  const folioFinal = destino === "mismo" ? nc.contratoOrigen : folioDestino;
  const canApply = monto > 0 && !excede && fecha && folioFinal;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,37,64,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1001 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 16, maxWidth: 540, width: "100%", maxHeight: "92vh", overflow: "auto", boxShadow: "0 24px 48px rgba(10,37,64,0.25)" }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--ink-200)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
              <span className="mono fw-700" style={{ fontSize: 14 }}>{nc.folioInterno}</span>
              <RazonPill razon={nc.razon} />
              <NCStatusPill status={nc.status} />
            </div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Aplicar nota de crédito</h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 20, color: "var(--ink-400)", cursor: "pointer" }}>✕</button>
        </div>

        {/* Resumen NC */}
        <div style={{ padding: "12px 22px", background: razonM.bg, borderBottom: "1px solid " + razonM.color + "44" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><div className="text-xs muted">Contrato origen</div><div className="mono fw-700">{nc.contratoOrigen}</div></div>
            <div><div className="text-xs muted">Monto total NC</div><div className="mono fw-700" style={{ color: "#DC2626" }}>−{ncFmt.USD(nc.montoUSD || 0)}</div></div>
            <div><div className="text-xs muted">Saldo disponible</div><div className="mono fw-700" style={{ color: "#D97706" }}>{ncFmt.USD(nc.saldoPendienteUSD || 0)}</div></div>
          </div>
          {nc.aplicaciones?.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed " + razonM.color + "55" }}>
              <div className="text-xs fw-700" style={{ color: razonM.text, marginBottom: 4 }}>APLICACIONES PREVIAS</div>
              {nc.aplicaciones.map((a, i) => (
                <div key={i} className="hstack" style={{ justifyContent: "space-between", fontSize: 12, color: razonM.text, marginBottom: 2 }}>
                  <span><span className="mono fw-600">{a.contratoDestino}</span> · {ncFmt.FechaCorta(a.fecha)}</span>
                  <span className="mono fw-700">−{ncFmt.USD(a.montoUSD)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Destino */}
          <div>
            <label className="field-label">¿A qué contrato aplicar?</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
              {[
                { id: "mismo", label: "Mismo contrato", sub: nc.contratoOrigen },
                { id: "otro",  label: "Otro contrato",  sub: "Lo seleccionas abajo" },
              ].map(o => {
                const sel = destino === o.id;
                return (
                  <button key={o.id} onClick={() => { setDestino(o.id); setFolioDestino(o.id === "mismo" ? nc.contratoOrigen : ""); }}
                    style={{ padding: "10px 14px", borderRadius: 10, border: "2px solid " + (sel ? "var(--blue-500)" : "var(--ink-200)"), background: sel ? "#EFF6FF" : "white", textAlign: "left", cursor: "pointer", transition: "all 0.15s" }}>
                    <div className="fw-700" style={{ fontSize: 13, color: sel ? "var(--blue-500)" : "var(--ink-900)" }}>{o.label}</div>
                    <div className="text-xs muted">{o.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>
          {destino === "otro" && (
            <div>
              <label className="field-label">Contrato destino *</label>
              <select className="field-input mono" value={folioDestino} onChange={e => setFolioDestino(e.target.value)}>
                <option value="">— Selecciona —</option>
                {window.BLUFIN_DATA.contratos.map(c => (
                  <option key={c.folio} value={c.folio}>{c.folio} · {ncFmt.USD(c.totalUSD)} · {c.productos[0].marca} · {c.status}</option>
                ))}
              </select>
              {folioDestino && <div className="text-xs muted" style={{ marginTop: 4 }}>NC de <span className="mono fw-600">{nc.contratoOrigen}</span> se descuenta en <span className="mono fw-600">{folioDestino}</span></div>}
            </div>
          )}
          {/* Monto */}
          <div>
            <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <label className="field-label" style={{ margin: 0 }}>Monto a aplicar USD *</label>
              <button className="text-xs fw-600" style={{ color: "var(--blue-500)", background: "transparent", border: "none", cursor: "pointer" }}
                onClick={() => setMontoAplicar((nc.saldoPendienteUSD || 0).toFixed(2))}>
                Todo: {ncFmt.USD(nc.saldoPendienteUSD || 0)}
              </button>
            </div>
            <input type="number" step="0.01" className="field-input mono" value={montoAplicar} onChange={e => setMontoAplicar(e.target.value)}
              style={{ borderColor: excede ? "#DC2626" : undefined }} />
            {excede && <div className="text-xs" style={{ color: "#DC2626", marginTop: 4 }}>⚠ Excede el saldo disponible</div>}
          </div>
          {/* Balance preview */}
          {monto > 0 && !excede && (
            <div style={{ padding: 12, borderRadius: 10, background: saldoRestante === 0 ? "#F0FDF4" : "#FFF7ED", border: "1px solid " + (saldoRestante === 0 ? "#BBF7D0" : "#FED7AA") }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr", gap: 8, alignItems: "center" }}>
                <div><div className="text-xs muted">Saldo actual</div><div className="mono fw-700" style={{ fontSize: 15, color: "#D97706" }}>{ncFmt.USD(nc.saldoPendienteUSD || 0)}</div></div>
                <div style={{ textAlign: "center", color: "var(--ink-400)", fontSize: 16 }}>→</div>
                <div><div className="text-xs muted">Saldo restante</div><div className="mono fw-700" style={{ fontSize: 15, color: saldoRestante === 0 ? "#059669" : "#D97706" }}>
                  {saldoRestante === 0 ? "✓ NC Liquidada" : ncFmt.USD(saldoRestante)}
                </div></div>
              </div>
            </div>
          )}
          {/* Fecha + nota */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="field-label">Fecha de aplicación</label>
              <input type="date" className="field-input" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Nota (opcional)</label>
              <input className="field-input" value={nota} onChange={e => setNota(e.target.value)} placeholder="Referencia, acuerdo…" />
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--ink-200)", display: "flex", justifyContent: "space-between", background: "var(--ink-50)" }}>
          <div className="text-xs muted">Por <span className="fw-600">Ricardo Núñez</span></div>
          <div className="hstack" style={{ gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={onClose} disabled={!canApply}>
              <IconNC name="check" size={13} /> Aplicar {monto > 0 ? ncFmt.USD(monto) : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Modal: Nueva NC manual ────────────────────────────────────────────────────

const NuevaNCModal = ({ open, onClose }) => {
  const [razon, setRazon] = useStateNC("presentacion");
  const [folio, setFolio] = useStateNC("");
  const [presRecibida, setPresRecibida] = useStateNC("Granel");
  const [tengoMonto, setTengoMonto] = useStateNC(false);
  const [montoNC, setMontoNC] = useStateNC("");
  const [descDescuento, setDescDescuento] = useStateNC("");
  const [kgRecibidos, setKgRecibidos] = useStateNC("");
  const [tc, setTC] = useStateNC(window.BLUFIN_DATA.tcDelDia);
  const [fecha, setFecha] = useStateNC(HOY_NC);
  const [nota, setNota] = useStateNC("");

  useEffectNC(() => {
    if (open) {
      setRazon("presentacion"); setFolio(""); setPresRecibida("Granel");
      setTengoMonto(false); setMontoNC(""); setDescDescuento(""); setKgRecibidos("");
      setTC(window.BLUFIN_DATA.tcDelDia); setFecha(HOY_NC); setNota("");
    }
  }, [open]);

  const contrato = useMemoNC(() => window.BLUFIN_DATA.contratos.find(c => c.folio === folio), [folio]);
  const kgFacturados = contrato?.totalKg || 0;
  const precioPromedio = contrato ? (contrato.totalUSD / contrato.totalKg) : 0;
  const kgFaltantes = Math.max(0, kgFacturados - (parseFloat(kgRecibidos) || 0));
  const montoDesc = parseFloat(montoNC) || 0;
  const montoFinal = razon === "descuento" ? montoDesc : (tengoMonto ? montoDesc : 0);
  const montoMXN = montoFinal * (parseFloat(tc) || 0);
  const presPactada = contrato?.presentacion || "Paletizado";

  const canSave = folio && fecha
    && (razon !== "descuento" || descDescuento)
    && (razon !== "faltante" || kgRecibidos)
    && (razon !== "descuento" || montoDesc > 0);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,37,64,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 16, maxWidth: 760, width: "100%", maxHeight: "92vh", overflow: "auto", boxShadow: "0 24px 48px rgba(10,37,64,0.25)" }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--ink-200)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Nueva nota de crédito</h2>
            <div className="text-sm muted" style={{ marginTop: 3 }}>Emite una NC vinculada a un contrato. Puedes capturar el monto ahora o después.</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 20, color: "var(--ink-400)", cursor: "pointer" }}>✕</button>
        </div>

        {/* Razón */}
        <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--ink-100)" }}>
          <label className="field-label">Motivo</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 6 }}>
            {Object.entries(RAZON_META).map(([id, m]) => {
              const sel = razon === id;
              return (
                <button key={id} onClick={() => setRazon(id)} style={{ padding: "12px", borderRadius: 10, border: "2px solid " + (sel ? m.color : "var(--ink-200)"), background: sel ? m.bg : "white", textAlign: "left", cursor: "pointer", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: sel ? m.color : "var(--ink-100)", color: sel ? "white" : "var(--ink-500)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <IconNC name={m.icon} size={13} />
                    </div>
                    <div>
                      <div className="fw-700" style={{ fontSize: 12, color: sel ? m.text : "var(--ink-900)", marginBottom: 2 }}>{m.label}</div>
                      <div className="text-xs" style={{ color: sel ? m.text : "var(--ink-400)" }}>{m.desc}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "18px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

            {/* Contrato */}
            <div style={{ gridColumn: "span 2" }}>
              <label className="field-label">Contrato origen *</label>
              <select className="field-input mono" value={folio} onChange={e => setFolio(e.target.value)}>
                <option value="">— Selecciona —</option>
                {window.BLUFIN_DATA.contratos.map(c => (
                  <option key={c.folio} value={c.folio}>{c.folio} · {ncFmt.USD(c.totalUSD)} · {c.productos[0].marca} {c.productos[0].talla} · {c.status}</option>
                ))}
              </select>
              {contrato && (
                <div className="text-xs" style={{ marginTop: 5, padding: "7px 10px", background: "var(--ink-50)", borderRadius: 7, border: "1px solid var(--ink-200)", color: "var(--ink-700)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <span className="fw-600">{contrato.productos[0].desc} · {contrato.productos[0].marca}</span>
                  <span>Total: <span className="mono fw-600">{ncFmt.USD(contrato.totalUSD)}</span></span>
                  <span>Presentación: <span className="fw-700">{contrato.presentacion}</span></span>
                  <span className="mono">{contrato.totalKg.toLocaleString("es-MX")} kg</span>
                </div>
              )}
            </div>

            {/* PRESENTACIÓN */}
            {razon === "presentacion" && (<>
              <div>
                <label className="field-label">Presentación pactada</label>
                <input className="field-input fw-700" disabled value={presPactada} style={{ background: "var(--ink-50)", color: "var(--blue-500)" }} />
              </div>
              <div>
                <label className="field-label">Presentación recibida *</label>
                <select className="field-input fw-700" value={presRecibida} onChange={e => setPresRecibida(e.target.value)}>
                  {["Paletizado", "Granel"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2", padding: "10px 14px", borderRadius: 8, background: "#F9FAFB", border: "1px dashed var(--ink-300)" }}>
                <div className="text-xs fw-700" style={{ color: "var(--ink-500)", marginBottom: 4 }}>MONTO</div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: tengoMonto ? 10 : 0 }}>
                  <input type="checkbox" checked={tengoMonto} onChange={e => setTengoMonto(e.target.checked)} />
                  <span className="text-sm fw-600">Ya tengo el monto — el proveedor ya me lo comunicó</span>
                </label>
                {tengoMonto ? (
                  <input type="number" step="0.01" className="field-input mono" value={montoNC} onChange={e => setMontoNC(e.target.value)} placeholder="0.00" />
                ) : (
                  <div className="text-xs muted">La NC se crea en status <strong>Sin monto</strong>. Lo capturas en este módulo cuando el proveedor te lo indique.</div>
                )}
              </div>
            </>)}

            {/* DESCUENTO */}
            {razon === "descuento" && (<>
              <div style={{ gridColumn: "span 2" }}>
                <label className="field-label">Descripción del descuento *</label>
                <input className="field-input" value={descDescuento} onChange={e => setDescDescuento(e.target.value)} placeholder="Ej. Descuento por volumen mayo 2026" />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label className="field-label">Monto del descuento USD *</label>
                <input type="number" step="0.01" className="field-input mono" value={montoNC} onChange={e => setMontoNC(e.target.value)} placeholder="0.00" />
              </div>
            </>)}

            {/* FALTANTE */}
            {razon === "faltante" && (<>
              <div>
                <label className="field-label">Kg facturados</label>
                <input className="field-input mono fw-700" disabled value={contrato ? contrato.totalKg.toLocaleString("es-MX") + " kg" : "—"} style={{ background: "var(--ink-50)" }} />
              </div>
              <div>
                <label className="field-label">Kg recibidos *</label>
                <input type="number" step="1" className="field-input mono" value={kgRecibidos} onChange={e => setKgRecibidos(e.target.value)} placeholder="0" />
              </div>
              {kgRecibidos && kgFaltantes > 0 && (
                <div style={{ gridColumn: "span 2", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: 12, background: "#FEF2F2", borderRadius: 8, border: "1px solid #FECACA" }}>
                  <div style={{ textAlign: "center" }}><div className="text-xs muted">Facturado</div><div className="mono fw-700">{kgFacturados.toLocaleString("es-MX")} kg</div></div>
                  <div style={{ textAlign: "center" }}><div className="text-xs muted">Recibido</div><div className="mono fw-700" style={{ color: "#DC2626" }}>{(parseFloat(kgRecibidos)||0).toLocaleString("es-MX")} kg</div></div>
                  <div style={{ textAlign: "center" }}><div className="text-xs muted">Diferencia</div><div className="mono fw-700" style={{ color: "#DC2626" }}>−{kgFaltantes.toLocaleString("es-MX")} kg</div></div>
                </div>
              )}
              <div style={{ gridColumn: "span 2", padding: "10px 14px", borderRadius: 8, background: "#F9FAFB", border: "1px dashed var(--ink-300)" }}>
                <div className="text-xs fw-700" style={{ color: "var(--ink-500)", marginBottom: 4 }}>MONTO</div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: tengoMonto ? 10 : 0 }}>
                  <input type="checkbox" checked={tengoMonto} onChange={e => setTengoMonto(e.target.checked)} />
                  <span className="text-sm fw-600">Ya tengo el monto confirmado por el proveedor</span>
                </label>
                {tengoMonto ? (
                  <input type="number" step="0.01" className="field-input mono" value={montoNC} onChange={e => setMontoNC(e.target.value)} placeholder="0.00" />
                ) : (
                  <div className="text-xs muted">
                    Referencia estimada: <span className="mono fw-600">{kgFaltantes > 0 ? ncFmt.USD(kgFaltantes * precioPromedio) : "—"}</span>
                    {kgFaltantes > 0 && <span className="muted"> ({kgFaltantes.toLocaleString()} kg × ${precioPromedio.toFixed(4)}) — pendiente confirmar con proveedor</span>}
                  </div>
                )}
              </div>
            </>)}

            {/* TC + Fecha */}
            <div>
              <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <label className="field-label" style={{ margin: 0 }}>TC referencia</label>
                <span className="text-xs muted">día: <span className="mono fw-600">{window.BLUFIN_DATA.tcDelDia.toFixed(4)}</span></span>
              </div>
              <input type="number" step="0.0001" className="field-input mono" value={tc} onChange={e => setTC(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Fecha de emisión</label>
              <input type="date" className="field-input" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label className="field-label">Nota interna (opcional)</label>
              <textarea className="field-input" rows={2} value={nota} onChange={e => setNota(e.target.value)} placeholder="Contexto de la nota de crédito…" style={{ resize: "vertical" }} />
            </div>
          </div>

          {/* Resumen (solo si hay monto) */}
          {montoFinal > 0 && (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: "#FFF7ED", border: "1px solid #FDE68A" }}>
              <div className="text-xs fw-700" style={{ color: "var(--ink-500)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Resumen</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div><div className="text-xs muted">Monto USD</div><div className="mono fw-700" style={{ fontSize: 17, color: "#DC2626" }}>−{ncFmt.USD(montoFinal)}</div></div>
                <div><div className="text-xs muted">× TC</div><div className="mono fw-700" style={{ fontSize: 17 }}>{(parseFloat(tc)||0).toFixed(4)}</div></div>
                <div><div className="text-xs muted">= MXN</div><div className="mono fw-700" style={{ fontSize: 17, color: "var(--blue-500)" }}>−{fmtMXNnc(montoMXN)}</div></div>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--ink-200)", display: "flex", justifyContent: "space-between", background: "var(--ink-50)" }}>
          <div className="text-xs muted">Por <span className="fw-600">Ricardo Núñez</span></div>
          <div className="hstack" style={{ gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={onClose} disabled={!canSave}>
              <IconNC name="check" size={13} /> Emitir NC {!tengoMonto && razon !== "descuento" ? "(sin monto)" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Vista principal ────────────────────────────────────────────────────────────

const NotasCreditoView = () => {
  const [tab, setTab] = useStateNC("sinmonto");
  const [nuevaOpen, setNuevaOpen] = useStateNC(false);
  const [aplicarNC, setAplicarNC] = useStateNC(null);
  const [montoNC, setMontoNC] = useStateNC(null);
  const [expanded, setExpanded] = useStateNC(new Set());
  const [folioTimbrado, setFolioTimbrado] = useStateNC({ id: null, valor: "" });

  const ncs = window.BLUFIN_DATA.notasCredito;
  const sinMonto   = ncs.filter(n => n.status === "Sin monto");
  const pendientes = ncs.filter(n => n.status === "Pendiente" || n.status === "Parcial");
  const aplicadas  = ncs.filter(n => n.status === "Aplicada");

  const visibles = tab === "sinmonto" ? sinMonto : tab === "pendientes" ? pendientes : tab === "aplicadas" ? aplicadas : ncs;

  const kpis = useMemoNC(() => {
    const totalSaldo = pendientes.reduce((s, n) => s + (n.saldoPendienteUSD || 0), 0);
    const totalEmitido = ncs.reduce((s, n) => s + (n.montoUSD || 0), 0);
    return [
      { label: "Sin monto",        value: String(sinMonto.length),   sub: "Pendientes de confirmar monto", accent: sinMonto.length > 0 ? "amber" : null },
      { label: "Saldo pendiente",  value: ncFmt.USD(totalSaldo),     sub: `${pendientes.length} NCs por aplicar`, accent: totalSaldo > 0 ? "amber" : null },
      { label: "Total emitido",    value: ncFmt.USD(totalEmitido),   sub: `${ncs.length} notas de crédito` },
      { label: "Timbradas",        value: String(ncs.filter(n => n.folioTimbrado).length), sub: "Con folio del SAT recibido" },
    ];
  }, [ncs]);

  const toggleExpand = (id) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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

      <div className="card">
        {/* Tabs + acción */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="hstack" style={{ gap: 4 }}>
            {[
              { id: "sinmonto",   label: "Sin monto",   count: sinMonto.length,   accent: "gray" },
              { id: "pendientes", label: "Por aplicar", count: pendientes.length, accent: "amber" },
              { id: "aplicadas",  label: "Aplicadas",   count: aplicadas.length },
              { id: "todas",      label: "Todas",       count: ncs.length },
            ].map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 14px", borderRadius: 8, background: active ? "var(--ink-900)" : "transparent", color: active ? "white" : "var(--ink-700)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  {t.label}
                  <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: active ? "rgba(255,255,255,0.15)" : (t.accent === "amber" ? "#FEF3C7" : "var(--ink-100)"), color: active ? "white" : (t.accent === "amber" ? "#92400E" : "var(--ink-700)"), fontWeight: 700 }}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setNuevaOpen(true)}>
            <IconNC name="plus" size={13} /> Nueva NC
          </button>
        </div>

        {/* Tabla */}
        {visibles.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--ink-500)" }}>
            <IconNC name="check" size={28} />
            <div style={{ marginTop: 10, fontWeight: 600 }}>Sin notas de crédito en esta vista</div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 28 }}></th>
                <th>Folio interno</th>
                <th>Razón</th>
                <th>Contrato</th>
                <th>Detalle</th>
                <th>Emitida</th>
                <th style={{ textAlign: "right" }}>Monto NC</th>
                <th style={{ textAlign: "right" }}>Saldo</th>
                <th>Timbrado</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(nc => {
                const isExp = expanded.has(nc.id);
                const razonM = RAZON_META[nc.razon];
                const sinMonto = nc.status === "Sin monto";
                const detalle = nc.razon === "presentacion" ? `${nc.presentacionPactada} → ${nc.presentacionRecibida}` :
                                nc.razon === "descuento"    ? nc.descripcionDescuento :
                                `${nc.kgFaltantes?.toLocaleString("es-MX")} kg faltantes`;
                return (
                  <React.Fragment key={nc.id}>
                    <tr style={{ cursor: "pointer", opacity: sinMonto ? 0.85 : 1 }} onClick={() => toggleExpand(nc.id)}>
                      <td><span style={{ color: "var(--ink-400)", fontSize: 11 }}>{isExp ? "▼" : "▶"}</span></td>
                      <td>
                        <div className="mono fw-700" style={{ fontSize: 13 }}>{nc.folioInterno || nc.id}</div>
                        <div className="text-xs muted" style={{ fontFamily: "monospace" }}>{nc.id}</div>
                      </td>
                      <td><RazonPill razon={nc.razon} /></td>
                      <td className="mono text-sm fw-600">{nc.contratoOrigen}</td>
                      <td>
                        <div className="text-sm" style={{ maxWidth: 210, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detalle}</div>
                        {nc.skuOrigen && <div className="text-xs muted mono">{nc.skuOrigen}</div>}
                      </td>
                      <td className="text-sm">{ncFmt.FechaCorta(nc.fechaEmision)}</td>
                      <td style={{ textAlign: "right" }}>
                        {sinMonto
                          ? <span className="text-xs" style={{ color: "#9CA3AF", fontStyle: "italic" }}>pendiente</span>
                          : <span className="mono fw-700" style={{ color: "#DC2626" }}>−{ncFmt.USD(nc.montoUSD)}</span>
                        }
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {!sinMonto && nc.saldoPendienteUSD > 0
                          ? <span className="mono fw-700" style={{ color: "#D97706" }}>{ncFmt.USD(nc.saldoPendienteUSD)}</span>
                          : !sinMonto ? <span style={{ color: "#059669", fontSize: 13 }}>—</span>
                          : <span className="text-xs muted">—</span>
                        }
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {nc.folioTimbrado ? (
                          <div>
                            <div className="badge badge-green" style={{ fontSize: 10 }}>✓ Timbrada</div>
                            <div className="text-xs mono muted" style={{ marginTop: 2 }}>{nc.folioTimbrado}</div>
                          </div>
                        ) : (
                          <button className="text-xs" style={{ color: "var(--ink-400)", background: "transparent", border: "1px dashed var(--ink-300)", borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}
                            onClick={() => setFolioTimbrado({ id: nc.id, valor: "" })}>
                            + Folio SAT
                          </button>
                        )}
                      </td>
                      <td><NCStatusPill status={nc.status} /></td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="hstack" style={{ gap: 5, justifyContent: "flex-end" }}>
                          {sinMonto && (
                            <button className="btn btn-outline btn-sm" onClick={() => setMontoNC(nc)}>
                              <IconNC name="dollar" size={12} /> Capturar monto
                            </button>
                          )}
                          {!sinMonto && nc.status !== "Aplicada" && (
                            <button className="btn btn-primary btn-sm" onClick={() => setAplicarNC(nc)}>
                              <IconNC name="check" size={12} /> Aplicar
                            </button>
                          )}
                          {nc.status === "Aplicada" && <span className="text-xs muted">✓ Cerrada</span>}
                        </div>
                      </td>
                    </tr>

                    {/* Detalle expandible */}
                    {isExp && (
                      <tr>
                        <td colSpan={11} style={{ padding: 0, background: "var(--ink-50)" }}>
                          <div style={{ padding: "14px 24px", borderTop: "1px solid var(--ink-100)", borderBottom: "1px solid var(--ink-100)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: nc.aplicaciones?.length > 0 ? "1fr 1fr" : "1fr", gap: 24 }}>
                              <div>
                                <div className="text-xs fw-700" style={{ color: "var(--ink-500)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Detalle</div>
                                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 5, columnGap: 14, fontSize: 13 }}>
                                  <span className="muted">Razón:</span><span className="fw-600">{razonM.label}</span>
                                  {nc.razon === "presentacion" && (<><span className="muted">Pactado:</span><span className="fw-600">{nc.presentacionPactada}</span><span className="muted">Recibido:</span><span className="fw-700" style={{ color: "#DC2626" }}>{nc.presentacionRecibida}</span></>)}
                                  {nc.razon === "descuento"    && (<><span className="muted">Descripción:</span><span>{nc.descripcionDescuento}</span></>)}
                                  {nc.razon === "faltante"     && (<><span className="muted">Kg faltantes:</span><span className="mono fw-600" style={{ color: "#DC2626" }}>{nc.kgFaltantes?.toLocaleString("es-MX")} kg</span></>)}
                                  {nc.recepcionOrigen && (<><span className="muted">Recepción:</span><span className="mono fw-600">{nc.recepcionOrigen}</span></>)}
                                  {nc.skuOrigen && (<><span className="muted">SKU:</span><span className="mono">{nc.skuOrigen}</span></>)}
                                  {nc.montoUSD && (<><span className="muted">Monto MXN:</span><span className="mono fw-600">{fmtMXNnc(nc.montoMXN)}</span></>)}
                                  {nc.nota && (<><span className="muted" style={{ alignSelf: "flex-start" }}>Nota:</span><span style={{ fontStyle: "italic" }}>{nc.nota}</span></>)}
                                </div>
                              </div>
                              {nc.aplicaciones?.length > 0 && (
                                <div>
                                  <div className="text-xs fw-700" style={{ color: "var(--ink-500)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Aplicaciones</div>
                                  {nc.aplicaciones.map((a, i) => (
                                    <div key={i} style={{ padding: "8px 12px", borderRadius: 7, border: "1px solid var(--ink-200)", background: "white", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <div>
                                        <div className="hstack" style={{ gap: 6 }}>
                                          <span className="mono fw-600 text-sm">{a.contratoDestino}</span>
                                          <span className={"badge " + (a.contratoDestino === nc.contratoOrigen ? "badge-gray" : "badge-blue")} style={{ fontSize: 10 }}>
                                            {a.contratoDestino === nc.contratoOrigen ? "mismo" : "otro"}
                                          </span>
                                        </div>
                                        {a.nota && <div className="text-xs muted">{a.nota}</div>}
                                      </div>
                                      <div style={{ textAlign: "right" }}>
                                        <div className="mono fw-700" style={{ color: "#059669" }}>−{ncFmt.USD(a.montoUSD)}</div>
                                        <div className="text-xs muted">{ncFmt.FechaCorta(a.fecha)}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal folio timbrado inline */}
      {folioTimbrado.id && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,37,64,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setFolioTimbrado({ id: null, valor: "" })}>
          <div style={{ background: "white", borderRadius: 12, padding: "20px 24px", maxWidth: 400, width: "100%", boxShadow: "0 16px 40px rgba(10,37,64,0.2)" }} onClick={e => e.stopPropagation()}>
            <div className="fw-700" style={{ marginBottom: 12 }}>Agregar folio timbrado (SAT)</div>
            <label className="field-label">Folio de la NC del proveedor (CFDI)</label>
            <input className="field-input mono" value={folioTimbrado.valor} onChange={e => setFolioTimbrado(prev => ({ ...prev, valor: e.target.value }))} placeholder="Ej. FBTF-A-0134-2026-00456" autoFocus />
            <div className="hstack" style={{ gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setFolioTimbrado({ id: null, valor: "" })}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={() => setFolioTimbrado({ id: null, valor: "" })} disabled={!folioTimbrado.valor}>
                <IconNC name="check" size={13} /> Guardar folio
              </button>
            </div>
          </div>
        </div>
      )}

      <NuevaNCModal open={nuevaOpen} onClose={() => setNuevaOpen(false)} />
      <CapturarMontoModal open={!!montoNC} onClose={() => setMontoNC(null)} nc={montoNC} />
      <AplicarNCModal open={!!aplicarNC} onClose={() => setAplicarNC(null)} nc={aplicarNC} />
    </>
  );
};

Object.assign(window, { NotasCreditoView });
