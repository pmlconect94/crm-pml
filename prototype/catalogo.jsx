// ============================================================
// Catálogo de SKUs — componente compartido
// Usado por: Blufin, Camanchaca, Neptuno
//
// Props:
//   skus:        array de SKUs del proveedor
//   onRefresh:   función para disparar el refresco global
//   categorias:  array de strings con categorías del proveedor
//   accentColor: color de acento del módulo (ej: "#0EA5A1")
// ============================================================

const { useState: useCatC, useMemo: useMemoC } = React;

const SkuCatalogo = ({ skus, onRefresh, categorias = [], accentColor = "var(--blue-500)" }) => {
  const [query,    setQuery]    = useCatC("");
  const [showNew,  setShowNew]  = useCatC(false);
  const [editIdx,  setEditIdx]  = useCatC(null);
  const [catFilter,setCatFilter]= useCatC("Todos");

  const allCats = ["Todos", ...categorias];

  const filtered = useMemoC(() => {
    const q = query.toLowerCase();
    return skus.filter(s => {
      const matchQ = !q || s.code.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q) || (s.categoria||"").toLowerCase().includes(q);
      const matchC = catFilter === "Todos" || s.categoria === catFilter;
      return matchQ && matchC;
    });
  }, [skus, query, catFilter]);

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
          {/* Buscador */}
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:"white", border:"1.5px solid var(--ink-200)", borderRadius:9, flex:"0 0 280px" }}>
            <Icon name="search" size={14} style={{ color:"var(--ink-400)", flexShrink:0 }}/>
            <input value={query} onChange={e=>setQuery(e.target.value)}
              placeholder="Buscar código o descripción…"
              style={{ border:"none", outline:"none", fontSize:13, background:"transparent", width:"100%", color:"var(--ink-900)" }}/>
            {query && <button onClick={()=>setQuery("")} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-400)", fontSize:14, padding:0 }}>✕</button>}
          </div>

          {/* Filtro categorías */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {allCats.map(c => (
              <button key={c} onClick={()=>setCatFilter(c)} style={{
                padding:"5px 12px", borderRadius:999, fontSize:11.5, fontWeight:600, cursor:"pointer",
                background: catFilter===c ? accentColor : "var(--ink-100)",
                color:      catFilter===c ? "white"      : "var(--ink-600)",
                border:     "none", transition:"all 0.12s",
              }}>{c}</button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary btn-sm" onClick={()=>setShowNew(true)} style={{ background:accentColor, border:"none" }}>
          <Icon name="plus" size={12}/> Nuevo SKU
        </button>
      </div>

      {/* KPIs rápidos */}
      <div style={{ display:"flex", gap:14, marginBottom:16, flexWrap:"wrap" }}>
        {[
          { label:"SKUs totales",   value:skus.length },
          { label:"Mostrados",      value:filtered.length },
          ...categorias.map(c => ({ label:c, value:skus.filter(s=>s.categoria===c).length }))
        ].map((k,i) => (
          <div key={i} style={{ padding:"8px 14px", background:"white", border:"1px solid var(--ink-200)", borderRadius:9, textAlign:"center", minWidth:90 }}>
            <div style={{ fontSize:18, fontWeight:800, fontFamily:"var(--font-mono)", color:i===0?accentColor:"var(--ink-800)" }}>{k.value}</div>
            <div style={{ fontSize:10, color:"var(--ink-500)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="card" style={{ padding:0, overflow:"hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th style={{ textAlign:"right" }}>kg / Caja</th>
              <th style={{ textAlign:"right" }}>Cajas tipo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign:"center", padding:"32px", color:"var(--ink-400)", fontSize:13 }}>
                  Sin SKUs que coincidan con la búsqueda
                </td>
              </tr>
            ) : filtered.map((s, i) => {
              const realIdx = skus.indexOf(s);
              return editIdx === realIdx ? (
                <SkuEditRow key={s.code} sku={s} categorias={categorias} accentColor={accentColor}
                  onSave={(updated) => { Object.assign(s, updated); setEditIdx(null); onRefresh(); }}
                  onCancel={() => setEditIdx(null)}
                />
              ) : (
                <tr key={s.code}
                  onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                  onMouseLeave={e=>e.currentTarget.style.background="white"}>
                  <td className="mono fw-700" style={{ color:accentColor }}>{s.code}</td>
                  <td className="fw-600 text-sm">{s.desc}</td>
                  <td>
                    {s.categoria
                      ? <span style={{ padding:"2px 9px", borderRadius:999, fontSize:10.5, fontWeight:700, background:accentColor+"22", color:accentColor }}>{s.categoria}</span>
                      : <span className="muted" style={{ fontSize:11 }}>—</span>}
                  </td>
                  <td style={{ textAlign:"right" }} className="mono fw-700">{s.kgCaja.toFixed(3)}</td>
                  <td style={{ textAlign:"right" }} className="mono" style={{ color:"var(--ink-400)", textAlign:"right" }}>{(s.cajasTipo||"—")}</td>
                  <td style={{ textAlign:"right" }}>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:"3px 10px" }} onClick={() => setEditIdx(realIdx)}>
                      <Icon name="pencil" size={12}/> Editar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal nuevo SKU */}
      {showNew && (
        <SkuNewModal categorias={categorias} accentColor={accentColor}
          onSave={(nuevo) => {
            skus.push(nuevo);
            onRefresh();
            setShowNew(false);
          }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
};

// ── Fila de edición inline ───────────────────────────────────────────────────
const SkuEditRow = ({ sku, categorias, accentColor, onSave, onCancel }) => {
  const [code,     setCode]     = useCatC(sku.code);
  const [desc,     setDesc]     = useCatC(sku.desc);
  const [cat,      setCat]      = useCatC(sku.categoria||"");
  const [kgCaja,   setKgCaja]   = useCatC(String(sku.kgCaja));
  const [cajasTipo,setCajasTipo]= useCatC(sku.cajasTipo||"");

  return (
    <tr style={{ background:"#FFF9DB" }}>
      <td><input className="field-input" value={code} onChange={e=>setCode(e.target.value)} style={{ width:90, padding:"5px 8px", fontSize:12 }}/></td>
      <td><input className="field-input" value={desc} onChange={e=>setDesc(e.target.value)} style={{ minWidth:200, padding:"5px 8px", fontSize:12 }}/></td>
      <td>
        <select className="field-input" value={cat} onChange={e=>setCat(e.target.value)} style={{ padding:"5px 8px", fontSize:12 }}>
          <option value="">— Sin categoría —</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td>
        <input type="number" step="0.001" className="field-input" value={kgCaja} onChange={e=>setKgCaja(e.target.value)} style={{ width:80, padding:"5px 8px", fontSize:12, textAlign:"right", fontFamily:"var(--font-mono)" }}/>
      </td>
      <td>
        <input className="field-input" value={cajasTipo} onChange={e=>setCajasTipo(e.target.value)} style={{ width:70, padding:"5px 8px", fontSize:12 }} placeholder="—"/>
      </td>
      <td style={{ display:"flex", gap:6, alignItems:"center" }}>
        <button className="btn btn-sm" style={{ background:accentColor, color:"white", border:"none", padding:"4px 10px", fontSize:11 }}
          onClick={() => onSave({ code, desc, categoria:cat, kgCaja:parseFloat(kgCaja)||0, cajasTipo })}>
          <Icon name="check" size={11}/>
        </button>
        <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:"4px 10px" }} onClick={onCancel}>✕</button>
      </td>
    </tr>
  );
};

// ── Modal nuevo SKU ──────────────────────────────────────────────────────────
const SkuNewModal = ({ categorias, accentColor, onSave, onClose }) => {
  const [form, setForm] = useCatC({ code:"", desc:"", categoria:"", kgCaja:"", cajasTipo:"" });
  const set = (k,v) => setForm(p => ({ ...p, [k]:v }));
  const valid = form.code.trim() && form.desc.trim() && parseFloat(form.kgCaja) > 0;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"white", borderRadius:16, padding:28, width:500, boxShadow:"0 24px 64px rgba(0,0,0,0.25)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800 }}>Nuevo SKU</div>
            <div style={{ fontSize:12, color:"var(--ink-500)", marginTop:3 }}>Agregar producto al catálogo del proveedor</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-400)", fontSize:20 }}>✕</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
          <div>
            <label className="field-label">Código SKU <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" value={form.code} onChange={e=>set("code",e.target.value)} placeholder="Ej: 202010"/>
          </div>
          <div>
            <label className="field-label">Categoría</label>
            <select className="field-input" value={form.categoria} onChange={e=>set("categoria",e.target.value)}>
              <option value="">— Sin categoría —</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label className="field-label">Descripción <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input className="field-input" value={form.desc} onChange={e=>set("desc",e.target.value)} placeholder="Ej: Salmon Premium Posta 3/4"/>
          </div>
          <div>
            <label className="field-label">kg por Caja <span style={{ color:"var(--red-500)" }}>*</span></label>
            <input type="number" step="0.001" className="field-input" value={form.kgCaja} onChange={e=>set("kgCaja",e.target.value)} placeholder="10.000"/>
          </div>
          <div>
            <label className="field-label">Tipo de cajas <span style={{ fontSize:11, color:"var(--ink-400)", fontWeight:400 }}>(opcional)</span></label>
            <input className="field-input" value={form.cajasTipo} onChange={e=>set("cajasTipo",e.target.value)} placeholder="Ej: Master"/>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ background:accentColor, border:"none" }}
            onClick={() => onSave({ code:form.code.trim(), desc:form.desc.trim(), categoria:form.categoria, kgCaja:parseFloat(form.kgCaja), cajasTipo:form.cajasTipo })}
            disabled={!valid}>
            <Icon name="check" size={13}/> Guardar SKU
          </button>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { SkuCatalogo });
