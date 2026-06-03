// ============================================================
// Camanchaca — Calendario
// Sub-tabs: Calendario (cuadrícula mensual) | Lista
// SA: ETAs en Manzanillo y Bodega, vencimientos, forwards
// MX: Vencimientos de facturas (30 días)
// ============================================================

const { useState: useCalC } = React;

const fmtFch_Cal = (s) => { if (!s) return "—"; const d = new Date(s + "T12:00:00"); return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }); };
const fmtMXN_Cal = (n) => "$" + Number(n||0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUSD_Cal = (n) => "$" + Number(n||0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS  = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

// ── Construir lista de eventos SA ─────────────────────────────────────────────
const buildSAEvents = (data) => {
  const hoy    = new Date();
  const events = [];

  data.contenedoresSA.forEach(c => {
    if (c.etaManzanillo && c.status !== "Entregado") {
      events.push({ fecha: c.etaManzanillo, tipo: "ETA Puerto",   titulo: `${c.folioInterno} → Manzanillo`, sub: `${c.naviera||"—"} · OC ${c.ocProveedor}`, color: "#7C3AED", bg: "#EDE9FE" });
    }
    if (c.etaBodega && c.status !== "Entregado") {
      events.push({ fecha: c.etaBodega,     tipo: "ETA Bodega",   titulo: `${c.folioInterno} → Bodega`,     sub: `${(c.totalKg||0).toLocaleString()} kg · ${fmtUSD_Cal(c.totalUSD||0)}`, color: "#0073E6", bg: "#EFF6FF" });
    }
    if (c.fechaVencimiento && c.status !== "Entregado") {
      const paid  = (c.pagos||[]).reduce((s,p)=>s+p.monto,0);
      const saldo = (c.totalUSD||0) - paid;
      if (saldo > 0.01) {
        events.push({ fecha: c.fechaVencimiento, tipo: "Vencimiento", titulo: `Pago ${c.folioInterno}`, sub: `Saldo: ${fmtUSD_Cal(saldo)} · Fac. ${c.factura||"—"}`, color: "#F59E0B", bg: "#FEF3C7" });
      }
    }
    (c.forwards||[]).filter(f=>f.status!=="Ejecutado").forEach(f => {
      events.push({ fecha: f.fechaEntrega, tipo: "Forward", titulo: `Forward ${c.folioInterno}`, sub: `${fmtUSD_Cal(f.montoUSD)} · TC ${f.tcForward.toFixed(4)} · ${f.banco}`, color: "#5B21B6", bg: "#F5F3FF" });
    });
  });

  events.sort((a, b) => (a.fecha||"9999").localeCompare(b.fecha||"9999"));
  return events;
};

// ── Cuadrícula mensual ────────────────────────────────────────────────────────
const MonthCalendar = ({ events }) => {
  const hoy  = new Date();
  const [year,  setYear]  = useCalC(hoy.getFullYear());
  const [month, setMonth] = useCalC(hoy.getMonth());
  const [sel,   setSel]   = useCalC(null);

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); setSel(null); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); setSel(null); };

  const daysInMonth = new Date(year, month+1, 0).getDate();
  const firstDay    = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

  // Group events by day number in this month
  const byDay = {};
  events.forEach(e => {
    if (!e.fecha) return;
    const d = new Date(e.fecha + "T12:00:00");
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(e);
    }
  });

  const cells = [...Array(firstDay).fill(null), ...Array(daysInMonth).fill(0).map((_,i) => i+1)];
  const weeks  = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i+7).concat(Array(7).fill(null)).slice(0,7));

  const isToday = (d) => d === hoy.getDate() && month === hoy.getMonth() && year === hoy.getFullYear();
  const selEvents = sel ? (byDay[sel] || []) : [];

  return (
    <div>
      {/* Header nav */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <button className="btn btn-ghost btn-sm" onClick={prevMonth}>← Anterior</button>
        <div style={{ fontSize:18, fontWeight:800, letterSpacing:"-0.01em", color:"var(--ink-900)" }}>{MESES[month]} {year}</div>
        <button className="btn btn-ghost btn-sm" onClick={nextMonth}>Siguiente →</button>
      </div>

      {/* Calendar card */}
      <div className="card" style={{ padding:0, overflow:"hidden", marginBottom: sel ? 16 : 0 }}>
        {/* Day headers */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:"1px solid var(--ink-100)" }}>
          {DIAS.map(d => (
            <div key={d} style={{ padding:"9px 0", textAlign:"center", fontSize:11, fontWeight:700, color:"var(--ink-400)", letterSpacing:"0.06em" }}>{d}</div>
          ))}
        </div>

        {/* Week rows */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom: wi < weeks.length-1 ? "1px solid var(--ink-100)" : "none" }}>
            {week.map((day, di) => {
              const evs     = day ? (byDay[day] || []) : [];
              const isSel   = day && sel === day;
              return (
                <div key={di} onClick={() => day && setSel(day === sel ? null : day)} style={{
                  minHeight: 88, padding: "6px 8px",
                  borderRight: di < 6 ? "1px solid var(--ink-100)" : "none",
                  background: isSel ? "#EFF6FF" : !day ? "var(--ink-50)" : "white",
                  cursor: day ? "pointer" : "default", transition:"background 0.1s",
                }}
                  onMouseEnter={e => { if(day && !isSel) e.currentTarget.style.background="#F8FAFC"; }}
                  onMouseLeave={e => { if(day && !isSel) e.currentTarget.style.background="white"; }}
                >
                  {day && (
                    <>
                      <div style={{ display:"inline-flex", width:24, height:24, alignItems:"center", justifyContent:"center", borderRadius:"50%", marginBottom:4,
                        background: isToday(day) ? "var(--blue-500)" : "transparent",
                        color: isToday(day) ? "white" : "var(--ink-700)", fontSize:12, fontWeight: isToday(day) ? 800 : 400,
                      }}>{day}</div>
                      {evs.slice(0,3).map((e, ei) => (
                        <div key={ei} style={{ fontSize:9.5, padding:"2px 5px", borderRadius:4, marginBottom:2, background:e.bg, color:e.color, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight:700 }}>
                          {e.titulo}
                        </div>
                      ))}
                      {evs.length > 3 && <div style={{ fontSize:9, color:"var(--ink-400)", fontWeight:600 }}>+{evs.length-3} más</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected day panel */}
      {sel && (
        <div className="card" style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--ink-100)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:13, fontWeight:700 }}>{sel} de {MESES[month]} — {selEvents.length} evento{selEvents.length!==1?"s":""}</span>
            <button onClick={() => setSel(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-400)", fontSize:16 }}>✕</button>
          </div>
          {selEvents.length === 0
            ? <div style={{ padding:"24px", textAlign:"center", color:"var(--ink-400)", fontSize:13 }}>Sin eventos este día</div>
            : selEvents.map((e, i) => (
              <div key={i} style={{ display:"flex", gap:12, padding:"12px 16px", borderBottom:"1px solid var(--ink-100)", alignItems:"flex-start" }}>
                <div style={{ width:10, height:10, borderRadius:999, background:e.color, flexShrink:0, marginTop:4 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:999, background:e.bg, color:e.color }}>{e.tipo}</span>
                  </div>
                  <div style={{ fontSize:13, fontWeight:700 }}>{e.titulo}</div>
                  <div style={{ fontSize:12, color:"var(--ink-500)", marginTop:2 }}>{e.sub}</div>
                </div>
                <div style={{ fontSize:12, color:"var(--ink-400)", flexShrink:0 }}>{fmtFch_Cal(e.fecha)}</div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
};

// ── Lista de eventos ──────────────────────────────────────────────────────────
const EventList = ({ events }) => {
  const hoy      = new Date();
  const proximos = events.filter(e => !e.fecha || new Date(e.fecha+"T12:00:00") >= hoy);
  const pasados  = events.filter(e =>  e.fecha && new Date(e.fecha+"T12:00:00") <  hoy);

  const EventCard = ({ e }) => {
    const fecha = e.fecha ? new Date(e.fecha+"T12:00:00") : null;
    const dias  = fecha ? Math.ceil((fecha - hoy) / 86400000) : null;
    const vencio = dias !== null && dias < 0;
    return (
      <div style={{ display:"flex", gap:14, padding:"14px 18px", borderBottom:"1px solid var(--ink-100)", alignItems:"flex-start" }}>
        <div style={{ flexShrink:0, width:50, height:50, borderRadius:10, background:e.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ fontSize:9, fontWeight:700, color:e.color, textTransform:"uppercase", letterSpacing:"0.04em" }}>{fecha?MESES[fecha.getMonth()].slice(0,3).toUpperCase():"—"}</div>
          <div style={{ fontSize:18, fontWeight:900, color:e.color, lineHeight:1 }}>{fecha?fecha.getDate():"?"}</div>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:999, background:e.bg, color:e.color }}>{e.tipo}</span>
            {dias!==null && (
              <span style={{ fontSize:11, fontWeight:700, color: vencio?"var(--red-500)":dias<7?"var(--amber-500)":"var(--ink-400)" }}>
                {vencio?`Hace ${Math.abs(dias)}d`:dias===0?"Hoy":`En ${dias}d`}
              </span>
            )}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--ink-900)" }}>{e.titulo}</div>
          <div style={{ fontSize:12, color:"var(--ink-500)", marginTop:2 }}>{e.sub}</div>
        </div>
        <div style={{ fontSize:12, color:"var(--ink-400)", flexShrink:0 }}>{fmtFch_Cal(e.fecha)}</div>
      </div>
    );
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
      <div className="card" style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--ink-100)", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ width:8, height:8, borderRadius:999, background:"var(--green-500)", display:"inline-block" }}/>
          <span style={{ fontSize:12, fontWeight:700, color:"var(--ink-700)" }}>Próximos — {proximos.length}</span>
        </div>
        {proximos.length > 0 ? proximos.map((e, i) => <EventCard key={i} e={e}/>) : <div style={{ padding:"32px", textAlign:"center", color:"var(--ink-400)", fontSize:13 }}>Sin eventos próximos</div>}
      </div>
      <div className="card" style={{ padding:0, overflow:"hidden", opacity:0.7 }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--ink-100)", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ width:8, height:8, borderRadius:999, background:"var(--ink-300)", display:"inline-block" }}/>
          <span style={{ fontSize:12, fontWeight:700, color:"var(--ink-700)" }}>Historial — {pasados.length}</span>
        </div>
        {pasados.length > 0 ? pasados.map((e, i) => <EventCard key={i} e={e}/>) : <div style={{ padding:"32px", textAlign:"center", color:"var(--ink-400)", fontSize:13 }}>Sin historial</div>}
      </div>
    </div>
  );
};

// ── MX: Vencimientos ─────────────────────────────────────────────────────────
const MXVencimientos = ({ data }) => {
  const [calView, setCalView] = useCalC("lista");
  const hoy      = new Date();
  const pendientes = data.comprasMX.filter(c => c.status !== "Liquidada");

  const mxEvents = pendientes.map(c => ({
    fecha: c.fechaVencimiento,
    tipo: "Vencimiento",
    titulo: `${c.folioInterno} · ${c.facturaNum}`,
    sub: `Saldo: ${fmtMXN_Cal(c.saldoPendiente)}`,
    color: "#F59E0B", bg: "#FEF3C7",
  }));

  return (
    <div>
      {/* View switcher */}
      <div style={{ display:"flex", gap:2, borderBottom:"1px solid var(--ink-200)", marginBottom:20 }}>
        {[{id:"lista",label:"Lista de vencimientos"},{id:"cal",label:"Calendario"}].map(t => (
          <button key={t.id} onClick={() => setCalView(t.id)} style={{ padding:"8px 14px", fontSize:12, fontWeight:600, cursor:"pointer", border:"none", background:"transparent", color: calView===t.id?"var(--blue-500)":"var(--ink-500)", borderBottom: calView===t.id?"2px solid var(--blue-500)":"2px solid transparent", marginBottom:-1 }}>{t.label}</button>
        ))}
      </div>

      {calView === "lista" && (
        <div>
          <div style={{ padding:"10px 14px", background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:9, fontSize:12, color:"#92400E", marginBottom:14 }}>
            Vencimientos con crédito a <strong>30 días</strong>. Camanchaca México S.A. de C.V.
          </div>
          <div className="card" style={{ padding:0, overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--ink-100)", fontSize:12, fontWeight:700, color:"var(--ink-700)" }}>Facturas con saldo pendiente — {pendientes.length}</div>
            {pendientes.length > 0 ? (
              <table className="tbl">
                <thead>
                  <tr><th>Folio</th><th>Factura</th><th>Fecha factura</th><th>Vencimiento</th><th>Días</th><th style={{ textAlign:"right" }}>Saldo MXN</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {pendientes.sort((a,b)=>(a.fechaVencimiento||"").localeCompare(b.fechaVencimiento||"")).map(c => {
                    const venc = new Date(c.fechaVencimiento+"T12:00:00");
                    const dias = Math.ceil((venc-hoy)/86400000);
                    const vencida = dias < 0;
                    return (
                      <tr key={c.folioInterno}>
                        <td className="mono fw-700">{c.folioInterno}</td>
                        <td className="mono text-sm">{c.facturaNum}</td>
                        <td className="text-sm">{fmtFch_Cal(c.fechaFactura)}</td>
                        <td className="text-sm" style={{ color:vencida?"var(--red-500)":"inherit", fontWeight:vencida?700:400 }}>{fmtFch_Cal(c.fechaVencimiento)}</td>
                        <td style={{ fontWeight:700, fontSize:12, color:vencida?"var(--red-500)":dias<7?"var(--amber-500)":"var(--green-500)" }}>{vencida?`−${Math.abs(dias)}d`:`+${dias}d`}</td>
                        <td style={{ textAlign:"right" }} className="mono fw-700" style={{ color:"var(--amber-500)", textAlign:"right" }}>{fmtMXN_Cal(c.saldoPendiente)}</td>
                        <td><span className={`badge ${c.status==="Parcial"?"badge-amber":"badge-red"}`}>{c.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding:"32px", textAlign:"center", color:"var(--ink-400)", fontSize:13 }}>✓ Todas las facturas liquidadas</div>
            )}
          </div>
        </div>
      )}
      {calView === "cal" && <MonthCalendar events={mxEvents}/>}
    </div>
  );
};

// ── SA: Calendario principal ──────────────────────────────────────────────────
const SACalendario = ({ data }) => {
  const [view, setView] = useCalC("cal");
  const events = buildSAEvents(data);

  return (
    <div>
      {/* View switcher */}
      <div style={{ display:"flex", gap:2, borderBottom:"1px solid var(--ink-200)", marginBottom:20 }}>
        {[{id:"cal",label:"Calendario"},{id:"lista",label:"Lista"}].map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{ padding:"8px 14px", fontSize:12, fontWeight:600, cursor:"pointer", border:"none", background:"transparent", color: view===t.id?"var(--blue-500)":"var(--ink-500)", borderBottom: view===t.id?"2px solid var(--blue-500)":"2px solid transparent", marginBottom:-1 }}>{t.label}</button>
        ))}
      </div>

      {/* Leyenda */}
      <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        {[
          { label:"ETA Puerto",   color:"#7C3AED", bg:"#EDE9FE" },
          { label:"ETA Bodega",   color:"#0073E6", bg:"#EFF6FF" },
          { label:"Vencimiento",  color:"#F59E0B", bg:"#FEF3C7" },
          { label:"Forward",      color:"#5B21B6", bg:"#F5F3FF" },
        ].map(l => (
          <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:"var(--ink-600)" }}>
            <span style={{ width:10, height:10, borderRadius:999, background:l.color, display:"inline-block" }}/>
            {l.label}
          </div>
        ))}
      </div>

      {view === "cal"   && <MonthCalendar events={events}/>}
      {view === "lista" && <EventList events={events}/>}
    </div>
  );
};

// ── Entry point ───────────────────────────────────────────────────────────────
const CamanchacaCalendario = ({ entity }) => {
  const data = window.CAMANCHACA_DATA;
  return entity === "sa" ? <SACalendario data={data}/> : <MXVencimientos data={data}/>;
};

Object.assign(window, { CamanchacaCalendario });
