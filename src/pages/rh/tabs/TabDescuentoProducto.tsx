import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase, dbNomina } from '@/lib/nomina/db';
import { fmt, fmtFecha } from '@/lib/nomina/format';
import { Icon } from '@/components/Icon';

export function TabDescuentoProducto({ semana, nominas, empleados, canEdit, onChanged }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [modalEmp, setModalEmp] = useState<any>(null);
  const [form, setForm] = useState<any>({ monto: '', numero_nota: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchItems(); }, [semana.id]);
  async function fetchItems() {
    const { data } = await dbNomina.from('nomina_descuento_producto').select('*').eq('semana_id', semana.id).order('created_at', { ascending: false });
    setItems(data || []);
  }
  const delEmp = (id: string) => items.filter((i) => i.empleado_id === id);
  const totalEmp = (id: string) => delEmp(id).reduce((s, i) => s + (i.monto || 0), 0);

  async function agregar() {
    const monto = parseFloat(form.monto) || 0;
    if (monto <= 0) { toast.error('Captura el monto'); return; }
    setSaving(true);
    const { error } = await dbNomina.from('nomina_descuento_producto').insert({
      semana_id: semana.id, nomina_id: nominas[modalEmp.id]?.id, empleado_id: modalEmp.id, monto, numero_nota: form.numero_nota.trim() || null,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    setForm({ monto: '', numero_nota: '' }); setSaving(false); fetchItems(); onChanged?.();
  }
  async function eliminar(id: string) {
    await dbNomina.from('nomina_descuento_producto').delete().eq('id', id);
    fetchItems(); onChanged?.();
  }

  const total = items.reduce((s, i) => s + (i.monto || 0), 0);

  return (
    <div>
      <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 className="card-title">Descuento de producto</h3>
        <div className="kpi" style={{ minWidth: 200 }}><span className="kpi-label">Total descuento producto</span><span className="kpi-value neg">{fmt(total)}</span></div>
      </div>

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Empleado</th><th className="center">Descuentos</th><th className="right">Total</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {empleados.map((e: any) => {
              const n = delEmp(e.id).length;
              return (
                <tr key={e.id}>
                  <td><div className="fw-600">{e.nombre}</div><div className="text-xs muted">{e.area}</div></td>
                  <td className="center">{n || '—'}</td>
                  <td className={`right mono ${totalEmp(e.id) > 0 ? 'neg' : 'zero'}`}>{totalEmp(e.id) > 0 ? '-' + fmt(totalEmp(e.id)) : '—'}</td>
                  {canEdit && <td className="right"><button className="btn btn-outline btn-sm" onClick={() => { setModalEmp(e); setForm({ monto: '', numero_nota: '' }); }}><Icon name="plus" size={14} /></button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalEmp && (
        <div className="modal-backdrop" onClick={(ev) => ev.target === ev.currentTarget && setModalEmp(null)}>
          <div className="modal page-enter" style={{ maxWidth: 560 }}>
            <div className="modal-header"><h3 className="modal-title">Descuento de producto — {modalEmp.nombre}</h3><button className="btn btn-ghost btn-sm" onClick={() => setModalEmp(null)}><Icon name="x" size={16} /></button></div>
            <div className="modal-body">
              {canEdit && (
                <div className="form-grid form-grid-2" style={{ alignItems: 'end' }}>
                  <div><label className="field-label">Monto a descontar</label><input className="field-input mono" type="number" step="0.01" autoFocus value={form.monto} onChange={(e) => setForm((f: any) => ({ ...f, monto: e.target.value }))} /></div>
                  <div><label className="field-label">Número de nota</label><input className="field-input" value={form.numero_nota} placeholder="Ej. 12345" onChange={(e) => setForm((f: any) => ({ ...f, numero_nota: e.target.value }))} /></div>
                </div>
              )}
              {canEdit && <div className="hstack" style={{ justifyContent: 'flex-end', marginTop: 10 }}><button className="btn btn-primary btn-sm" onClick={agregar} disabled={saving}><Icon name="plus" size={14} /> Agregar descuento</button></div>}
              <div className="form-section-title">Registrados</div>
              <table className="tbl">
                <thead><tr><th>N° nota</th><th className="right">Monto</th><th>Fecha</th>{canEdit && <th></th>}</tr></thead>
                <tbody>
                  {delEmp(modalEmp.id).length === 0 && <tr><td colSpan={canEdit ? 4 : 3}><div className="empty"><div className="empty-title">Sin descuentos</div></div></td></tr>}
                  {delEmp(modalEmp.id).map((i) => (
                    <tr key={i.id}>
                      <td className="mono">{i.numero_nota || '—'}</td>
                      <td className="right mono neg">-{fmt(i.monto)}</td>
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
