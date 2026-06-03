// ============================================================
// Calendario de Importaciones — Vista principal
// ============================================================

const { useState: useStateCAL, useMemo: useMemoCAL, useRef: useRefCAL } = React;
const { Icon: IconCAL } = window;

const STATUS_TRANSP = {
  contratada:   { bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF", label: "Contratado"  },
  transito:     { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6", label: "En tránsito" },
  por_liquidar: { bg: "#D1FAE5", text: "#065F46", dot: "#059669", label: "Entregado"   },
  liquidada:    { bg: "#D1FAE5", text: "#065F46", dot: "#059669", label: "Entregado"   },
};

const STATUS_PAGO = {
  contratada:   { bg: "#F3F4F6", text: "#6B7280", label: "Sin iniciar"    },
  transito_ok:  { bg: "#EFF6FF", text: "#1E40AF", label: "Anticipo pag."  },
  transito_pdt: { bg: "#FEF3C7", text: "#92400E", label: "Pendiente"      },
  por_liquidar: { bg: "#FEF3C7", text: "#92400E", label: "Por liquidar"   },
  liquidada:    { bg: "#D1FAE5", text: "#065F46", label: "Liquidado"      },
};

const getTransp = (c) => STATUS_TRANSP[c.status] || STATUS_TRANSP.contratada;
const getPago   = (c) => {
  if (c.status === "transito")
    return c.anticipoPagado > 0 ? STATUS_PAGO.transito_ok : STATUS_PAGO.transito_pdt;
  return STATUS_PAGO[c.status] || STATUS_PAGO.contratada;
};

const MESES_CAL    = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_CAL     = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const HOY_CAL      = "2026-05-23";

const addDaysCAL = (ds, n) => {
  const d = new Date(ds + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};

const fmtDateCAL = (ds) => {
  if (!ds) return "—";
  const [y, m, d] = ds.split("-").map(Number);
  return `${String(d).padStart(2,"0")} ${MESES_CAL[m-1].slice(0,3)} ${y}`;
};

const fmtMoneyCAL = (n) =>
  n == null ? "—" : "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const calDays = (year, month) => {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const startDow = (first.getDay() + 6) % 7;
  const days = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
};

const downloadICS = (c) => {
  const d = c.etaPuerto.replace(/-/g, "");
  const ics = [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Grupo Lizárraga//CRM//ES",
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${d}`,
    `SUMMARY:ETA Puerto — ${c.lote}: ${c.producto.substring(0,50)}`,
    `DESCRIPTION:Contrato: ${c.contrato}\\nContenedor: ${c.contenedor||"—"}\\nNaviera: ${c.naviera||"—"}\\nSaldo: ${fmtMoneyCAL(c.saldoPendiente)}`,
    "END:VEVENT","END:VCALENDAR"
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `${c.lote}.ics` });
  a.click(); URL.revokeObjectURL(url);
};

// ── Detail Modal ──────────────────────────────────────────────────────────────

const CalDetailModal = ({ c, onClose }) => {
  if (!c) return null;
  const trSt = getTransp(c);
  const pgSt = getPago(c);
  const etaBodega = addDaysCAL(c.etaPuerto, 7);
  const navLink = (window.CALENDARIO_NAVIERA_LINKS || {})[c.naviera];

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(10,37,64,0.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20, zIndex:2000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:"white", borderRadius:16, maxWidth:560, width:"100%", overflow:"hidden", boxShadow:"0 24px 48px rgba(10,37,64,0.28)" }}>

        {/* Header */}
        <div style={{ padding:"18px 22px 14px", borderBottom:"1px solid var(--ink-200)", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div className="hstack" style={{ gap:7, marginBottom:5, flexWrap:"wrap" }}>
              <span className="mono fw-800" style={{ fontSize:16 }}>{c.lote}</span>
              <span style={{ padding:"3px 9px", borderRadius:999, background:trSt.bg, color:trSt.text, fontSize:11, fontWeight:700 }}>🚚 {trSt.label}</span>
              <span style={{ padding:"3px 9px", borderRadius:999, background:pgSt.bg, color:pgSt.text, fontSize:11, fontWeight:700 }}>💳 {pgSt.label}</span>
              {c.cambio && <span style={{ padding:"3px 9px", borderRadius:999, background:"#FEF3C7", color:"#92400E", fontSize:11, fontWeight:700 }}>⚡ ETA cambió</span>}
            </div>
            <div className="text-sm muted">{c.contrato}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:19, color:"var(--ink-400)", cursor:"pointer", lineHeight:1, padding:"0 2px" }}>✕</button>
        </div>

        <div style={{ padding:"16px 22px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* Contenido del contenedor */}
          {(() => {
            const det = (window.BLUFIN_DATA?.contratos || []).find(ct => ct.folio === c.contrato)
                     || (window.BLUFIN_DATA?.contratosExtraidos || []).find(ct => ct.folio === c.contrato);
            const prods = det?.productos;
            return (
              <div>
                <div className="text-xs muted" style={{ marginBottom:6, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>
                  Contenido del contenedor
                </div>
                {prods?.length > 0 ? (
                  <div style={{ border:"1px solid var(--ink-200)", borderRadius:8, overflow:"hidden" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 60px 110px 70px", background:"var(--ink-50)", borderBottom:"1px solid var(--ink-200)" }}>
                      {["Descripción / Marca","Talla","Kilogramos","Cajas"].map((h,i) => (
                        <div key={i} style={{ padding:"6px 10px", fontSize:10, fontWeight:700, color:"var(--ink-500)", letterSpacing:"0.05em", textTransform:"uppercase", textAlign:i>1?"right":"left" }}>{h}</div>
                      ))}
                    </div>
                    {prods.map((p,i) => (
                      <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 60px 110px 70px", borderBottom:i<prods.length-1?"1px solid var(--ink-100)":"none", background:"white" }}>
                        <div style={{ padding:"8px 10px" }}>
                          <div className="text-sm fw-600">{p.desc}</div>
                          <div className="text-xs muted">{p.marca}{p.pct?" · "+p.pct:""}</div>
                        </div>
                        <div className="mono text-sm" style={{ padding:"8px 10px", display:"flex", alignItems:"center" }}>{p.talla||"—"}</div>
                        <div className="mono fw-700 text-sm" style={{ padding:"8px 10px", display:"flex", alignItems:"center", justifyContent:"flex-end", color:"var(--blue-500)" }}>
                          {p.kg ? p.kg.toLocaleString("es-MX")+" kg" : "—"}
                        </div>
                        <div className="mono text-sm muted" style={{ padding:"8px 10px", display:"flex", alignItems:"center", justifyContent:"flex-end" }}>
                          {p.cajas ? p.cajas.toLocaleString("es-MX") : "—"}
                        </div>
                      </div>
                    ))}
                    {det.totalKg && (
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 60px 110px 70px", background:"var(--ink-50)", borderTop:"2px solid var(--ink-200)" }}>
                        <div style={{ padding:"7px 10px" }} className="fw-700 text-sm">Total</div>
                        <div />
                        <div className="mono fw-800 text-sm" style={{ padding:"7px 10px", textAlign:"right", color:"var(--ink-900)" }}>{det.totalKg.toLocaleString("es-MX")} kg</div>
                        <div />
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ border:"1px solid var(--ink-200)", borderRadius:8, overflow:"hidden" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 60px 110px 70px", background:"var(--ink-50)", borderBottom:"1px solid var(--ink-200)" }}>
                      {["Descripción / Marca","Talla","Kilogramos","Cajas"].map((h,i) => (
                        <div key={i} style={{ padding:"6px 10px", fontSize:10, fontWeight:700, color:"var(--ink-500)", letterSpacing:"0.05em", textTransform:"uppercase", textAlign:i>1?"right":"left" }}>{h}</div>
                      ))}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 60px 110px 70px", background:"white" }}>
                      <div style={{ padding:"10px 10px" }}>
                        <div className="text-sm fw-600">{c.producto}</div>
                        <div className="text-xs muted">{c.marca}</div>
                      </div>
                      <div className="mono text-sm muted" style={{ padding:"10px 10px", display:"flex", alignItems:"center" }}>—</div>
                      <div className="mono fw-700 text-sm" style={{ padding:"10px 10px", display:"flex", alignItems:"center", justifyContent:"flex-end", color: det?.totalKg ? "var(--blue-500)" : "var(--ink-400)" }}>
                        {det?.totalKg ? det.totalKg.toLocaleString("es-MX")+" kg" : "—"}
                      </div>
                      <div className="mono text-sm muted" style={{ padding:"10px 10px", display:"flex", alignItems:"center", justifyContent:"flex-end" }}>—</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Fechas */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {[
              { label:"ETA Puerto",      value: fmtDateCAL(c.etaPuerto), color:"var(--blue-500)" },
              { label:"ETA Bodega (+7d)", value: fmtDateCAL(etaBodega),  color:"#059669" },
              { label:"Fecha de pago",   value: fmtDateCAL(c.fechaPago), color: c.fechaPago ? "#D97706" : "var(--ink-400)" },
            ].map((item,i) => (
              <div key={i} style={{ padding:"10px 12px", borderRadius:8, background:"var(--ink-50)", border:"1px solid var(--ink-200)" }}>
                <div className="text-xs muted" style={{ marginBottom:2 }}>{item.label}</div>
                <div className="mono fw-700" style={{ fontSize:12, color:item.color }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Contenedor + Naviera */}
          {(c.contenedor || c.naviera) && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div style={{ padding:"10px 12px", borderRadius:8, background:"var(--ink-50)", border:"1px solid var(--ink-200)" }}>
                <div className="text-xs muted" style={{ marginBottom:2 }}>Contenedor</div>
                <div className="mono fw-700" style={{ fontSize:13 }}>{c.contenedor || "—"}</div>
              </div>
              <div style={{ padding:"10px 12px", borderRadius:8, background:"var(--ink-50)", border:"1px solid var(--ink-200)" }}>
                <div className="text-xs muted" style={{ marginBottom:2 }}>Naviera</div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span className="fw-700" style={{ fontSize:13 }}>{c.naviera || "—"}</span>
                  {navLink && (
                    <a href={navLink} target="_blank" rel="noopener" style={{ fontSize:11, color:"var(--blue-500)", fontWeight:700, textDecoration:"none" }}>
                      Rastrear ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Factura + crédito */}
          <div className="hstack" style={{ gap:7, flexWrap:"wrap" }}>
            {c.factura
              ? <span style={{ padding:"3px 10px", borderRadius:999, background:"#EFF6FF", color:"#1E40AF", fontSize:11, fontWeight:700 }}>Factura: {c.factura}</span>
              : <span style={{ padding:"3px 10px", borderRadius:999, background:"var(--ink-100)", color:"var(--ink-500)", fontSize:11, fontWeight:600 }}>S/Factura</span>
            }
            {c.credito && <span style={{ padding:"3px 10px", borderRadius:999, background:"#D1FAE5", color:"#065F46", fontSize:11, fontWeight:700 }}>Crédito ✓</span>}
          </div>
        </div>

        <div style={{ padding:"12px 22px", borderTop:"1px solid var(--ink-200)", background:"var(--ink-50)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => downloadICS(c)}>
            <IconCAL name="download" size={13} /> Guardar en calendario (.ics)
          </button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
};

// ── Month Grid ────────────────────────────────────────────────────────────────

const CalMonthGrid = ({ year, month, byDate, onSelect }) => {
  const days = useMemoCAL(() => calDays(year, month), [year, month]);
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:4 }}>
        {DIAS_CAL.map(d => (
          <div key={d} style={{ textAlign:"center", fontSize:11, fontWeight:700, color:"var(--ink-400)", padding:"4px 0", letterSpacing:"0.05em" }}>{d}</div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
        {days.map((day, i) => {
          if (!day) return <div key={`e${i}`} style={{ minHeight:96 }} />;
          const key = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const items = byDate[key] || [];
          const isToday = key === HOY_CAL;
          const show = items.slice(0, 3);
          const overflow = items.length - 3;
          return (
            <div key={key} style={{
              minHeight:96, borderRadius:8, padding:"6px 6px 5px",
              background: items.length > 0 ? "white" : "#FAFBFC",
              border: isToday ? "2px solid var(--blue-500)" : items.length > 0 ? "1px solid var(--ink-200)" : "1px solid transparent",
              boxShadow: items.length > 0 ? "0 1px 4px rgba(10,37,64,0.06)" : "none",
            }}>
              <div style={{
                width:22, height:22, borderRadius:999, marginBottom:4,
                display:"flex", alignItems:"center", justifyContent:"center",
                background: isToday ? "var(--blue-500)" : "transparent",
                fontSize:12, fontWeight: isToday ? 800 : items.length > 0 ? 700 : 400,
                color: isToday ? "white" : items.length > 0 ? "var(--ink-900)" : "var(--ink-400)",
              }}>{day}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                {show.map((c, ci) => {
                  const trSt = getTransp(c);
                  return (
                    <div key={ci} onClick={() => onSelect(c)} title={`${c.lote} · ${c.producto}`}
                      style={{ padding:"2px 6px", borderRadius:5, cursor:"pointer", background:trSt.bg, color:trSt.text, fontSize:10, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", lineHeight:1.5 }}
                      onMouseEnter={e => e.currentTarget.style.opacity="0.7"}
                      onMouseLeave={e => e.currentTarget.style.opacity="1"}>
                      {c.cambio ? "⚡" : ""}{c.lote}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <div style={{ fontSize:10, color:"var(--blue-500)", fontWeight:700, paddingLeft:4, cursor:"pointer" }}>+{overflow} más</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── List View ─────────────────────────────────────────────────────────────────

const CalListView = ({ items, onSelect }) => {
  const grouped = useMemoCAL(() => {
    const sorted = [...items].sort((a,b) => a.etaPuerto.localeCompare(b.etaPuerto));
    const groups = [];
    sorted.forEach(c => {
      const d  = new Date(c.etaPuerto + "T12:00:00");
      const mo = new Date(d); mo.setDate(d.getDate() - ((d.getDay()+6)%7));
      const key   = mo.toISOString().split("T")[0];
      const label = `Semana del ${String(mo.getDate()).padStart(2,"0")} ${MESES_CAL[mo.getMonth()].slice(0,3)} ${mo.getFullYear()}`;
      let g = groups.find(x => x.key === key);
      if (!g) { g = { key, label, items:[] }; groups.push(g); }
      g.items.push(c);
    });
    return groups;
  }, [items]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {grouped.map(g => (
        <div key={g.key}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--ink-500)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8, paddingBottom:6, borderBottom:"1px solid var(--ink-200)" }}>
            {g.label} <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0 }}>· {g.items.length} contenedor{g.items.length!==1?"es":""}</span>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Lote</th><th>ETA Puerto</th><th>ETA Bodega</th><th>Producto</th>
                <th>Marca</th><th>Contenedor</th><th>Naviera</th>
                <th>Transporte</th><th>Pago</th>
              </tr>
            </thead>
            <tbody>
              {g.items.map(c => {
                const trSt = getTransp(c);
                const pgSt = getPago(c);
                const navLink = (window.CALENDARIO_NAVIERA_LINKS||{})[c.naviera];
                return (
                  <tr key={c.contrato} style={{ cursor:"pointer" }} onClick={() => onSelect(c)}
                    onMouseEnter={e => e.currentTarget.style.background="#F3F9FF"}
                    onMouseLeave={e => e.currentTarget.style.background=""}>
                    <td className="mono fw-700" style={{ color: c.cambio ? "#D97706" : "var(--ink-900)" }}>
                      {c.cambio ? "⚡ " : ""}{c.lote}
                    </td>
                    <td className="mono text-sm">{fmtDateCAL(c.etaPuerto)}</td>
                    <td className="mono text-sm" style={{ color:"#059669" }}>{fmtDateCAL(addDaysCAL(c.etaPuerto,7))}</td>
                    <td className="text-sm fw-600" style={{ maxWidth:170, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.producto}</td>
                    <td><span className="badge badge-gray" style={{ fontSize:10 }}>{c.marca}</span></td>
                    <td className="mono text-xs">{c.contenedor || <span className="muted">—</span>}</td>
                    <td>
                      {c.naviera
                        ? navLink
                          ? <a href={navLink} target="_blank" rel="noopener" style={{ color:"var(--blue-500)", fontWeight:700, fontSize:12, textDecoration:"none" }} onClick={e=>e.stopPropagation()}>{c.naviera} ↗</a>
                          : <span className="text-sm fw-600">{c.naviera}</span>
                        : <span className="muted text-xs">—</span>}
                    </td>
                    <td>
                      <span style={{ padding:"2px 8px", borderRadius:999, background:trSt.bg, color:trSt.text, fontSize:10, fontWeight:700 }}>{trSt.label}</span>
                    </td>
                    <td>
                      <span style={{ padding:"2px 8px", borderRadius:999, background:pgSt.bg, color:pgSt.text, fontSize:10, fontWeight:700 }}>{pgSt.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

// ── Main Module ───────────────────────────────────────────────────────────────

const CalendarioModule = () => {
  const [view,     setView]     = useStateCAL("cal");
  const [bodega,   setBodega]   = useStateCAL(false);
  const [year,     setYear]     = useStateCAL(2026);
  const [month,    setMonth]    = useStateCAL(4); // May=4
  const [selected, setSelected] = useStateCAL(null);
  const [dismissed, setDismissed] = useStateCAL(false);
  const [uploading, setUploading] = useStateCAL(false);
  const [search,   setSearch]   = useStateCAL("");
  const [tagMarca, setTagMarca] = useStateCAL("");
  const fileRef = useRefCAL();

  const contenedores = window.CALENDARIO_CONTENEDORES || [];
  const cambios      = window.CALENDARIO_CAMBIOS || [];
  const ultimaAct    = window.CALENDARIO_ULTIMA_ACT;

  // Marcas únicas para chips de filtro rápido
  const marcasUnicas = useMemoCAL(() => {
    const set = new Set();
    contenedores.forEach(c => { if (c.marca) set.add(c.marca.split("/")[0].trim()); });
    return [...set].sort();
  }, [contenedores]);

  // Contenedores filtrados por búsqueda + tag de marca
  const filtrados = useMemoCAL(() => {
    const q   = search.trim().toLowerCase();
    const tag = tagMarca.toLowerCase();
    return contenedores.filter(c => {
      if (tag && !c.marca.toLowerCase().includes(tag)) return false;
      if (!q) return true;
      return (
        c.producto.toLowerCase().includes(q) ||
        c.marca.toLowerCase().includes(q) ||
        (c.contenedor||"").toLowerCase().includes(q) ||
        c.lote.toLowerCase().includes(q) ||
        c.contrato.toLowerCase().includes(q) ||
        (c.naviera||"").toLowerCase().includes(q)
      );
    });
  }, [search, tagMarca, contenedores]);

  const byDate = useMemoCAL(() => {
    const map = {};
    filtrados.forEach(c => {
      const key = bodega ? addDaysCAL(c.etaPuerto, 7) : c.etaPuerto;
      (map[key] = map[key] || []).push(c);
    });
    return map;
  }, [bodega, filtrados]);

  const kpis = useMemoCAL(() => {
    const weekEnd = addDaysCAL(HOY_CAL, 7);
    const twoWeekEnd = addDaysCAL(HOY_CAL, 14);
    const enTransito = filtrados.filter(c => c.status === "transito").length;
    const estaSemana = filtrados.filter(c => c.etaPuerto >= HOY_CAL && c.etaPuerto <= weekEnd).length;
    const proxSemana = filtrados.filter(c => c.etaPuerto > weekEnd && c.etaPuerto <= twoWeekEnd).length;
    return [
      { label:"En tránsito",      value: String(enTransito),         sub:"contenedores activos", accent:"blue"  },
      { label:"Esta semana",      value: String(estaSemana),         sub:"próximos 7 días",       accent:"amber" },
      { label:"Próxima semana",   value: String(proxSemana),         sub:"días 8–14",             accent:null    },
      { label:"Total en periodo", value: String(filtrados.length), sub: (search||tagMarca) ? "con filtro aplicado" : "contenedores cargados", accent:null    },
    ];
  }, [filtrados, search, tagMarca]);

  const prevMonth = () => { if (month===0) { setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===11) { setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1); };

  const handleUpload = () => {
    fileRef.current.click();
  };
  const onFileChosen = () => {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setDismissed(false); // re-show changes alert
      alert("✓ PDF procesado — 2 cambios de ETA detectados vs. versión anterior.");
    }, 1600);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div>
          <h2 style={{ margin:0, fontSize:20, fontWeight:800, letterSpacing:"-0.015em" }}>Calendario de Importaciones</h2>
          <div className="text-sm muted" style={{ marginTop:3 }}>
            Última actualización: <span className="fw-600">{fmtDateCAL(ultimaAct)}</span>
            <span style={{ margin:"0 8px", color:"var(--ink-300)" }}>·</span>
            Se actualiza martes y viernes
          </div>
        </div>
        <div className="hstack" style={{ gap:8 }}>
          {/* Cal / Lista toggle */}
          <div className="hstack" style={{ background:"var(--ink-100)", borderRadius:8, padding:3, gap:2 }}>
            {[{id:"cal",label:"📅 Calendario"},{id:"lista",label:"☰ Lista"}].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{
                padding:"5px 14px", borderRadius:6, fontSize:12, fontWeight:600, border:"none", cursor:"pointer",
                background: view===v.id ? "white" : "transparent",
                color: view===v.id ? "var(--ink-900)" : "var(--ink-500)",
                boxShadow: view===v.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition:"all 0.15s"
              }}>{v.label}</button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept=".pdf" style={{ display:"none" }} onChange={onFileChosen} />
          <button className="btn btn-outline btn-sm" onClick={handleUpload} disabled={uploading}>
            {uploading
              ? <><span style={{ display:"inline-block", animation:"spin 0.8s linear infinite", marginRight:4 }}>⟳</span> Procesando…</>
              : <><IconCAL name="download" size={13} style={{ transform:"rotate(180deg)" }} /> Actualizar PDF</>
            }
          </button>
        </div>
      </div>

      {/* Changes alert */}
      {!dismissed && cambios.length > 0 && (
        <div style={{ marginBottom:16, padding:"12px 16px", borderRadius:10, background:"#FEF3C7", border:"1px solid #FDE68A", display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
          <div>
            <div className="fw-700 text-sm" style={{ color:"#92400E", marginBottom:5 }}>
              ⚡ {cambios.length} cambios detectados vs. versión anterior
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {cambios.map((c,i) => (
                <span key={i} style={{ padding:"2px 9px", borderRadius:999, background:"white", border:"1px solid #FDE68A", fontSize:11, fontWeight:600, color:"#92400E" }}>
                  <span className="mono">{c.lote}</span>: {c.campo} {fmtDateCAL(c.anterior)} → {fmtDateCAL(c.nuevo)}
                </span>
              ))}
            </div>
          </div>
          <button onClick={() => setDismissed(true)} style={{ background:"none", border:"none", color:"#92400E", fontSize:17, cursor:"pointer", flexShrink:0, lineHeight:1 }}>✕</button>
        </div>
      )}

      {/* Barra de búsqueda + filtros de marca */}
      <div className="card" style={{ padding:"12px 16px", marginBottom:16 }}>
        {/* Búsqueda libre */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: marcasUnicas.length > 0 ? 10 : 0 }}>
          <div style={{ flex:1, display:"flex", alignItems:"center", gap:8, padding:"7px 12px", background:"var(--ink-50)", border:"1px solid var(--ink-200)", borderRadius:8 }}>
            <IconCAL name="search" size={14} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por producto, marca, contenedor, naviera…"
              style={{ border:"none", outline:"none", background:"transparent", flex:1, fontSize:13, color:"var(--ink-900)" }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ background:"none", border:"none", color:"var(--ink-400)", cursor:"pointer", fontSize:15, lineHeight:1, padding:"0 2px" }}>✕</button>
            )}
          </div>
          {(search || tagMarca) && (
            <div style={{ fontSize:12, color:"var(--ink-500)", whiteSpace:"nowrap" }}>
              <span className="fw-700" style={{ color: filtrados.length > 0 ? "var(--blue-500)" : "#DC2626" }}>{filtrados.length}</span> resultado{filtrados.length !== 1 ? "s" : ""}
              {" "}de {contenedores.length}
              <button onClick={() => { setSearch(""); setTagMarca(""); }} style={{ marginLeft:8, fontSize:11, color:"var(--blue-500)", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>Limpiar</button>
            </div>
          )}
        </div>

        {/* Chips de marca rápida */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {marcasUnicas.map(m => {
            const active = tagMarca === m.toLowerCase();
            return (
              <button key={m} onClick={() => setTagMarca(active ? "" : m.toLowerCase())}
                style={{ padding:"4px 11px", borderRadius:999, fontSize:11, fontWeight:600, cursor:"pointer", border:"1px solid " + (active ? "var(--blue-500)" : "var(--ink-200)"), background: active ? "var(--blue-500)" : "white", color: active ? "white" : "var(--ink-700)", transition:"all 0.15s" }}>
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-4" style={{ marginBottom:16 }}>
        {kpis.map((k,i) => (
          <div key={i} className="kpi" style={{
            background: k.accent==="blue" ? "linear-gradient(135deg,#EFF6FF,#DBEAFE)" : k.accent==="amber" ? "linear-gradient(135deg,#FFFBEB,#FEF3C7)" : undefined,
            borderColor: k.accent==="blue" ? "#BFDBFE" : k.accent==="amber" ? "#FDE68A" : undefined,
          }}>
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-value" style={{ fontSize: i===3 ? 15 : undefined }}>{k.value}</span>
            <span className="text-xs muted" style={{ marginTop:2 }}>{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Calendar view */}
      {view === "cal" && (
        <div className="card" style={{ padding:"16px 18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div className="hstack" style={{ gap:10 }}>
              <button onClick={prevMonth} className="btn btn-ghost btn-sm" style={{ padding:"4px 10px", fontSize:16 }}>‹</button>
              <h3 style={{ margin:0, fontSize:18, fontWeight:800, letterSpacing:"-0.01em", minWidth:170, textAlign:"center" }}>
                {MESES_CAL[month]} {year}
              </h3>
              <button onClick={nextMonth} className="btn btn-ghost btn-sm" style={{ padding:"4px 10px", fontSize:16 }}>›</button>
            </div>

            <div className="hstack" style={{ gap:14, alignItems:"center" }}>
              {/* Puerto / Bodega toggle */}
              <div className="hstack" style={{ gap:6, alignItems:"center" }}>
                <span className="text-xs muted">Mostrar fecha de:</span>
                <div className="hstack" style={{ background:"var(--ink-100)", borderRadius:6, padding:2, gap:1 }}>
                  {[{v:false,l:"Puerto"},{v:true,l:"Bodega (+7d)"}].map(opt => (
                    <button key={String(opt.v)} onClick={() => setBodega(opt.v)} style={{
                      padding:"4px 10px", borderRadius:5, fontSize:11, fontWeight:600, border:"none", cursor:"pointer",
                      background: bodega===opt.v ? "white" : "transparent",
                      color: bodega===opt.v ? "var(--ink-900)" : "var(--ink-500)",
                      boxShadow: bodega===opt.v ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                    }}>{opt.l}</button>
                  ))}
                </div>
              </div>
              {/* Legend — transport statuses only */}
              <div className="hstack" style={{ gap:10 }}>
                {Object.entries(STATUS_TRANSP).filter(([k]) => k !== "liquidada").map(([k,v]) => (
                  <div key={k} className="hstack" style={{ gap:5 }}>
                    <div style={{ width:8, height:8, borderRadius:999, background:v.dot, flexShrink:0 }} />
                    <span style={{ fontSize:10.5, color:"var(--ink-600)", fontWeight:600 }}>{v.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <CalMonthGrid year={year} month={month} byDate={byDate} onSelect={setSelected} />
        </div>
      )}

      {/* List view */}
      {view === "lista" && (
        <CalListView items={filtrados} onSelect={setSelected} />
      )}

      <CalDetailModal c={selected} onClose={() => setSelected(null)} />

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </div>
  );
};

Object.assign(window, { CalendarioModule });
