// ============================================
// Blufin Seafood — Vista detalle de contrato
// Muestra toda la información de un contrato:
// logística, productos, pagos, NCs, recepción, facturas
// ============================================

const { useState: useStateCT, useMemo: useMemoCT } = React;
const { Icon: IconCT } = window;

const ctFmt = {
  USD: window.fmtUSD,
  Fecha: window.fmtFecha,
  FechaCorta: window.fmtFechaCorta,
  diasDesde: window.diasDesde,
  Kg: window.fmtKg,
};
const fmtMXNct = (n) => n == null ? "—" : "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Atoms ─────────────────────────────────────────────────────────────────────

const SeccionHeader = ({ label, count }) => (
  <div style={{ padding: "10px 0", marginBottom: 10, borderBottom: "1px solid var(--ink-200)", display: "flex", alignItems: "center", gap: 8 }}>
    <span className="fw-700" style={{ fontSize: 13, color: "var(--ink-900)" }}>{label}</span>
    {count != null && (
      <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "var(--ink-100)", color: "var(--ink-600)", fontWeight: 700 }}>{count}</span>
    )}
  </div>
);

const InfoGrid = ({ items }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px 20px" }}>
    {items.filter(Boolean).map((item, i) => (
      <div key={i}>
        <div className="text-xs muted" style={{ marginBottom: 2 }}>{item.label}</div>
        <div className={"fw-600 " + (item.mono ? "mono " : "")} style={{ fontSize: 13, color: item.color || "var(--ink-900)" }}>
          {item.value || <span className="muted">—</span>}
        </div>
        {item.sub && <div className="text-xs muted">{item.sub}</div>}
      </div>
    ))}
  </div>
);

const PagoStatusDot = ({ pagado, forward }) => {
  if (pagado)   return <span style={{ color: "#059669", fontWeight: 700 }}>✓ Pagado</span>;
  if (forward)  return <span style={{ color: "#0369A1", fontWeight: 700 }}>🔒 Forward</span>;
  return <span style={{ color: "#D97706", fontWeight: 700 }}>⏳ Pendiente</span>;
};

// ── Vista detalle ─────────────────────────────────────────────────────────────

