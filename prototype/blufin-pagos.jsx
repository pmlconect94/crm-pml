// ============================================
// Blufin Seafood — Módulo de Pagos
// 3 tipos: Anticipo (10%), Saldo, Forward (cierre futuro)
// Bancos: SANTANDER, MONEX
// ============================================

const { useState: useStateP, useMemo: useMemoP, useEffect: useEffectP } = React;
const { Icon: IconP } = window;
const $fmt = {
  USD: window.fmtUSD,
  Fecha: window.fmtFecha,
  FechaCorta: window.fmtFechaCorta,
  diasDesde: window.diasDesde,
};

const fmtMXN = (n) => "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const HOY = "2026-05-19";

// ============================================
// Helpers
// ============================================
const findContrato = (folio) => window.BLUFIN_DATA.contratos.find(c => c.folio === folio);

const tipoMeta = {
  anticipo: { label: "Anticipo", color: "var(--blue-500)", bg: "#E6F4FF", text: "#1E40AF", icon: "dollar" },
  saldo:    { label: "Saldo",    color: "#8B5CF6",        bg: "#EDE9FE", text: "#5B21B6", icon: "check" },
  forward:  { label: "Forward",  color: "var(--amber-500)", bg: "#FEF3C7", text: "#92400E", icon: "clock" },
};
const bancoMeta = {
  MONEX:     { label: "Monex",     color: "#0F766E", bg: "#CCFBF1" },
  SANTANDER: { label: "Santander", color: "#991B1B", bg: "#FEE2E2" },
};

const TipoPill = ({ tipo }) => {
  const m = tipoMeta[tipo];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 9px", borderRadius: 999,
      background: m.bg, color: m.text,
      fontSize: 11, fontWeight: 600,
    }}>
      <IconP name={m.icon} size={10} /> {m.label}
    </span>
  );
};

const BancoPill = ({ banco }) => {
  const m = bancoMeta[banco];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 6,
      background: m.bg, color: m.color,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
    }}>{m.label.toUpperCase()}</span>
  );
};

