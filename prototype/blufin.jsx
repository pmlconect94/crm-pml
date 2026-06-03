// ============================================
// Blufin Seafood — Módulo de Contratos
// Vistas: list, new (manual), bulk (3 variaciones)
// ============================================

const { useState, useMemo, useRef } = React;
const { Icon } = window;

// ============================================
// Helpers
// ============================================
const fmtUSD = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtKg = (n) => Number(n).toLocaleString("es-MX", { maximumFractionDigits: 3 }) + " kg";
const fmtFecha = (s) => {
  if (!s) return "—";
  const d = new Date(s + "T12:00:00");
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtFechaCorta = (s) => {
  if (!s) return "—";
  const d = new Date(s + "T12:00:00");
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
};
const diasDesde = (s) => {
  if (!s) return null;
  const d = new Date(s + "T12:00:00");
  const hoy = new Date("2026-05-19T12:00:00");
  return Math.ceil((d - hoy) / (1000 * 60 * 60 * 24));
};

const STATUS_META = {
  "Contratado":  { color: "var(--blue-500)",  bg: "#E6F4FF", text: "#1E40AF" },
  "En tránsito": { color: "var(--amber-500)", bg: "#FEF3C7", text: "#92400E" },
  "En puerto":   { color: "#8B5CF6",          bg: "#EDE9FE", text: "#5B21B6" },
  "Entregado":   { color: "var(--green-500)", bg: "#D1FAE5", text: "#065F46" },
};

// ============================================
// Header del módulo Blufin
// ============================================
const BlufinHeader = ({ activeView, setView, activeTab, setActiveTab }) => {
  const { supplier } = window.BLUFIN_DATA;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div className="hstack" style={{ gap: 16, alignItems: "flex-start" }}>
          <div style={{
            width: 160, height: 80, borderRadius: 10,
            background: "white",
            border: "1px solid var(--ink-100)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "6px 10px", flexShrink: 0,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}>
            <img src="assets/blufin-logo.png" alt="Blufin Seafood" style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain" }}/>
          </div>
          <div>
            <div className="hstack" style={{ gap: 10, marginBottom: 4 }}>
              <h1 className="page-title" style={{ margin: 0 }}>Blufin Seafood</h1>
              <span className="badge badge-blue"><span className="dot" /> Activo</span>
            </div>
            <div className="text-sm muted">
              {supplier.nombre} · RFC <span className="mono">{supplier.rfc}</span> · {supplier.representante}
            </div>
          </div>
        </div>
        {activeView === "list" && activeTab === "contratos" && (
          <div className="hstack" style={{ gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setView("bulk")}>
              <Icon name="download" size={13} /> Carga masiva PDF
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setView("new")}>
              <Icon name="plus" size={13} /> Nuevo contrato
            </button>
          </div>
        )}
        {activeView !== "list" && (
          <button className="btn btn-ghost btn-sm" onClick={() => setView("list")}>
            ← Volver a contratos
          </button>
        )}
      </div>

      {/* Tabs sub-secciones */}
      <div style={{
        marginTop: 20, borderBottom: "1px solid var(--ink-200)",
        display: "flex", gap: 4,
      }}>
        {[
          { id: "contratos", label: "Contratos",       icon: "receipt" },
          { id: "recepcion", label: "Recepción",       icon: "check" },
          { id: "pagos",     label: "Pagos",           icon: "dollar" },
          { id: "ncs",       label: "Notas de crédito",icon: "alert" },
          { id: "facturas",  label: "Facturas",        icon: "receipt" },
          { id: "calendario", label: "Calendario",      icon: "calendar" },
          { id: "costos",    label: "Central de costos",icon: "calc" },
          { id: "catalogo", label: "Productos",         icon: "pkg"  },
        ].map(t => {
          const isActive = activeTab === t.id;
          return (
          <div key={t.id}
            onClick={() => !t.soon && setActiveTab(t.id)}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: isActive ? "var(--blue-500)" : t.soon ? "var(--ink-400)" : "var(--ink-700)",
              borderBottom: isActive ? "2px solid var(--blue-500)" : "2px solid transparent",
              marginBottom: -1,
              cursor: t.soon ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6,
              transition: "color 0.15s",
            }}>
            <Icon name={t.icon} size={13} /> {t.label}
            {t.soon && (
              <span style={{
                fontSize: 9, padding: "1px 5px", borderRadius: 4,
                background: "var(--ink-100)", color: "var(--ink-500)",
                fontWeight: 700, letterSpacing: "0.04em",
              }}>PRÓX.</span>
            )}
          </div>);
        })}
      </div>
    </div>
  );
};

