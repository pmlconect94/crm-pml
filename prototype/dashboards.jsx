// ============================================
// Dashboards por departamento
// Split por empresa: PML (distribuidora) vs Marlin (productora)
// ============================================

const { Icon, CompanyCrest } = window;

const fmtDate = (s) => new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

// =====================================================
// DASHBOARD GENERAL
// =====================================================
const DashboardGeneral = ({ company }) => {
  return company.id === "pml" ? <DashboardGeneralPML company={company}/> : <DashboardGeneralMarlin company={company}/>;
};

const DashboardGeneralPML = ({ company }) => {
  const kpis = CRM_DATA.adminKpis.pml;
  const eventos = CRM_DATA.eventos.pml;
  const contenedores = CRM_DATA.contenedores.pml;
  const tipoColor = { logistica: "badge-blue", finanzas: "badge-green", ventas: "badge-violet", rh: "badge-amber", produccion: "badge-amber" };
  const tipoLabel = { logistica: "Logística", finanzas: "Finanzas", ventas: "Ventas", rh: "RH", produccion: "Producción" };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Buenos días, Carlos 👋</h1>
          <p className="page-subtitle">
            <span className="badge badge-blue" style={{ marginRight: 8 }}>Distribuidora</span>
            Productos Marinos Lizárraga · Jueves 23 de abril, 2026
          </p>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button className="btn btn-outline btn-sm"><Icon name="download" size={13}/> Exportar</button>
          <button className="btn btn-primary btn-sm"><Icon name="plus" size={13}/> Nueva acción</button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} className="kpi">
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-value">{k.value}</span>
            <span className={`kpi-delta ${k.up ? "up" : "down"}`}><Icon name={k.up ? "up" : "down"} size={12}/> {k.delta} vs. mes anterior</span>
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Próximas llegadas de contenedores</h3>
              <div className="card-subtitle">Importaciones en tránsito hacia México</div>
            </div>
            <button className="btn btn-ghost btn-sm">Ver todo <Icon name="chevRight" size={13}/></button>
          </div>
          <table className="tbl">
            <thead><tr><th>Contenedor</th><th>Producto</th><th>Proveedor</th><th>ETA</th><th>Status</th></tr></thead>
            <tbody>
              {contenedores.slice(0, 5).map(c => (
                <tr key={c.id}>
                  <td className="mono fw-600">{c.id}</td>
                  <td>{c.producto}</td>
                  <td className="text-sm muted">{c.proveedor}</td>
                  <td>
                    <div className="fw-600">{fmtDate(c.eta)}</div>
                    <div className="text-xs muted">en {c.dias} días</div>
                  </td>
                  <td><span className={`badge ${c.dias <= 5 ? "badge-amber" : "badge-blue"}`}><span className="dot"/> {c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Actividad de hoy</h3>
            <span className="badge badge-gray">{eventos.length} eventos</span>
          </div>
          <div style={{ padding: "8px 0" }}>
            {eventos.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "10px 20px", borderBottom: i < eventos.length - 1 ? "1px solid var(--ink-100)" : "none" }}>
                <div style={{ fontSize: 11, color: "var(--ink-500)", fontFamily: "var(--font-mono)", minWidth: 38, paddingTop: 2 }}>{e.hora}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.titulo}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2 }}>{e.detalle}</div>
                </div>
                <span className={`badge ${tipoColor[e.tipo]}`} style={{ alignSelf: "flex-start" }}>{tipoLabel[e.tipo]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Relación con Marlin */}
      <div className="card" style={{ marginTop: 16, background: "linear-gradient(135deg, #E6F4FF 0%, #F3F9FF 100%)", border: "1px solid #BAE0FF" }}>
        <div className="card-body hstack" style={{ gap: 20, alignItems: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "white", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--blue-500)" }}>
            <Icon name="fish" size={24}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="fw-700" style={{ fontSize: 14 }}>Maquila con Marlin Lizárraga</div>
            <div className="text-sm muted">4 órdenes activas · 31,000 kg en proceso · próxima entrega 25 abr</div>
          </div>
          <div className="hstack" style={{ gap: 24 }}>
            <div style={{ textAlign: "center" }}>
              <div className="fw-700" style={{ fontSize: 18 }}>$26.8M</div>
              <div className="text-xs muted">CxP Marlin este mes</div>
            </div>
            <button className="btn btn-accent btn-sm">Ver maquila <Icon name="chevRight" size={13}/></button>
          </div>
        </div>
      </div>

    </>
  );
};

