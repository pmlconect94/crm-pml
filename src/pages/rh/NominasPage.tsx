import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase, dbNomina } from '@/lib/nomina/db';
import { useAuth } from '@/lib/nomina/auth';
import { useRhPermisos } from '@/lib/nomina/permisos';
import { useEmpresa } from '@/lib/nomina/empresas';
import { fmtPeriodo, toISO, MESES } from '@/lib/nomina/format';
import { Icon } from '@/components/Icon';
import { PageEnter } from '@/components/motion';

function sugerencia(tipo: string) {
  const hoy = new Date();
  const a = hoy.getFullYear(), m = hoy.getMonth(), d = hoy.getDate();
  if (tipo === 'semanal') {
    const dow = hoy.getDay();
    const lunes = new Date(hoy); lunes.setDate(d - (dow === 0 ? 6 : dow - 1));
    const dom = new Date(lunes); dom.setDate(lunes.getDate() + 6);
    return { ini: lunes, fin: dom };
  }
  if (d <= 15) return { ini: new Date(a, m, 1), fin: new Date(a, m, 15) };
  return { ini: new Date(a, m, 16), fin: new Date(a, m + 1, 0) };
}

export function NominasPage() {
  const { user } = useAuth();
  const rhPerm = useRhPermisos();
  const { code: empresa } = useEmpresa();
  const navigate = useNavigate();
  const canEdit = user?.rol !== 'viewer';
  const [semanas, setSemanas] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<'abierta' | 'timbrada' | 'todas'>('abierta');
  const [modal, setModal] = useState(false);
  const [tipo, setTipo] = useState<string | null>(null);
  const [ini, setIni] = useState(''); const [fin, setFin] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch(); }, [empresa]);
  async function fetch() {
    const { data } = await dbNomina.from('semanas').select('*').eq('empresa', empresa).order('fecha_inicio', { ascending: false });
    setSemanas(data || []);
  }
  function selTipo(t: string) { setTipo(t); const s = sugerencia(t); setIni(toISO(s.ini)); setFin(toISO(s.fin)); }

  async function crear() {
    if (!tipo || !ini || !fin) return;
    setSaving(true);
    const esquema = tipo === 'semanal' ? 'Semanal' : 'Quincenal';

    // Nómina ANTERIOR del mismo esquema y empresa (la más reciente antes de esta fecha) → para copiar ISR/IMSS.
    const { data: prevSem } = await dbNomina.from('semanas').select('id').eq('tipo', tipo).eq('empresa', empresa).lt('fecha_inicio', ini).order('fecha_inicio', { ascending: false }).limit(1).maybeSingle();
    const fiscalPrev: Record<string, { isr: number; imss: number }> = {};
    if (prevSem) {
      const { data: prevNoms } = await dbNomina.from('nominas').select('empleado_id, isr, imss').eq('semana_id', prevSem.id);
      (prevNoms || []).forEach((n: any) => { fiscalPrev[n.empleado_id] = { isr: n.isr || 0, imss: n.imss || 0 }; });
    }

    const { data: semana, error } = await dbNomina.from('semanas').insert({ fecha_inicio: ini, fecha_fin: fin, tipo, status: 'abierta', empresa }).select().single();
    if (error) { toast.error(error.message); setSaving(false); return; }
    // Solo los empleados activos de ESE esquema y empresa. Se copia el ISR/IMSS de la nómina anterior.
    const { data: emps } = await dbNomina.from('empleados').select('id').eq('activo', true).eq('esquema_pago', esquema).eq('empresa', empresa);
    if (emps?.length) await dbNomina.from('nominas').insert(emps.map((e: any) => ({ semana_id: semana.id, empleado_id: e.id, isr: fiscalPrev[e.id]?.isr || 0, imss: fiscalPrev[e.id]?.imss || 0 })));
    const copiados = Object.keys(fiscalPrev).length;
    toast.success(`Nómina creada con ${emps?.length || 0} empleados ${esquema.toLowerCase()}s${copiados ? ' · ISR/IMSS copiado de la anterior' : ''}`);
    setModal(false); setTipo(null); setIni(''); setFin(''); setSaving(false); fetch();
  }

  async function eliminar(e: React.MouseEvent, s: any) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar la nómina "${fmtPeriodo(s.fecha_inicio, s.fecha_fin)}"?`)) return;
    await dbNomina.from('semanas').delete().eq('id', s.id);
    fetch();
  }

  // Permisos granulares: solo los TIPOS de nómina permitidos (ej. Efraín solo
  // ve semanales; las quincenales ni aparecen en la lista).
  const visibles = semanas.filter((s) => rhPerm.nominasTipos.includes(s.tipo));
  const lista = filtro === 'todas' ? visibles : visibles.filter((s) => s.status === filtro);

  // Agrupadas por mes (YYYY-MM). `lista` ya viene ordenada por fecha_inicio DESC,
  // así que los meses salen del más reciente al más viejo.
  const porMes = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of lista) {
      const key = (s.fecha_inicio ?? '').slice(0, 7);
      (map.get(key) ?? map.set(key, []).get(key)!).push(s);
    }
    return Array.from(map.entries());
  }, [lista]);

  // Colapsable por mes: por default se abre el mes más reciente (idx 0) y los
  // demás quedan cerrados. En cuanto el usuario toca uno, manda su selección.
  const [expandido, setExpandido] = useState<Set<string> | null>(null);
  const estaAbierto = (key: string, idx: number) => (expandido ? expandido.has(key) : idx === 0);
  const toggleMes = (key: string) => {
    setExpandido((prev) => {
      const base = new Set(prev ?? (porMes[0] ? [porMes[0][0]] : []));
      base.has(key) ? base.delete(key) : base.add(key);
      return base;
    });
  };
  const mesLabel = (key: string) => {
    const [y, m] = key.split('-');
    return `${MESES[Number(m) - 1] ?? ''} ${y}`;
  };
  // Color por tipo, MUY tenue: solo diferencia semanal (azul) vs quincenal
  // (violeta) sin resaltar. La franja izquierda es el diferenciador.
  const tipoColor = (t: string) =>
    t === 'semanal'
      ? { accent: 'var(--blue-500)', tint: 'color-mix(in srgb, var(--blue-500) 5%, white)', soft: 'var(--blue-100)' }
      : { accent: 'var(--violet-500)', tint: 'color-mix(in srgb, var(--violet-500) 6%, white)', soft: 'color-mix(in srgb, var(--violet-500) 15%, white)' };

  return (
    <PageEnter>
      <div className="page-header">
        <div>
          <h1 className="page-title">Nóminas</h1>
          <p className="page-subtitle">Selecciona una nómina para capturar incidencias</p>
        </div>
        {canEdit && rhPerm.crearNomina && <button className="btn btn-primary" onClick={() => { setModal(true); setTipo(null); setIni(''); setFin(''); }}><Icon name="plus" size={15} /> Crear nómina</button>}
      </div>

      <div className="segmented" style={{ marginBottom: 14 }}>
        {(['abierta', 'timbrada', 'todas'] as const).map((x) => (
          <button key={x} className={filtro === x ? 'active' : ''} onClick={() => setFiltro(x)}>{x === 'abierta' ? 'Abiertas' : x === 'timbrada' ? 'Guardadas' : 'Todas'}</button>
        ))}
      </div>

      {/* Leyenda de colores por tipo */}
      {lista.length > 0 && (
        <div className="hstack" style={{ gap: 14, marginBottom: 10, fontSize: 11, color: 'var(--ink-500)' }}>
          <span className="hstack" style={{ gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--blue-500)', opacity: 0.8 }} /> Semanal</span>
          <span className="hstack" style={{ gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--violet-500)', opacity: 0.8 }} /> Quincenal</span>
        </div>
      )}

      <div className="vstack" style={{ gap: 10 }}>
        {lista.length === 0 && <div className="card"><div className="empty"><div className="empty-title">No hay nóminas</div></div></div>}
        {porMes.map(([mesKey, items], idx) => {
          const abierto = estaAbierto(mesKey, idx);
          const nSem = items.filter((x) => x.tipo === 'semanal').length;
          const nQui = items.length - nSem;
          return (
            <div key={mesKey} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => toggleMes(mesKey)}
                className="hstack"
                style={{ width: '100%', gap: 10, padding: '12px 16px', background: 'var(--ink-50)', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                aria-expanded={abierto}
              >
                <Icon name="chevron-right" size={15} style={{ color: 'var(--ink-500)', transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform 160ms' }} />
                <span className="fw-700" style={{ textTransform: 'capitalize', fontSize: 13 }}>{mesLabel(mesKey)}</span>
                <span className="text-xs muted" style={{ marginLeft: 'auto' }}>
                  {items.length} nómina{items.length !== 1 ? 's' : ''}
                  {nSem > 0 && ` · ${nSem} sem`}{nQui > 0 && ` · ${nQui} quinc`}
                </span>
              </button>
              {abierto && (
                <div className="vstack" style={{ gap: 0 }}>
                  {items.map((s) => {
                    const col = tipoColor(s.tipo);
                    return (
                      <div
                        key={s.id}
                        className="clickable"
                        style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--ink-100)', borderLeft: `3px solid ${col.accent}`, background: col.tint }}
                        onClick={() => navigate(`/app/rh/nominas/${s.id}`)}
                      >
                        <div className="hstack" style={{ gap: 14 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', background: col.soft, color: col.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="file-text" size={17} /></div>
                          <div>
                            <div className="fw-600">{fmtPeriodo(s.fecha_inicio, s.fecha_fin)}</div>
                            <div className="text-xs muted" style={{ textTransform: 'capitalize' }}>{s.tipo}</div>
                          </div>
                        </div>
                        <div className="hstack" style={{ gap: 10 }}>
                          <span className={`badge ${s.status === 'abierta' ? 'badge-blue' : 'badge-green'}`}><span className="dot" />{s.status === 'abierta' ? 'Abierta' : 'Guardada'}</span>
                          {canEdit && s.status === 'abierta' && <button className="btn btn-ghost btn-sm" onClick={(e) => eliminar(e, s)} title="Eliminar"><Icon name="trash" size={14} /></button>}
                          <Icon name="chevron-right" size={18} style={{ color: 'var(--ink-400)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal page-enter" style={{ maxWidth: 560 }}>
            <div className="modal-header"><h3 className="modal-title">Nueva nómina</h3><button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}><Icon name="x" size={16} /></button></div>
            <div className="modal-body">
              <label className="field-label">Tipo de nómina</label>
              <div className="grid grid-2" style={{ marginBottom: 16 }}>
                {[{ k: 'semanal', t: 'Semanal', d: 'Lunes a domingo' }, { k: 'quincenal', t: 'Quincenal', d: '1–15 o 16–fin' }].map((o) => (
                  <button key={o.k} className="card clickable" style={{ padding: 16, textAlign: 'left', borderColor: tipo === o.k ? 'var(--blue-500)' : undefined, boxShadow: tipo === o.k ? '0 0 0 2px var(--blue-100)' : undefined }} onClick={() => selTipo(o.k)}>
                    <div className="fw-600">{o.t}</div><div className="text-xs muted">{o.d}</div>
                  </button>
                ))}
              </div>
              {tipo && (
                <div className="form-grid form-grid-2">
                  <div><label className="field-label">Fecha inicio</label><input className="field-input" type="date" value={ini} onChange={(e) => setIni(e.target.value)} /></div>
                  <div><label className="field-label">Fecha fin</label><input className="field-input" type="date" value={fin} onChange={(e) => setFin(e.target.value)} /></div>
                </div>
              )}
              {tipo && ini && fin && <p className="text-xs muted" style={{ marginTop: 12 }}>Se creará <strong>{fmtPeriodo(ini, fin)}</strong> con los empleados activos de esquema <strong>{tipo === 'semanal' ? 'Semanal' : 'Quincenal'}</strong>.</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={crear} disabled={!tipo || !ini || !fin || saving}>{saving ? 'Creando…' : 'Crear nómina'}</button>
            </div>
          </div>
        </div>
      )}
    </PageEnter>
  );
}
