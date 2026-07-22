import { useEffect, useMemo, useState } from 'react';
import { supabase, dbNomina } from '@/lib/nomina/db';
import { fmt, MESES } from '@/lib/nomina/format';
import { PageEnter } from '@/components/motion';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/lib/nomina/auth';
import { useRhPermisos } from '@/lib/nomina/permisos';
import { useEmpresa } from '@/lib/nomina/empresas';
import { descargarXLSX } from './tabs/printNomina';

const COSTO_COMEDOR = 30;

/* ───────────────────────── helpers ───────────────────────── */
const N = (v: any) => Number(v) || 0;
const nh = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2)); // horas legibles
const mesKey = (fecha?: string | null) => (fecha ? fecha.slice(0, 7) : '');
const mesLabel = (k: string) => {
  if (!k) return '';
  const [y, m] = k.split('-');
  return `${MESES[Number(m) - 1]} ${y}`;
};

type Emp = { id: string; nombre: string; id_banco: number | null; activo: boolean };
type Asis = { fecha: string; codigo: string | null; te_horas: any; te_motivo: string | null; retardo_min: any; nomina_id: string };
type Viaje = { fecha: string; destino: string | null; chofer_id: string | null; acompanante_id: string | null; retroactivo: boolean };
type Comida = { fecha: string; empleado_id: string; cantidad?: number | null };
type Prestamo = { empleado_id: string; monto: any; saldo: any; activo: boolean };

