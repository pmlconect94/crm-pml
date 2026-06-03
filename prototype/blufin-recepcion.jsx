// ============================================
// Blufin Seafood — Panel de Recepción de Mercancía
// • Por SKU: una fila por producto del contrato
// • Sin montos — solo kg y presentación
// • Genera NCs automáticas en status "Sin monto"
// • Campo Entrada de compra Intelisis
// ============================================

const { useState: useStateR, useMemo: useMemoR, useEffect: useEffectR } = React;
const { Icon: IconR } = window;
const HOY_REC = "2026-05-21";
const recFmt = { USD: window.fmtUSD, Fecha: window.fmtFecha, FechaCorta: window.fmtFechaCorta };

// Genera SKU legible desde datos del producto
const mkSku = (p) => `${p.marca.replace(/\s+/g, "").substring(0, 4).toUpperCase()}-${p.talla}`;

// Genera folios internos consecutivos de NC
const generarFoliosNC = (cantidad) => {
  const nums = window.BLUFIN_DATA.notasCredito.map(nc => {
    const m = (nc.folioInterno || "").match(/NC-(\d+)/);
    return m ? parseInt(m[1]) : 0;
  });
  const base = nums.length > 0 ? Math.max(...nums) : 0;
  return Array.from({ length: cantidad }, (_, i) => `NC-${String(base + i + 1).padStart(4, "0")}`);
};

// ── Modal de recepción ────────────────────────────────────────────────────────