// ============================================
// KPIs row
// ============================================
const BlufinKPIs = () => (
  <div className="grid grid-4" style={{ marginBottom: 20 }}>
    {window.BLUFIN_DATA.kpis.map((k, i) => (
      <div key={i} className="kpi">
        <span className="kpi-label">{k.label}</span>
        <span className="kpi-value">{k.value}</span>
        <span className={`kpi-delta ${k.up ? "up" : "down"}`} style={{ color: k.up ? undefined : "var(--ink-500)" }}>
          {k.up && <Icon name="up" size={12} />} {k.delta}
        </span>
      </div>
    ))}
  </div>
);

// ============================================
// Status pill
// ============================================
const StatusPill = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META["Activo"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 9px", borderRadius: 999,
      background: m.bg, color: m.text,
      fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: m.color }} />
      {status}
    </span>
  );
};

// ============================================
// LIST VIEW
// ============================================
const BlufinList = ({ setView, openContract }) => {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const contratos = window.BLUFIN_DATA.contratos;

  const filtered = useMemo(() => {
    return contratos.filter(c => {
      if (filter !== "todos" && c.status !== filter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!c.folio.toLowerCase().includes(s) &&
            !(c.productos[0]?.desc || "").toLowerCase().includes(s) &&
            !(c.productos[0]?.marca || "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [filter, search]);

  return (
    <>
      <BlufinKPIs />

      {/* Filter bar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="hstack" style={{ gap: 8, padding: "6px 10px", background: "var(--ink-50)", borderRadius: 8, border: "1px solid var(--ink-200)", flex: 1, minWidth: 280 }}>
            <Icon name="search" size={14} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar folio, producto, marca…"
              style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 13 }}
            />
          </div>
          <div className="hstack" style={{ gap: 6 }}>
            {[
              { id: "todos", label: "Todos" },
              { id: "Contratado", label: "Contratados" },
              { id: "En tránsito", label: "En tránsito" },
              { id: "En puerto", label: "En puerto" },
              { id: "Entregado", label: "Entregados" },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: "6px 12px", borderRadius: 999,
                  border: "1px solid " + (filter === f.id ? "var(--blue-500)" : "var(--ink-200)"),
                  background: filter === f.id ? "var(--blue-500)" : "white",
                  color: filter === f.id ? "white" : "var(--ink-700)",
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                }}
              >{f.label}</button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm">
            <Icon name="filter" size={13} /> Más filtros
          </button>
        </div>
      </div>

      {/* Lista de contratos */}
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Contrato</th>
              <th>Producto principal</th>
              <th style={{ textAlign: "right" }}>Kg</th>
              <th>Llegada puerto</th>
              <th>Status</th>
              <th>Contenedor</th>
              <th style={{ textAlign: "right" }}>USD</th>
              <th style={{ textAlign: "right" }}>Pagos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const dias = diasDesde(c.etaPuerto);
              const principal = c.productos[0];
              const numProductos = c.productos.length;
              return (
                <tr key={c.folio} className="clickable" onClick={() => openContract(c.folio)}>
                  <td>
                    <div className="mono fw-600" style={{ fontSize: 13 }}>{c.folio}</div>
                    <div className="text-xs muted">{fmtFechaCorta(c.fecha)} · {c.lote}</div>
                  </td>
                  <td>
                    <div className="fw-600" style={{ fontSize: 13 }}>
                      {principal.desc.replace("FROZEN ", "").substring(0, 32)}
                    </div>
                    <div className="text-xs muted">
                      {principal.marca} · {principal.talla}
                      {numProductos > 1 && <span> · +{numProductos - 1} más</span>}
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }} className="fw-600 mono">
                    {fmtKg(c.totalKg)}
                  </td>
                  <td>
                    <div className="fw-600">{fmtFechaCorta(c.etaPuerto)}</div>
                    <div className="text-xs muted">
                      {dias < 0 ? `hace ${-dias} días` : dias === 0 ? "hoy" : `en ${dias} días`}
                    </div>
                    {c.alertaFecha && (
                      <div className="text-xs" style={{ color: "var(--amber-500)", marginTop: 2, fontWeight: 600 }}>
                        <Icon name="alert" size={10} /> {c.alertaFecha.cambio}
                      </div>
                    )}
                  </td>
                  <td><StatusPill status={c.status} /></td>
                  <td>
                    {c.contenedor ? (
                      <>
                        <div className="mono fw-600" style={{ fontSize: 12 }}>{c.contenedor}</div>
                        <div className="text-xs muted">{c.naviera}</div>
                      </>
                    ) : (
                      <span className="text-xs muted">— Sin asignar —</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }} className="fw-600 mono">
                    {fmtUSD(c.totalUSD)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="hstack" style={{ gap: 4, justifyContent: "flex-end" }}>
                      <span title="Anticipo" style={{
                        width: 12, height: 12, borderRadius: 999,
                        background: c.anticipoPagado ? "var(--green-500)" : "var(--ink-300)",
                        display: "inline-block",
                      }} />
                      <span title="Saldo" style={{
                        width: 12, height: 12, borderRadius: 999,
                        background: c.saldoPagado ? "var(--green-500)" : "var(--amber-500)",
                        display: "inline-block",
                      }} />
                    </div>
                    <div className="text-xs muted" style={{ marginTop: 2 }}>
                      {c.anticipoPagado && c.saldoPagado ? "Liquidado" :
                       c.anticipoPagado ? "Saldo pdte" : "Anticipo pdte"}
                    </div>
                  </td>
                  <td><Icon name="chevRight" size={14} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 60, textAlign: "center", color: "var(--ink-500)" }}>
            <Icon name="receipt" size={32} />
            <div style={{ marginTop: 12, fontWeight: 600 }}>Sin contratos que coincidan</div>
            <div className="text-sm">Prueba con otros filtros o ajusta tu búsqueda.</div>
          </div>
        )}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--ink-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="text-xs muted">Mostrando {filtered.length} de {contratos.length} contratos</div>
          <div className="hstack" style={{ gap: 6 }}>
            <button className="btn btn-ghost btn-sm" disabled>← Anterior</button>
            <button className="btn btn-ghost btn-sm">Siguiente →</button>
          </div>
        </div>
      </div>

      {/* CTAs grandes de captura */}
      <div className="grid grid-2" style={{ marginTop: 16, gap: 16 }}>
        <button onClick={() => setView("bulk")} style={{
          padding: 20, borderRadius: 14, border: "1px solid var(--ink-200)",
          background: "linear-gradient(135deg, #F3F9FF 0%, #E6F4FF 100%)",
          textAlign: "left", cursor: "pointer", display: "flex", gap: 16, alignItems: "flex-start",
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "white", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--blue-500)", flexShrink: 0, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <Icon name="download" size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="fw-700" style={{ fontSize: 14, marginBottom: 4 }}>Carga masiva desde PDF</div>
            <div className="text-sm muted">Sube el PDF con todas las órdenes de compra y déjanos extraerlas. Tú revisas y editas antes de guardar.</div>
            <div className="text-xs" style={{ color: "var(--blue-500)", fontWeight: 600, marginTop: 8 }}>
              Recomendado para 5+ contratos →
            </div>
          </div>
        </button>
        <button onClick={() => setView("new")} style={{
          padding: 20, borderRadius: 14, border: "1px solid var(--ink-200)",
          background: "white", textAlign: "left", cursor: "pointer", display: "flex", gap: 16, alignItems: "flex-start",
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--ink-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-700)", flexShrink: 0 }}>
            <Icon name="plus" size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="fw-700" style={{ fontSize: 14, marginBottom: 4 }}>Captura manual</div>
            <div className="text-sm muted">Formulario completo para capturar un contrato a la vez. Ideal cuando llega solo o necesitas precisión total.</div>
            <div className="text-xs" style={{ color: "var(--ink-600)", fontWeight: 600, marginTop: 8 }}>
              Captura 1 contrato →
            </div>
          </div>
        </button>
      </div>
    </>
  );
};

// ============================================
// MANUAL CAPTURE FORM
// ============================================
const BlufinNew = ({ setView }) => {
  const cat = window.BLUFIN_DATA.catalogos;
  const [folio, setFolio] = useState("MCO-CV-003566");
  const [fecha, setFecha] = useState("2026-05-19");
  const [lote, setLote] = useState("");
  const [etaPuerto, setEtaPuerto] = useState("");
  const [anticipoFecha, setAnticipoFecha] = useState("");
  const [saldoFecha, setSaldoFecha] = useState("");
  const [presentacion, setPresentacion] = useState("Paletizado");
  const [credito, setCredito] = useState("Sí");
  const [domicilio, setDomicilio] = useState("PRIV. PINO SUAREZ 20 COL EL VIGIA, ZAPOPAN, JALISCO. C.P. 45140");
  const [productos, setProductos] = useState([
    { desc: "", marca: cat.marcasPropiasActivas[0], pct: "90%", talla: "", kg: "", kgCaja: "", cajas: "", precio: "" }
  ]);

  const updateProducto = (i, key, val) => {
    setProductos(p => p.map((row, idx) => {
      if (idx !== i) return row;
      const next = { ...row, [key]: val };
      // auto-calcular cajas si tenemos kg y kgCaja
      if (key === "kg" || key === "kgCaja") {
        const kg = parseFloat(key === "kg" ? val : next.kg);
        const kc = parseFloat(key === "kgCaja" ? val : next.kgCaja);
        if (kg && kc) next.cajas = Math.round(kg / kc);
      }
      return next;
    }));
  };

  const addProducto = () => setProductos(p => [...p, { desc: "", marca: cat.marcasPropiasActivas[0], pct: "90%", talla: "", kg: "", kgCaja: "", cajas: "", precio: "" }]);
  const removeProducto = (i) => setProductos(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : p);

  const totals = useMemo(() => {
    const kg = productos.reduce((s, p) => s + (parseFloat(p.kg) || 0), 0);
    const cajas = productos.reduce((s, p) => s + (parseFloat(p.cajas) || 0), 0);
    const usd = productos.reduce((s, p) => s + ((parseFloat(p.kg) || 0) * (parseFloat(p.precio) || 0)), 0);
    return { kg, cajas, usd, anticipo: usd * 0.1, saldo: usd * 0.9 };
  }, [productos]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header de captura */}
      <div className="card" style={{ marginBottom: 16, background: "linear-gradient(135deg, #F8FAFC 0%, white 100%)" }}>
        <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
              <Icon name="plus" size={16} />
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Nuevo contrato — Captura manual</h2>
            </div>
            <div className="text-sm muted">
              Captura un contrato a la vez. Los campos marcados con <span style={{ color: "var(--red-500)" }}>*</span> son obligatorios.
            </div>
          </div>
          <div className="hstack" style={{ gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setView("list")}>Cancelar</button>
            <button className="btn btn-outline btn-sm">Guardar como borrador</button>
            <button className="btn btn-primary btn-sm" onClick={() => setView("list")}>
              <Icon name="check" size={13} /> Guardar contrato
            </button>
          </div>
        </div>
      </div>

      {/* Info del contrato */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Información del contrato</h3>
          <span className="text-xs muted">Datos generales del documento</span>
        </div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <Field label="Folio (MCO-CV-)" required>
              <input className="field-input mono" value={folio} onChange={e => setFolio(e.target.value)} />
            </Field>
            <Field label="Fecha del contrato" required>
              <input type="date" className="field-input" value={fecha} onChange={e => setFecha(e.target.value)} />
            </Field>
            <Field label="Lote (opcional)">
              <input className="field-input" placeholder="L-2026-XXX" value={lote} onChange={e => setLote(e.target.value)} />
            </Field>
            <Field label="Fecha estimada llegada puerto" required>
              <input type="date" className="field-input" value={etaPuerto} onChange={e => setEtaPuerto(e.target.value)} />
            </Field>
            <Field label="Presentación pactada">
              <select className="field-input" value={presentacion} onChange={e => setPresentacion(e.target.value)}>
                {cat.presentaciones.map(p => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Crédito">
              <select className="field-input" value={credito} onChange={e => setCredito(e.target.value)}>
                <option>Sí</option>
                <option>No</option>
              </select>
            </Field>
            <div style={{ gridColumn: "span 3" }}>
              <Field label="Domicilio para entrega de la mercancía">
                <input className="field-input" value={domicilio} onChange={e => setDomicilio(e.target.value)} />
              </Field>
            </div>
          </div>
        </div>
      </div>

      {/* Productos */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Productos del contrato</h3>
            <div className="card-subtitle">Agrega cada SKU con marca, talla, cantidad y precio</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={addProducto}>
            <Icon name="plus" size={13} /> Agregar producto
          </button>
        </div>
        <div style={{ overflow: "auto" }}>
          <table className="tbl" style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>Descripción</th>
                <th>Marca</th>
                <th>%</th>
                <th>Talla</th>
                <th style={{ textAlign: "right" }}>Kg</th>
                <th style={{ textAlign: "right" }}>Kg/caja</th>
                <th style={{ textAlign: "right" }}>Cajas</th>
                <th style={{ textAlign: "right" }}>USD/kg</th>
                <th style={{ textAlign: "right" }}>Total USD</th>
                <th>SKU Intelisis</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p, i) => {
                const total = (parseFloat(p.kg) || 0) * (parseFloat(p.precio) || 0);
                return (
                  <tr key={i}>
                    <td>
                      <input className="field-input" style={{ padding: "6px 8px", fontSize: 12 }} value={p.desc} onChange={e => updateProducto(i, "desc", e.target.value)} placeholder="FROZEN TILAPIA FILLET..." />
                    </td>
                    <td>
                      <select className="field-input" style={{ padding: "6px 8px", fontSize: 12, minWidth: 100 }} value={p.marca} onChange={e => updateProducto(i, "marca", e.target.value)}>
                        {[...cat.marcasPropiasActivas, ...cat.marcasTerceros].map(m => <option key={m}>{m}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="field-input" style={{ padding: "6px 8px", fontSize: 12, minWidth: 60 }} value={p.pct} onChange={e => updateProducto(i, "pct", e.target.value)}>
                        {cat.porcentajes.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="field-input" style={{ padding: "6px 8px", fontSize: 12, minWidth: 70 }} value={p.talla} onChange={e => updateProducto(i, "talla", e.target.value)}>
                        <option value="">—</option>
                        {cat.tallas.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="number" className="field-input mono" style={{ padding: "6px 8px", fontSize: 12, textAlign: "right", width: 90 }} value={p.kg} onChange={e => updateProducto(i, "kg", e.target.value)} />
                    </td>
                    <td>
                      <input type="number" className="field-input mono" style={{ padding: "6px 8px", fontSize: 12, textAlign: "right", width: 70 }} value={p.kgCaja} onChange={e => updateProducto(i, "kgCaja", e.target.value)} />
                    </td>
                    <td className="mono text-sm" style={{ textAlign: "right", color: "var(--ink-500)" }}>{p.cajas || "—"}</td>
                    <td>
                      <input type="number" step="0.001" className="field-input mono" style={{ padding: "6px 8px", fontSize: 12, textAlign: "right", width: 80 }} value={p.precio} onChange={e => updateProducto(i, "precio", e.target.value)} />
                    </td>
                    <td className="mono fw-600" style={{ textAlign: "right" }}>{total ? fmtUSD(total) : "—"}</td>
                    <td>
                      <button style={{
                        padding: "4px 8px", borderRadius: 6,
                        background: "var(--blue-100)", color: "var(--blue-500)",
                        fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
                        border: "1px solid transparent", cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }} title="SKU sugerido automáticamente por sistema">
                        {p.marca && p.talla ? `30${1000 + i} ${p.marca.substring(0, 6)} ${p.talla}` : "Sugerir SKU"}
                        <Icon name="chevDown" size={10} />
                      </button>
                      <div className="text-xs muted" style={{ marginTop: 2, fontSize: 10 }}>Sugerido · click para cambiar</div>
                    </td>
                    <td>
                      <button onClick={() => removeProducto(i)} style={{ background: "transparent", border: "none", color: "var(--ink-400)", cursor: "pointer", padding: 4 }} title="Eliminar">✕</button>
                    </td>
                  </tr>
                );
              })}
              {/* Totales */}
              <tr style={{ background: "var(--ink-50)", fontWeight: 700 }}>
                <td colSpan={4} style={{ textAlign: "right", color: "var(--ink-700)" }}>TOTAL</td>
                <td className="mono" style={{ textAlign: "right" }}>{fmtKg(totals.kg)}</td>
                <td></td>
                <td className="mono" style={{ textAlign: "right" }}>{totals.cajas.toLocaleString("es-MX")}</td>
                <td></td>
                <td className="mono" style={{ textAlign: "right" }}>{fmtUSD(totals.usd)}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Montos y fechas de pago */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Montos y fechas de pago</h3>
          <div className="card-subtitle">Calculados automáticamente — TC se captura al pagar</div>
        </div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <Field label="Total USD (auto)" badge="AUTO">
              <input className="field-input mono" disabled value={fmtUSD(totals.usd)} />
            </Field>
            <Field label="Anticipo 10% USD (auto)" badge="AUTO">
              <input className="field-input mono" disabled value={fmtUSD(totals.anticipo)} />
            </Field>
            <Field label="Saldo USD (auto)" badge="AUTO">
              <input className="field-input mono" disabled value={fmtUSD(totals.saldo)} />
            </Field>
            <Field label="Fecha anticipo">
              <input type="date" className="field-input" value={anticipoFecha} onChange={e => setAnticipoFecha(e.target.value)} />
            </Field>
            <Field label="Fecha liquidación">
              <input type="date" className="field-input" value={saldoFecha} onChange={e => setSaldoFecha(e.target.value)} />
            </Field>
            <div style={{ alignSelf: "end" }}>
              <div style={{ padding: 10, borderRadius: 8, background: "#FEF3C7", border: "1px solid #FDE68A", fontSize: 11, color: "#92400E" }}>
                <div className="fw-700" style={{ marginBottom: 2 }}>📌 TC no se captura aquí</div>
                Se registra al momento del pago — entra al cálculo del costo ponderado en MXN.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky footer con acciones */}
      <div style={{
        position: "sticky", bottom: 0, marginTop: 24,
        background: "white", borderTop: "1px solid var(--ink-200)",
        padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div className="text-sm muted">
          <Icon name="check" size={13} /> Validaciones · {productos.length} producto{productos.length > 1 ? "s" : ""} · Total <span className="fw-700" style={{ color: "var(--ink-900)" }}>{fmtUSD(totals.usd)}</span>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setView("list")}>Cancelar</button>
          <button className="btn btn-outline btn-sm">Guardar como borrador</button>
          <button className="btn btn-primary btn-sm" onClick={() => setView("list")}>
            <Icon name="check" size={13} /> Guardar contrato
          </button>
        </div>
      </div>
    </div>
  );
};

// Small Field helper
const Field = ({ label, required, badge, children }) => (
  <div>
    <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 6 }}>
      <label className="field-label" style={{ margin: 0 }}>
        {label} {required && <span style={{ color: "var(--red-500)" }}>*</span>}
      </label>
      {badge && (
        <span style={{
          fontSize: 9, padding: "1px 6px", borderRadius: 4,
          background: "var(--green-100)", color: "#065F46",
          fontWeight: 700, letterSpacing: "0.06em",
        }}>{badge}</span>
      )}
    </div>
    {children}
  </div>
);

// ============================================
// MODULE ENTRY POINT
// ============================================
const BlufinModule = () => {
  const [view, setView] = useState("list"); // list | new | bulk
  const [activeTab, setActiveTab] = useState("contratos");
  const [openContractId, setOpenContractId] = useState(null);

  const handleOpenContract = (folio) => {
    setOpenContractId(folio);
    setView("list"); // asegurar que estamos en la vista de contratos
  };

  return (
    <div data-screen-label={`Blufin Seafood — ${activeTab === "pagos" ? "Pagos" : activeTab === "ncs" ? "Notas de crédito" : activeTab === "recepcion" ? "Recepción" : activeTab === "facturas" ? "Facturas" : openContractId ? "Detalle contrato" : "Contratos"}`}>
      <BlufinHeader activeView={view} setView={(v) => { setView(v); setOpenContractId(null); }} activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setOpenContractId(null); }} />
      {activeTab === "contratos" && (
        <>
          {openContractId
            ? <window.BlufinContrato folio={openContractId} onBack={() => setOpenContractId(null)} />
            : view === "list"  ? <BlufinList setView={setView} openContract={handleOpenContract} />
            : view === "new"   ? <BlufinNew setView={setView} />
            : view === "bulk"  ? <BlufinBulk setView={setView} />
            : null
          }
        </>
      )}
      {activeTab === "recepcion" && <window.RecepcionView />}
      {activeTab === "pagos" && <window.PagosView />}
      {activeTab === "ncs" && <window.NotasCreditoView />}
      {activeTab === "facturas" && <window.FacturasView />}
      {activeTab === "calendario" && <window.CalendarioModule />}
      {activeTab === "costos"     && <window.CostosModule />}
      {activeTab === "catalogo"   && <window.SkuCatalogo
        skus={window.BLUFIN_DATA.skus}
        onRefresh={() => {}}
        categorias={["Tilapia Filete","Tilapia Entera","Camarón","Otros"]}
        accentColor="var(--blue-500)"
      />}
    </div>
  );
};

Object.assign(window, { BlufinModule, fmtUSD, fmtKg, fmtFecha, fmtFechaCorta, diasDesde, StatusPill, Field });