/* ─────────────── barra horizontal (ranking) ─────────────── */
function BarList({ items, color, unit = '', empty = 'Sin datos este mes.' }: {
  items: { label: string; value: number }[]; color: string; unit?: string; empty?: string;
}) {
  if (!items.length) return <p className="text-sm muted" style={{ margin: 0 }}>{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="vstack" style={{ gap: 10 }}>
      {items.map((it) => (
        <div key={it.label} className="hstack" style={{ gap: 12, alignItems: 'center' }}>
          <span style={{ flex: '0 0 38%', fontSize: 13, color: 'var(--ink-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={it.label}>{it.label}</span>
          <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--ink-100)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(6, (it.value / max) * 100)}%`, height: '100%', borderRadius: 999, background: color, transition: 'width 420ms var(--ease-soft)' }} />
          </div>
          <span style={{ flex: '0 0 auto', minWidth: 44, textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
            {nh(it.value)}{unit && <span style={{ fontWeight: 500, color: 'var(--ink-400)', fontSize: 11 }}> {unit}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function SectionCard({ title, hint, children, style, action }: { title: string; hint?: string; children: any; style?: any; action?: any }) {
  return (
    <div className="card" style={style}>
      <div className="card-body">
        <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
          <div>
            <div className="fw-700" style={{ fontSize: 14, letterSpacing: '-0.01em' }}>{title}</div>
            {hint && <div className="text-xs muted" style={{ marginTop: 2 }}>{hint}</div>}
          </div>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const rhPerm = useRhPermisos();
  // Qué tarjetas del Resumen puede ver este usuario (permisos granulares).
  const ve = (k: string) => rhPerm.resumen.includes(k);
  const { code: empresa } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [nomMap, setNomMap] = useState<Record<string, string>>({}); // nomina_id → empleado_id
  const [asis, setAsis] = useState<Asis[]>([]);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [comidas, setComidas] = useState<Comida[]>([]);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [mes, setMes] = useState<string>('');
  const [detalle, setDetalle] = useState<string | null>(null); // tile de incidencia abierto

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [emp, nom, a, v, c, p] = await Promise.all([
        dbNomina.from('empleados').select('id,nombre,id_banco,activo').eq('empresa', empresa),
        dbNomina.from('nominas').select('id,empleado_id'),
        dbNomina.from('asistencias').select('fecha,codigo,te_horas,te_motivo,retardo_min,nomina_id'),
        dbNomina.from('viajes').select('fecha,destino,chofer_id,acompanante_id,retroactivo'),
        dbNomina.from('comedor_registro').select('fecha,empleado_id,cantidad'),
        dbNomina.from('prestamos').select('empleado_id,monto,saldo,activo').eq('activo', true),
      ]);
      // Solo datos de los empleados de esta empresa.
      const empList = (emp.data || []) as Emp[];
      const empIds = new Set(empList.map((e) => e.id));
      const noms = ((nom.data || []) as any[]).filter((n) => empIds.has(n.empleado_id));
      const nomIds = new Set(noms.map((n) => n.id));
      setEmps(empList);
      setNomMap(Object.fromEntries(noms.map((n) => [n.id, n.empleado_id])));
      setAsis(((a.data || []) as Asis[]).filter((x: any) => nomIds.has(x.nomina_id)));
      setViajes(((v.data || []) as Viaje[]).filter((x: any) => empIds.has(x.chofer_id) || empIds.has(x.acompanante_id)));
      setComidas(((c.data || []) as Comida[]).filter((x: any) => empIds.has(x.empleado_id)));
      setPrestamos(((p.data || []) as Prestamo[]).filter((x: any) => empIds.has(x.empleado_id)));
      setLoading(false);
    })();
  }, [empresa]);

  const empMap = useMemo(() => Object.fromEntries(emps.map((e) => [e.id, e])), [emps]);
  const nombre = (empId?: string | null) => (empId && empMap[empId]?.nombre) || '—';

  // Meses disponibles (con datos) + mes actual, más reciente primero.
  const meses = useMemo(() => {
    const set = new Set<string>();
    asis.forEach((x) => set.add(mesKey(x.fecha)));
    viajes.forEach((x) => set.add(mesKey(x.fecha)));
    comidas.forEach((x) => set.add(mesKey(x.fecha)));
    set.delete('');
    const arr = Array.from(set).sort().reverse();
    return arr;
  }, [asis, viajes, comidas]);

  useEffect(() => { if (!mes && meses.length) setMes(meses[0]); }, [meses, mes]);

  /* ───────── agregados del mes seleccionado ───────── */
  const data = useMemo(() => {
    const enMes = (f?: string | null) => !!f && mesKey(f) === mes;

    // Incidencias: por código (días) y por empleado.
    const dias: Record<string, number> = {};
    const porEmp: Record<string, Record<string, number>> = {}; // codigo → {empId: dias}
    const retEmp: Record<string, number> = {};                  // empId → horas retardo
    const teEmp: Record<string, number> = {};                   // empId → horas extra
    const teMotivo: Record<string, number> = {};                // motivo → horas
    let retTot = 0, teTot = 0;

    for (const a of asis) {
      if (!enMes(a.fecha)) continue;
      const empId = nomMap[a.nomina_id];
      if (a.codigo) {
        dias[a.codigo] = (dias[a.codigo] || 0) + 1;
        (porEmp[a.codigo] ||= {})[empId] = ((porEmp[a.codigo] || {})[empId] || 0) + 1;
      }
      const te = N(a.te_horas);
      if (te > 0) {
        teTot += te; if (empId) teEmp[empId] = (teEmp[empId] || 0) + te;
        const m = (a.te_motivo || '').trim() || 'Sin motivo';
        teMotivo[m] = (teMotivo[m] || 0) + te;
      }
      const ret = N(a.retardo_min);
      if (ret > 0) { retTot += ret; if (empId) retEmp[empId] = (retEmp[empId] || 0) + ret; }
    }

    // Viajes del mes: destinos y choferes.
    const dest: Record<string, number> = {};
    const chof: Record<string, number> = {};
    let viajesMes = 0;
    for (const v of viajes) {
      if (!mesKey(v.fecha) || mesKey(v.fecha) !== mes) continue;
      viajesMes++;
      const d = (v.destino || '').trim() || 'Sin destino';
      dest[d] = (dest[d] || 0) + 1;
      if (v.chofer_id) chof[v.chofer_id] = (chof[v.chofer_id] || 0) + 1;
    }

    // Comedor.
    const comMes = comidas.filter((c) => mesKey(c.fecha) === mes);
    const comidasTot = comMes.length;
    const personasComedor = new Set(comMes.map((c) => c.empleado_id)).size;

    const rank = (obj: Record<string, number>, label: (k: string) => string, top = 6) =>
      Object.entries(obj).map(([k, v]) => ({ label: label(k), value: v })).sort((a, b) => b.value - a.value).slice(0, top);

    const empList = (obj: Record<string, number> = {}) =>
      Object.entries(obj).map(([id, v]) => ({ nombre: nombre(id), value: v, id_banco: empMap[id]?.id_banco ?? null }))
        .sort((a, b) => b.value - a.value);

    return {
      dias, retTot, teTot,
      faltas: empList(porEmp['F']),
      inc: empList(porEmp['INC']),
      vac: empList(porEmp['V']),
      pcg: empList(porEmp['PCG']),
      psg: empList(porEmp['PSG']),
      retList: empList(retEmp),
      teList: empList(teEmp),
      topDest: rank(dest, (k) => k),
      topChof: rank(chof, (id) => nombre(id)),
      motivos: rank(teMotivo, (k) => k),
      comidasTot, personasComedor, viajesMes,
    };
  }, [asis, viajes, comidas, nomMap, mes, empMap]);

  // Tiles de incidencias (clic = despliega quién).
  const tiles = [
    { key: 'F', label: 'Faltas', val: data.dias['F'] || 0, unit: 'días', color: 'var(--red-500)', list: data.faltas, lu: '' },
    { key: 'INC', label: 'Incapacidades', val: data.dias['INC'] || 0, unit: 'días', color: '#5FC9DC', list: data.inc, lu: '' },
    { key: 'RET', label: 'Retardos', val: data.retTot, unit: 'h', color: 'var(--amber-500)', list: data.retList, lu: 'h' },
    { key: 'TE', label: 'Horas extra', val: data.teTot, unit: 'h', color: 'var(--blue-500)', list: data.teList, lu: 'h' },
    { key: 'V', label: 'Vacaciones', val: data.dias['V'] || 0, unit: 'días', color: 'var(--green-500)', list: data.vac, lu: '' },
    { key: 'PCG', label: 'Permiso c/goce', val: data.dias['PCG'] || 0, unit: 'días', color: 'var(--violet-500)', list: data.pcg, lu: '' },
    { key: 'PSG', label: 'Permiso s/goce', val: data.dias['PSG'] || 0, unit: 'días', color: 'var(--amber-500)', list: data.psg, lu: '' },
  ];
  const tileSel = tiles.find((t) => t.key === detalle);

  const activos = emps.filter((e) => e.activo).length;
  const saldoPrestamos = prestamos.reduce((s, p) => s + N(p.saldo), 0);

  // ── Exportar Excel del mes seleccionado ──
  const fmtDia = (f: string) => { const d = new Date(f + 'T12:00:00'); return `${d.getDate()}/${d.getMonth() + 1}`; };

  // Comedor: matriz empleados × días que comieron (cantidad por día) + total y monto.
  function exportComedor() {
    const comMes = comidas.filter((c) => mesKey(c.fecha) === mes);
    if (!comMes.length) { alert(`No hay registros de comedor en ${mesLabel(mes)}.`); return; }
    const fechas = Array.from(new Set(comMes.map((c) => c.fecha))).sort();
    const porEmp = new Map<string, Map<string, number>>();
    comMes.forEach((c) => {
      const m = porEmp.get(c.empleado_id) ?? new Map<string, number>();
      m.set(c.fecha, (m.get(c.fecha) || 0) + (N(c.cantidad) || 1));
      porEmp.set(c.empleado_id, m);
    });
    const empIds = [...porEmp.keys()].sort((a, b) => nombre(a).localeCompare(nombre(b)));
    const totalPorFecha: Record<string, number> = {};
    let gran = 0;
    const aoa: (string | number)[][] = [['Empleado', ...fechas.map(fmtDia), 'Total comidas', 'Monto']];
    empIds.forEach((id) => {
      const m = porEmp.get(id)!;
      let tot = 0;
      const row: (string | number)[] = [nombre(id)];
      fechas.forEach((f) => { const c = m.get(f) || 0; row.push(c || ''); tot += c; totalPorFecha[f] = (totalPorFecha[f] || 0) + c; });
      row.push(tot, Math.round(tot * COSTO_COMEDOR * 100) / 100);
      gran += tot;
      aoa.push(row);
    });
    aoa.push(['TOTAL', ...fechas.map((f) => totalPorFecha[f] || 0), gran, Math.round(gran * COSTO_COMEDOR * 100) / 100]);
    descargarXLSX(aoa, 'Comedor', `comedor_${empresa}_${mes}.xlsx`);
  }

  // Incidencias: matriz empleados × tipo de incidencia (del mes) con su valor.
  function exportIncidencias() {
    const nombres = new Set<string>();
    tiles.forEach((t) => t.list.forEach((p: any) => nombres.add(p.nombre)));
    if (!nombres.size) { alert(`No hay incidencias en ${mesLabel(mes)}.`); return; }
    const aoa: (string | number)[][] = [['Empleado', ...tiles.map((t) => `${t.label}${t.unit ? ` (${t.unit})` : ''}`)]];
    [...nombres].sort((a, b) => a.localeCompare(b)).forEach((nom) => {
      const row: (string | number)[] = [nom];
      tiles.forEach((t) => { const f = t.list.find((p: any) => p.nombre === nom); row.push(f ? f.value : 0); });
      aoa.push(row);
    });
    descargarXLSX(aoa, 'Incidencias', `incidencias_${empresa}_${mes}.xlsx`);
  }

  const btnExcel = (onClick: () => void) => (
    <button className="btn btn-outline btn-sm" onClick={onClick} disabled={!mes} title="Descargar Excel del mes">
      <Icon name="download" size={13} /> Excel
    </button>
  );

  return (
    <PageEnter>
      <div className="page-header" style={{ alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title">Hola, {user?.nombre?.split(' ')[0]}</h1>
          <p className="page-subtitle">Resumen de Recursos Humanos</p>
        </div>
        <label className="vstack" style={{ gap: 4, alignItems: 'flex-end' }}>
          <span className="text-xs muted">Mes</span>
          <select className="field-input" style={{ minWidth: 180, width: 'auto' }} value={mes} onChange={(e) => { setMes(e.target.value); setDetalle(null); }}>
            {meses.length === 0 && <option value="">—</option>}
            {meses.map((m) => <option key={m} value={m} style={{ textTransform: 'capitalize' }}>{mesLabel(m)}</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="vstack" style={{ gap: 16 }}>
          {/* ───── Incidencias del mes (tiles + detalle desplegable) ───── */}
          {ve('incidencias') && (
          <SectionCard title="Incidencias del mes" hint={`${mesLabel(mes)} · pulsa una tarjeta para ver quién`} action={btnExcel(exportIncidencias)}>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              {tiles.map((t) => {
                const open = detalle === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setDetalle(open ? null : t.key)}
                    className="kpi"
                    style={{
                      textAlign: 'left', cursor: 'pointer', borderLeft: `3px solid ${t.color}`,
                      outline: open ? `2px solid ${t.color}` : 'none', outlineOffset: -1,
                      background: open ? 'var(--blue-50)' : 'white',
                    }}
                  >
                    <span className="kpi-label">{t.label}</span>
                    <span className="hstack" style={{ alignItems: 'baseline', gap: 4 }}>
                      <span className="kpi-value">{nh(t.val)}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-400)' }}>{t.unit}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-400)' }}>{t.list.length} {t.list.length === 1 ? 'persona' : 'personas'} ›</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {tileSel && (
              <div style={{ marginTop: 14, padding: 14, borderRadius: 'var(--r-md)', background: 'var(--ink-50)', border: '1px solid var(--ink-200)' }}>
                <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                  <span className="fw-700 text-sm">{tileSel.label} · detalle</span>
                  <button className="text-xs muted" style={{ cursor: 'pointer' }} onClick={() => setDetalle(null)}>cerrar ✕</button>
                </div>
                {tileSel.list.length === 0 ? (
                  <p className="text-sm muted" style={{ margin: 0 }}>Nadie con {tileSel.label.toLowerCase()} este mes. </p>
                ) : (
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
                    {tileSel.list.map((p, i) => (
                      <div key={i} className="hstack" style={{ justifyContent: 'space-between', gap: 10, padding: '6px 10px', background: 'white', borderRadius: 8, border: '1px solid var(--ink-200)' }}>
                        <span style={{ fontSize: 13, color: 'var(--ink-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.nombre}>{p.nombre}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{nh(p.value)}{tileSel.lu && ` ${tileSel.lu}`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </SectionCard>
          )}

          {/* ───── Viajes: destinos + choferes ───── */}
          {ve('viajes') && (
          <div className="grid grid-2" style={{ gap: 16 }}>
            <SectionCard title="Destinos más visitados" hint={`${data.viajesMes} viaje${data.viajesMes === 1 ? '' : 's'} en ${mesLabel(mes)}`}>
              <BarList items={data.topDest} color="var(--blue-500)" unit="viajes" />
            </SectionCard>
            <SectionCard title="Choferes que más viajaron" hint="Por número de viajes">
              <BarList items={data.topChof} color="var(--green-500)" unit="viajes" />
            </SectionCard>
          </div>
          )}

          {/* ───── Motivos HE + Comedor ───── */}
          {(ve('motivos_he') || ve('comedor')) && (
          <div className="grid grid-2" style={{ gap: 16 }}>
            {ve('motivos_he') && (
            <SectionCard title="Motivos de horas extra" hint={`${nh(data.teTot)} h en total`}>
              <BarList items={data.motivos} color="var(--violet-500)" unit="h" />
            </SectionCard>
            )}
            {ve('comedor') && (
            <SectionCard title="Comedor" hint={`${mesLabel(mes)}`} action={btnExcel(exportComedor)}>
              <div className="hstack" style={{ gap: 24, alignItems: 'center', height: '100%', minHeight: 80 }}>
                <div className="vstack" style={{ gap: 2 }}>
                  <span style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{data.comidasTot}</span>
                  <span className="text-xs muted">comidas servidas</span>
                </div>
                <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--ink-200)' }} />
                <div className="vstack" style={{ gap: 2 }}>
                  <span style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{data.personasComedor}</span>
                  <span className="text-xs muted">personas distintas</span>
                </div>
              </div>
            </SectionCard>
            )}
          </div>
          )}

          {/* ───── Préstamos ───── */}
          {ve('prestamos') && (
          <SectionCard title="Préstamos activos" hint={`${prestamos.length} activo${prestamos.length === 1 ? '' : 's'} · saldo total ${fmt(saldoPrestamos)}`}>
            {prestamos.length === 0 ? (
              <p className="text-sm muted" style={{ margin: 0 }}>Sin préstamos activos.</p>
            ) : (
              <div className="vstack" style={{ gap: 12 }}>
                {[...prestamos].sort((a, b) => N(b.saldo) - N(a.saldo)).map((p, i) => {
                  const pct = N(p.monto) > 0 ? Math.round((1 - N(p.saldo) / N(p.monto)) * 100) : 0;
                  return (
                    <div key={i} className="hstack" style={{ gap: 12, alignItems: 'center' }}>
                      <span style={{ flex: '0 0 34%', fontSize: 13, color: 'var(--ink-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={nombre(p.empleado_id)}>{nombre(p.empleado_id)}</span>
                      <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--ink-100)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'var(--green-500)' }} />
                      </div>
                      <span style={{ flex: '0 0 38px', textAlign: 'right', fontSize: 12, color: 'var(--ink-500)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                      <span style={{ flex: '0 0 92px', textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(N(p.saldo))}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
          )}

          {/* ───── Pie: totales generales (cada KPI sigue su permiso) ───── */}
          <div className="grid grid-4" style={{ gap: 12 }}>
            {ve('empleados') && <div className="kpi"><span className="kpi-label">Empleados activos</span><span className="kpi-value">{activos}</span></div>}
            {ve('viajes') && <div className="kpi"><span className="kpi-label">Viajes del mes</span><span className="kpi-value">{data.viajesMes}</span></div>}
            {ve('motivos_he') && <div className="kpi"><span className="kpi-label">Horas extra del mes</span><span className="kpi-value">{nh(data.teTot)} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-400)' }}>h</span></span></div>}
            {ve('prestamos') && <div className="kpi"><span className="kpi-label">Saldo en préstamos</span><span className="kpi-value" style={{ fontSize: 16 }}>{fmt(saldoPrestamos)}</span></div>}
          </div>
        </div>
      )}
    </PageEnter>
  );
}
