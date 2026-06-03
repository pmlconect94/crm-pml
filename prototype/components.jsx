// ============================================
// Shared UI components + icons
// Exports to window so other Babel scripts can use them
// ============================================

// ---------- Icons (lucide-style) ----------
const Icon = ({ name, size = 16, stroke = 1.8 }) => {
  const paths = {
    anchor: <><circle cx="12" cy="5" r="3" /><path d="M12 22V8" /><path d="M5 12H2a10 10 0 0 0 20 0h-3" /></>,
    ship: <><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" /><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" /><path d="M12 10v4" /><path d="M12 2v3" /></>,
    layout: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></>,
    truck: <><path d="M5 18H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v12" /><path d="M15 18H9" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.3a1 1 0 0 0-.3-.7l-3.7-3.7a1 1 0 0 0-.7-.3H15" /></>,
    warehouse: <><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35a2 2 0 0 1 1.26-1.86l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" /><path d="M6 18h12" /><path d="M6 14h12" /><path d="M6 10h12" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    dollar: <><line x1="12" y1="2" x2="12" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
    calc: <><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="16" y1="14" x2="16" y2="18" /><path d="M8 10h.01" /><path d="M12 10h.01" /><path d="M16 10h.01" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /></>,
    sales: <><path d="m3 17 6-6 4 4 8-8" /><path d="M14 7h7v7" /></>,
    receipt: <><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8H8" /><path d="M16 12H8" /><path d="M12 16H8" /></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
    search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    chevDown: <polyline points="6 9 12 15 18 9" />,
    chevRight: <polyline points="9 18 15 12 9 6" />,
    up: <polyline points="18 15 12 9 6 15" />,
    down: <polyline points="6 9 12 15 18 9" />,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
    building: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" /></>,
    gear: <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>,
    pkg: <><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>,
    arrowRight: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
    home: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
    fish: <><path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z" /><path d="M18 12v.5" /><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86" /><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33" /><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4" /><path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    check: <polyline points="20 6 9 17 4 12" />,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
    filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
    briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
    cake: <><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" /><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" /><path d="M2 21h20" /><path d="M7 8v3" /><path d="M12 8v3" /><path d="M17 8v3" /><path d="M7 4h.01" /><path d="M12 4h.01" /><path d="M17 4h.01" /></>,
    globe: <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    alert: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
    snow: <><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" /><path d="m20 16-4-4 4-4" /><path d="m4 8 4 4-4 4" /><path d="m16 4-4 4-4-4" /><path d="m8 20 4-4 4 4" /></>,
    calendar:  <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    chevLeft:  <polyline points="15 18 9 12 15 6" />,
    payments:  <><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
    doc:       <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
    pencil:    <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    compare:   <><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></>
  };
  const d = paths[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {d}
    </svg>);

};

// ---------- Logo (Grupo Lizárraga — original monogram) ----------
const LizarragaLogo = ({ size = 40, color = "white", accent = "#00A3FF" }) => {
  const isDark = color !== "white";
  const bg = isDark ? "#0A2540" : "rgba(255,255,255,0.06)";
  const ring = isDark ? "rgba(10,37,64,0.12)" : "rgba(255,255,255,0.18)";
  const ink = isDark ? "#0A2540" : "#FFFFFF";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      {/* outer diamond */}
      <rect x="4" y="4" width="40" height="40" rx="10" fill={bg} stroke={ring} strokeWidth="1" />
      {/* horizon line */}
      <line x1="10" y1="30" x2="38" y2="30" stroke={accent} strokeWidth="1.2" opacity="0.7" />
      {/* stylized "L" monogram with a wave tail */}
      <path d="M17 14 L17 30 L30 30" stroke={ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* subtle wave under */}
      <path d="M10 35c3-2 6-2 9 0s6 2 9 0 6-2 10 0" stroke={accent} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* accent dot */}
      <circle cx="33" cy="16" r="2" fill={accent} />
    </svg>);

};

// ---------- Company crest (uses real brand logos) ----------
const CompanyCrest = ({ company, size = 56, variant = "card" }) => {
  const isPML = company.id === "pml";
  const src = isPML ? "assets/pml-logo.png" : "assets/marlin-logo.png";
  // Marlin logo has a slightly taller aspect; pad differently
  const padding = isPML ? size * 0.08 : size * 0.06;
  const bg = variant === "sidebar" ?
  "#FFFFFF" :
  isPML ? "#FFFFFF" : "#0A2540";
  const border = variant === "sidebar" ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(10,37,64,0.08)";
  return (
    <div style={{
      width: size, height: size, borderRadius: 12,
      background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden",
      border,
      boxShadow: variant === "card" ? "0 1px 2px rgba(10,37,64,0.06)" : "none",
      flexShrink: 0, fontWeight: "500"
    }}>
      <img
        src={src}
        alt={company.name}
        style={{ ...{
            width: `calc(100% - ${padding * 2}px)`,
            height: `calc(100% - ${padding * 2}px)`,
            objectFit: "contain"
          }, height: "100px" }} />
      
    </div>);

};

// ---------- Dept list used in sidebar ----------
const DEPTS = [
{ id: "dashboard", label: "Dashboard", icon: "layout", always: true },
{ id: "logistica",      label: "Importaciones",  icon: "ship"      },
{ id: "logistica_dept", label: "Logística",       icon: "truck", soon: true },
{ id: "administracion", label: "Administración",  icon: "briefcase", soon: true },
{ id: "ventas", label: "Ventas", icon: "sales", soon: true },
{ id: "cobranza", label: "Cobranza", icon: "dollar", soon: true },
{ id: "contabilidad", label: "Contabilidad", icon: "calc", soon: true },
{ id: "rh", label: "Recursos Humanos", icon: "users", soon: true }];