const BlufinContrato = ({ folio, onBack }) => {
  const [tab, setTab] = useStateCT("resumen");

  const contrato = useMemoCT(() =>
    window.BLUFIN_DATA.contratos.find(c => c.folio === folio)
  , [folio]);

  if (!contrato) return (
    <div style={{ padding: 60, textAlign: "center" }}>
      <div className="fw-700">Contrato no encontrado</div>
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={onBack}>← Volver</button>
    </div>
  );

  // Datos relacionados
  const pagos    = useMemoCT(() => (window.BLUFIN_DATA.pagos    || []).filter(p => p.contrato === folio), [folio]);
  const forwards = useMemoCT(() => (window.BLUFIN_DATA.forwards || []).filter(f => f.contrato === folio), [folio]);
  const ncs      = useMemoCT(() => (window.BLUFIN_DATA.notasCredito || []).filter(n => n.contratoOrigen === folio), [folio]);
  const recep    = useMemoCT(() => (window.BLUFIN_DATA.recepciones  || []).filter(r => r.contrato === folio), [folio]);
  const facturas = useMemoCT(() => (window.BLUFIN_DATA.facturas     || []).filter(f => f.contratoAsociado === folio), [folio]);

  // Días clave
  const diasEtaPuerto = ctFmt.diasDesde(contrato.etaPuerto);
  const diasEtaBodega = ctFmt.diasDesde(contrato.etaBodega);
  const diasPagoAnticipo = ctFmt.diasDesde(contrato.anticipoFecha);
  const diasPagoSaldo    = ctFmt.diasDesde(contrato.saldoFecha);

  // Totales pagados
  const totalPagadoUSD = pagos.reduce((s, p) => s + p.montoUSD, 0);
  const totalPagadoMXN = pagos.reduce((s, p) => s + p.montoMXN, 0);
  const tcPonderado = totalPagadoUSD > 0 ? totalPagadoMXN / totalPagadoUSD : null;
  const forwardSaldo = forwards.find(f => f.asociadoA === "saldo" && f.status === "Pendiente");
  const ncsUSD = ncs.filter(n => n.montoUSD).reduce((s, n) => s + (n.saldoPendienteUSD || 0), 0);

  const STATUS_COLOR = {
    "Contratado":  "#1E40AF",
    "En tránsito": "#92400E",
    "En puerto":   "#5B21B6",
    "Entregado":   "#065F46",
  };

  const TABS = [
    { id: "resumen",    label: "Resumen" },
    { id: "productos",  label: "Productos y precios" },
    { id: "pagos",      label: "Pagos", count: pagos.length + forwards.length },
    { id: "logistica",  label: "Logística" },
    { id: "ncs",        label: "Notas de crédito", count: ncs.length },
    { id: "recepcion",  label: "Recepción", count: recep.length },
    { id: "facturas",   label: "Facturas", count: facturas.length },
  ];

  return (
    <div>
      {/* Breadcrumb + acciones */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div className="hstack" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← Contratos</button>
          <span style={{ color: "var(--ink-300)" }}>/</span>
          <span className="mono fw-700" style={{ fontSize: 14 }}>{folio}</span>
          <span style={{ padding: "3px 9px", borderRadius: 999, background: window.STATUS_META?.[contrato.status]?.bg || "#E6F4FF", color: STATUS_COLOR[contrato.status] || "#1E40AF", fontSize: 11, fontWeight: 600 }}>
            {contrato.status}
          </span>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => window.open("#")}>
            <IconCT name="download" size={13} /> PDF Contrato
          </button>
          <button
            className="btn btn-outline btn-sm"
            disabled={facturas.length === 0}
            title={facturas.length === 0 ? "Sin factura subida para este contrato" : `Descargar factura ${facturas[0]?.folioFactura}`}
            style={facturas.length === 0 ? { opacity: 0.4, cursor: "not-allowed" } : {}}
            onClick={facturas.length > 0 ? () => window.open("#") : undefined}
          >
            <IconCT name="download" size={13} /> PDF Factura
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="card" style={{ marginBottom: 16, padding: "18px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20 }}>
          <div>
            <div className="hstack" style={{ gap: 8, marginBottom: 8 }}>
              <span className="mono fw-800" style={{ fontSize: 20 }}>{contrato.folio}</span>
              <span className="text-sm muted">· {ctFmt.Fecha(contrato.fecha)}</span>
              {contrato.lote && <span className="badge badge-gray">{contrato.lote}</span>}
            </div>
            <div className="fw-600" style={{ fontSize: 15, marginBottom: 4 }}>
              {contrato.productos[0].desc}
            </div>
            <div className="text-sm muted">
              {window.BLUFIN_DATA.supplier.nombre} · RFC {window.BLUFIN_DATA.supplier.rfc}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, textAlign: "right" }}>
            <div>
              <div className="text-xs muted">Total contrato</div>
              <div className="mono fw-800" style={{ fontSize: 18 }}>{ctFmt.USD(contrato.totalUSD)}</div>
              <div className="text-xs muted">{ctFmt.Kg(contrato.totalKg)}</div>
            </div>
            <div>
              <div className="text-xs muted">Pagado</div>
              <div className="mono fw-700" style={{ fontSize: 18, color: "#059669" }}>{ctFmt.USD(totalPagadoUSD)}</div>
              <div className="text-xs" style={{ color: "#059669" }}>{pagos.length} pago{pagos.length !== 1 ? "s" : ""}</div>
            </div>
            <div>
              <div className="text-xs muted">Saldo NC pendiente</div>
              <div className="mono fw-700" style={{ fontSize: 18, color: ncsUSD > 0 ? "#D97706" : "var(--ink-400)" }}>
                {ncsUSD > 0 ? ctFmt.USD(ncsUSD) : "—"}
              </div>
              <div className="text-xs muted">{ncs.length} NC{ncs.length !== 1 ? "s" : ""}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid var(--ink-200)", display: "flex", gap: 2, marginBottom: 16 }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "9px 14px", borderRadius: "8px 8px 0 0", background: active ? "white" : "transparent", color: active ? "var(--blue-500)" : "var(--ink-600)", fontWeight: 600, fontSize: 13, cursor: "pointer", border: active ? "1px solid var(--ink-200)" : "1px solid transparent", borderBottom: active ? "1px solid white" : undefined, marginBottom: active ? -1 : 0, display: "flex", alignItems: "center", gap: 6 }}>
              {t.label}
              {t.count != null && t.count > 0 && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: active ? "#EFF6FF" : "var(--ink-100)", color: active ? "var(--blue-500)" : "var(--ink-600)", fontWeight: 700 }}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── RESUMEN ── */}
      {tab === "resumen" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* Logística */}
          <div className="card" style={{ padding: "16px 18px" }}>
            <SeccionHeader label="Logística" />
            <InfoGrid items={[
              { label: "Contenedor",        value: contrato.contenedor, mono: true },
              { label: "Naviera",           value: contrato.naviera },
              { label: "Bodega destino",    value: contrato.bodegaDestino },
              { label: "Presentación",      value: contrato.presentacion, color: "var(--blue-500)" },
              { label: "ETA Puerto",        value: contrato.etaPuerto ? `${ctFmt.FechaCorta(contrato.etaPuerto)} ${diasEtaPuerto != null ? (diasEtaPuerto < 0 ? `(hace ${-diasEtaPuerto}d)` : diasEtaPuerto === 0 ? "(hoy)" : `(en ${diasEtaPuerto}d)`) : ""}` : null },
              { label: "ETA Bodega",        value: contrato.etaBodega  ? `${ctFmt.FechaCorta(contrato.etaBodega)} ${diasEtaBodega != null ? (diasEtaBodega < 0 ? `(hace ${-diasEtaBodega}d)` : diasEtaBodega === 0 ? "(hoy)" : `(en ${diasEtaBodega}d)`) : ""}` : null },
              { label: "Llegada real",      value: contrato.llegadaReal ? ctFmt.Fecha(contrato.llegadaReal) : "—" },
              contrato.alertaFecha && { label: "⚠ Cambio ETA", value: contrato.alertaFecha.cambio + " vs " + ctFmt.FechaCorta(contrato.alertaFecha.anterior), color: "#D97706" },
            ]} />
          </div>

          {/* Pagos resumen */}
          <div className="card" style={{ padding: "16px 18px" }}>
            <SeccionHeader label="Estado de pagos" />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Anticipo */}
              <div style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--ink-200)", background: contrato.anticipoPagado ? "#F0FDF4" : "#FFFBEB" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div className="text-xs fw-700" style={{ letterSpacing: "0.05em", color: "var(--ink-500)", marginBottom: 2 }}>ANTICIPO (10%)</div>
                    <div className="mono fw-700" style={{ fontSize: 16 }}>{ctFmt.USD(contrato.anticipoUSD)}</div>
                    <div className="text-xs muted">Vence: {ctFmt.FechaCorta(contrato.anticipoFecha)} {diasPagoAnticipo != null && !contrato.anticipoPagado && <span style={{ color: diasPagoAnticipo < 0 ? "#DC2626" : "#D97706" }}>· {diasPagoAnticipo < 0 ? `vencido hace ${-diasPagoAnticipo}d` : `en ${diasPagoAnticipo}d`}</span>}</div>
                  </div>
                  <PagoStatusDot pagado={contrato.anticipoPagado} />
                </div>
              </div>
              {/* Saldo */}
              <div style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--ink-200)", background: contrato.saldoPagado ? "#F0FDF4" : forwardSaldo ? "#EFF6FF" : "#FFFBEB" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div className="text-xs fw-700" style={{ letterSpacing: "0.05em", color: "var(--ink-500)", marginBottom: 2 }}>SALDO (90%)</div>
                    <div className="mono fw-700" style={{ fontSize: 16 }}>{ctFmt.USD(contrato.totalUSD - contrato.anticipoUSD)}</div>
                    <div className="text-xs muted">Vence: {ctFmt.FechaCorta(contrato.saldoFecha)} {diasPagoSaldo != null && !contrato.saldoPagado && <span style={{ color: diasPagoSaldo < 0 ? "#DC2626" : "#D97706" }}>· {diasPagoSaldo < 0 ? `vencido hace ${-diasPagoSaldo}d` : `en ${diasPagoSaldo}d`}</span>}</div>
                    {forwardSaldo && <div className="text-xs" style={{ color: "#0369A1", marginTop: 2 }}>Forward {forwardSaldo.id} · TC {forwardSaldo.tcForward.toFixed(4)} · {ctFmt.FechaCorta(forwardSaldo.fechaEntrega)}</div>}
                  </div>
                  <PagoStatusDot pagado={contrato.saldoPagado} forward={!!forwardSaldo} />
                </div>
              </div>
              {/* TC ponderado */}
              {tcPonderado && (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--ink-50)", border: "1px solid var(--ink-200)", display: "flex", justifyContent: "space-between" }}>
                  <span className="text-xs muted">TC ponderado real</span>
                  <span className="mono fw-700">{tcPonderado.toFixed(4)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Productos resumen */}
          <div className="card" style={{ padding: "16px 18px", gridColumn: "span 2" }}>
            <SeccionHeader label="Productos" count={contrato.productos.length} />
            <table className="tbl" style={{ marginTop: 0 }}>
              <thead>
                <tr>
                  <th>Descripción</th><th>Marca</th><th>Talla</th><th>Glaze %</th>
                  <th style={{ textAlign: "right" }}>Kg</th><th style={{ textAlign: "right" }}>Cajas</th>
                  <th style={{ textAlign: "right" }}>USD/kg</th><th style={{ textAlign: "right" }}>Total USD</th>
                </tr>
              </thead>
              <tbody>
                {contrato.productos.map((p, i) => (
                  <tr key={i}>
                    <td className="fw-600">{p.desc.replace("FROZEN ", "")}</td>
                    <td>{p.marca}</td>
                    <td className="mono">{p.talla}</td>
                    <td className="mono">{p.pct}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-600">{p.kg?.toLocaleString("es-MX")} kg</td>
                    <td style={{ textAlign: "right" }} className="mono">{p.cajas?.toLocaleString("es-MX")}</td>
                    <td style={{ textAlign: "right" }} className="mono">${p.precio?.toFixed(4)}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-700">{ctFmt.USD(p.total)}</td>
                  </tr>
                ))}
                <tr style={{ background: "var(--ink-50)", fontWeight: 700 }}>
                  <td colSpan={4}>Total</td>
                  <td style={{ textAlign: "right" }} className="mono">{contrato.totalKg.toLocaleString("es-MX")} kg</td>
                  <td></td><td></td>
                  <td style={{ textAlign: "right" }} className="mono">{ctFmt.USD(contrato.totalUSD)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PRODUCTOS Y PRECIOS ── */}
      {tab === "productos" && (
        <div className="card" style={{ padding: "16px 18px" }}>
          <SeccionHeader label="Productos y precios detallados" count={contrato.productos.length} />
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th><th>Descripción completa</th><th>Marca</th><th>Talla</th>
                <th>Glaze</th><th style={{ textAlign: "right" }}>Kg/caja</th>
                <th style={{ textAlign: "right" }}>Cajas</th><th style={{ textAlign: "right" }}>Kg total</th>
                <th style={{ textAlign: "right" }}>USD/kg</th><th style={{ textAlign: "right" }}>Total USD</th>
              </tr>
            </thead>
            <tbody>
              {contrato.productos.map((p, i) => (
                <tr key={i}>
                  <td className="mono muted">{i + 1}</td>
                  <td className="fw-600">{p.desc}</td>
                  <td><span className="badge badge-gray">{p.marca}</span></td>
                  <td className="mono fw-700">{p.talla}</td>
                  <td className="mono">{p.pct}</td>
                  <td style={{ textAlign: "right" }} className="mono">{p.kgCaja}</td>
                  <td style={{ textAlign: "right" }} className="mono fw-600">{p.cajas?.toLocaleString("es-MX")}</td>
                  <td style={{ textAlign: "right" }} className="mono fw-700">{p.kg?.toLocaleString("es-MX")} kg</td>
                  <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "var(--blue-500)", textAlign: "right" }}>${p.precio?.toFixed(4)}</td>
                  <td style={{ textAlign: "right" }} className="mono fw-700">{ctFmt.USD(p.total)}</td>
                </tr>
              ))}
              <tr style={{ background: "var(--ink-50)" }}>
                <td colSpan={7} className="fw-700">Total contrato</td>
                <td style={{ textAlign: "right" }} className="mono fw-800">{contrato.totalKg.toLocaleString("es-MX")} kg</td>
                <td></td>
                <td style={{ textAlign: "right" }} className="mono fw-800" style={{ color: "var(--ink-900)", textAlign: "right" }}>{ctFmt.USD(contrato.totalUSD)}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 8, background: "#F3F9FF", border: "1px solid #BAE0FF" }}>
            <InfoGrid items={[
              { label: "Presentación pactada", value: contrato.presentacion, color: "var(--blue-500)" },
              { label: "Bodega destino", value: contrato.bodegaDestino },
              { label: "Fecha contrato", value: ctFmt.Fecha(contrato.fecha) },
              { label: "Lote", value: contrato.lote, mono: true },
              { label: "Precio promedio USD/kg", value: "$" + (contrato.totalUSD / contrato.totalKg).toFixed(4) + "/kg", mono: true },
            ]} />
          </div>
        </div>
      )}

      {/* ── PAGOS ── */}
      {tab === "pagos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Resumen */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {[
              { label: "Total contrato", value: ctFmt.USD(contrato.totalUSD), color: "var(--ink-900)" },
              { label: "Pagado USD", value: ctFmt.USD(totalPagadoUSD), color: "#059669" },
              { label: "Pendiente USD", value: ctFmt.USD(contrato.totalUSD - totalPagadoUSD), color: contrato.totalUSD - totalPagadoUSD > 0 ? "#D97706" : "#059669" },
              { label: "TC ponderado", value: tcPonderado ? tcPonderado.toFixed(4) : "—", color: "var(--ink-900)" },
            ].map((item, i) => (
              <div key={i} className="kpi">
                <span className="kpi-label">{item.label}</span>
                <span className="mono fw-700" style={{ fontSize: 18, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Pagos realizados */}
          {pagos.length > 0 && (
            <div className="card" style={{ padding: "14px 16px" }}>
              <SeccionHeader label="Pagos realizados" count={pagos.length} />
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ID</th><th>Tipo</th><th>Fecha</th>
                    <th style={{ textAlign: "right" }}>USD</th><th style={{ textAlign: "right" }}>TC</th>
                    <th style={{ textAlign: "right" }}>MXN</th><th>Banco</th><th>Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map(p => (
                    <tr key={p.id}>
                      <td className="mono fw-600 text-sm">{p.id}</td>
                      <td>
                        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: p.tipo === "anticipo" ? "#E6F4FF" : "#EDE9FE", color: p.tipo === "anticipo" ? "#1E40AF" : "#5B21B6" }}>
                          {p.tipo === "anticipo" ? "Anticipo" : "Saldo"}
                        </span>
                      </td>
                      <td className="text-sm">{ctFmt.FechaCorta(p.fecha)}</td>
                      <td style={{ textAlign: "right" }} className="mono fw-700">{ctFmt.USD(p.montoUSD)}</td>
                      <td style={{ textAlign: "right" }} className="mono">{p.tc.toFixed(4)}</td>
                      <td style={{ textAlign: "right" }} className="mono fw-600" style={{ color: "var(--blue-500)", textAlign: "right" }}>{fmtMXNct(p.montoMXN)}</td>
                      <td className="text-sm">{p.banco}</td>
                      <td className="mono text-xs muted">{p.referencia}</td>
                    </tr>
                  ))}
                  {pagos.length > 1 && (
                    <tr style={{ background: "var(--ink-50)", fontWeight: 700 }}>
                      <td colSpan={3}>Total pagado</td>
                      <td style={{ textAlign: "right" }} className="mono fw-800">{ctFmt.USD(totalPagadoUSD)}</td>
                      <td style={{ textAlign: "right" }} className="mono">{tcPonderado?.toFixed(4)}</td>
                      <td style={{ textAlign: "right" }} className="mono fw-800" style={{ color: "var(--blue-500)", textAlign: "right" }}>{fmtMXNct(totalPagadoMXN)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Forwards */}
          {forwards.length > 0 && (
            <div className="card" style={{ padding: "14px 16px" }}>
              <SeccionHeader label="Forwards vinculados" count={forwards.length} />
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ID Forward</th><th>Cubre</th>
                    <th style={{ textAlign: "right" }}>USD</th><th style={{ textAlign: "right" }}>TC Forward</th>
                    <th style={{ textAlign: "right" }}>MXN</th><th>Cerrado</th><th>Se ejecuta</th><th>Banco</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {forwards.map(f => (
                    <tr key={f.id}>
                      <td className="mono fw-600 text-sm">{f.id}</td>
                      <td className="text-sm">{f.asociadoA === "anticipo" ? "Anticipo" : "Saldo"}</td>
                      <td style={{ textAlign: "right" }} className="mono fw-700">{ctFmt.USD(f.montoUSD)}</td>
                      <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: "var(--amber-500)", textAlign: "right" }}>{f.tcForward.toFixed(4)}</td>
                      <td style={{ textAlign: "right" }} className="mono" style={{ color: "var(--blue-500)", textAlign: "right" }}>{fmtMXNct(f.montoMXN)}</td>
                      <td className="text-sm">{ctFmt.FechaCorta(f.fechaCierre)}</td>
                      <td className="text-sm fw-600">{ctFmt.FechaCorta(f.fechaEntrega)}</td>
                      <td className="text-sm">{f.banco}</td>
                      <td>
                        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: f.status === "Pendiente" ? "#FEF3C7" : "#D1FAE5", color: f.status === "Pendiente" ? "#92400E" : "#065F46" }}>
                          {f.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagos.length === 0 && forwards.length === 0 && (
            <div className="card" style={{ padding: "48px 32px", textAlign: "center", color: "var(--ink-400)" }}>
              <IconCT name="dollar" size={28} />
              <div style={{ marginTop: 10, fontWeight: 600 }}>Sin movimientos de pago registrados</div>
            </div>
          )}
        </div>
      )}

      {/* ── LOGÍSTICA ── */}
      {tab === "logistica" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: "16px 18px" }}>
            <SeccionHeader label="Datos del contenedor" />
            <InfoGrid items={[
              { label: "Número contenedor", value: contrato.contenedor, mono: true },
              { label: "Naviera",            value: contrato.naviera },
              { label: "Bodega destino",     value: contrato.bodegaDestino },
              { label: "Presentación",       value: contrato.presentacion, color: "var(--blue-500)" },
              { label: "Total kg",           value: ctFmt.Kg(contrato.totalKg), mono: true },
            ]} />
          </div>
          <div className="card" style={{ padding: "16px 18px" }}>
            <SeccionHeader label="Fechas clave" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
              {[
                { label: "Fecha de contrato",    fecha: contrato.fecha,         icon: "receipt", done: true },
                { label: "ETA Puerto",           fecha: contrato.etaPuerto,      icon: "clock",   done: contrato.llegadaReal != null, alerta: contrato.alertaFecha },
                { label: "Llegada real a puerto",fecha: contrato.llegadaReal,    icon: "check",   done: contrato.llegadaReal != null, opcional: true },
                { label: "ETA Bodega",           fecha: contrato.etaBodega,      icon: "clock",   done: contrato.status === "Entregado" },
                { label: "Pago anticipo",        fecha: contrato.anticipoFecha,  icon: "dollar",  done: contrato.anticipoPagado },
                { label: "Pago saldo",           fecha: contrato.saldoFecha,     icon: "dollar",  done: contrato.saldoPagado },
              ].filter(f => f.fecha || !f.opcional).map((item, i) => {
                const dias = item.fecha ? ctFmt.diasDesde(item.fecha) : null;
                const pasado = dias != null && dias < 0;
                const hoy    = dias === 0;
                return (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 999, background: item.done ? "#059669" : pasado ? "#FEE2E2" : "var(--ink-100)", color: item.done ? "white" : pasado ? "#DC2626" : "var(--ink-500)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <IconCT name={item.icon} size={12} />
                    </div>
                    <div>
                      <div className="text-sm fw-600" style={{ color: item.done ? "#059669" : "var(--ink-900)" }}>{item.label}</div>
                      <div className="text-xs muted">
                        {item.fecha ? ctFmt.Fecha(item.fecha) : "—"}
                        {dias != null && !item.done && <span style={{ marginLeft: 6, color: pasado ? "#DC2626" : hoy ? "#D97706" : "var(--ink-500)", fontWeight: 600 }}>
                          {pasado ? `hace ${-dias}d` : hoy ? "hoy" : `en ${dias}d`}
                        </span>}
                        {item.alerta && <span style={{ marginLeft: 6, color: "#D97706", fontWeight: 600 }}>⚠ {item.alerta.cambio}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── NOTAS DE CRÉDITO ── */}
      {tab === "ncs" && (
        <div className="card" style={{ padding: "14px 16px" }}>
          <SeccionHeader label="Notas de crédito vinculadas" count={ncs.length} />
          {ncs.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-400)" }}>
              <div className="text-sm">Sin notas de crédito para este contrato.</div>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Folio interno</th><th>Razón</th><th>Fecha</th>
                  <th style={{ textAlign: "right" }}>Monto USD</th><th style={{ textAlign: "right" }}>Saldo pend.</th>
                  <th>Timbrado</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ncs.map(nc => (
                  <tr key={nc.id}>
                    <td className="mono fw-700">{nc.folioInterno || nc.id}</td>
                    <td>
                      <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: nc.razon === "presentacion" ? "#FEF3C7" : nc.razon === "faltante" ? "#FEE2E2" : "#D1FAE5", color: nc.razon === "presentacion" ? "#92400E" : nc.razon === "faltante" ? "#991B1B" : "#065F46" }}>
                        {nc.razon === "presentacion" ? "Presentación" : nc.razon === "faltante" ? "Faltante" : "Descuento"}
                      </span>
                    </td>
                    <td>{ctFmt.FechaCorta(nc.fechaEmision)}</td>
                    <td style={{ textAlign: "right" }} className="mono fw-600" style={{ color: "#DC2626", textAlign: "right" }}>
                      {nc.montoUSD ? "−" + ctFmt.USD(nc.montoUSD) : <span className="text-xs muted" style={{ fontStyle: "italic" }}>sin monto</span>}
                    </td>
                    <td style={{ textAlign: "right" }} className="mono">
                      {nc.saldoPendienteUSD > 0 ? <span style={{ color: "#D97706", fontWeight: 700 }}>{ctFmt.USD(nc.saldoPendienteUSD)}</span> : "—"}
                    </td>
                    <td className="text-xs mono muted">{nc.folioTimbrado || "—"}</td>
                    <td>
                      <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: nc.status === "Sin monto" ? "#F3F4F6" : nc.status === "Aplicada" ? "#D1FAE5" : "#FEF3C7", color: nc.status === "Sin monto" ? "#6B7280" : nc.status === "Aplicada" ? "#065F46" : "#92400E" }}>
                        {nc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── RECEPCIÓN ── */}
      {tab === "recepcion" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {recep.length === 0 ? (
            <div className="card" style={{ padding: "48px 32px", textAlign: "center", color: "var(--ink-400)" }}>
              <IconCT name="check" size={28} />
              <div style={{ marginTop: 10, fontWeight: 600 }}>Sin recepción registrada aún</div>
              <div className="text-sm muted">Ve a la pestaña Recepción para registrar la llegada de este contenedor.</div>
            </div>
          ) : recep.map(r => {
            const kgDif = (r.kgFacturados || 0) - (r.lineas || []).reduce((s, l) => s + l.kgRecibidos, 0);
            return (
              <div key={r.id} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div>
                    <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
                      <span className="mono fw-700" style={{ fontSize: 14 }}>{r.id}</span>
                      <span className="badge badge-green">✓ Recibido</span>
                    </div>
                    <div className="text-sm muted">{ctFmt.Fecha(r.fechaRecepcion)} · {r.bodega}</div>
                  </div>
                  <InfoGrid items={[
                    { label: "Entrada Intelisis", value: r.entradaIntelisis, mono: true },
                    { label: "Pres. pactada",  value: r.presentacionPactada, color: "var(--blue-500)" },
                    { label: "Pres. recibida", value: r.presentacionRecibida, color: r.presentacionRecibida !== r.presentacionPactada ? "#DC2626" : "#059669" },
                  ]} />
                </div>
                {r.lineas?.length > 0 && (
                  <table className="tbl">
                    <thead>
                      <tr><th>SKU</th><th>Descripción</th><th style={{ textAlign: "right" }}>Kg contratados</th><th style={{ textAlign: "right" }}>Kg recibidos</th><th style={{ textAlign: "right" }}>Diferencia</th><th>Observaciones</th></tr>
                    </thead>
                    <tbody>
                      {r.lineas.map((l, i) => (
                        <tr key={i}>
                          <td className="mono fw-700">{l.sku}</td>
                          <td className="text-sm">{l.desc}</td>
                          <td style={{ textAlign: "right" }} className="mono">{l.kgContratados?.toLocaleString("es-MX")} kg</td>
                          <td style={{ textAlign: "right" }} className="mono fw-700" style={{ color: l.diferencia > 0 ? "#DC2626" : "#059669", textAlign: "right" }}>{l.kgRecibidos?.toLocaleString("es-MX")} kg</td>
                          <td style={{ textAlign: "right" }} className="mono" style={{ color: l.diferencia > 0 ? "#DC2626" : "var(--ink-400)", textAlign: "right" }}>{l.diferencia > 0 ? `−${l.diferencia.toLocaleString("es-MX")} kg` : "✓"}</td>
                          <td className="text-xs muted">{l.observaciones || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {r.ncGeneradas?.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center" }}>
                    <span className="text-xs muted">NCs generadas:</span>
                    {r.ncGeneradas.map(id => <span key={id} className="badge badge-amber" style={{ fontSize: 10 }}>{id}</span>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── FACTURAS ── */}
      {tab === "facturas" && (
        <div className="card" style={{ padding: "14px 16px" }}>
          <SeccionHeader label="Facturas del proveedor" count={facturas.length} />
          {facturas.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-400)" }}>
              <div className="text-sm">Sin facturas subidas para este contrato.</div>
              <div className="text-xs muted" style={{ marginTop: 4 }}>Ve a la pestaña Facturas para subir el PDF.</div>
            </div>
          ) : facturas.map(f => (
            <div key={f.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div className="hstack" style={{ gap: 8 }}>
                    <span className="mono fw-700">{f.folioFactura}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: f.status === "Pendiente revisión" ? "#FEF3C7" : "#D1FAE5", color: f.status === "Pendiente revisión" ? "#92400E" : "#065F46" }}>{f.status}</span>
                  </div>
                  <div className="text-xs muted">{ctFmt.Fecha(f.fechaFactura)} · {f.nombreArchivo}</div>
                </div>
                <div className="hstack" style={{ gap: 12 }}>
                  <div style={{ textAlign: "right" }}>
                    <div className="text-xs muted">Diferencia</div>
                    <div className="mono fw-700" style={{ color: f.diferenciaMonto < 0 ? "#DC2626" : f.diferenciaMonto > 0 ? "#D97706" : "#059669" }}>
                      {f.diferenciaMonto >= 0 ? "+" : ""}{ctFmt.USD(f.diferenciaMonto)}
                    </div>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => window.open("#")}>
                    <IconCT name="download" size={13} /> PDF
                  </button>
                </div>
              </div>
              <table className="tbl">
                <thead>
                  <tr><th>SKU factura</th><th>Descripción</th><th style={{ textAlign: "right" }}>Kg</th><th style={{ textAlign: "right" }}>Precio fac.</th><th style={{ textAlign: "right" }}>Precio cont.</th><th style={{ textAlign: "right" }}>Total fac.</th><th>Diferencias</th><th>Revisión</th></tr>
                </thead>
                <tbody>
                  {f.lineas.map(l => (
                    <tr key={l.id}>
                      <td className="mono fw-700">{l.sku_factura}</td>
                      <td className="text-sm" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.descripcion_factura}</td>
                      <td style={{ textAlign: "right" }} className="mono">{l.kg_factura.toLocaleString("es-MX")} kg</td>
                      <td style={{ textAlign: "right" }} className="mono" style={{ color: l.diferencias?.some(d => d.tipo === "precio") ? "#DC2626" : "inherit", textAlign: "right" }}>${l.precio_factura.toFixed(4)}</td>
                      <td style={{ textAlign: "right" }} className="mono muted">${l.precio_contrato.toFixed(4)}</td>
                      <td style={{ textAlign: "right" }} className="mono fw-600">{ctFmt.USD(l.total_factura)}</td>
                      <td>
                        {l.diferencias?.length > 0
                          ? <span className="badge badge-amber" style={{ fontSize: 10 }}>{l.diferencias.length} dif.</span>
                          : <span className="badge badge-green" style={{ fontSize: 10 }}>✓ OK</span>
                        }
                      </td>
                      <td>
                        {l.aceptado === true  && <span className="badge badge-green"  style={{ fontSize: 10 }}>✓ Aceptado</span>}
                        {l.aceptado === false && <span className="badge badge-gray"   style={{ fontSize: 10 }}>✗ No aplica</span>}
                        {l.aceptado === null  && l.match !== "ok" && <span className="badge badge-amber" style={{ fontSize: 10 }}>Pendiente</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

Object.assign(window, { BlufinContrato });