const RecepcionModal = ({ open, onClose, contrato, onConfirm }) => {
  const [lineas, setLineas] = useStateR([]);
  const [fecha, setFecha] = useStateR(HOY_REC);
  const [bodega, setBodega] = useStateR("");
  const [intelisis, setIntelisis] = useStateR("");
  const [presRecibida, setPresRecibida] = useStateR(""); // nivel contenedor
  const [obsGenerales, setObsGenerales] = useStateR("");
  const [step, setStep] = useStateR("form");
  const [recConfirmada, setRecConfirmada] = useStateR(null);

  useEffectR(() => {
    if (open && contrato) {
      setLineas(contrato.productos.map((p, i) => ({
        idx: i,
        sku: mkSku(p),
        desc: `${p.desc} · ${p.marca} · ${p.talla}`,
        kgContratados: p.kg,
        presPactada: contrato.presentacion,
        kgRecibidos: "",
        observaciones: "",
      })));
      setFecha(HOY_REC);
      setBodega(contrato.bodegaDestino || window.BLUFIN_DATA.catalogos.bodegas[0]);
      setPresRecibida(contrato.presentacion);
      setIntelisis("");
      setObsGenerales("");
      setStep("form");
      setRecConfirmada(null);
    }
  }, [open, contrato?.folio]);

  // ── Todos los hooks deben estar ANTES del return condicional ──
  // Diferencias: presentación a nivel contenedor, kg por SKU
  const difs = useMemoR(() => {
    if (!open || !contrato) return [];
    const out = [];
    // Presentación — aplica al contenedor completo (una sola NC)
    const presPactada = contrato?.presentacion || "";
    if (presRecibida && presRecibida !== presPactada) {
      out.push({
        tipo: "presentacion",
        sku: "CONTENEDOR",
        desc: `${contrato.folio} — presentación del contenedor`,
        detalle: `${presPactada} pactado → ${presRecibida} recibido`,
        linea: null,
      });
    }
    // Faltantes — por SKU
    lineas.forEach(l => {
      const kgN = parseFloat(l.kgRecibidos) || 0;
      if (l.kgRecibidos !== "" && kgN < l.kgContratados) {
        out.push({ tipo: "faltante", sku: l.sku, desc: l.desc,
          detalle: `${(l.kgContratados - kgN).toLocaleString("es-MX")} kg faltantes`, linea: l.idx });
      }
    });
    return out;
  }, [lineas, presRecibida, open, contrato]);

  const canConfirm = fecha && lineas.every(l => l.kgRecibidos !== "" && parseFloat(l.kgRecibidos) > 0);
  const totalKgContratados = lineas.reduce((s, l) => s + l.kgContratados, 0);
  const totalKgRecibidos   = lineas.reduce((s, l) => s + (parseFloat(l.kgRecibidos) || 0), 0);

  // Buscar factura asociada al contrato (safe cuando contrato es null)
  const facturaExiste = useMemoR(() =>
    window.BLUFIN_DATA.facturas?.find(f => f.contratoAsociado === contrato?.folio) ?? null
  , [contrato?.folio]);

  if (!open || !contrato) return null;

  const updateLinea = (idx, field, value) =>
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));

  const handleConfirmar = () => {
    const folios = generarFoliosNC(difs.length);
    const ncsGeneradas = difs.map((d, i) => ({
      folioInterno: folios[i],
      tipo: d.tipo,
      sku: d.sku,
      desc: d.desc,
      detalle: d.detalle,
    }));

    const rec = {
      id: `REC-2026-${String(window.BLUFIN_DATA.recepciones.length + 10).padStart(3, "0")}`,
      contrato: contrato.folio,
      fechaRecepcion: fecha,
      bodega,
      entradaIntelisis: intelisis,
      facturaRef: facturaExiste?.id || null,
      presentacionPactada: contrato.presentacion,
      presentacionRecibida: presRecibida,
      lineas: lineas.map(l => ({
        sku: l.sku,
        desc: l.desc,
        kgContratados: l.kgContratados,
        kgRecibidos: parseFloat(l.kgRecibidos) || 0,
        diferencia: l.kgContratados - (parseFloat(l.kgRecibidos) || 0),
        observaciones: l.observaciones,
      })),
      ncGeneradas: ncsGeneradas.map(n => n.folioInterno),
      observacionesGenerales: obsGenerales,
      capturadoPor: "Ricardo Núñez",
      createdAt: new Date().toISOString(),
    };

    setRecConfirmada({ rec, ncsGeneradas });
    onConfirm(rec);
    setStep("done");
  };

  // ── Pantalla final ──
  if (step === "done" && recConfirmada) {
    const { rec, ncsGeneradas } = recConfirmada;
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(10,37,64,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }} onClick={onClose}>
        <div style={{ background: "white", borderRadius: 16, maxWidth: 520, width: "100%", overflow: "hidden", boxShadow: "0 24px 48px rgba(10,37,64,0.25)" }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: "28px 28px 20px", textAlign: "center", background: "linear-gradient(135deg,#F0FDF4 0%,#D1FAE5 100%)", borderBottom: "1px solid #BBF7D0" }}>
            <div style={{ width: 52, height: 52, borderRadius: 999, background: "#059669", color: "white", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <IconR name="check" size={26} />
            </div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Recepción registrada</h2>
            <div className="text-sm muted" style={{ marginTop: 4 }}>
              <span className="mono fw-600">{contrato.folio}</span> · {recFmt.FechaCorta(fecha)} · {bodega}
              {rec.entradaIntelisis && <span> · Intelisis: <span className="mono fw-600">{rec.entradaIntelisis}</span></span>}
            </div>
          </div>

          <div style={{ padding: "18px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Resumen kg */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[
                { label: "Kg contratados", value: totalKgContratados.toLocaleString("es-MX") + " kg" },
                { label: "Kg recibidos", value: totalKgRecibidos.toLocaleString("es-MX") + " kg", red: totalKgRecibidos < totalKgContratados },
                { label: "Diferencia", value: (totalKgContratados - totalKgRecibidos > 0 ? "−" : "") + Math.abs(totalKgContratados - totalKgRecibidos).toLocaleString("es-MX") + " kg", red: totalKgContratados - totalKgRecibidos > 0 },
              ].map((item, i) => (
                <div key={i} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--ink-200)", background: "var(--ink-50)", textAlign: "center" }}>
                  <div className="text-xs muted">{item.label}</div>
                  <div className="mono fw-700" style={{ color: item.red ? "#DC2626" : "#059669" }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* NCs generadas */}
            {ncsGeneradas.length > 0 ? (
              <div style={{ borderRadius: 10, border: "1px solid #FED7AA", overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", background: "#FEF3C7", borderBottom: "1px solid #FDE68A" }}>
                  <span className="fw-700 text-sm" style={{ color: "#92400E" }}>
                    ⚡ {ncsGeneradas.length} NC{ncsGeneradas.length > 1 ? "s" : ""} generada{ncsGeneradas.length > 1 ? "s" : ""} — sin monto
                  </span>
                </div>
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  {ncsGeneradas.map((nc, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 10px", borderRadius: 7, background: "white", border: "1px solid var(--ink-200)" }}>
                      <div>
                        <div className="hstack" style={{ gap: 6, marginBottom: 2 }}>
                          <span className="mono fw-700 text-sm" style={{ color: "var(--ink-900)" }}>{nc.folioInterno}</span>
                          <span style={{ padding: "1px 7px", borderRadius: 999, background: nc.tipo === "presentacion" ? "#FEF3C7" : "#FEE2E2", color: nc.tipo === "presentacion" ? "#92400E" : "#991B1B", fontSize: 10, fontWeight: 600 }}>
                            {nc.tipo === "presentacion" ? "Presentación" : "Faltante"}
                          </span>
                        </div>
                        <div className="text-xs muted">{nc.detalle} · <span className="mono">{nc.sku}</span></div>
                      </div>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "#F9FAFB", color: "#6B7280", border: "1px solid #E5E7EB", whiteSpace: "nowrap", marginLeft: 8 }}>Sin monto</span>
                    </div>
                  ))}
                  <div className="text-xs muted" style={{ marginTop: 2 }}>
                    Ve a <strong>Notas de crédito</strong> para capturar el monto cuando el proveedor lo comunique.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: 14, borderRadius: 10, background: "#F0FDF4", border: "1px solid #BBF7D0", textAlign: "center" }}>
                <span className="fw-600 text-sm" style={{ color: "#065F46" }}>✓ Sin diferencias — no se generaron NCs</span>
              </div>
            )}
          </div>

          <div style={{ padding: "14px 28px", borderTop: "1px solid var(--ink-200)", display: "flex", justifyContent: "flex-end", background: "var(--ink-50)" }}>
            <button className="btn btn-primary btn-sm" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario principal ──
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,37,64,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 16, maxWidth: 900, width: "100%", maxHeight: "92vh", overflow: "auto", boxShadow: "0 24px 48px rgba(10,37,64,0.25)" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--ink-200)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
              <span className="mono fw-700" style={{ fontSize: 14 }}>{contrato.folio}</span>
              <window.StatusPill status={contrato.status} />
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Registrar recepción de mercancía</h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 20, color: "var(--ink-400)", cursor: "pointer" }}>✕</button>
        </div>

        {/* Barra del contrato */}
        <div style={{ padding: "10px 24px", background: "#F3F9FF", borderBottom: "1px solid #BAE0FF", display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            contrato.contenedor && { label: "Contenedor", value: contrato.contenedor, mono: true },
            contrato.naviera    && { label: "Naviera", value: contrato.naviera },
            { label: "ETA bodega", value: recFmt.FechaCorta(contrato.etaBodega) },
            { label: "Total kg", value: contrato.totalKg.toLocaleString("es-MX") + " kg", mono: true },
            { label: "Presentación pactada", value: contrato.presentacion, blue: true },
          ].filter(Boolean).map((item, i) => (
            <div key={i}>
              <div className="text-xs muted">{item.label}</div>
              <div className={"text-sm " + (item.mono ? "mono " : "") + "fw-600"} style={{ color: item.blue ? "var(--blue-500)" : "var(--ink-900)" }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: "20px 24px" }}>
          {/* Campos generales del contenedor */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div>
              <label className="field-label">Fecha de recepción *</label>
              <input type="date" className="field-input" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Bodega</label>
              <select className="field-input" value={bodega} onChange={e => setBodega(e.target.value)}>
                {window.BLUFIN_DATA.catalogos.bodegas.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Presentación recibida (contenedor)</label>
              <select className="field-input fw-700" value={presRecibida} onChange={e => setPresRecibida(e.target.value)}
                style={{ borderColor: presRecibida && presRecibida !== contrato.presentacion ? "#DC2626" : presRecibida === contrato.presentacion ? "#059669" : undefined }}>
                {["Paletizado", "Granel"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {presRecibida && presRecibida !== contrato.presentacion && (
                <div className="text-xs" style={{ color: "#DC2626", marginTop: 3, fontWeight: 600 }}>
                  ⚠ Difiere del contrato ({contrato.presentacion}) — NC automática
                </div>
              )}
              {presRecibida === contrato.presentacion && presRecibida && (
                <div className="text-xs" style={{ color: "#059669", marginTop: 3 }}>✓ Coincide con contrato</div>
              )}
            </div>
            <div>
              <label className="field-label">Entrada de compra Intelisis</label>
              <input className="field-input mono" value={intelisis} onChange={e => setIntelisis(e.target.value)} placeholder="EC-2026-XXXX" />
            </div>
            <div>
              <label className="field-label">Factura del proveedor</label>
              {facturaExiste ? (
                <button className="btn btn-outline btn-sm" style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => window.open("#", "_blank")}>
                  <IconR name="download" size={13} /> Descargar ({facturaExiste.folioFactura})
                </button>
              ) : (
                <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", color: "var(--ink-400)", cursor: "not-allowed" }} disabled>
                  <IconR name="download" size={13} /> Sin factura subida
                </button>
              )}
              <div className="text-xs muted" style={{ marginTop: 4 }}>Súbela en la pestaña Facturas</div>
            </div>
          </div>

          {/* Tabla por SKU */}
          <div style={{ marginBottom: 16 }}>
            <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <div className="fw-700" style={{ fontSize: 13 }}>Verificación por SKU</div>
              <div className="text-xs muted">
                Total: {totalKgRecibidos > 0 && (
                  <span className="mono fw-700" style={{ color: totalKgRecibidos < totalKgContratados ? "#DC2626" : "#059669" }}>
                    {totalKgRecibidos.toLocaleString("es-MX")} / {totalKgContratados.toLocaleString("es-MX")} kg
                  </span>
                )}
                {totalKgRecibidos === 0 && <span className="mono">{totalKgContratados.toLocaleString("es-MX")} kg contratados</span>}
              </div>
            </div>
            <div style={{ border: "1px solid var(--ink-200)", borderRadius: 10, overflow: "hidden" }}>
              {/* Encabezado tabla — sin columnas de presentación (es a nivel contenedor) */}
              <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 140px 140px 1fr", gap: 0, background: "var(--ink-50)", borderBottom: "1px solid var(--ink-200)" }}>
                {["SKU", "Descripción", "Kg contratados", "Kg recibidos", "Observaciones"].map((h, i) => (
                  <div key={i} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "var(--ink-500)", letterSpacing: "0.04em", textTransform: "uppercase", borderRight: i < 4 ? "1px solid var(--ink-200)" : undefined }}>{h}</div>
                ))}
              </div>
              {/* Filas por SKU */}
              {lineas.map((l, i) => {
                const kgN = parseFloat(l.kgRecibidos) || 0;
                const hayFaltante = l.kgRecibidos !== "" && kgN < l.kgContratados;
                const kgOk = l.kgRecibidos !== "" && kgN >= l.kgContratados;
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "160px 1fr 140px 140px 1fr", borderBottom: i < lineas.length - 1 ? "1px solid var(--ink-200)" : undefined, background: hayFaltante ? "#FFF9F0" : kgOk ? "#F8FFF9" : "white" }}>
                    <div style={{ padding: "10px 12px", borderRight: "1px solid var(--ink-200)", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "var(--ink-700)", display: "flex", alignItems: "center" }}>{l.sku}</div>
                    <div style={{ padding: "10px 12px", borderRight: "1px solid var(--ink-200)", fontSize: 12, color: "var(--ink-700)", display: "flex", alignItems: "center" }}>{l.desc}</div>
                    <div style={{ padding: "10px 12px", borderRight: "1px solid var(--ink-200)", fontFamily: "monospace", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center" }}>
                      {l.kgContratados.toLocaleString("es-MX")} kg
                    </div>
                    <div style={{ padding: "8px 10px", borderRight: "1px solid var(--ink-200)", display: "flex", alignItems: "center" }}>
                      <input type="number" step="0.1" className="mono"
                        value={l.kgRecibidos} onChange={e => updateLinea(i, "kgRecibidos", e.target.value)}
                        placeholder={l.kgContratados.toString()}
                        style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid " + (hayFaltante ? "#DC2626" : kgOk ? "#059669" : "var(--ink-200)"), fontWeight: 700, fontSize: 12 }} />
                    </div>
                    <div style={{ padding: "8px 10px", display: "flex", alignItems: "center" }}>
                      <input type="text" value={l.observaciones} onChange={e => updateLinea(i, "observaciones", e.target.value)}
                        placeholder="Notas..." style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid var(--ink-200)", fontSize: 12 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* NCs preview */}
          {difs.length > 0 && (
            <div style={{ marginBottom: 16, borderRadius: 10, border: "1px solid #FED7AA", overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: "#FEF3C7", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: "#D97706", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <IconR name="alert" size={11} />
                </div>
                <div>
                  <span className="fw-700 text-sm" style={{ color: "#92400E" }}>
                    {difs.length} NC{difs.length > 1 ? "s" : ""} a generar automáticamente — sin monto
                  </span>
                  <span className="text-xs" style={{ color: "#92400E", opacity: 0.8, marginLeft: 8 }}>
                    El proveedor comunicará el monto; se captura en el módulo de NCs
                  </span>
                </div>
              </div>
              <div style={{ padding: "10px 14px", background: "white", display: "flex", flexWrap: "wrap", gap: 8 }}>
                {difs.map((d, i) => (
                  <div key={i} style={{ padding: "6px 10px", borderRadius: 7, background: d.tipo === "presentacion" ? "#FEF3C7" : "#FEE2E2", border: "1px solid " + (d.tipo === "presentacion" ? "#FDE68A" : "#FECACA") }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: d.tipo === "presentacion" ? "#92400E" : "#991B1B" }}>
                      {d.tipo === "presentacion" ? "PRESENTACIÓN" : "FALTANTE"}
                    </span>
                    <div className="text-xs" style={{ color: "var(--ink-700)", marginTop: 2 }}>
                      <span className="mono fw-600">{d.sku}</span> · {d.detalle}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Todo ok */}
          {lineas.every(l => l.kgRecibidos !== "") && difs.length === 0 && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: "#F0FDF4", border: "1px solid #BBF7D0", display: "flex", alignItems: "center", gap: 8 }}>
              <IconR name="check" size={16} />
              <span className="fw-600 text-sm" style={{ color: "#065F46" }}>Todos los SKUs coinciden — sin NCs a generar</span>
            </div>
          )}

          {/* Observaciones generales */}
          <div>
            <label className="field-label">Observaciones generales (opcional)</label>
            <textarea className="field-input" rows={2} value={obsGenerales} onChange={e => setObsGenerales(e.target.value)}
              placeholder="Estado del contenedor, incidencias generales…" style={{ resize: "vertical" }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--ink-200)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--ink-50)" }}>
          <div className="text-xs muted">
            Por <span className="fw-600">Ricardo Núñez</span> · {recFmt.Fecha(HOY_REC)}
            {difs.length > 0 && <span style={{ marginLeft: 12, color: "#D97706", fontWeight: 600 }}>⚡ {difs.length} NC{difs.length > 1 ? "s" : ""} sin monto</span>}
          </div>
          <div className="hstack" style={{ gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleConfirmar} disabled={!canConfirm}>
              <IconR name="check" size={13} />
              Confirmar recepción{difs.length > 0 ? ` + ${difs.length} NC${difs.length > 1 ? "s" : ""}` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Vista principal ────────────────────────────────────────────────────────────

const RecepcionView = () => {
  const [modalContrato, setModalContrato] = useStateR(null);
  const [localRecepciones, setLocalRecepciones] = useStateR(window.BLUFIN_DATA.recepciones);

  const contratos = window.BLUFIN_DATA.contratos;
  const recepcionIds = useMemoR(() => new Set(localRecepciones.map(r => r.contrato)), [localRecepciones]);

  const porRecibir = useMemoR(() =>
    contratos
      .filter(c => (c.status === "En tránsito" || c.status === "En puerto") && !recepcionIds.has(c.folio))
      .sort((a, b) => {
        const p = x => x.status === "En puerto" ? 0 : 1;
        return p(a) !== p(b) ? p(a) - p(b) : (a.etaBodega || "").localeCompare(b.etaBodega || "");
      })
  , [contratos, recepcionIds]);

  const historial = useMemoR(() =>
    [...localRecepciones].sort((a, b) => b.fechaRecepcion.localeCompare(a.fechaRecepcion))
  , [localRecepciones]);

  const kpis = useMemoR(() => {
    const ncTotal = localRecepciones.reduce((s, r) => s + (r.ncGeneradas?.length || 0), 0);
    const difPres  = localRecepciones.reduce((s, r) => s + (r.lineas?.filter(l => l.presentacionRecibida !== l.presentacionPactada).length || 0), 0);
    const kgDif    = localRecepciones.reduce((s, r) => s + (r.lineas?.reduce((ss, l) => ss + Math.max(0, l.kgContratados - l.kgRecibidos), 0) || 0), 0);
    return [
      { label: "Por recibir",        value: String(porRecibir.length), sub: "En puerto / En tránsito", accent: porRecibir.length > 0 ? "amber" : null },
      { label: "Recibidos",          value: String(localRecepciones.length), sub: "En historial" },
      { label: "NCs auto-generadas", value: String(ncTotal), sub: "Sin monto, pendientes", accent: ncTotal > 0 ? "amber" : null },
      { label: "Kg faltantes total", value: kgDif > 0 ? kgDif.toLocaleString("es-MX") + " kg" : "0 kg", sub: difPres + " SKU" + (difPres !== 1 ? "s" : "") + " con dif. presentación" },
    ];
  }, [porRecibir, localRecepciones]);

  const facturasMap = useMemoR(() => {
    const m = {};
    (window.BLUFIN_DATA.facturas || []).forEach(f => { if (f.contratoAsociado) m[f.contratoAsociado] = f; });
    return m;
  }, []);

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} className="kpi" style={{ background: k.accent === "amber" ? "linear-gradient(135deg,#FFFBEB 0%,#FEF3C7 100%)" : undefined, borderColor: k.accent === "amber" ? "#FDE68A" : undefined }}>
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-value">{k.value}</span>
            <span className="text-xs muted" style={{ marginTop: 2 }}>{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Por recibir */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", display: "flex", gap: 8, alignItems: "center" }}>
          <span className="fw-700" style={{ fontSize: 14 }}>Por recibir</span>
          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: porRecibir.length > 0 ? "#FEF3C7" : "var(--ink-100)", color: porRecibir.length > 0 ? "#92400E" : "var(--ink-600)", fontWeight: 700 }}>{porRecibir.length}</span>
        </div>
        {porRecibir.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-400)" }}>
            <IconR name="check" size={24} />
            <div style={{ marginTop: 8, fontWeight: 600 }}>Sin contenedores pendientes de recibir</div>
          </div>
        ) : porRecibir.map(c => {
          const dias = window.diasDesde(c.etaBodega);
          const enPuerto = c.status === "En puerto";
          return (
            <div key={c.folio} style={{ padding: "14px 20px", borderBottom: "1px solid var(--ink-100)", display: "grid", gridTemplateColumns: "46px 1fr 130px 110px 100px 180px", gap: 16, alignItems: "center" }}>
              <div style={{ width: 40, padding: "4px 5px", borderRadius: 8, textAlign: "center", background: enPuerto ? "#EDE9FE" : "var(--ink-50)", border: "1px solid " + (enPuerto ? "#C4B5FD" : "var(--ink-200)") }}>
                <div className="text-xs fw-700" style={{ textTransform: "uppercase", letterSpacing: "0.03em", color: enPuerto ? "#5B21B6" : "var(--ink-500)" }}>
                  {new Date((c.etaBodega || HOY_REC) + "T12:00:00").toLocaleDateString("es-MX", { month: "short" })}
                </div>
                <div className="fw-800" style={{ fontSize: 17, lineHeight: 1, color: enPuerto ? "#5B21B6" : "var(--ink-900)" }}>
                  {new Date((c.etaBodega || HOY_REC) + "T12:00:00").getDate()}
                </div>
              </div>
              <div>
                <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
                  <span className="mono fw-700 text-sm">{c.folio}</span>
                  <window.StatusPill status={c.status} />
                </div>
                <div className="text-sm fw-600">{c.productos[0].desc} · {c.productos[0].marca}</div>
                <div className="text-xs muted">{[c.contenedor, c.naviera, c.bodegaDestino].filter(Boolean).join(" · ")}</div>
              </div>
              <div><div className="text-xs muted">Kg contratados</div><div className="mono fw-700">{c.totalKg.toLocaleString("es-MX")} kg</div></div>
              <div><div className="text-xs muted">Presentación</div><div className="fw-700 text-sm" style={{ color: "var(--blue-500)" }}>{c.presentacion}</div></div>
              <div><div className="text-xs muted">SKUs</div><div className="fw-700 text-sm">{c.productos.length}</div></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={() => setModalContrato(c)} style={{ width: "100%" }}>
                  <IconR name="check" size={13} /> Registrar recepción
                </button>
                {facturasMap[c.folio] ? (
                  <button className="btn btn-outline btn-sm" style={{ width: "100%" }} onClick={() => window.open("#", "_blank")} title={`Factura ${facturasMap[c.folio].folioFactura}`}>
                    <IconR name="download" size={13} /> PDF Factura
                  </button>
                ) : (
                  <button className="btn btn-ghost btn-sm" style={{ width: "100%", opacity: 0.38, cursor: "not-allowed" }} disabled>
                    <IconR name="download" size={13} /> Sin factura
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Historial */}
      <div className="card">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ink-100)", display: "flex", gap: 8, alignItems: "center" }}>
          <span className="fw-700" style={{ fontSize: 14 }}>Historial</span>
          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "var(--ink-100)", color: "var(--ink-600)", fontWeight: 700 }}>{historial.length}</span>
        </div>
        {historial.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--ink-400)" }}><div className="text-sm">Sin recepciones registradas.</div></div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>ID</th><th>Contrato</th><th>Fecha</th><th>Bodega</th>
                <th>Intelisis</th><th>SKUs recibidos</th><th>Diferencias</th><th>NCs generadas</th><th>Factura PDF</th>
              </tr>
            </thead>
            <tbody>
              {historial.map(r => {
                const lineas = r.lineas || [];
                const difPres  = lineas.filter(l => l.presentacionRecibida !== l.presentacionPactada).length;
                const kgDif    = lineas.reduce((s, l) => s + Math.max(0, l.kgContratados - l.kgRecibidos), 0);
                const haydif   = difPres > 0 || kgDif > 0;
                return (
                  <tr key={r.id}>
                    <td className="mono text-sm fw-600">{r.id}</td>
                    <td className="mono text-sm">{r.contrato}</td>
                    <td className="text-sm">{recFmt.FechaCorta(r.fechaRecepcion)}</td>
                    <td className="text-sm">{r.bodega}</td>
                    <td className="mono text-sm">{r.entradaIntelisis || <span className="muted">—</span>}</td>
                    <td className="text-sm">{lineas.length} SKU{lineas.length !== 1 ? "s" : ""}</td>
                    <td>
                      {haydif ? (
                        <div style={{ fontSize: 11 }}>
                          {difPres > 0 && <div style={{ color: "#D97706", fontWeight: 600 }}>⚠ {difPres} pres.</div>}
                          {kgDif > 0  && <div style={{ color: "#DC2626", fontWeight: 600 }}>−{kgDif.toLocaleString("es-MX")} kg</div>}
                        </div>
                      ) : (
                        <span className="badge badge-green" style={{ fontSize: 10 }}>✓ OK</span>
                      )}
                    </td>
                    <td>
                      {r.ncGeneradas?.length > 0
                        ? <div className="hstack" style={{ gap: 4, flexWrap: "wrap" }}>{r.ncGeneradas.map(id => <span key={id} className="badge badge-amber" style={{ fontSize: 10 }}>{id}</span>)}</div>
                        : <span className="badge badge-green" style={{ fontSize: 10 }}>✓ Sin NCs</span>
                      }
                    </td>
                    <td>
                      {facturasMap[r.contrato] ? (
                        <button className="btn btn-outline btn-sm" onClick={() => window.open("#", "_blank")} title={`Factura ${facturasMap[r.contrato].folioFactura}`}>
                          <IconR name="download" size={12} /> PDF
                        </button>
                      ) : (
                        <button className="btn btn-ghost btn-sm" style={{ opacity: 0.38, cursor: "not-allowed" }} disabled>
                          <IconR name="download" size={12} /> —
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <RecepcionModal open={!!modalContrato} onClose={() => setModalContrato(null)}
        contrato={modalContrato} onConfirm={rec => setLocalRecepciones(prev => [...prev, rec])} />
    </>
  );
};

Object.assign(window, { RecepcionView });
