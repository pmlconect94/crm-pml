import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase, dbNomina } from '@/lib/nomina/db';
import { fmt, fmtFecha } from '@/lib/nomina/format';
import { Icon } from '@/components/Icon';

const MOTIVOS = ['Productividad mensual', 'Ventas'];

export function TabBonos({ semana, nominas, empleados, canEdit, onChanged }: any) {
  const [items, setItems] = useState<any[]>([]);            // bonos de este periodo (nomina_bono)
  const [perms, setPerms] = useState<any[]>([]);            // bonos permanentes activos
  const [excl, setExcl] = useState<Set<string>>(new Set()); // permanentes excluidos en esta nómina
  const [modalEmp, setModalEmp] = useState<any>(null);
  const [form, setForm] = useState<any>({ monto: '', motivo: 'Productividad mensual' });
  const [permForm, setPermForm] = useState<any>({ monto: '', motivo: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, [semana.id]);
  async function fetchAll() {
    const [bonoRes, permRes, exclRes] = await Promise.all([
      dbNomina.from('nomina_bono').select('*').eq('semana_id', semana.id).order('created_at', { ascending: false }),
      dbNomina.from('bono_permanente').select('*').eq('activo', true).order('created_at', { ascending: false }),
      dbNomina.from('bono_permanente_excluido').select('bono_permanente_id').eq('semana_id', semana.id),
    ]);
    setItems(bonoRes.data || []);
    setPerms(permRes.data || []);
    setExcl(new Set((exclRes.data || []).map((x: any) => x.bono_permanente_id)));
  }

  const oneTime = (id: string) => items.filter((i) => i.empleado_id === id);
  const permsEmp = (id: string) => perms.filter((p) => p.empleado_id === id);
  const totalEmp = (id: string) => oneTime(id).reduce((s, i) => s + (i.monto || 0), 0)
    + permsEmp(id).filter((p) => !excl.has(p.id)).reduce((s, p) => s + (p.monto || 0), 0);

  // ── Bonos de este periodo (one-time) ──
  async function agregar() {
    const monto = parseFloat(form.monto) || 0;
    if (monto <= 0) { toast.error('Captura el monto'); return; }
    setSaving(true);
    const { error } = await dbNomina.from('nomina_bono').insert({ semana_id: semana.id, nomina_id: nominas[modalEmp.id]?.id, empleado_id: modalEmp.id, monto, motivo: form.motivo });
    if (error) { toast.error(error.message); setSaving(false); return; }
    setForm({ monto: '', motivo: 'Productividad mensual' }); setSaving(false); fetchAll(); onChanged?.();
  }
  async function eliminar(id: string) { await dbNomina.from('nomina_bono').delete().eq('id', id); fetchAll(); onChanged?.(); }

  // ── Bonos permanentes ──
  async function agregarPerm() {
    const monto = parseFloat(permForm.monto) || 0;
    if (monto <= 0) { toast.error('Captura el monto'); return; }
    if (!permForm.motivo.trim()) { toast.error('Captura el motivo'); return; }
    setSaving(true);
    const { error } = await dbNomina.from('bono_permanente').insert({ empleado_id: modalEmp.id, monto, motivo: permForm.motivo.trim(), activo: true });
    if (error) { toast.error(error.message); setSaving(false); return; }
    setPermForm({ monto: '', motivo: '' }); setSaving(false); fetchAll(); onChanged?.();
  }
  async function quitarPerm(id: string) {
    if (!confirm('¿Quitar este bono permanente? Dejará de aplicar en todas las nóminas abiertas.')) return;
    await dbNomina.from('bono_permanente').update({ activo: false }).eq('id', id);
    fetchAll(); onChanged?.();
  }
  // Aplica/excluye un permanente SOLO en esta nómina.
  async function toggleAplica(p: any) {
    if (excl.has(p.id)) await dbNomina.from('bono_permanente_excluido').delete().eq('semana_id', semana.id).eq('bono_permanente_id', p.id);
    else await dbNomina.from('bono_permanente_excluido').insert({ semana_id: semana.id, bono_permanente_id: p.id });
    fetchAll(); onChanged?.();
  }

  const total = empleados.reduce((s: number, e: any) => s + totalEmp(e.id), 0);

  return (
    <div>
      <p className="muted text-sm" style={{ marginTop: 0 }}>
        Bonos de <strong>este periodo</strong> y <strong>bonos permanentes</strong> (aplican por default cada nómina; quítalos del periodo si no se cumplieron).
      </p>
      <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 className="card-title">Bonos</h3>
        <div className="kpi" style={{ minWidth: 180 }}><span className="kpi-label">Total bonos</span><span className="kpi-value pos">{fmt(total)}</span></div>
      </div>

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Empleado</th><th className="center">Periodo</th><th className="center">Permanentes</th><th className="right">Total</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {empleados.map((e: any) => {
              const nOne = oneTime(e.id).length;
              const nPerm = permsEmp(e.id).filter((p) => !excl.has(p.id)).length;
              return (
                <tr key={e.id}>
                  <td><div className="hstack" style={{ gap: 8 }}><span className="mono fw-700" style={{ minWidth: 26, color: 'var(--ink-500)' }}>{e.id_banco ?? '—'}</span><div><div className="fw-600">{e.nombre}</div><div className="text-xs muted">{e.area}</div></div></div></td>
                  <td className="center">{nOne || '—'}</td>
                  <td className="center">{nPerm || '—'}</td>
                  <td className={`right mono ${totalEmp(e.id) > 0 ? 'pos' : 'zero'}`}>{totalEmp(e.id) > 0 ? fmt(totalEmp(e.id)) : '—'}</td>
                  {canEdit && <td className="right"><button className="btn btn-outline btn-sm" onClick={() => { setModalEmp(e); setForm({ monto: '', motivo: 'Productividad mensual' }); setPermForm({ monto: '', motivo: '' }); }}><Icon name="plus" size={14} /></button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalEmp && (
        <div className="modal-backdrop" onClick={(ev) => ev.target === ev.currentTarget && setModalEmp(null)}>
          <div className="modal page-enter" style={{ maxWidth: 640 }}>
            <div className="modal-header"><h3 className="modal-title">Bonos — {modalEmp.nombre}</h3><button className="btn btn-ghost btn-sm" onClick={() => setModalEmp(null)}><Icon name="x" size={16} /></button></div>
            <div className="modal-body">
              {/* Permanentes */}
              <div className="form-section-title">Bonos permanentes (aplican cada nómina)</div>
              <table className="tbl">
                <thead><tr><th>Motivo</th><th className="right">Monto</th><th className="center">Aplica este periodo</th>{canEdit && <th></th>}</tr></thead>
                <tbody>
                  {permsEmp(modalEmp.id).length === 0 && <tr><td colSpan={canEdit ? 4 : 3}><div className="empty"><div className="empty-title">Sin bonos permanentes</div></div></td></tr>}
                  {permsEmp(modalEmp.id).map((p) => {
                    const aplica = !excl.has(p.id);
                    return (
                      <tr key={p.id} style={aplica ? undefined : { opacity: 0.5 }}>
                        <td><span className="badge badge-violet">{p.motivo}</span></td>
                        <td className="right mono pos">{fmt(p.monto)}</td>
                        <td className="center">{canEdit ? <button type="button" className={`switch ${aplica ? 'on' : ''}`} onClick={() => toggleAplica(p)} /> : (aplica ? 'Sí' : 'No')}</td>
                        {canEdit && <td><button className="btn btn-ghost btn-sm" onClick={() => quitarPerm(p.id)} title="Quitar permanente">Quitar</button></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {canEdit && (
                <div className="form-grid form-grid-3" style={{ alignItems: 'end', marginTop: 8 }}>
                  <div><label className="field-label">Monto</label><input className="field-input mono" type="number" step="0.01" value={permForm.monto} onChange={(e) => setPermForm((f: any) => ({ ...f, monto: e.target.value }))} /></div>
                  <div style={{ gridColumn: 'span 1' }}><label className="field-label">Motivo</label><input className="field-input" placeholder="ej. Bono de puntualidad" value={permForm.motivo} onChange={(e) => setPermForm((f: any) => ({ ...f, motivo: e.target.value }))} /></div>
                  <div><button className="btn btn-primary btn-sm" onClick={agregarPerm} disabled={saving} style={{ width: '100%' }}><Icon name="plus" size={14} /> Agregar permanente</button></div>
                </div>
              )}

              {/* Periodo */}
              <div className="form-section-title">Bonos de este periodo</div>
              {canEdit && (
                <div className="form-grid form-grid-2" style={{ alignItems: 'end' }}>
                  <div><label className="field-label">Monto</label><input className="field-input mono" type="number" step="0.01" value={form.monto} onChange={(e) => setForm((f: any) => ({ ...f, monto: e.target.value }))} /></div>
                  <div><label className="field-label">Motivo</label><select className="field-input" value={form.motivo} onChange={(e) => setForm((f: any) => ({ ...f, motivo: e.target.value }))}>{MOTIVOS.map((m) => <option key={m}>{m}</option>)}</select></div>
                </div>
              )}
              {canEdit && <div className="hstack" style={{ justifyContent: 'flex-end', marginTop: 10 }}><button className="btn btn-primary btn-sm" onClick={agregar} disabled={saving}><Icon name="plus" size={14} /> Agregar bono</button></div>}
              <table className="tbl" style={{ marginTop: 8 }}>
                <thead><tr><th>Motivo</th><th className="right">Monto</th><th>Fecha</th>{canEdit && <th></th>}</tr></thead>
                <tbody>
                  {oneTime(modalEmp.id).length === 0 && <tr><td colSpan={canEdit ? 4 : 3}><div className="empty"><div className="empty-title">Sin bonos de este periodo</div></div></td></tr>}
                  {oneTime(modalEmp.id).map((i) => (
                    <tr key={i.id}>
                      <td><span className="badge badge-blue">{i.motivo}</span></td>
                      <td className="right mono pos">{fmt(i.monto)}</td>
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
