import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase, dbNomina } from '@/lib/nomina/db';
import { useAuth } from '@/lib/nomina/auth';
import { fmt, fmtFecha, toISO } from '@/lib/nomina/format';
import { antiguedadAnios, factorIntegracionSDI, calcSDI } from '@/lib/nomina/calc';
import { Icon } from '@/components/Icon';

const TIPO_LABEL: Record<string, string> = { alta: 'Alta', modificacion: 'Modificación de sueldo', baja: 'Baja' };
const TIPO_BADGE: Record<string, string> = { alta: 'badge-green', modificacion: 'badge-blue', baja: 'badge-gray' };
const CONCEPTOS = ['Infonavit', 'Fonacot', 'Pensión alimenticia', 'Caja de ahorro', 'Otro'];

export function SueldoModal({ empleado, onClose, onChanged }: { empleado: any; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const canEdit = user?.rol === 'admin' || user?.rol === 'editor';
  const [movs, setMovs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  // Descuentos permanentes
  const [descs, setDescs] = useState<any[]>([]);
  const [showDescForm, setShowDescForm] = useState(false);
  const [descForm, setDescForm] = useState<any>({ concepto: 'Infonavit', monto: '', fecha_inicio: '', nota: '' });

  const antig = antiguedadAnios(empleado.fecha_ingreso);
  const factor = factorIntegracionSDI(antig);
  const esQuincenal = empleado.esquema_pago === 'Quincenal';
  const periodo = esQuincenal ? 'quincena' : 'semana';
  const periodoAdj = esQuincenal ? 'quincenal' : 'semanal';
  const divisor = esQuincenal ? 15 : 7;
  const r4 = (x: number) => Math.round(x * 10000) / 10000;

  const hoy = useMemo(() => toISO(new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)), []);
  const [form, setForm] = useState<any>({ tipo: 'modificacion', fecha_inicio: hoy, periodo_real: '', periodo_fiscal: '', sdi: '', vales: '', prevision_social: '', nota: '' });

  useEffect(() => { fetchMovs(); fetchDescs(); }, []);
  async function fetchMovs() {
    setLoading(true);
    const { data } = await dbNomina.from('empleado_sueldo_movimientos').select('*').eq('empleado_id', empleado.id).order('fecha_inicio', { ascending: false }).order('created_at', { ascending: false });
    setMovs(data || []);
    setLoading(false);
  }
  async function fetchDescs() {
    const { data } = await dbNomina.from('empleado_descuentos').select('*').eq('empleado_id', empleado.id).order('fecha_inicio', { ascending: false }).order('created_at', { ascending: false });
    setDescs(data || []);
  }

  // Sincroniza empleados.infonavit con el descuento Infonavit vigente (lo usa el cálculo actual).
  async function syncInfonavit() {
    const { data } = await dbNomina.from('empleado_descuentos').select('monto').eq('empleado_id', empleado.id).eq('concepto', 'Infonavit').eq('activo', true).is('fecha_fin', null);
    const total = (data || []).reduce((s: number, d: any) => s + (d.monto || 0), 0);
    await dbNomina.from('empleados').update({ infonavit: total }).eq('id', empleado.id);
  }

  async function guardarDescuento() {
    const monto = parseFloat(descForm.monto) || 0;
    if (monto <= 0) { toast.error('Captura el monto del descuento'); return; }
    if (!descForm.fecha_inicio) { toast.error('Falta la fecha de inicio'); return; }
    setSaving(true);
    // Cerrar el vigente del mismo concepto (queda en historial).
    const previo = descs.find((d) => d.concepto === descForm.concepto && d.activo && !d.fecha_fin);
    if (previo) await dbNomina.from('empleado_descuentos').update({ fecha_fin: descForm.fecha_inicio, activo: false }).eq('id', previo.id);
    const { error } = await dbNomina.from('empleado_descuentos').insert({
      empleado_id: empleado.id, concepto: descForm.concepto, monto, fecha_inicio: descForm.fecha_inicio, fecha_fin: null, activo: true,
      nota: descForm.nota.trim() || null, changed_by: user?.id, changed_by_nombre: user?.nombre,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    await syncInfonavit();
    toast.success('Descuento registrado');
    setShowDescForm(false); setDescForm({ concepto: 'Infonavit', monto: '', fecha_inicio: hoy, nota: '' }); setSaving(false); fetchDescs(); onChanged();
  }

  async function quitarDescuento(d: any) {
    if (!confirm(`¿Terminar el descuento de ${d.concepto}?`)) return;
    await dbNomina.from('empleado_descuentos').update({ fecha_fin: hoy, activo: false }).eq('id', d.id);
    await syncInfonavit();
    toast.success('Descuento terminado'); fetchDescs(); onChanged();
  }

  const vigente = movs.find((m) => m.tipo !== 'baja' && !m.fecha_fin) || null;
  const dadoBaja = movs.length > 0 && movs[0].tipo === 'baja';

  function abrirForm() {
    const esAlta = movs.length === 0 || dadoBaja;
    setForm({
      tipo: esAlta ? 'alta' : 'modificacion',
      fecha_inicio: hoy,
      periodo_real: vigente?.sueldo_periodo_real || '',
      periodo_fiscal: vigente?.sueldo_periodo_fiscal || '',
      sdi: vigente?.sdi || '',
      vales: vigente?.vales || '',
      prevision_social: vigente?.prevision_social || '',
      nota: '',
    });
    setShowForm(true);
  }

  // Al capturar el sueldo fiscal del periodo: recalcula SDI y sugiere vales/previsión (10%).
  const setFiscalP = (v: string) => {
    const fp = parseFloat(v) || 0;
    const sug = Math.round(fp * 0.1 * 100) / 100;
    setForm((p: any) => ({ ...p, periodo_fiscal: v, sdi: fp > 0 ? r4(calcSDI(fp / divisor, antig)) : '', vales: fp > 0 ? sug : '', prevision_social: fp > 0 ? sug : '' }));
  };

  async function guardar() {
    const periodoReal = parseFloat(form.periodo_real) || 0;
    const periodoFiscal = parseFloat(form.periodo_fiscal) || 0;
    if (periodoReal <= 0 && periodoFiscal <= 0) { toast.error(`Captura al menos un sueldo ${periodoAdj}`); return; }
    if (!form.fecha_inicio) { toast.error('Falta la fecha de inicio'); return; }
    setSaving(true);

    const dailyReal = r4(periodoReal / divisor);
    const dailyFiscal = r4(periodoFiscal / divisor);
    const sdi = parseFloat(form.sdi) || r4(calcSDI(dailyFiscal, antig));
    const vales = parseFloat(form.vales) || 0;
    const prevision = parseFloat(form.prevision_social) || 0;

    // Cerrar la vigencia anterior en la fecha de inicio del nuevo movimiento.
    if (vigente) await dbNomina.from('empleado_sueldo_movimientos').update({ fecha_fin: form.fecha_inicio }).eq('id', vigente.id);

    const { error } = await dbNomina.from('empleado_sueldo_movimientos').insert({
      empleado_id: empleado.id, tipo: form.tipo, fecha_inicio: form.fecha_inicio, fecha_fin: null,
      sueldo_periodo_real: periodoReal, sueldo_periodo_fiscal: periodoFiscal,
      sueldo_diario_real: dailyReal, sueldo_diario_fiscal: dailyFiscal, sdi, factor_integracion: factor,
      vales, prevision_social: prevision,
      nota: form.nota.trim() || null, changed_by: user?.id, changed_by_nombre: user?.nombre,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }

    // El cálculo usa el sueldo SEMANAL-equivalente (diario × 7). El diario sale de dividir
    // el sueldo del periodo entre 15 (quincena) o 7 (semana). Vales/previsión se guardan por periodo.
    await dbNomina.from('empleados').update({ sd_real: r4(dailyReal * 7), sd_fiscal: r4(dailyFiscal * 7), vales, prevision_social: prevision, activo: true }).eq('id', empleado.id);

    toast.success('Movimiento registrado');
    setShowForm(false); setSaving(false); fetchMovs(); onChanged();
  }

  async function darBaja() {
    if (!confirm(`¿Dar de baja a ${empleado.nombre}? Quedará inactivo en el catálogo.`)) return;
    setSaving(true);
    if (vigente) await dbNomina.from('empleado_sueldo_movimientos').update({ fecha_fin: hoy }).eq('id', vigente.id);
    await dbNomina.from('empleado_sueldo_movimientos').insert({
      empleado_id: empleado.id, tipo: 'baja', fecha_inicio: hoy, fecha_fin: hoy,
      sueldo_diario_real: 0, sueldo_diario_fiscal: 0, sdi: 0,
      nota: 'Baja del empleado', changed_by: user?.id, changed_by_nombre: user?.nombre,
    });
    await dbNomina.from('empleados').update({ activo: false }).eq('id', empleado.id);
    toast.success('Empleado dado de baja');
    setSaving(false); fetchMovs(); onChanged();
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal page-enter" style={{ maxWidth: 1000, width: '94vw' }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Sueldo — {empleado.nombre}</h3>
            <div className="text-xs muted">Antigüedad: {antig} {antig === 1 ? 'año' : 'años'} · Factor SDI: {factor} · El último movimiento vigente es el que calcula la nómina.</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="modal-body">
          {/* Resumen del vigente */}
          <div className="grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(6,1fr)' }}>
            <div className="kpi"><span className="kpi-label">Sueldo {periodoAdj} real</span><span className="kpi-value">{vigente ? fmt(vigente.sueldo_periodo_real) : '—'}</span></div>
            <div className="kpi"><span className="kpi-label">Sueldo {periodoAdj} fiscal</span><span className="kpi-value">{vigente ? fmt(vigente.sueldo_periodo_fiscal) : '—'}</span></div>
            <div className="kpi"><span className="kpi-label">Diario (÷{divisor})</span><span className="kpi-value">{vigente ? fmt(vigente.sueldo_diario_real) : '—'}</span></div>
            <div className="kpi"><span className="kpi-label">SDI</span><span className="kpi-value blue">{vigente ? fmt(vigente.sdi) : '—'}</span></div>
            <div className="kpi"><span className="kpi-label">Vales despensa</span><span className="kpi-value orange">{vigente ? fmt(vigente.vales) : '—'}</span></div>
            <div className="kpi"><span className="kpi-label">Estado</span><span className="kpi-value">{dadoBaja ? <span className="neg">Baja</span> : vigente ? <span className="pos">Vigente</span> : '—'}</span></div>
          </div>

          <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <h4 className="card-title">Historial de movimientos</h4>
            {canEdit && (
              <div className="hstack" style={{ gap: 8 }}>
                {!dadoBaja && empleado.activo && <button className="btn btn-danger btn-sm" onClick={darBaja} disabled={saving}><Icon name="logout" size={13} /> Dar de baja</button>}
                <button className="btn btn-primary btn-sm" onClick={abrirForm} disabled={saving}><Icon name="plus" size={14} /> {movs.length === 0 || dadoBaja ? 'Alta de sueldo' : 'Modificar sueldo'}</button>
              </div>
            )}
          </div>

          <div className="card tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Tipo</th><th>Inicio</th><th>Fin</th><th className="right">{periodoAdj} real</th><th className="right">{periodoAdj} fiscal</th><th className="right">Diario</th><th className="right">SDI</th><th>Nota</th><th>Usuario</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={8}><div className="empty"><span className="spinner" /></div></td></tr>}
                {!loading && movs.length === 0 && <tr><td colSpan={8}><div className="empty"><div className="empty-title">Sin movimientos</div><p className="muted">Captura el alta de sueldo para empezar.</p></div></td></tr>}
                {movs.map((m, i) => (
                  <tr key={m.id} style={i === 0 && m.tipo !== 'baja' && !m.fecha_fin ? { background: 'var(--blue-50)' } : undefined}>
                    <td><span className={`badge ${TIPO_BADGE[m.tipo]}`}>{TIPO_LABEL[m.tipo]}</span></td>
                    <td className="muted">{fmtFecha(m.fecha_inicio)}</td>
                    <td className="muted">{m.fecha_fin ? fmtFecha(m.fecha_fin) : <span className="pos">vigente</span>}</td>
                    <td className="right mono">{fmt(m.sueldo_periodo_real)}</td>
                    <td className="right mono">{fmt(m.sueldo_periodo_fiscal)}</td>
                    <td className="right mono">{fmt(m.sueldo_diario_real)}</td>
                    <td className="right mono blue">{fmt(m.sdi)}</td>
                    <td className="muted text-xs">{m.nota || '—'}</td>
                    <td className="muted text-xs">{m.changed_by_nombre || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showForm && (
            <div style={{ marginTop: 16, border: '1px solid var(--ink-200)', borderRadius: 'var(--r-md)', padding: 16, background: 'var(--ink-50)' }}>
              <div className="form-grid form-grid-3">
                <div><label className="field-label">Tipo</label>
                  <select className="field-input" value={form.tipo} onChange={(e) => setForm((p: any) => ({ ...p, tipo: e.target.value }))}>
                    <option value="alta">Alta</option><option value="modificacion">Modificación de sueldo</option>
                  </select>
                </div>
                <div><label className="field-label">Fecha de inicio (vigencia)</label><input className="field-input" type="date" value={form.fecha_inicio} onChange={(e) => setForm((p: any) => ({ ...p, fecha_inicio: e.target.value }))} /></div>
                <div />
                <div>
                  <label className="field-label">Sueldo {periodoAdj} real</label>
                  <input className="field-input mono" type="number" step="0.01" value={form.periodo_real} onChange={(e) => setForm((p: any) => ({ ...p, periodo_real: e.target.value }))} />
                  <div className="text-xs muted" style={{ marginTop: 3 }}>Diario: {fmt((parseFloat(form.periodo_real) || 0) / divisor)} (÷{divisor})</div>
                </div>
                <div>
                  <label className="field-label">Sueldo {periodoAdj} fiscal (IMSS)</label>
                  <input className="field-input mono" type="number" step="0.01" value={form.periodo_fiscal} onChange={(e) => setFiscalP(e.target.value)} />
                  <div className="text-xs muted" style={{ marginTop: 3 }}>Diario: {fmt((parseFloat(form.periodo_fiscal) || 0) / divisor)} (÷{divisor})</div>
                </div>
                <div><label className="field-label">SDI (auto, editable)</label><input className="field-input mono" type="number" step="0.01" value={form.sdi} onChange={(e) => setForm((p: any) => ({ ...p, sdi: e.target.value }))} /></div>
              </div>
              <div className="form-grid form-grid-2" style={{ marginTop: 10 }}>
                <div><label className="field-label">Vales de despensa (sugerido 10% fiscal)</label><input className="field-input mono" type="number" step="0.01" value={form.vales} onChange={(e) => setForm((p: any) => ({ ...p, vales: e.target.value }))} /></div>
                <div><label className="field-label">Previsión social (sugerido 10% fiscal)</label><input className="field-input mono" type="number" step="0.01" value={form.prevision_social} onChange={(e) => setForm((p: any) => ({ ...p, prevision_social: e.target.value }))} /></div>
              </div>
              <div className="form-grid" style={{ marginTop: 10 }}><div><label className="field-label">Nota / motivo</label><input className="field-input" value={form.nota} placeholder="Ej. Aumento anual, ajuste de SDI…" onChange={(e) => setForm((p: any) => ({ ...p, nota: e.target.value }))} /></div></div>
              <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                <button className="btn btn-outline btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar movimiento'}</button>
              </div>
            </div>
          )}
          {/* ── Descuentos permanentes ── */}
          <div className="hstack" style={{ justifyContent: 'space-between', margin: '22px 0 10px' }}>
            <h4 className="card-title">Descuentos permanentes (Infonavit, etc.)</h4>
            {canEdit && <button className="btn btn-primary btn-sm" onClick={() => { setDescForm({ concepto: 'Infonavit', monto: '', fecha_inicio: hoy, nota: '' }); setShowDescForm(true); }}><Icon name="plus" size={14} /> Agregar descuento</button>}
          </div>
          <div className="card tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Concepto</th><th>Inicio</th><th>Fin</th><th className="right">Monto / {periodo}</th><th>Nota</th><th>Usuario</th>{canEdit && <th></th>}</tr></thead>
              <tbody>
                {descs.length === 0 && <tr><td colSpan={canEdit ? 7 : 6}><div className="empty"><div className="empty-title">Sin descuentos</div></div></td></tr>}
                {descs.map((d) => {
                  const vig = d.activo && !d.fecha_fin;
                  return (
                    <tr key={d.id} style={vig ? { background: 'var(--blue-50)' } : undefined}>
                      <td><span className="badge badge-gray">{d.concepto}</span></td>
                      <td className="muted">{fmtFecha(d.fecha_inicio)}</td>
                      <td className="muted">{d.fecha_fin ? fmtFecha(d.fecha_fin) : <span className="pos">vigente</span>}</td>
                      <td className="right mono">{fmt(d.monto)}</td>
                      <td className="muted text-xs">{d.nota || '—'}</td>
                      <td className="muted text-xs">{d.changed_by_nombre || '—'}</td>
                      {canEdit && <td>{vig && <button className="btn btn-ghost btn-sm" onClick={() => quitarDescuento(d)} title="Terminar">Terminar</button>}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {showDescForm && (
            <div style={{ marginTop: 14, border: '1px solid var(--ink-200)', borderRadius: 'var(--r-md)', padding: 16, background: 'var(--ink-50)' }}>
              <div className="form-grid form-grid-3">
                <div><label className="field-label">Concepto</label><select className="field-input" value={descForm.concepto} onChange={(e) => setDescForm((p: any) => ({ ...p, concepto: e.target.value }))}>{CONCEPTOS.map((c) => <option key={c}>{c}</option>)}</select></div>
                <div><label className="field-label">Monto por {periodo}</label><input className="field-input mono" type="number" step="0.01" value={descForm.monto} onChange={(e) => setDescForm((p: any) => ({ ...p, monto: e.target.value }))} /></div>
                <div><label className="field-label">Fecha de inicio</label><input className="field-input" type="date" value={descForm.fecha_inicio} onChange={(e) => setDescForm((p: any) => ({ ...p, fecha_inicio: e.target.value }))} /></div>
              </div>
              <div className="form-grid" style={{ marginTop: 10 }}><div><label className="field-label">Nota / motivo</label><input className="field-input" value={descForm.nota} placeholder="Ej. crédito 1234, ajuste…" onChange={(e) => setDescForm((p: any) => ({ ...p, nota: e.target.value }))} /></div></div>
              <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                <button className="btn btn-outline btn-sm" onClick={() => setShowDescForm(false)}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={guardarDescuento} disabled={saving}>{saving ? 'Guardando…' : 'Guardar descuento'}</button>
              </div>
            </div>
          )}
          <p className="text-xs muted" style={{ marginTop: 10 }}>Al modificar un descuento del mismo concepto, el anterior se cierra y queda en el historial. El de <strong>Infonavit</strong> se aplica automáticamente en el cálculo de la nómina.</p>
        </div>

        <div className="modal-footer"><button className="btn btn-outline" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}