const DashboardGeneralMarlin = ({ company }) => {
  const kpis = CRM_DATA.adminKpis.marlin;
  const eventos = CRM_DATA.eventos.marlin;
  const ordenes = CRM_DATA.ordenesMaquila;
  const tipoColor = { logistica: "badge-blue", finanzas: "badge-green", produccion: "badge-amber", rh: "badge-violet" };
  const tipoLabel = { logistica: "Logística", finanzas: "Finanzas", produccion: "Producción", rh: "RH" };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Buenos días, Carlos 👋</h1>
          <p className="page-subtitle">
            <span className="badge badge-blue" style={{ marginRight: 8 }}>Productora · Planta</span>
            Marlin Lizárraga · Cliente único: PML · Jueves 23 de abril, 2026
          </p>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button className="btn btn-outline btn-sm"><Icon name="download" size={13}/> Exportar</button>
          <button className="btn btn-primary btn-sm"><Icon name="plus" size={13}/> Nueva orden</button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} className="kpi">
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-value">{k.value}</span>
            <span className={`kpi-delta ${k.up ? "up" : "down"}`}><Icon name={k.up ? "up" : "down"} size={12}/> {k.delta} vs. mes anterior</span>
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Órdenes de maquila activas</h3>
              <div className="card-subtitle">Producción para PML en piso de planta</div>
            </div>
            <button className="btn btn-ghost btn-sm">Ver todo <Icon name="chevRight" size={13}/></button>
          </div>
          <table className="tbl">
            <thead><tr><th>Orden</th><th>Producto</th><th>Cantidad</th><th>Avance</th><th>Entrega</th></tr></thead>
            <tbody>
              {ordenes.filter(o => o.status !== "Terminada").map(o => (
                <tr key={o.id}>
                  <td className="mono fw-600">{o.id}</td>
                  <td>
                    <div className="fw-600">{o.producto}</div>
                    <div className="text-xs muted">{o.presentacion}</div>
                  </td>
                  <td className="fw-600">{o.cantidad}</td>
                  <td style={{ minWidth: 140 }}>
                    <div className="progress"><div className="progress-fill" style={{ width: o.avance + "%", background: o.status === "Empaque" ? "var(--green-500)" : "var(--blue-500)" }}/></div>
                    <div className="text-xs muted" style={{ marginTop: 4 }}>{o.avance}% · {o.status}</div>
                  </td>
                  <td>
                    <div className="fw-600">{fmtDate(o.fechaEntrega)}</div>
                    <div className="text-xs muted">{o.cliente.replace("PML — ", "")}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Actividad de hoy</h3>
            <span className="badge badge-gray">{eventos.length} eventos</span>
          </div>
          <div style={{ padding: "8px 0" }}>
            {eventos.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "10px 20px", borderBottom: i < eventos.length - 1 ? "1px solid var(--ink-100)" : "none" }}>
                <div style={{ fontSize: 11, color: "var(--ink-500)", fontFamily: "var(--font-mono)", minWidth: 38, paddingTop: 2 }}>{e.hora}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.titulo}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2 }}>{e.detalle}</div>
                </div>
                <span className={`badge ${tipoColor[e.tipo]}`} style={{ alignSelf: "flex-start" }}>{tipoLabel[e.tipo]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recepción de materia prima */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Recepción de materia prima — últimos 3 días</h3>
            <div className="card-subtitle">Pesca recibida en planta Mazatlán desde flotas locales</div>
          </div>
        </div>
        <table className="tbl">
          <thead><tr><th>Fecha</th><th>Especie</th><th>Kg recibidos</th><th>Proveedor / Embarcación</th><th>Calidad</th></tr></thead>
          <tbody>
            {CRM_DATA.materiaPrima.map((m, i) => (
              <tr key={i}>
                <td className="mono text-sm">{m.fecha}</td>
                <td className="fw-600">{m.especie}</td>
                <td className="fw-700 mono">{m.kg} kg</td>
                <td>
                  <div>{m.proveedor}</div>
                  <div className="text-xs muted">🚢 {m.embarcacion}</div>
                </td>
                <td><span className={`badge ${m.calidad === "Sashimi" ? "badge-violet" : m.calidad === "A" ? "badge-green" : "badge-amber"}`}>{m.calidad}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

// =====================================================
// LOGÍSTICA
// =====================================================
const DashboardLogistica = ({ company, onSelectSupplier }) => {
  return company.id === "pml" ? <ImportacionesPML onSelectSupplier={onSelectSupplier}/> : <LogisticaMarlin/>;
};

// ---------- IMPORTACIONES · PML ----------
const SUPPLIERS = [
  {
    id: "blufin",
    logoPath: "assets/blufin-logo.png",
    name: "Blufin Seafood",
    origen: "Zapopan, Jalisco · México",
    especies: "Tilapia · Camarón · Productos congelados",
    color: "#0073E6",
    accent: "var(--blue-500)",
    bg: "var(--blue-50)",
    badge: "badge-blue",
    status: "active",
    statusLabel: "Activo"
  },
  {
    id: "camanchaca",
    logoPath: "assets/camanchaca-logo.png",
    name: "Camanchaca",
    origen: "Puerto Montt, Chile · CDMX, México",
    especies: "Salmón Atlántico · SA (Chile, USD) + MX (Pesos)",
    color: "#0EA5A1",
    accent: "#0EA5A1",
    bg: "#E6F8F7",
    badge: "badge-green",
    status: "active",
    statusLabel: "Activo"
  },
  {
    id: "neptuno",
    logoPath: "assets/neptuno-logo.png",
    name: "Neptuno Seafood",
    origen: "Tijuana, Baja California · México",
    especies: "Pez espada · Merluza · Bacalao · Pulpo · Calamar",
    color: "#0EA5A1",
    accent: "#0EA5A1",
    bg: "#F0FDFA",
    badge: "badge-green",
    status: "active",
    statusLabel: "Activo"
  }
];

const ImportacionesPML = ({ onSelectSupplier }) => {
  const wip = SUPPLIERS.filter(s => s.status === "wip");
  const soon = SUPPLIERS.filter(s => s.status === "soon");
  const active = SUPPLIERS.filter(s => s.status === "active");

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Importaciones · PML</h1>
          <p className="page-subtitle">Gestión de contratos, contenedores y movimientos por proveedor internacional</p>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button className="btn btn-outline btn-sm"><Icon name="filter" size={13}/> Filtrar</button>
        </div>
      </div>

      {/* SUPPLIER PICKER */}
      <div style={{ marginBottom: 24 }}>
        <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-500)" }}>Proveedores · {SUPPLIERS.length}</div>
          <div className="hstack" style={{ gap: 14, fontSize: 12, color: "var(--ink-500)" }}>
            <span className="hstack" style={{ gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--green-500)" }}/> {active.length} activo</span>
            <span className="hstack" style={{ gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--ink-300)" }}/> {soon.length} próximamente</span>
          </div>
        </div>

        <div className="grid grid-3" style={{ gap: 16 }}>
          {SUPPLIERS.map(s => {
            const isActive = s.status === "active";
            const isSoon   = s.status === "soon";
            return (
              <div key={s.id}
                onClick={() => isActive && onSelectSupplier && onSelectSupplier(s.id)}
                style={{
                  position: "relative",
                  background: "white",
                  border: isActive ? `1.5px solid ${s.accent}` : "1px solid var(--ink-200)",
                  borderRadius: 16,
                  padding: 22,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  opacity: isSoon ? 0.7 : 1,
                  cursor: isActive ? "pointer" : "default",
                  transition: "all 0.18s",
                  boxShadow: isActive ? "0 2px 12px rgba(0,115,230,0.10)" : "var(--shadow-sm)",
                }}
                onMouseEnter={e => { if (isActive) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,115,230,0.18)"; } }}
                onMouseLeave={e => { if (isActive) { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,115,230,0.10)"; } }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: isActive ? s.accent : "var(--ink-200)" }}/>

                <div className="hstack" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ width: 150, height: 72, borderRadius: 10, background: "white", border: "1px solid var(--ink-100)", display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 12px", overflow: "hidden" }}>
                    <img src={s.logoPath} alt={s.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}/>
                  </div>
                  <span className={`badge ${s.badge}`}>
                    {isActive && <span className="dot"/>}
                    {s.statusLabel}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.015em", marginBottom: 4 }}>{s.name}</div>
                  <div className="text-xs muted hstack" style={{ gap: 6 }}>
                    <Icon name="globe" size={11}/> {s.origen}
                  </div>
                  <div className="text-xs muted" style={{ marginTop: 8, lineHeight: 1.5 }}>{s.especies}</div>
                </div>

                <div style={{ paddingTop: 14, borderTop: "1px solid var(--ink-100)", color: isActive ? s.accent : "var(--ink-400)", fontSize: 12.5, lineHeight: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: isActive ? 600 : 400 }}>
                  {isActive
                    ? <><span>Abrir módulo</span><Icon name="arrowRight" size={13}/></>
                    : <span>Módulo en planeación. Onboarding del proveedor pendiente.</span>
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
const LogisticaMarlin = () => {
  const ordenes = CRM_DATA.ordenesMaquila;
  const embarques = CRM_DATA.embarques.marlin;
  const almacenes = CRM_DATA.almacenes.marlin;
  const mp = CRM_DATA.materiaPrima;

  const totalMP = mp.reduce((s, m) => s + parseInt(m.kg.replace(",", "")), 0);
  const activas = ordenes.filter(o => o.status !== "Terminada");

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Logística · Marlin (Planta)</h1>
          <p className="page-subtitle">Recepción de pesca, producción en piso y embarques hacia PML</p>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <button className="btn btn-outline btn-sm"><Icon name="filter" size={13}/> Filtrar</button>
          <button className="btn btn-primary btn-sm"><Icon name="plus" size={13}/> Nueva orden maquila</button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="kpi"><span className="kpi-label">Órdenes activas</span><span className="kpi-value">{activas.length}</span><span className="text-xs muted">{ordenes.length} totales este mes</span></div>
        <div className="kpi"><span className="kpi-label">Kg en proceso</span><span className="kpi-value">{activas.reduce((s, o) => s + parseInt(o.cantidad.replace(/[,\s]|kg/g, "")), 0).toLocaleString("en")}</span><span className="text-xs muted">piso de planta</span></div>
        <div className="kpi"><span className="kpi-label">Materia prima 3d</span><span className="kpi-value">{(totalMP / 1000).toFixed(1)}t</span><span className="text-xs muted">{mp.length} recepciones</span></div>
        <div className="kpi"><span className="kpi-label">Embarques a PML</span><span className="kpi-value">{embarques.length}</span><span className="text-xs muted">próximo: {fmtDate(embarques[0].eta.split(" ")[0])}</span></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Órdenes de maquila — piso de planta</h3>
            <div className="card-subtitle">Todas destinadas a PML (cliente único)</div>
          </div>
          <span className="badge badge-blue">{activas.length} activas</span>
        </div>
        <table className="tbl">
          <thead><tr><th>Orden</th><th>Producto</th><th>Cantidad</th><th>Avance</th><th>Status</th><th>Entrega</th><th>Destino PML</th></tr></thead>
          <tbody>
            {ordenes.map(o => (
              <tr key={o.id}>
                <td className="mono fw-600">{o.id}</td>
                <td><div className="fw-600">{o.producto}</div><div className="text-xs muted">{o.presentacion}</div></td>
                <td className="fw-700 mono">{o.cantidad}</td>
                <td style={{ minWidth: 140 }}>
                  <div className="progress"><div className="progress-fill" style={{ width: o.avance + "%", background: o.status === "Terminada" ? "var(--green-500)" : o.status === "Empaque" ? "var(--amber-500)" : "var(--blue-500)" }}/></div>
                  <div className="text-xs muted" style={{ marginTop: 4 }}>{o.avance}%</div>
                </td>
                <td><span className={`badge ${o.status === "Terminada" ? "badge-green" : o.status === "Programada" ? "badge-gray" : o.status === "Empaque" ? "badge-amber" : "badge-blue"}`}><span className="dot"/>{o.status}</span></td>
                <td className="fw-600">{fmtDate(o.fechaEntrega)}</td>
                <td className="text-sm">{o.cliente.replace("PML — ", "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Recepción de materia prima</h3><span className="badge badge-gray">Últimos 3 días</span></div>
          <table className="tbl">
            <thead><tr><th>Fecha</th><th>Especie</th><th>Kg</th><th>Embarcación</th><th>Calidad</th></tr></thead>
            <tbody>
              {mp.map((m, i) => (
                <tr key={i}>
                  <td className="mono text-sm">{m.fecha}</td>
                  <td className="fw-600">{m.especie}</td>
                  <td className="fw-700 mono">{m.kg}</td>
                  <td><div className="text-sm">{m.embarcacion}</div><div className="text-xs muted">{m.proveedor}</div></td>
                  <td><span className={`badge ${m.calidad === "Sashimi" ? "badge-violet" : m.calidad === "A" ? "badge-green" : "badge-amber"}`}>{m.calidad}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Cámaras y áreas de planta</h3></div>
          <div style={{ padding: "6px 0" }}>
            {almacenes.map((a, i) => (
              <div key={i} style={{ padding: "14px 20px", borderBottom: i < almacenes.length - 1 ? "1px solid var(--ink-100)" : "none" }}>
                <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                  <div className="fw-600" style={{ fontSize: 13 }}>{a.nombre}</div>
                  <span className="text-xs muted">{a.capacidad}</span>
                </div>
                <div className="text-xs muted" style={{ marginBottom: 8 }}>{a.tipo}</div>
                <div className="progress" style={{ marginBottom: 6 }}>
                  <div className="progress-fill" style={{ width: a.ocupacion + "%", background: a.ocupacion > 75 ? "var(--amber-500)" : "var(--blue-500)" }}/>
                </div>
                <div className="hstack" style={{ justifyContent: "space-between", fontSize: 11 }}>
                  <span className="muted">{a.ocupacion}% ocupación</span>
                  <span><span style={{ color: "var(--green-500)" }}>↓ {a.entradas}</span> <span className="muted">entr.</span> · <span style={{ color: "var(--red-500)" }}>↑ {a.salidas}</span> <span className="muted">sal.</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Embarques hacia PML</h3><span className="badge badge-blue">Cliente único</span></div>
        <table className="tbl">
          <thead><tr><th>ID</th><th>Ruta</th><th>Carga</th><th>ETA</th><th>Status</th></tr></thead>
          <tbody>
            {embarques.map(e => (
              <tr key={e.id}>
                <td className="mono fw-600">{e.id}</td>
                <td><div className="fw-600">{e.ruta}</div><div className="text-xs muted">{e.transportista} · {e.tipo}</div></td>
                <td className="text-sm">{e.carga}</td>
                <td className="text-sm mono">{e.eta}</td>
                <td><span className={`badge ${e.status === "Cargando" ? "badge-amber" : "badge-blue"}`}><span className="dot"/>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

// =====================================================
// ADMINISTRACIÓN
// =====================================================
const DashboardAdmin = ({ company }) => {
  const kpis = CRM_DATA.adminKpis[company.id];
  const bancos = CRM_DATA.bancos[company.id];
  const eventos = CRM_DATA.eventos[company.id];
  const isMarlin = company.id === "marlin";

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Administración · {company.short}</h1>
          <p className="page-subtitle">
            {isMarlin
              ? "Facturación intercompañía a PML, bancos y KPIs de planta"
              : "Estados de cuenta, KPIs corporativos y actividad reciente"}
          </p>
        </div>
        <button className="btn btn-primary btn-sm"><Icon name="download" size={13}/> Reporte mensual</button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} className="kpi">
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-value">{k.value}</span>
            <span className={`kpi-delta ${k.up ? "up" : "down"}`}><Icon name={k.up ? "up" : "down"} size={12}/>{k.delta}</span>
          </div>
        ))}
      </div>

      {isMarlin && (
        <div className="card" style={{ marginBottom: 16, background: "linear-gradient(135deg, #E6F4FF 0%, #F3F9FF 100%)", border: "1px solid #BAE0FF" }}>
          <div className="card-body">
            <div className="hstack" style={{ gap: 16, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "white", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--blue-500)" }}>
                <Icon name="receipt" size={20}/>
              </div>
              <div style={{ flex: 1 }}>
                <div className="fw-700">Facturación intercompañía → PML</div>
                <div className="text-sm muted">Marlin opera 100% como proveedor de PML. Todo ingreso es CxC intercompañía.</div>
              </div>
            </div>
            <div className="grid grid-4">
              <div><div className="text-xs muted">Facturado mes</div><div className="fw-700" style={{ fontSize: 18 }}>$26.8M</div></div>
              <div><div className="text-xs muted">CxC PML (corriente)</div><div className="fw-700" style={{ fontSize: 18 }}>$8.4M</div></div>
              <div><div className="text-xs muted">CxC PML (30+ días)</div><div className="fw-700" style={{ fontSize: 18 }}>$2.1M</div></div>
              <div><div className="text-xs muted">Próximo cobro</div><div className="fw-700" style={{ fontSize: 18 }}>28 abr</div></div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Estados de cuenta bancarios</h3>
            <div className="card-subtitle">Saldos consolidados al cierre del día</div>
          </div>
          <button className="btn btn-outline btn-sm">Conciliar</button>
        </div>
        <table className="tbl">
          <thead><tr><th>Banco</th><th>Cuenta</th><th style={{ textAlign: "right" }}>Saldo disponible</th><th style={{ textAlign: "right" }}>Movimiento 7d</th><th></th></tr></thead>
          <tbody>
            {bancos.map((b, i) => (
              <tr key={i}>
                <td><div className="hstack" style={{ gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--blue-100)", color: "var(--blue-500)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11 }}>{b.banco.slice(0, 2).toUpperCase()}</div><div className="fw-600">{b.banco}</div></div></td>
                <td className="mono text-sm">{b.cuenta}</td>
                <td style={{ textAlign: "right" }} className="fw-700 mono">{b.saldo}</td>
                <td style={{ textAlign: "right" }}><span className={`kpi-delta ${b.mov_up ? "up" : "down"}`} style={{ fontSize: 12 }}><Icon name={b.mov_up ? "up" : "down"} size={11}/>{b.movimiento}</span></td>
                <td style={{ textAlign: "right" }}><button className="btn btn-ghost btn-sm">Ver <Icon name="chevRight" size={12}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">Actividad corporativa reciente</h3></div>
        <div style={{ padding: "4px 0" }}>
          {eventos.slice(0, 5).map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: "12px 20px", borderBottom: i < 4 ? "1px solid var(--ink-100)" : "none", alignItems: "center" }}>
              <div className="timeline-dot"/>
              <div style={{ flex: 1 }}>
                <div className="fw-600 text-sm">{e.titulo}</div>
                <div className="text-xs muted">{e.detalle}</div>
              </div>
              <span className="text-xs muted mono">{e.hora}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// =====================================================
// RH
// =====================================================
const DashboardRH = ({ company }) => {
  const rh = CRM_DATA.rh[company.id];
  const max = Math.max(...rh.porDepartamento.map(d => d.count));

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Recursos Humanos · {company.short}</h1>
          <p className="page-subtitle">Plantilla, movimientos de personal y pendientes</p>
        </div>
        <button className="btn btn-primary btn-sm"><Icon name="plus" size={13}/> Nueva contratación</button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="kpi"><span className="kpi-label">Plantilla total</span><span className="kpi-value">{rh.headcount}</span><span className="text-xs muted">colaboradores activos</span></div>
        <div className="kpi"><span className="kpi-label">Nuevos ingresos (mes)</span><span className="kpi-value">{rh.nuevos}</span><span className="kpi-delta up" style={{ fontSize: 11 }}><Icon name="up" size={11}/>+{rh.nuevos} este mes</span></div>
        <div className="kpi"><span className="kpi-label">Bajas (mes)</span><span className="kpi-value">{rh.bajas}</span><span className="text-xs muted">rotación baja</span></div>
        <div className="kpi"><span className="kpi-label">Pendientes</span><span className="kpi-value">{rh.pendientes.length}</span><span className="text-xs muted">acciones requeridas</span></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Plantilla por departamento</h3><span className="badge badge-gray">{rh.headcount} personas</span></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rh.porDepartamento.map((d, i) => (
              <div key={i}>
                <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span className="fw-600 text-sm">{d.depto}</span>
                  <span className="mono text-sm muted">{d.count}</span>
                </div>
                <div className="progress"><div className="progress-fill" style={{ width: (d.count / max * 100) + "%" }}/></div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Pendientes de RH</h3></div>
          <table className="tbl">
            <tbody>
              {rh.pendientes.map((p, i) => (
                <tr key={i}>
                  <td><div className="fw-600 text-sm">{p.quien}</div><div className="text-xs muted">{p.depto}</div></td>
                  <td><span className="badge badge-blue">{p.tipo}</span></td>
                  <td className="text-xs muted">{p.fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title"><Icon name="cake" size={14}/> Cumpleaños esta semana</h3></div>
        <div className="card-body hstack" style={{ gap: 16, flexWrap: "wrap" }}>
          {rh.cumpleanios.map((c, i) => (
            <div key={i} className="hstack" style={{ gap: 12, padding: "10px 16px", background: "var(--blue-50)", borderRadius: 10, border: "1px solid var(--ink-200)" }}>
              <div className="avatar">{c.nombre.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
              <div>
                <div className="fw-600 text-sm">{c.nombre}</div>
                <div className="text-xs muted">{c.depto} · {c.fecha}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// =====================================================
// PLACEHOLDER — departamentos fase 2 (con contexto de empresa)
// =====================================================
const DashboardPlaceholder = ({ company, dept, label, icon }) => {
  // Mensajes contextuales por empresa+depto
  const context = {
    pml: {
      ventas: "Pipeline de clientes (retail, mayoristas, HORECA, exportación), cotizaciones y pedidos.",
      cobranza: "Cuentas por cobrar de clientes PML, antigüedad de saldos y recordatorios.",
      contabilidad: "CxP a proveedores internacionales, maquila Marlin, CFDI y conciliaciones.",
    },
    marlin: {
      ventas: "Marlin factura exclusivamente a PML. Este módulo gestionará las órdenes de maquila entrantes.",
      cobranza: "Cobranza intercompañía a PML — CxC consolidada y calendario de pago.",
      contabilidad: "Costos de planta, mermas, rendimientos, conciliaciones y CFDI a PML.",
    },
  };
  const msg = context[company.id]?.[dept] || "Este módulo se construirá en la siguiente fase.";

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{label} · {company.short}</h1>
          <p className="page-subtitle">Módulo en construcción</p>
        </div>
      </div>
      <div className="card card-body" style={{ textAlign: "center", padding: 60 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--blue-100)", color: "var(--blue-500)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Icon name={icon} size={28}/>
        </div>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Próximamente: {label}</h3>
        <p className="muted" style={{ maxWidth: 520, margin: "8px auto 0" }}>{msg}</p>
        <div className="hstack" style={{ justifyContent: "center", gap: 8, marginTop: 20 }}>
          <span className="badge badge-blue">Fase 2</span>
          <span className="text-xs muted">Estimado: mayo 2026</span>
        </div>
      </div>
    </>
  );
};

Object.assign(window, { DashboardGeneral, DashboardLogistica, DashboardAdmin, DashboardRH, DashboardPlaceholder });