const IMPORT_SUPPLIERS = [
{ id: "blufin",     label: "Blufin Seafood",     status: "active" },
{ id: "camanchaca", label: "Salmones Camanchaca", status: "active" },
{ id: "neptuno",    label: "Neptuno Seafood",     status: "active"  }];


// ---------- Sidebar ----------
const Sidebar = ({ company, activeDept, setActiveDept, activeSupplier, setActiveSupplier, onSwitchCompany, onLogout, allowedDepts }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand" style={{ cursor: "pointer" }} onClick={onSwitchCompany}>
        <CompanyCrest company={company} size={36} variant="sidebar" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600, letterSpacing: "0.04em" }}>EMPRESA ACTIVA</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {company.short === "PML" ? "Productos Marinos" : "Marlin Lizárraga"}
          </div>
        </div>
        <Icon name="chevDown" size={14} />
      </div>

      <div className="sidebar-section-label">General</div>
      {DEPTS.filter((d) => d.always).map((d) =>
      <div key={d.id} className={`nav-item ${activeDept === d.id ? "active" : ""}`} onClick={() => setActiveDept(d.id)}>
          <Icon name={d.icon} size={16} /> {d.label}
        </div>
      )}

      <div className="sidebar-section-label">Departamentos</div>
      {DEPTS.filter((d) => !d.always).map((d) => {
        const allowed = allowedDepts.includes(d.id) && !d.soon;
        const isSoon = d.soon;
        const isActive = activeDept === d.id;
        return (
          <React.Fragment key={d.id}>
            <div
              className={`nav-item ${isActive ? "active" : ""}`}
              style={{ opacity: isSoon ? 0.55 : allowed ? 1 : 0.35, cursor: allowed ? "pointer" : "not-allowed" }}
              onClick={() => allowed && setActiveDept(d.id)}
              title={isSoon ? "Próximamente" : allowed ? "" : "Sin acceso para este rol"}>
              
              <Icon name={d.icon} size={16} /> {d.label}
              {isSoon && <span style={{ marginLeft: "auto", fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: "0.06em" }}>PRÓX.</span>}
              {!isSoon && !allowed && <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.8 }}>🔒</span>}
            </div>
            {d.id === "logistica" && isActive &&
            <div style={{ paddingLeft: 28, paddingTop: 2, paddingBottom: 4 }}>
                {IMPORT_SUPPLIERS.map((sup) => {
                  const isActiveSup = activeSupplier === sup.id;
                  const isClickable = sup.status === "active";
                  return (
              <div key={sup.id}
              className="nav-sub"
              onClick={() => isClickable && setActiveSupplier(sup.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px 6px 16px",
                fontSize: 12,
                color: isActiveSup ? "white" : isClickable ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)",
                borderLeft: isActiveSup ? "2px solid var(--cyan-500)" : "1px solid rgba(255,255,255,0.08)",
                background: isActiveSup ? "rgba(0, 163, 255, 0.08)" : "transparent",
                cursor: isClickable ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
                fontWeight: isActiveSup ? 600 : 500,
                transition: "all 0.15s"
              }}
              title={sup.status === "active" ? "" : "Próximamente"}>
                
                    <span style={{ width: 5, height: 5, borderRadius: 999, background: sup.status === "active" ? "var(--green-500, #10B981)" : "rgba(255,255,255,0.25)" }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{sup.label}</span>
                    {sup.status !== "active" && <span style={{ fontSize: 8.5, padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: "0.06em" }}>
                      PRÓX.
                    </span>}
                  </div>
                  );
                })}
              </div>
            }
          </React.Fragment>);

      })}

      <div style={{ flex: 1 }} />

      <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <button className="nav-item" style={{ width: "100%", justifyContent: "flex-start", padding: "8px 4px", borderLeft: "none" }} onClick={onLogout}>
          <Icon name="logout" size={15} /> Cerrar sesión
        </button>
      </div>
    </aside>);

};

// ---------- Topbar ----------
const Topbar = ({ user, company, activeDeptLabel, onOpenSwitcher }) =>
<header className="topbar">
    <div className="hstack" style={{ gap: 12 }}>
      <div style={{ fontSize: 13, color: "var(--ink-500)" }}>{company.name}</div>
      <Icon name="chevRight" size={12} />
      <div style={{ fontSize: 13, fontWeight: 600 }}>{activeDeptLabel}</div>
    </div>
    <div className="hstack" style={{ gap: 16 }}>
      <div className="search-box">
        <Icon name="search" size={14} />
        <input placeholder="Buscar contenedores, facturas, clientes…" />
        <kbd style={{ fontSize: 10, color: "var(--ink-400)", background: "white", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--ink-200)" }}>⌘ K</kbd>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onOpenSwitcher}>
        <Icon name="building" size={14} /> Cambiar empresa
      </button>
      <div style={{ position: "relative" }}>
        <Icon name="bell" size={18} />
        <span style={{ position: "absolute", top: -4, right: -6, background: "var(--red-500)", color: "white", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 999 }}>4</span>
      </div>
      <div className="hstack" style={{ gap: 10 }}>
        <div className="avatar" style={{ background: "var(--navy-900)", color: "white" }}>{user.initials}</div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
          <div style={{ fontSize: 11, color: "var(--ink-500)" }}>{user.email}</div>
        </div>
      </div>
    </div>
  </header>;


// Export
Object.assign(window, { Icon, LizarragaLogo, CompanyCrest, Sidebar, Topbar, DEPTS });