// ============================================
// REGISTRAR PAGO — Modal
// ============================================
const RegistrarPagoModal = ({ open, onClose, contratoFolio, defaultTipo, defaultIsForward }) => {
  const [tipo, setTipo] = useStateP(defaultTipo || "anticipo");
  const [esForward, setEsForward] = useStateP(defaultIsForward || false);
  const [folio, setFolio] = useStateP(contratoFolio || "");
  const [montoUSD, setMontoUSD] = useStateP("");
  const [tc, setTC] = useStateP(window.BLUFIN_DATA.tcDelDia);
  const [fecha, setFecha] = useStateP(HOY);
  const [fechaEntrega, setFechaEntrega] = useStateP("");
  const [banco, setBanco] = useStateP("MONEX");
  const [referencia, setReferencia] = useStateP("");
  const [nota, setNota] = useStateP("");

  // Reset when opened
  useEffectP(() => {
    if (open) {
      setTipo(defaultTipo || "anticipo");
      setEsForward(defaultIsForward || false);
      setFolio(contratoFolio || "");
      setReferencia("");
      setNota("");
    }
  }, [open, contratoFolio, defaultTipo, defaultIsForward]);

  // Sugerir monto basado en contrato + tipo
  const contrato = useMemoP(() => findContrato(folio), [folio]);
  useEffectP(() => {
    if (contrato) {
      if (tipo === "anticipo") setMontoUSD(contrato.anticipoUSD.toFixed(2));
      else if (tipo === "saldo") setMontoUSD((contrato.totalUSD - contrato.anticipoUSD).toFixed(2));
    }
  }, [folio, tipo]);

  const montoMXN = (parseFloat(montoUSD) || 0) * (parseFloat(tc) || 0);

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(10,37,64,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: "white", borderRadius: 16, maxWidth: 720, width: "100%",
        maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 24px 48px rgba(10,37,64,0.25)",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--ink-200)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {esForward ? "Cerrar dólares (Forward)" : "Registrar pago"}
            </h2>
            <div className="text-sm muted" style={{ marginTop: 4 }}>
              {esForward
                ? "Cierre de dólares en banco para una fecha futura — se asocia a un contrato"
                : "Captura un pago de anticipo o saldo realizado en banco"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 20, color: "var(--ink-400)", cursor: "pointer" }}>✕</button>
        </div>

        {/* Tipo selector (segmented) */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--ink-100)" }}>
          <label className="field-label">¿Qué tipo de movimiento?</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 6 }}>
            {[
              { id: "anticipo", isFwd: false, label: "Anticipo", desc: "10% del contrato", icon: "dollar", color: "var(--blue-500)" },
              { id: "saldo", isFwd: false, label: "Saldo", desc: "90% restante", icon: "check", color: "#8B5CF6" },
              { id: "forward", isFwd: true, label: "Forward", desc: "Cierre futuro", icon: "clock", color: "var(--amber-500)" },
            ].map(t => {
              const isSelected = t.id === "forward" ? esForward : (!esForward && tipo === t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    if (t.id === "forward") { setEsForward(true); setTipo("saldo"); }
                    else { setEsForward(false); setTipo(t.id); }
                  }}
                  style={{
                    padding: "12px 14px", borderRadius: 10,
                    border: "2px solid " + (isSelected ? t.color : "var(--ink-200)"),
                    background: isSelected ? t.color + "11" : "white",
                    textAlign: "left", cursor: "pointer",
                    display: "flex", gap: 10, alignItems: "flex-start",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: isSelected ? t.color : "var(--ink-100)",
                    color: isSelected ? "white" : "var(--ink-500)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <IconP name={t.icon} size={14} />
                  </div>
                  <div>
                    <div className="fw-700" style={{ fontSize: 13 }}>{t.label}</div>
                    <div className="text-xs muted">{t.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Forward asociado a tipo */}
        {esForward && (
          <div style={{ padding: "12px 24px", background: "#FFFBEB", borderBottom: "1px solid #FDE68A" }}>
            <div className="text-xs fw-700" style={{ color: "#92400E", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              ¿Para qué pago se cierra este forward?
            </div>
            <div className="hstack" style={{ gap: 6 }}>
              {[
                { v: "anticipo", label: "Anticipo" },
                { v: "saldo", label: "Saldo" },
              ].map(o => (
                <button key={o.v} onClick={() => setTipo(o.v)} style={{
                  padding: "6px 12px", borderRadius: 999,
                  border: "1px solid " + (tipo === o.v ? "#92400E" : "#FDE68A"),
                  background: tipo === o.v ? "#92400E" : "white",
                  color: tipo === o.v ? "white" : "#92400E",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Contrato */}
            <div style={{ gridColumn: "span 2" }}>
              <label className="field-label">Contrato asociado *</label>
              <select className="field-input mono" value={folio} onChange={e => setFolio(e.target.value)}>
                <option value="">— Selecciona un contrato —</option>
                {window.BLUFIN_DATA.contratos
                  .filter(c => {
                    if (esForward) {
                      // Forward: contratos con saldo o anticipo aún por pagar
                      return tipo === "anticipo" ? !c.anticipoPagado : !c.saldoPagado;
                    }
                    return tipo === "anticipo" ? !c.anticipoPagado : !c.saldoPagado;
                  })
                  .map(c => (
                    <option key={c.folio} value={c.folio}>
                      {c.folio} · {$fmt.USD(c.totalUSD)} · {c.productos[0].marca} {c.productos[0].talla}
                    </option>
                  ))}
              </select>
              {contrato && (
                <div className="text-xs muted" style={{ marginTop: 6, padding: 10, background: "var(--ink-50)", borderRadius: 8, border: "1px solid var(--ink-200)" }}>
                  <span className="fw-600">{contrato.productos[0].desc} · {contrato.productos[0].marca}</span><br />
                  Total contrato: <span className="mono fw-600">{$fmt.USD(contrato.totalUSD)}</span> ·
                  Anticipo: <span className="mono">{$fmt.USD(contrato.anticipoUSD)}</span> {contrato.anticipoPagado && "✓"} ·
                  Saldo: <span className="mono">{$fmt.USD(contrato.totalUSD - contrato.anticipoUSD)}</span> {contrato.saldoPagado && "✓"}
                </div>
              )}
            </div>

            {/* Monto USD */}
            <div>
              <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <label className="field-label" style={{ margin: 0 }}>Monto USD *</label>
                {contrato && tipo === "anticipo" && (
                  <span className="text-xs" style={{ color: "var(--blue-500)", fontWeight: 600 }}>Sugerido 10%: {$fmt.USD(contrato.anticipoUSD)}</span>
                )}
                {contrato && tipo === "saldo" && (
                  <span className="text-xs" style={{ color: "var(--blue-500)", fontWeight: 600 }}>Saldo del contrato: {$fmt.USD(contrato.totalUSD - contrato.anticipoUSD)}</span>
                )}
              </div>
              <input type="number" step="0.01" className="field-input mono" value={montoUSD} onChange={e => setMontoUSD(e.target.value)} placeholder="0.00" />
            </div>

            {/* TC */}
            <div>
              <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <label className="field-label" style={{ margin: 0 }}>
                  {esForward ? "TC Forward pactado *" : "Tipo de cambio capturado *"}
                </label>
                <span className="text-xs muted">TC del día: <span className="mono fw-600">{window.BLUFIN_DATA.tcDelDia.toFixed(4)}</span></span>
              </div>
              <input type="number" step="0.0001" className="field-input mono" value={tc} onChange={e => setTC(e.target.value)} />
              {!esForward && Math.abs(parseFloat(tc) - window.BLUFIN_DATA.tcDelDia) > 0.5 && (
                <div className="text-xs" style={{ color: "var(--amber-500)", marginTop: 4 }}>
                  ⚠ TC muy distinto al del día — verifica que sea correcto
                </div>
              )}
            </div>

            {/* Fechas */}
            <div>
              <label className="field-label">
                {esForward ? "Fecha de cierre *" : "Fecha del pago *"}
              </label>
              <input type="date" className="field-input" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            {esForward && (
              <div>
                <label className="field-label">Fecha de entrega *</label>
                <input type="date" className="field-input" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} />
                {fechaEntrega && (
                  <div className="text-xs muted" style={{ marginTop: 4 }}>
                    En {$fmt.diasDesde(fechaEntrega)} días
                  </div>
                )}
              </div>
            )}

            {/* Banco */}
            <div style={{ gridColumn: esForward ? undefined : "span 2" }}>
              <label className="field-label">Banco *</label>
              <div className="hstack" style={{ gap: 8 }}>
                {window.BLUFIN_DATA.bancos.map(b => {
                  const m = bancoMeta[b];
                  const sel = banco === b;
                  return (
                    <button key={b} onClick={() => setBanco(b)} style={{
                      flex: 1, padding: "10px 14px", borderRadius: 10,
                      border: "2px solid " + (sel ? m.color : "var(--ink-200)"),
                      background: sel ? m.bg : "white",
                      cursor: "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 999,
                        background: sel ? m.color : "var(--ink-200)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "white", fontSize: 10, fontWeight: 700,
                      }}>{b[0]}</div>
                      <div>
                        <div className="fw-700" style={{ fontSize: 13 }}>{m.label}</div>
                        <div className="text-xs muted">Cuenta USD</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Referencia */}
            <div style={{ gridColumn: "span 2" }}>
              <label className="field-label">Referencia bancaria (opcional)</label>
              <input className="field-input mono" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="TRF-XXXXX" />
            </div>

            {/* Nota */}
            <div style={{ gridColumn: "span 2" }}>
              <label className="field-label">Nota (opcional)</label>
              <textarea className="field-input" rows={2} value={nota} onChange={e => setNota(e.target.value)} placeholder="Comentarios internos…" style={{ resize: "vertical" }} />
            </div>
          </div>

          {/* Resumen */}
          <div style={{
            marginTop: 20, padding: 16, borderRadius: 12,
            background: "linear-gradient(135deg, #F3F9FF 0%, #E6F4FF 100%)",
            border: "1px solid #BAE0FF",
          }}>
            <div className="text-xs fw-700" style={{ color: "var(--ink-500)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Resumen del movimiento</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <div className="text-xs muted">USD</div>
                <div className="mono fw-700" style={{ fontSize: 18 }}>{$fmt.USD(parseFloat(montoUSD) || 0)}</div>
              </div>
              <div>
                <div className="text-xs muted">× TC {esForward ? "forward" : "día"}</div>
                <div className="mono fw-700" style={{ fontSize: 18 }}>{(parseFloat(tc) || 0).toFixed(4)}</div>
              </div>
              <div>
                <div className="text-xs muted">= MXN total</div>
                <div className="mono fw-700" style={{ fontSize: 18, color: "var(--blue-500)" }}>{fmtMXN(montoMXN)}</div>
              </div>
            </div>
            {esForward && fechaEntrega && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #BAE0FF", fontSize: 12, color: "var(--ink-700)" }}>
                <IconP name="clock" size={12} /> El {$fmt.Fecha(fechaEntrega)} se ejecutará este forward y entrarán <span className="mono fw-700">{fmtMXN(montoMXN)}</span> al saldo del contrato <span className="mono fw-700">{folio}</span>.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--ink-200)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--ink-50)" }}>
          <div className="text-xs muted">
            Quedará registrado por <span className="fw-600">Ricardo Núñez</span> · {$fmt.Fecha(HOY)}
          </div>
          <div className="hstack" style={{ gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={onClose} disabled={!folio || !montoUSD}>
              <IconP name="check" size={13} />
              {esForward ? "Cerrar forward" : `Registrar ${tipoMeta[tipo].label.toLowerCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// PAGOS VIEW — sub-tab principal
// ============================================
const PagosView = () => {
  const [tab, setTab] = useStateP("pendientes"); // pendientes | realizados | forwards
  const [modalOpen, setModalOpen] = useStateP(false);
  const [modalFolio, setModalFolio] = useStateP("");
  const [modalTipo, setModalTipo] = useStateP("anticipo");
  const [modalIsForward, setModalIsForward] = useStateP(false);
  const [multipleOpen, setMultipleOpen] = useStateP(false);

  const pagos = window.BLUFIN_DATA.pagos;
  const forwards = window.BLUFIN_DATA.forwards;
  const contratos = window.BLUFIN_DATA.contratos;

  // Calcular pendientes
  const pendientes = useMemoP(() => {
    const items = [];
    contratos.forEach(c => {
      if (!c.anticipoPagado) {
        items.push({
          contrato: c.folio,
          tipo: "anticipo",
          montoUSD: c.anticipoUSD,
          fecha: c.anticipoFecha,
          producto: c.productos[0].desc.substring(0, 30),
          marca: c.productos[0].marca,
        });
      }
      if (!c.saldoPagado) {
        // ¿Tiene forward pendiente que lo cubra?
        const fwd = forwards.find(f => f.contrato === c.folio && f.asociadoA === "saldo" && f.status === "Pendiente");
        items.push({
          contrato: c.folio,
          tipo: "saldo",
          montoUSD: c.totalUSD - c.anticipoUSD,
          fecha: c.saldoFecha,
          producto: c.productos[0].desc.substring(0, 30),
          marca: c.productos[0].marca,
          coveredByForward: fwd,
        });
      }
    });
    return items.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, []);

  // KPIs
  const kpis = useMemoP(() => {
    const totalPendUSD = pendientes.reduce((s, p) => s + p.montoUSD, 0);
    const totalPagadoMesUSD = pagos.filter(p => p.fecha.startsWith("2026-05")).reduce((s, p) => s + p.montoUSD, 0);
    const forwardsActivos = forwards.filter(f => f.status === "Pendiente");
    const totalForwardsUSD = forwardsActivos.reduce((s, f) => s + f.montoUSD, 0);
    const totalForwardsMXN = forwardsActivos.reduce((s, f) => s + f.montoMXN, 0);
    return [
      { label: "Pendientes de pago", value: $fmt.USD(totalPendUSD), sub: `${pendientes.length} movimientos` },
      { label: "Pagado este mes", value: $fmt.USD(totalPagadoMesUSD), sub: `${pagos.filter(p => p.fecha.startsWith("2026-05")).length} pagos en mayo` },
      { label: "Forwards activos", value: $fmt.USD(totalForwardsUSD), sub: `${forwardsActivos.length} cierres · ${fmtMXN(totalForwardsMXN)} MXN`, accent: "amber" },
      { label: "TC del día", value: window.BLUFIN_DATA.tcDelDia.toFixed(4), sub: "ExchangeRate-API · ref" },
    ];
  }, []);

  const openModal = (tipo, folio = "", isFwd = false) => {
    setModalTipo(tipo);
    setModalFolio(folio);
    setModalIsForward(isFwd);
    setModalOpen(true);
  };

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} className="kpi" style={{ background: k.accent === "amber" ? "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)" : undefined, borderColor: k.accent === "amber" ? "#FDE68A" : undefined }}>
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-value">{k.value}</span>
            <span className="text-xs muted" style={{ marginTop: 2 }}>{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Action bar + tabs */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="hstack" style={{ gap: 4 }}>
            {[
              { id: "pendientes", label: "Por pagar", count: pendientes.length, accent: "amber" },
              { id: "realizados", label: "Pagos realizados", count: pagos.length },
              { id: "forwards", label: "Forwards", count: forwards.filter(f => f.status === "Pendiente").length, accent: "amber" },
            ].map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: "8px 14px", borderRadius: 8,
                    background: active ? "var(--ink-900)" : "transparent",
                    color: active ? "white" : "var(--ink-700)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  {t.label}
                  <span style={{
                    fontSize: 10, padding: "1px 7px", borderRadius: 999,
                    background: active ? "rgba(255,255,255,0.15)" : (t.accent === "amber" ? "#FEF3C7" : "var(--ink-100)"),
                    color: active ? "white" : (t.accent === "amber" ? "#92400E" : "var(--ink-700)"),
                    fontWeight: 700,
                  }}>{t.count}</span>
                </button>
              );
            })}
          </div>
          <div className="hstack" style={{ gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => openModal("saldo", "", true)}>
              <IconP name="clock" size={13} /> Cerrar dólares (Forward)
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setMultipleOpen(true)}>
              <IconP name="check" size={13} /> Pago múltiple
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => openModal("anticipo")}>
              <IconP name="plus" size={13} /> Registrar pago
            </button>
          </div>
        </div>

        {/* PENDIENTES */}
        {tab === "pendientes" && (
          <PendientesTable pendientes={pendientes} onPay={(p) => openModal(p.tipo, p.contrato)} onForward={(p) => openModal(p.tipo, p.contrato, true)} />
        )}
        {/* REALIZADOS */}
        {tab === "realizados" && (
          <RealizadosTable pagos={pagos} />
        )}
        {/* FORWARDS */}
        {tab === "forwards" && (
          <ForwardsTable forwards={forwards} onNew={() => openModal("saldo", "", true)} />
        )}
      </div>

      <RegistrarPagoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        contratoFolio={modalFolio}
        defaultTipo={modalTipo}
        defaultIsForward={modalIsForward}
      />
      <PagoMultipleModal
        open={multipleOpen}
        onClose={() => setMultipleOpen(false)}
      />
    </>
  );
};

// ============================================
// PENDIENTES TABLE (con calendario)
// ============================================
const PendientesTable = ({ pendientes, onPay, onForward }) => {
  // Agrupar por semana / día
  const grouped = useMemoP(() => {
    const g = {};
    pendientes.forEach(p => {
      const d = new Date(p.fecha + "T12:00:00");
      const wk = Math.ceil(d.getDate() / 7);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-w${wk}`;
      const label = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" }) + " · Semana " + wk;
      if (!g[key]) g[key] = { label, items: [] };
      g[key].items.push(p);
    });
    return Object.entries(g);
  }, [pendientes]);

  return (
    <div>
      {grouped.map(([key, { label, items }]) => {
        const totalUSD = items.reduce((s, i) => s + i.montoUSD, 0);
        return (
          <div key={key}>
            <div style={{
              padding: "10px 20px", background: "var(--ink-50)",
              fontSize: 11, fontWeight: 700, color: "var(--ink-500)",
              letterSpacing: "0.06em", textTransform: "uppercase",
              display: "flex", justifyContent: "space-between",
              borderBottom: "1px solid var(--ink-100)", borderTop: "1px solid var(--ink-100)",
            }}>
              <span>{label}</span>
              <span className="mono">{items.length} pagos · {$fmt.USD(totalUSD)}</span>
            </div>
            {items.map((p, i) => {
              const dias = $fmt.diasDesde(p.fecha);
              const urgente = dias <= 3;
              const vencido = dias < 0;
              return (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 140px 140px 100px 200px",
                  gap: 16, alignItems: "center",
                  padding: "14px 20px", borderBottom: "1px solid var(--ink-100)",
                }}>
                  {/* Calendar chip */}
                  <div style={{
                    width: 52, padding: "6px 8px", borderRadius: 8,
                    background: vencido ? "#FEE2E2" : urgente ? "#FEF3C7" : "var(--ink-50)",
                    border: "1px solid " + (vencido ? "#FCA5A5" : urgente ? "#FDE68A" : "var(--ink-200)"),
                    textAlign: "center",
                  }}>
                    <div className="text-xs fw-700" style={{ color: vencido ? "#991B1B" : urgente ? "#92400E" : "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {new Date(p.fecha + "T12:00:00").toLocaleDateString("es-MX", { month: "short" })}
                    </div>
                    <div className="fw-800" style={{ fontSize: 20, color: vencido ? "#991B1B" : urgente ? "#92400E" : "var(--ink-900)", lineHeight: 1 }}>
                      {new Date(p.fecha + "T12:00:00").getDate()}
                    </div>
                  </div>

                  <div>
                    <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
                      <TipoPill tipo={p.tipo} />
                      <span className="mono fw-600 text-sm">{p.contrato}</span>
                      {vencido && <span className="badge badge-red">⚠ Vencido hace {-dias}d</span>}
                      {!vencido && urgente && <span className="badge badge-amber">⏰ En {dias}d</span>}
                      {p.coveredByForward && <span className="badge badge-blue">🔒 Forward {p.coveredByForward.id} cierra el {$fmt.FechaCorta(p.coveredByForward.fechaEntrega)}</span>}
                    </div>
                    <div className="text-sm fw-600">{p.producto}</div>
                    <div className="text-xs muted">{p.marca}</div>
                  </div>

                  <div>
                    <div className="text-xs muted" style={{ marginBottom: 2 }}>Monto USD</div>
                    <div className="mono fw-700">{$fmt.USD(p.montoUSD)}</div>
                  </div>

                  <div>
                    <div className="text-xs muted" style={{ marginBottom: 2 }}>MXN al TC día</div>
                    <div className="mono fw-700" style={{ color: "var(--ink-500)" }}>{fmtMXN(p.montoUSD * window.BLUFIN_DATA.tcDelDia)}</div>
                    <div className="text-xs muted">est. al {window.BLUFIN_DATA.tcDelDia.toFixed(4)}</div>
                  </div>

                  <div>
                    {p.coveredByForward ? (
                      <span className="badge badge-blue">🔒 Cubierto</span>
                    ) : (
                      <span className="badge badge-amber">Pendiente</span>
                    )}
                  </div>

                  <div className="hstack" style={{ gap: 6, justifyContent: "flex-end" }}>
                    {!p.coveredByForward && (
                      <button className="btn btn-outline btn-sm" onClick={() => onForward(p)} title="Cerrar dólares forward">
                        <IconP name="clock" size={12} /> Forward
                      </button>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => onPay(p)}>
                      <IconP name="check" size={12} /> Pagar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {pendientes.length === 0 && (
        <div style={{ padding: 60, textAlign: "center", color: "var(--ink-500)" }}>
          <IconP name="check" size={32} />
          <div style={{ marginTop: 12, fontWeight: 600 }}>Sin pagos pendientes</div>
          <div className="text-sm">Todos los contratos están al día.</div>
        </div>
      )}
    </div>
  );
};

// ============================================
// REALIZADOS TABLE
// ============================================
const RealizadosTable = ({ pagos }) => {
  const sorted = [...pagos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Folio pago</th>
          <th>Contrato</th>
          <th>Tipo</th>
          <th style={{ textAlign: "right" }}>USD</th>
          <th style={{ textAlign: "right" }}>TC</th>
          <th style={{ textAlign: "right" }}>MXN</th>
          <th>Banco</th>
          <th>Referencia</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(p => (
          <tr key={p.id}>
            <td>
              <div className="fw-600">{$fmt.FechaCorta(p.fecha)}</div>
              <div className="text-xs muted">{new Date(p.fecha + "T12:00:00").getFullYear()}</div>
            </td>
            <td className="mono text-sm fw-600">{p.id}</td>
            <td className="mono text-sm">{p.contrato}</td>
            <td><TipoPill tipo={p.tipo} /></td>
            <td style={{ textAlign: "right" }} className="mono fw-600">{$fmt.USD(p.montoUSD)}</td>
            <td style={{ textAlign: "right" }} className="mono">{p.tc.toFixed(4)}</td>
            <td style={{ textAlign: "right", color: "var(--blue-500)" }} className="mono fw-600">{fmtMXN(p.montoMXN)}</td>
            <td><BancoPill banco={p.banco} /></td>
            <td className="mono text-xs muted">{p.referencia}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ============================================
// FORWARDS TABLE
// ============================================
const ForwardsTable = ({ forwards, onNew }) => {
  const sorted = [...forwards].sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega));
  return (
    <div>
      {/* Hero card: forward más próximo */}
      {forwards.filter(f => f.status === "Pendiente").length > 0 && (() => {
        const proximo = sorted.find(f => f.status === "Pendiente");
        if (!proximo) return null;
        const dias = $fmt.diasDesde(proximo.fechaEntrega);
        return (
          <div style={{
            margin: 16, padding: 20, borderRadius: 14,
            background: "linear-gradient(135deg, #0A2540 0%, #143C66 100%)",
            color: "white", display: "flex", alignItems: "center", gap: 20,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 14,
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            }}>
              <div className="text-xs fw-700" style={{ letterSpacing: "0.06em", opacity: 0.7, textTransform: "uppercase" }}>
                {new Date(proximo.fechaEntrega + "T12:00:00").toLocaleDateString("es-MX", { month: "short" })}
              </div>
              <div className="fw-800" style={{ fontSize: 26, lineHeight: 1 }}>
                {new Date(proximo.fechaEntrega + "T12:00:00").getDate()}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
                <span className="text-xs fw-700" style={{ background: "var(--amber-500)", color: "#451A03", padding: "2px 8px", borderRadius: 999, letterSpacing: "0.04em" }}>
                  PRÓXIMO FORWARD
                </span>
                <span className="text-xs" style={{ opacity: 0.7 }}>se ejecuta en {dias} días</span>
              </div>
              <div className="fw-700" style={{ fontSize: 18 }}>
                {$fmt.USD(proximo.montoUSD)} @ <span className="mono">{proximo.tcForward.toFixed(4)}</span> = {fmtMXN(proximo.montoMXN)} MXN
              </div>
              <div className="text-sm" style={{ opacity: 0.7, marginTop: 2 }}>
                {proximo.id} · Cubre saldo de <span className="mono">{proximo.contrato}</span> · {bancoMeta[proximo.banco].label}
              </div>
            </div>
            <button className="btn btn-accent btn-sm" onClick={onNew} style={{ background: "white", color: "var(--ink-900)" }}>
              <IconP name="plus" size={13} /> Nuevo forward
            </button>
          </div>
        );
      })()}

      <table className="tbl">
        <thead>
          <tr>
            <th>Folio forward</th>
            <th>Contrato</th>
            <th>Cubre</th>
            <th style={{ textAlign: "right" }}>USD</th>
            <th style={{ textAlign: "right" }}>TC pactado</th>
            <th style={{ textAlign: "right" }}>MXN</th>
            <th>Cerrado</th>
            <th>Se ejecuta</th>
            <th>Banco</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(f => {
            const dias = $fmt.diasDesde(f.fechaEntrega);
            return (
              <tr key={f.id}>
                <td className="mono text-sm fw-600">{f.id}</td>
                <td className="mono text-sm">{f.contrato}</td>
                <td><TipoPill tipo={f.asociadoA} /></td>
                <td style={{ textAlign: "right" }} className="mono fw-600">{$fmt.USD(f.montoUSD)}</td>
                <td style={{ textAlign: "right", color: "var(--amber-500)" }} className="mono fw-700">{f.tcForward.toFixed(4)}</td>
                <td style={{ textAlign: "right", color: "var(--blue-500)" }} className="mono fw-600">{fmtMXN(f.montoMXN)}</td>
                <td>
                  <div className="text-sm">{$fmt.FechaCorta(f.fechaCierre)}</div>
                </td>
                <td>
                  <div className="fw-600 text-sm">{$fmt.FechaCorta(f.fechaEntrega)}</div>
                  {f.status === "Pendiente" && (
                    <div className="text-xs" style={{ color: dias <= 3 ? "var(--amber-500)" : "var(--ink-500)", fontWeight: 600 }}>
                      {dias < 0 ? `vencido hace ${-dias}d` : dias === 0 ? "hoy" : `en ${dias} días`}
                    </div>
                  )}
                </td>
                <td><BancoPill banco={f.banco} /></td>
                <td>
                  {f.status === "Pendiente" ? (
                    <span className="badge badge-amber">⏰ Pendiente</span>
                  ) : (
                    <span className="badge badge-green">✓ Ejecutado</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ============================================
// PAGO MÚLTIPLE — Modal
// Permite registrar varios pagos a la vez (p.ej. 4 saldos o 5 anticipos)
// con un solo TC, banco y fecha aplicados a todos.
// ============================================
const PagoMultipleModal = ({ open, onClose }) => {
  const [filtroTipo, setFiltroTipo] = useStateP("anticipo"); // anticipo | saldo | todos
  const [seleccion, setSeleccion] = useStateP(() => new Set()); // claves "folio|tipo"
  const [overrides, setOverrides] = useStateP({}); // { "folio|tipo": montoUSD }
  const [tc, setTC] = useStateP(window.BLUFIN_DATA.tcDelDia);
  const [fecha, setFecha] = useStateP(HOY);
  const [banco, setBanco] = useStateP("MONEX");
  const [referencia, setReferencia] = useStateP("");
  const [nota, setNota] = useStateP("");

  // Reset state when modal opens
  useEffectP(() => {
    if (open) {
      setFiltroTipo("anticipo");
      setSeleccion(new Set());
      setOverrides({});
      setTC(window.BLUFIN_DATA.tcDelDia);
      setFecha(HOY);
      setBanco("MONEX");
      setReferencia("");
      setNota("");
    }
  }, [open]);

  // Construir lista de pendientes globales
  const pendientes = useMemoP(() => {
    const items = [];
    window.BLUFIN_DATA.contratos.forEach(c => {
      if (!c.anticipoPagado) {
        items.push({
          key: c.folio + "|anticipo",
          contrato: c.folio,
          tipo: "anticipo",
          montoUSD: c.anticipoUSD,
          fecha: c.anticipoFecha,
          producto: c.productos[0].desc,
          marca: c.productos[0].marca,
          talla: c.productos[0].talla,
          totalContrato: c.totalUSD,
        });
      }
      if (!c.saldoPagado) {
        const fwd = window.BLUFIN_DATA.forwards.find(
          f => f.contrato === c.folio && f.asociadoA === "saldo" && f.status === "Pendiente"
        );
        items.push({
          key: c.folio + "|saldo",
          contrato: c.folio,
          tipo: "saldo",
          montoUSD: c.totalUSD - c.anticipoUSD,
          fecha: c.saldoFecha,
          producto: c.productos[0].desc,
          marca: c.productos[0].marca,
          talla: c.productos[0].talla,
          totalContrato: c.totalUSD,
          coveredByForward: fwd,
        });
      }
    });
    return items.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [open]);

  const visibles = useMemoP(() => {
    if (filtroTipo === "todos") return pendientes;
    return pendientes.filter(p => p.tipo === filtroTipo);
  }, [pendientes, filtroTipo]);

  const toggleOne = (key) => {
    setSeleccion(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const allVisibleSelected = visibles.length > 0 && visibles.every(v => seleccion.has(v.key));
  const someVisibleSelected = visibles.some(v => seleccion.has(v.key));

  const toggleAllVisible = () => {
    setSeleccion(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibles.forEach(v => next.delete(v.key));
      } else {
        visibles.forEach(v => next.add(v.key));
      }
      return next;
    });
  };

  const setOverride = (key, value) => {
    setOverrides(prev => ({ ...prev, [key]: value }));
  };

  const getMonto = (p) => {
    const o = overrides[p.key];
    if (o === undefined || o === "") return p.montoUSD;
    return parseFloat(o) || 0;
  };

  const seleccionados = pendientes.filter(p => seleccion.has(p.key));
  const totalUSD = seleccionados.reduce((s, p) => s + getMonto(p), 0);
  const totalMXN = totalUSD * (parseFloat(tc) || 0);
  const tcDistinto = Math.abs(parseFloat(tc) - window.BLUFIN_DATA.tcDelDia) > 0.5;

  // Conteo por tipo dentro de la selección (para el botón)
  const breakdown = useMemoP(() => {
    const b = { anticipo: 0, saldo: 0 };
    seleccionados.forEach(p => { b[p.tipo]++; });
    return b;
  }, [seleccionados]);

  if (!open) return null;

  const filtros = [
    { id: "anticipo", label: "Anticipos", count: pendientes.filter(p => p.tipo === "anticipo").length, color: tipoMeta.anticipo.text, bg: tipoMeta.anticipo.bg },
    { id: "saldo", label: "Saldos", count: pendientes.filter(p => p.tipo === "saldo").length, color: tipoMeta.saldo.text, bg: tipoMeta.saldo.bg },
    { id: "todos", label: "Todos", count: pendientes.length, color: "var(--ink-700)", bg: "var(--ink-100)" },
  ];

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(10,37,64,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: "white", borderRadius: 16, maxWidth: 1100, width: "100%",
        maxHeight: "92vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 48px rgba(10,37,64,0.25)",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--ink-200)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="hstack" style={{ gap: 10, marginBottom: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "var(--blue-500)", color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <IconP name="dollar" size={14} />
              </div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Pago múltiple</h2>
            </div>
            <div className="text-sm muted">
              Registra varios pagos a la vez con un mismo banco, TC y fecha. Útil para procesar el corte del día.
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 20, color: "var(--ink-400)", cursor: "pointer" }}>✕</button>
        </div>

        {/* Encabezado del lote — aplica a TODOS */}
        <div style={{
          padding: "14px 24px",
          background: "linear-gradient(135deg, #F3F9FF 0%, #E6F4FF 100%)",
          borderBottom: "1px solid #BAE0FF",
        }}>
          <div className="hstack" style={{ gap: 8, marginBottom: 10 }}>
            <span className="text-xs fw-700" style={{ color: "var(--ink-500)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Datos aplicados a todo el lote
            </span>
            <div style={{ flex: 1, height: 1, background: "#BAE0FF" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1.4fr 1fr", gap: 12 }}>
            <div>
              <label className="field-label">Fecha del pago</label>
              <input type="date" className="field-input" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <label className="field-label" style={{ margin: 0 }}>TC capturado</label>
                <span className="text-xs muted">día: <span className="mono fw-600">{window.BLUFIN_DATA.tcDelDia.toFixed(4)}</span></span>
              </div>
              <input type="number" step="0.0001" className="field-input mono" value={tc} onChange={e => setTC(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Banco</label>
              <div className="hstack" style={{ gap: 6 }}>
                {window.BLUFIN_DATA.bancos.map(b => {
                  const m = bancoMeta[b];
                  const sel = banco === b;
                  return (
                    <button key={b} onClick={() => setBanco(b)} style={{
                      flex: 1, padding: "8px 10px", borderRadius: 8,
                      border: "2px solid " + (sel ? m.color : "var(--ink-200)"),
                      background: sel ? m.bg : "white",
                      cursor: "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 999,
                        background: sel ? m.color : "var(--ink-200)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "white", fontSize: 9, fontWeight: 700,
                      }}>{b[0]}</div>
                      <div className="fw-700" style={{ fontSize: 12 }}>{m.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="field-label">Referencia base (opcional)</label>
              <input className="field-input mono" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="TRF-LOTE-…" />
            </div>
          </div>
          {tcDistinto && (
            <div className="text-xs" style={{ color: "var(--amber-500)", marginTop: 8, fontWeight: 600 }}>
              ⚠ TC muy distinto al del día — verifica que sea correcto antes de aplicarlo a todo el lote
            </div>
          )}
        </div>

        {/* Filtros por tipo */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="hstack" style={{ gap: 6 }}>
            {filtros.map(f => {
              const active = filtroTipo === f.id;
              return (
                <button key={f.id} onClick={() => setFiltroTipo(f.id)} style={{
                  padding: "6px 12px", borderRadius: 999,
                  border: "1px solid " + (active ? "var(--ink-900)" : "var(--ink-200)"),
                  background: active ? "var(--ink-900)" : "white",
                  color: active ? "white" : "var(--ink-700)",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  {f.label}
                  <span style={{
                    fontSize: 10, padding: "1px 6px", borderRadius: 999,
                    background: active ? "rgba(255,255,255,0.15)" : f.bg,
                    color: active ? "white" : f.color,
                    fontWeight: 700,
                  }}>{f.count}</span>
                </button>
              );
            })}
          </div>
          <div className="hstack" style={{ gap: 12 }}>
            <span className="text-xs muted">
              <span className="fw-700" style={{ color: "var(--ink-900)" }}>{seleccion.size}</span> de {visibles.length} visibles seleccionados
            </span>
            <button className="btn btn-ghost btn-sm" onClick={toggleAllVisible}>
              {allVisibleSelected ? "Deseleccionar todos" : "Seleccionar todos los visibles"}
            </button>
          </div>
        </div>

        {/* Tabla de pendientes seleccionables */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {visibles.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: "var(--ink-500)" }}>
              <IconP name="check" size={32} />
              <div style={{ marginTop: 12, fontWeight: 600 }}>No hay pendientes con este filtro</div>
            </div>
          ) : (
            <table className="tbl" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={el => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                      onChange={toggleAllVisible}
                    />
                  </th>
                  <th>Contrato</th>
                  <th>Tipo</th>
                  <th>Producto</th>
                  <th>Vence</th>
                  <th style={{ textAlign: "right" }}>Monto USD</th>
                  <th style={{ textAlign: "right" }}>MXN al TC capturado</th>
                  <th>Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(p => {
                  const sel = seleccion.has(p.key);
                  const dias = $fmt.diasDesde(p.fecha);
                  const urgente = dias <= 3;
                  const vencido = dias < 0;
                  const monto = getMonto(p);
                  return (
                    <tr key={p.key}
                      onClick={() => toggleOne(p.key)}
                      style={{
                        cursor: "pointer",
                        background: sel ? "#F0F7FF" : undefined,
                      }}
                    >
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={sel} onChange={() => toggleOne(p.key)} />
                      </td>
                      <td className="mono text-sm fw-600">{p.contrato}</td>
                      <td><TipoPill tipo={p.tipo} /></td>
                      <td>
                        <div className="text-sm fw-600" style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.producto}
                        </div>
                        <div className="text-xs muted">{p.marca} · {p.talla}</div>
                      </td>
                      <td>
                        <div className="text-sm fw-600" style={{ color: vencido ? "#991B1B" : urgente ? "#92400E" : "var(--ink-900)" }}>
                          {$fmt.FechaCorta(p.fecha)}
                        </div>
                        <div className="text-xs" style={{ color: vencido ? "#991B1B" : urgente ? "#92400E" : "var(--ink-500)" }}>
                          {vencido ? `vencido hace ${-dias}d` : dias === 0 ? "hoy" : `en ${dias}d`}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
                        <input
                          type="number"
                          step="0.01"
                          className="mono"
                          value={overrides[p.key] !== undefined ? overrides[p.key] : p.montoUSD.toFixed(2)}
                          onChange={e => setOverride(p.key, e.target.value)}
                          disabled={!sel}
                          style={{
                            width: 120, textAlign: "right",
                            padding: "6px 8px", borderRadius: 6,
                            border: "1px solid " + (sel ? "var(--ink-200)" : "var(--ink-100)"),
                            background: sel ? "white" : "var(--ink-50)",
                            color: sel ? "var(--ink-900)" : "var(--ink-400)",
                            fontWeight: 600,
                          }}
                        />
                        {sel && monto !== p.montoUSD && (
                          <div className="text-xs muted" style={{ marginTop: 2 }}>
                            sugerido: {$fmt.USD(p.montoUSD)}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }} className="mono fw-600" >
                        <span style={{ color: sel ? "var(--blue-500)" : "var(--ink-400)" }}>
                          {fmtMXN(monto * (parseFloat(tc) || 0))}
                        </span>
                      </td>
                      <td>
                        {p.coveredByForward ? (
                          <span className="badge badge-blue" title={`Forward ${p.coveredByForward.id}`}>🔒 Forward</span>
                        ) : (
                          <span className="badge badge-gray">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Nota global */}
        <div style={{ padding: "12px 24px", borderTop: "1px solid var(--ink-100)" }}>
          <label className="field-label">Nota del lote (opcional)</label>
          <input
            className="field-input"
            value={nota}
            onChange={e => setNota(e.target.value)}
            placeholder="Ej. Corte de pagos del 19-may, lote bancario MONEX"
          />
        </div>

        {/* Resumen + footer */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid var(--ink-200)",
          background: "var(--ink-50)",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto auto auto", gap: 24, alignItems: "center" }}>
            <div>
              <div className="text-xs muted">Pagos seleccionados</div>
              <div className="fw-800" style={{ fontSize: 22, lineHeight: 1.1 }}>{seleccion.size}</div>
              <div className="text-xs muted">
                {breakdown.anticipo > 0 && <span>{breakdown.anticipo} anticipo{breakdown.anticipo !== 1 ? "s" : ""}</span>}
                {breakdown.anticipo > 0 && breakdown.saldo > 0 && " · "}
                {breakdown.saldo > 0 && <span>{breakdown.saldo} saldo{breakdown.saldo !== 1 ? "s" : ""}</span>}
                {seleccion.size === 0 && <span>—</span>}
              </div>
            </div>
            <div style={{ width: 1, height: 36, background: "var(--ink-200)" }} />
            <div>
              <div className="text-xs muted">Total USD</div>
              <div className="mono fw-800" style={{ fontSize: 20 }}>{$fmt.USD(totalUSD)}</div>
            </div>
            <div>
              <div className="text-xs muted">Total MXN (× {(parseFloat(tc) || 0).toFixed(4)})</div>
              <div className="mono fw-800" style={{ fontSize: 20, color: "var(--blue-500)" }}>{fmtMXN(totalMXN)}</div>
            </div>
          </div>
          <div className="hstack" style={{ gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={onClose}
              disabled={seleccion.size === 0 || !fecha || !tc}
            >
              <IconP name="check" size={13} />
              Registrar {seleccion.size} pago{seleccion.size !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { PagosView, RegistrarPagoModal, PagoMultipleModal });
