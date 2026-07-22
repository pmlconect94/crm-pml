import { useEffect, useMemo, useState } from 'react';
import { supabase, dbNomina } from '@/lib/nomina/db';
import { CODIGOS_ASISTENCIA, MOTIVOS_TE, DIAS_SEMANA } from '@/lib/nomina/calc';
import { fetchMotivosActivos } from '@/lib/nomina/catalogos';
import { fmt, toISO } from '@/lib/nomina/format';

const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const COLOR: Record<string, string> = { A: '#9FDB86', F: '#F58A8A', D: '#F4CE6B', V: '#86BCEC', PSG: '#F2A94E', PCG: '#B79AEC', TXT: '#74D4B4', SUS: '#EE82AE', INC: '#5FC9DC' };

export function TabAsistencias({ semana, nominas, empleados, asistencias, viajeDias, canEdit }: any) {
  const [local, setLocal] = useState<Record<string, any>>({});
  const [sortEmp, setSortEmp] = useState<{ key: 'id_banco' | 'nombre'; dir: 1 | -1 }>({ key: 'id_banco', dir: 1 });
  const [areaFiltro, setAreaFiltro] = useState<string>('Todas');
  const [fullscreen, setFullscreen] = useState(false);
  // Motivos de HE del catálogo (por empresa; ver RH → Catálogos). Respaldo: la
  // lista hardcodeada MOTIVOS_TE si el catálogo no carga.
  const [motivosTE, setMotivosTE] = useState<string[]>(MOTIVOS_TE);
  useEffect(() => {
    fetchMotivosActivos(semana.empresa, 'horas_extra')
      .then((m) => { if (m.length) setMotivosTE(m); })
      .catch(() => {});
  }, [semana.empresa]);
  const toggleSort = (key: 'id_banco' | 'nombre') => setSortEmp((s) => s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) } : { key, dir: 1 });

  // Modo pantalla completa (enfoque): overlay que cubre toda la ventana para capturar sin scrollear el shell.
  // Esc sale; mientras está activo se bloquea el scroll del body.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [fullscreen]);
  const empOrden = useMemo(() => {
    return [...empleados].sort((a, b) => {
      let va: any, vb: any;
      if (sortEmp.key === 'nombre') { va = (a.nombre || '').toLowerCase(); vb = (b.nombre || '').toLowerCase(); }
      else { va = a.id_banco ?? Number.MAX_SAFE_INTEGER; vb = b.id_banco ?? Number.MAX_SAFE_INTEGER; }
      return va < vb ? -1 * sortEmp.dir : va > vb ? 1 * sortEmp.dir : 0;
    });
  }, [empleados, sortEmp]);
  const areas = useMemo(() => Array.from(new Set(empleados.map((e: any) => e.area).filter(Boolean))).sort() as string[], [empleados]);
  const empFiltrados = useMemo(() => areaFiltro === 'Todas' ? empOrden : empOrden.filter((e: any) => e.area === areaFiltro), [empOrden, areaFiltro]);

  useEffect(() => {
    const init: any = {};
    Object.entries(asistencias).forEach(([nomId, lista]: any) => lista.forEach((a: any) => { init[`${nomId}_${a.dia_index}`] = { ...a }; }));
    setLocal(init);
  }, [asistencias]);

  function dias() {
    const out: Date[] = [];
    const ini = new Date(semana.fecha_inicio + 'T12:00:00');
    const fin = new Date(semana.fecha_fin + 'T12:00:00');
    for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) out.push(new Date(d));
    return out;
  }
  const days = dias();
  const get = (nomId: string, i: number) => local[`${nomId}_${i}`] || null;

  // Poner un código a todos los empleados en un día (A entre semana, D los domingos).
  async function llenarDia(i: number, fecha: string, codigo: string) {
    if (!canEdit) return;
    for (const emp of empFiltrados) {
      const nom = nominas[emp.id];
      if (!nom) continue;
      const a = get(nom.id, i);
      if (a?.codigo) continue; // no pisar lo ya capturado
      await update(nom.id, i, fecha, 'codigo', codigo);
    }
  }

  async function update(nomId: string, i: number, fecha: string, campo: string, valor: any) {
    const key = `${nomId}_${i}`;
    const ex = local[key];
    // Validación: si este día ya tiene un viaje para el empleado, avisar al capturar HE.
    if (campo === 'te_horas' && (valor || 0) > 0 && (ex?.te_horas || 0) <= 0) {
      const hl = viajeDias?.[`${nomId}|${fecha}`];
      if (hl !== undefined) {
        const cuando = hl ? `que llegó a las ${hl}` : 'registrado';
        if (!confirm(`Este día ya tiene un VIAJE ${cuando}. ¿Seguro que también lleva horas extra?`)) return;
      }
    }
    const upd = { ...(ex || { nomina_id: nomId, dia_index: i, fecha, codigo: '', te_horas: 0, te_motivo: '', retardo_min: 0 }), [campo]: valor };
    setLocal((p) => ({ ...p, [key]: upd }));
    if (!asistencias[nomId]) asistencias[nomId] = [];
    const idx = asistencias[nomId].findIndex((a: any) => a.dia_index === i);
    if (idx >= 0) asistencias[nomId][idx] = upd; else asistencias[nomId].push(upd);
    try {
      if (ex?.id) await dbNomina.from('asistencias').update({ [campo]: valor }).eq('id', ex.id);
      else {
        // upsert por (nomina_id, dia_index): si ya existe la fila del día la actualiza,
        // si no, la crea. Evita filas duplicadas para el mismo día. Manda la celda completa.
        const { data } = await dbNomina.from('asistencias').upsert({
          nomina_id: nomId, dia_index: i, fecha,
          codigo: upd.codigo || '', te_horas: upd.te_horas || 0, te_motivo: upd.te_motivo || '', retardo_min: upd.retardo_min || 0,
        }, { onConflict: 'nomina_id,dia_index' }).select().single();
        if (data) { setLocal((p) => ({ ...p, [key]: { ...p[key], id: data.id } })); const j = asistencias[nomId].findIndex((a: any) => a.dia_index === i); if (j >= 0) asistencias[nomId][j].id = data.id; }
      }
    } catch (err) { console.error(err); }
  }

  return (
    <div style={fullscreen ? { position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--ink-50)', padding: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' } : undefined}>
      <div className="hstack" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="hstack" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="text-xs muted" style={{ marginRight: 2 }}>Área:</span>
          <div className="segmented" style={{ flexWrap: 'wrap' }}>
            <button className={areaFiltro === 'Todas' ? 'active' : ''} onClick={() => setAreaFiltro('Todas')}>Todas</button>
            {areas.map((a) => <button key={a} className={areaFiltro === a ? 'active' : ''} onClick={() => setAreaFiltro(a)}>{a}</button>)}
          </div>
        </div>
        <button className={`btn btn-sm ${fullscreen ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFullscreen((f) => !f)} title="Capturar a pantalla completa (Esc para salir)">
          {fullscreen ? '✕ Salir de pantalla completa' : '⛶ Pantalla completa'}
        </button>
      </div>
      <div className="hstack" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {Object.entries(COLOR).map(([c, bg]) => <span key={c} className="hstack text-xs" style={{ gap: 4 }}><i style={{ width: 12, height: 12, borderRadius: 3, background: bg, display: 'inline-block', border: '1px solid var(--ink-200)' }} />{c}</span>)}
      </div>
      <div className="card tbl-freeze" style={fullscreen ? { flex: 1, maxHeight: 'none', marginBottom: 0 } : undefined}>
        <table className="tbl" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 180 }}>
                <span onClick={() => toggleSort('id_banco')} style={{ cursor: 'pointer' }}>ID Banco <span style={{ opacity: sortEmp.key === 'id_banco' ? 1 : 0.25 }}>{sortEmp.key === 'id_banco' ? (sortEmp.dir === 1 ? '▲' : '▼') : '↕'}</span></span>
                <span className="muted"> · </span>
                <span onClick={() => toggleSort('nombre')} style={{ cursor: 'pointer' }}>Empleado <span style={{ opacity: sortEmp.key === 'nombre' ? 1 : 0.25 }}>{sortEmp.key === 'nombre' ? (sortEmp.dir === 1 ? '▲' : '▼') : '↕'}</span></span>
              </th>
              {days.map((d, i) => {
                const dn = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
                const esDomingo = d.getDay() === 0;
                return (
                  <th key={i} colSpan={4} className="center" style={{ borderLeft: '2px solid var(--ink-300)' }}>
                    <div className="hstack" style={{ justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span>{dn} {d.getDate()} {MESES_C[d.getMonth()]}</span>
                      {canEdit && <button className="btn btn-outline btn-sm" style={{ padding: '1px 6px', fontSize: 10 }} title={`Marcar ${esDomingo ? 'descanso (D)' : 'asistencia (A)'} a todos en este día`} onClick={() => llenarDia(i, toISO(d), esDomingo ? 'D' : 'A')}>✓ Todos {esDomingo ? 'D' : 'A'}</button>}
                    </div>
                    <div className="hstack" style={{ gap: 3, marginTop: 3, paddingLeft: 4, justifyContent: 'flex-start', fontWeight: 400 }}>
                      <span style={{ width: 56, fontSize: 9, color: 'var(--ink-500)', textAlign: 'center' }}>Cód</span>
                      <span style={{ width: 40, fontSize: 9, color: 'var(--ink-500)', textAlign: 'center' }}>Ret</span>
                      <span style={{ width: 40, fontSize: 9, color: 'var(--ink-500)', textAlign: 'center' }}>T.E.</span>
                      <span style={{ width: 64, fontSize: 9, color: 'var(--ink-500)', textAlign: 'center' }}>Mot</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {empFiltrados.map((emp: any) => {
              const nom = nominas[emp.id]; if (!nom) return null;
              return (
                <tr key={emp.id}>
                  <td style={{ minWidth: 180 }}>
                    <div className="hstack" style={{ gap: 8 }}>
                      <span className="mono fw-700" style={{ minWidth: 26, color: 'var(--ink-500)' }}>{emp.id_banco ?? '—'}</span>
                      <div><div className="fw-600">{emp.nombre}</div><div className="text-xs muted">{emp.area}</div></div>
                    </div>
                  </td>
                  {days.map((d, i) => {
                    const a = get(nom.id, i); const codigo = a?.codigo || '';
                    return (
                      <td key={i} colSpan={4} style={{ padding: 4, borderLeft: '2px solid var(--ink-300)' }}>
                        <div className="hstack" style={{ gap: 3 }}>
                          <select value={codigo} disabled={!canEdit} onChange={(e) => update(nom.id, i, toISO(d), 'codigo', e.target.value)} style={{ width: 56, padding: '4px 2px', borderRadius: 6, border: '1px solid var(--ink-200)', background: COLOR[codigo] || 'white', fontSize: 11 }}>
                            <option value="">—</option>{CODIGOS_ASISTENCIA.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <input type="number" value={a?.retardo_min || ''} min="0" step="0.25" placeholder="0" disabled={!canEdit} onChange={(e) => update(nom.id, i, toISO(d), 'retardo_min', parseFloat(e.target.value) || 0)} style={{ width: 40, padding: '4px', borderRadius: 6, border: '1px solid var(--ink-200)', fontSize: 11 }} />
                          <input type="number" value={a?.te_horas || ''} min="0" step="0.5" placeholder="0" disabled={!canEdit} onChange={(e) => update(nom.id, i, toISO(d), 'te_horas', parseFloat(e.target.value) || 0)} style={{ width: 40, padding: '4px', borderRadius: 6, border: '1px solid var(--ink-200)', fontSize: 11 }} />
                          <select value={a?.te_motivo || ''} disabled={!canEdit || !(a?.te_horas > 0)} onChange={(e) => update(nom.id, i, toISO(d), 'te_motivo', e.target.value)} style={{ width: 64, padding: '4px 2px', borderRadius: 6, border: '1px solid var(--ink-200)', fontSize: 10 }}>
                            <option value="">—</option>{(a?.te_motivo && !motivosTE.includes(a.te_motivo) ? [a.te_motivo, ...motivosTE] : motivosTE).map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: 12, padding: 12, display: fullscreen ? 'none' : undefined }}>
        <div className="text-xs fw-700" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-500)' }}>Incidencias — qué resta y qué no (todo queda en el historial)</div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
          {[
            { c: 'A', n: 'Asistencia', resta: false },
            { c: 'D', n: 'Descanso (paga vía séptimo)', resta: false },
            { c: 'V', n: 'Vacación', resta: false },
            { c: 'PCG', n: 'Permiso con goce de sueldo', resta: false },
            { c: 'TXT', n: 'Tiempo x Tiempo', resta: false },
            { c: 'F', n: 'Falta', resta: true },
            { c: 'PSG', n: 'Permiso sin goce de sueldo', resta: true },
            { c: 'SUS', n: 'Suspensión', resta: true },
            { c: 'INC', n: 'Incapacidad', resta: true },
          ].map((it) => (
            <div key={it.c} className="hstack text-xs" style={{ gap: 6, justifyContent: 'space-between', padding: '3px 6px', borderRadius: 6, background: COLOR[it.c] || 'var(--ink-50)' }}>
              <span><strong>{it.c}</strong> · {it.n}</span>
              <span className={`badge ${it.resta ? 'badge-red' : 'badge-green'}`}>{it.resta ? 'Resta' : 'No resta'}</span>
            </div>
          ))}
        </div>
        <p className="text-xs muted" style={{ margin: '8px 0 0' }}>Además: <strong>Ret</strong> = retardo en horas (se resta) · <strong>T.E.</strong> = tiempo extra en horas · <strong>Mot</strong> = motivo del tiempo extra.</p>
      </div>
    </div>
  );
}
