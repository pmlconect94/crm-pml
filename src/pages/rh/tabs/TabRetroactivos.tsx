import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase, dbNomina } from '@/lib/nomina/db';
import { MOTIVOS_TE } from '@/lib/nomina/calc';
import { fmt, fmtFecha, toISO } from '@/lib/nomina/format';
import { Icon } from '@/components/Icon';

// Horas extra RETROACTIVAS: horas de otro periodo pagadas en esta nómina.
// El monto se calcula como las HE normales: horas × valor hora × 2 (valor hora = diario / 8).
// Mismo criterio que calc.ts: SOLO MARLIN con el switch APAGADO (usar_sueldo_real=false) usa el
// sueldo FISCAL; en cualquier otro caso usa el real.
const montoHE = (emp: any, horas: number) => {
  const usaFiscal = emp?.empresa === 'MARLIN' && emp?.usar_sueldo_real === false;
  const sd = usaFiscal ? (emp?.sd_fiscal || 0) : (emp?.sd_real || 0);
  return ((sd / 7) / 8) * 2 * (horas || 0);
};

export function TabRetroactivos({ semana, nominas, empleados, canEdit, onChanged }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [modalEmp, setModalEmp] = useState<any>(null);
  const [form, setForm] = useState<any>({ horas: '', proposito: MOTIVOS_TE[0], periodo_origen: '' });
  const [saving, setSaving] = useState(false);

  // El día de origen solo puede ser de la SEMANA ANTERIOR al inicio de este periodo.
  const _ini = new Date(semana.fecha_inicio + 'T12:00:00');
  const semAntFin = new Date(_ini); semAntFin.setDate(_ini.getDate() - 1);
  const semAntIni = new Date(_ini); semAntIni.setDate(_ini.getDate() - 7);
  const minDia = toISO(semAntIni);
  const maxDia = toISO(semAntFin);

  useEffect(() => { fetchItems(); }, [semana.id]);
  async function fetchItems() {
    const { data } = await dbNomina.from('nomina_retroactivo').select('*').eq('semana_id', semana.id).order('created_at', { ascending: false });
    setItems(data || []);
  }
  const delEmp = (id: string) => items.filter((i) => i.empleado_id === id);
  const horasEmp = (id: string) => delEmp(id).reduce((s, i) => s + (i.horas || 0), 0);

  function resetForm() { setForm({ horas: '', proposito: MOTIVOS_TE[0], periodo_origen: '' }); }

  async function agregar() {
    const horas = parseFloat(form.horas) || 0;
    if (horas <= 0) { toast.error('Captura las horas'); return; }
    if (!form.periodo_origen) { toast.error('Selecciona el día (semana anterior)'); return; }
    setSaving(true);
    const { error } = await dbNomina.from('nomina_retroactivo').insert({
      semana_id: semana.id, nomina_id: nominas[modalEmp.id]?.id, empleado_id: modalEmp.id,
      tipo: 'horas_extra', horas, descripcion: form.proposito || null, periodo_origen: form.periodo_origen || null,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    resetForm(); setSaving(false); fetchItems(); onChanged?.();
  }
  async function eliminar(id: string) {
    await dbNomina.from('nomina_retroactivo').delete().eq('id', id);
    fetchItems(); onChanged?.();
  }

  const totalHoras = items.reduce((s, i) => s + (i.horas || 0), 0);

  return (
    <div>
      <p className="muted text-sm" style={{ marginTop: 0 }}>
        Horas extra de la <strong>semana anterior</strong> que se pagan en esta nómina. Capturas las horas, el propósito
        y el día; el monto se calcula igual que las horas extra normales y <strong>se suma a la columna Retroactivo</strong>.
      </p>
      <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 className="card-title">Horas extra retroactivas</h3>
        <div className="kpi" style={{ minWidth: 180 }}><span className="kpi-label">Total horas</span><span className="kpi-value pos">{totalHoras} h</span></div>
      </div>

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Empleado</th><th className="center">Registros</th><th className="right">Horas</th><th className="right">Monto aprox.</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {empleados.map((e: any) => {
              const n = delEmp(e.id).length;
              const h = horasEmp(e.id);
              return (
                <tr key={e.id}>
                  <td><div className="fw-600">{e.nombre}</div><div className="text-xs muted">{e.area}</div></td>
                  <td className="center">{n || '—'}</td>
                  <td className={`right mono ${h > 0 ? 'pos' : 'zero'}`}>{h > 0 ? `${h} h` : '—'}</td>
                  <td className={`right mono ${h > 0 ? 'pos' : 'zero'}`}>{h > 0 ? fmt(montoHE(e, h)) : '—'}</td>
                  {canEdit && <td className="right"><button className="btn btn-outline btn-sm" onClick={() => { setModalEmp(e); resetForm(); }}><Icon name="plus" size={14} /></button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalEmp && (
        <div className="modal-backdrop" onClick={(ev) => ev.target === ev.currentTarget && setModalEmp(null)}>
          <div className="modal page-enter" style={{ maxWidth: 620 }}>
            <div className="modal-header"><h3 className="modal-title">Horas extra retro — {modalEmp.nombre}</h3><button className="btn btn-ghost btn-sm" onClick={() => setModalEmp(null)}><Icon name="x" size={16} /></button></div>
            <div className="modal-body">
              {canEdit && (
                <>
                  <div className="form-grid form-grid-3" style={{ alignItems: 'end' }}>
                    <div><label className="field-label">Horas</label><input className="field-input mono" type="number" step="0.5" min="0" autoFocus value={form.horas} onChange={(e) => setForm((f: any) => ({ ...f, horas: e.target.value }))} /></div>
                    <div><label className="field-label">Propósito</label><select className="field-input" value={form.proposito} onChange={(e) => setForm((f: any) => ({ ...f, proposito: e.target.value }))}>{MOTIVOS_TE.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div><label className="field-label">Día (semana anterior)</label><input className="field-input" type="date" min={minDia} max={maxDia} value={form.periodo_origen} onChange={(e) => setForm((f: any) => ({ ...f, periodo_origen: e.target.value }))} /></div>
                  </div>
                  <div className="hstack" style={{ justifyContent: 'space-between', marginTop: 10 }}>
                    <span className="text-sm muted">Monto aprox.: <strong className="pos">{fmt(montoHE(modalEmp, parseFloat(form.horas) || 0))}</strong></span>
                    <button className="btn btn-primary btn-sm" onClick={agregar} disabled={saving}><Icon name="plus" size={14} /> Agregar horas</button>
                  </div>
                </>
              )}
              <div className="form-section-title">Registradas</div>
              <table className="tbl">
                <thead><tr><th>Propósito</th><th>Día</th><th className="right">Horas</th><th className="right">Monto</th><th>Capturado</th>{canEdit && <th></th>}</tr></thead>
                <tbody>
                  {delEmp(modalEmp.id).length === 0 && <tr><td colSpan={canEdit ? 6 : 5}><div className="empty"><div className="empty-title">Sin horas extra retro</div></div></td></tr>}
                  {delEmp(modalEmp.id).map((i) => (
                    <tr key={i.id}>
                      <td><span className="badge badge-blue">{i.descripcion || '—'}</span></td>
                      <td className="text-xs">{i.periodo_origen ? fmtFecha(i.periodo_origen) : '—'}</td>
                      <td className="right mono">{i.horas} h</td>
                      <td className="right mono pos">{fmt(montoHE(modalEmp, i.horas))}</td>
                      <td className="muted text-xs">{fmtFecha(i.created_at?.slice(0, 10))}</td>
                      {canEdit && <td><button className="btn btn-ghost btn-sm" onClick={() => eliminar(i.id)}><Icon name="trash" size={14} /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setModalEmp(null)}>Cerrar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
