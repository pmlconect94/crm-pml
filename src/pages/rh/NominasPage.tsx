import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase, dbNomina } from '@/lib/nomina/db';
import { useAuth } from '@/lib/nomina/auth';
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

  const lista = filtro === 'todas' ? semanas : semanas.filter((s) => s.status === filtro);

  return (
    <PageEnter>
      <div className="page-header">
        <div>
          <h1 className="page-title">Nóminas</h1>
          <p className="page-subtitle">Selecciona una nómina para capturar incidencias</p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => { setModal(true); setTipo(null); setIni(''); setFin(''); }}><Icon name="plus" size={15} /> Crear nómina</button>}
      </div>

      <div className="segmented" style={{ marginBottom: 14 }}>
        {(['abierta', 'timbrada', 'todas'] as const).map((x) => (
          <button key={x} className={filtro === x ? 'active' : ''} onClick={() => setFiltro(x)}>{x === 'abierta' ? 'Abiertas' : x === 'timbrada' ? 'Guardadas' : 'Todas'}</button>
        ))}
      </div>

      <div className="vstack" style={{ gap: 10 }}>
        {lista.length === 0 && <div className="card"><div className="empty"><div className="empty-title">No hay nóminas</div></div></div>}
        {lista.map((s) => (
          <div key={s.id} className="card clickable" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={() => navigate(`/app/rh/nominas/${s.id}`)}>
            <div className="hstack" style={{ gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--blue-100)', color: 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="file-text" size={18} /></div>
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
        ))}
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
