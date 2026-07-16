import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase, dbNomina } from '@/lib/nomina/db';
import { fmt } from '@/lib/nomina/format';
import { calcIncentivos, getTramo, TAB_CHOFER, TAB_ACOMP } from '@/lib/nomina/calc';
import { Icon } from '@/components/Icon';

const TRAMOS = ['7am–3pm', '3pm–7pm', '7pm–11pm', '11pm–7am'];
const EMPTY = { fecha: '', destino: '', cliente: '', vehiculo: '', chofer_id: '', acompanante_id: '', hora_salida: '', hora_llegada: '', se_quedo_dormir: false };
const AREA_LOGISTICA = 'Logistica/Almacen'; // solo esta área puede ser chofer/acompañante

export function ViajesPanel({ semana, canEdit, onChanged }: any) {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [viajes, setViajes] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [incent, setIncent] = useState({ chofer: 0, acomp: 0, tramo: null as number | null });
  const [editId, setEditId] = useState<string | null>(null); // viaje en edición (null = alta nueva)

  useEffect(() => { (async () => {
    const { data: emps } = await dbNomina.from('empleados').select('id,nombre,id_banco,area').eq('activo', true).eq('empresa', semana.empresa).order('id_banco', { ascending: true, nullsFirst: false });
    setEmpleados(emps || []);
    fetchViajes();
  })(); }, [semana.id]);

  // Solo personal de Logística/Almacén puede ir como chofer o acompañante.
  const logistica = empleados.filter((e) => e.area === AREA_LOGISTICA);

  async function fetchViajes() {
    const { data } = await dbNomina.from('viajes').select('*, chofer:chofer_id(nombre), acomp:acompanante_id(nombre)').eq('semana_id', semana.id).order('fecha');
    setViajes(data || []);
  }

  function onForm(campo: string, valor: any) {
    const nf = { ...form, [campo]: valor };
    setForm(nf);
    const { chofer, acomp } = calcIncentivos(nf.hora_llegada, nf.se_quedo_dormir);
    setIncent({ chofer, acomp, tramo: getTramo(nf.hora_llegada) });
  }

  async function guardar() {
    if (!form.chofer_id && !form.acompanante_id) { toast.error('Selecciona chofer o acompañante'); return; }

    // Validación de fecha: dentro del periodo = normal; hasta 7 días antes = retroactivo (avisa);
    // más viejo o posterior al periodo = bloqueado.
    let retro = false;
    if (form.fecha) {
      const f = new Date(form.fecha + 'T12:00:00');
      const ini = new Date(semana.fecha_inicio + 'T12:00:00');
      const fin = new Date(semana.fecha_fin + 'T12:00:00');
      const DIA = 86400000;
      if (f > fin) { toast.error('La fecha es posterior al periodo de esta nómina'); return; }
      if (f < ini) {
        const diasAntes = Math.round((ini.getTime() - f.getTime()) / DIA);
        if (diasAntes > 7) { toast.error('Solo se permiten viajes de hasta 1 semana antes del periodo'); return; }
        if (!confirm(`Ese viaje (${form.fecha}) no corresponde a esta semana. ¿Darlo de alta y que el monto vaya a Retroactivos?`)) return;
        retro = true;
      }
    }

    // Validación cruzada: si un viaje normal cae en un día con horas extra capturadas, avisar.
    if (!retro && form.fecha) {
      const empIds = [form.chofer_id, form.acompanante_id].filter(Boolean);
      const { data: noms } = await dbNomina.from('nominas').select('id,empleado_id').eq('semana_id', semana.id).in('empleado_id', empIds);
      const nomIds = (noms || []).map((n: any) => n.id);
      if (nomIds.length) {
        const { data: he } = await dbNomina.from('asistencias').select('nomina_id').in('nomina_id', nomIds).eq('fecha', form.fecha).gt('te_horas', 0);
        if (he && he.length) {
          const nomEmp: any = {}; (noms || []).forEach((n: any) => (nomEmp[n.id] = n.empleado_id));
          const nombres = [...new Set(he.map((h: any) => empleados.find((e) => e.id === nomEmp[h.nomina_id])?.nombre).filter(Boolean))];
          if (!confirm(`PARA ESTE DÍA ${nombres.join(' y ')} tiene horas extra. ¿Seguro que llegó a la hora del viaje?`)) return;
        }
      }
    }

    const payload = { semana_id: semana.id, fecha: form.fecha || null, destino: form.destino, cliente: form.cliente, vehiculo: form.vehiculo, chofer_id: form.chofer_id || null, acompanante_id: form.acompanante_id || null, hora_salida: form.hora_salida || null, hora_llegada: form.hora_llegada || null, se_quedo_dormir: form.se_quedo_dormir, incent_chofer: incent.chofer, incent_acompanante: incent.acomp, retroactivo: retro };

    if (editId) {
      // Modificar requiere validación explícita (recalcula incentivos).
      if (!confirm('¿Modificar este viaje? Se recalcularán los incentivos del chofer y acompañante.')) return;
      await dbNomina.from('viajes').update(payload).eq('id', editId);
      toast.success('Viaje modificado');
    } else {
      await dbNomina.from('viajes').insert(payload);
      toast.success(retro ? 'Viaje retroactivo agregado' : 'Viaje agregado');
    }
    cancelarEdicion(); fetchViajes(); onChanged?.();
  }

  function editar(v: any) {
    setEditId(v.id);
    const nf = { fecha: v.fecha || '', destino: v.destino || '', cliente: v.cliente || '', vehiculo: v.vehiculo || '', chofer_id: v.chofer_id || '', acompanante_id: v.acompanante_id || '', hora_salida: v.hora_salida || '', hora_llegada: v.hora_llegada || '', se_quedo_dormir: !!v.se_quedo_dormir };
    setForm(nf);
    const { chofer, acomp } = calcIncentivos(nf.hora_llegada, nf.se_quedo_dormir);
    setIncent({ chofer, acomp, tramo: getTramo(nf.hora_llegada) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelarEdicion() { setEditId(null); setForm({ ...EMPTY }); setIncent({ chofer: 0, acomp: 0, tramo: null }); }
  async function eliminar(id: string) { if (!confirm('¿Eliminar viaje?')) return; await dbNomina.from('viajes').delete().eq('id', id); if (editId === id) cancelarEdicion(); fetchViajes(); onChanged?.(); }

  const total = viajes.reduce((s, v) => s + (v.incent_chofer || 0) + (v.incent_acompanante || 0), 0);

  return (
    <div>
      {canEdit && (
        <div className="card" style={{ marginBottom: 16, ...(editId ? { borderColor: 'var(--amber-500)', boxShadow: '0 0 0 2px var(--amber-100)' } : {}) }}>
          <div className="card-header">
            <h3 className="card-title">{editId ? 'Editar viaje' : 'Agregar viaje'}</h3>
            {editId && <button className="btn btn-ghost btn-sm" onClick={cancelarEdicion}>Cancelar edición</button>}
          </div>
          <div className="card-body">
            <div className="form-grid form-grid-3">
              <div><label className="field-label">Fecha</label><input className="field-input" type="date" value={form.fecha} onChange={(e) => onForm('fecha', e.target.value)} /></div>
              <div><label className="field-label">Destino</label><input className="field-input" value={form.destino} onChange={(e) => onForm('destino', e.target.value)} /></div>
              <div><label className="field-label">Cliente</label><input className="field-input" value={form.cliente} onChange={(e) => onForm('cliente', e.target.value)} /></div>
              <div><label className="field-label">Vehículo</label><input className="field-input" value={form.vehiculo} onChange={(e) => onForm('vehiculo', e.target.value)} /></div>
              <div><label className="field-label">Chofer <span className="text-xs muted">(Logística/Almacén)</span></label><select className="field-input" value={form.chofer_id} onChange={(e) => onForm('chofer_id', e.target.value)}><option value="">—</option>{logistica.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>
              <div><label className="field-label">Acompañante <span className="text-xs muted">(Logística/Almacén)</span></label><select className="field-input" value={form.acompanante_id} onChange={(e) => onForm('acompanante_id', e.target.value)}><option value="">—</option>{logistica.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>
              <div><label className="field-label">Hora salida</label><input className="field-input" type="time" value={form.hora_salida} onChange={(e) => onForm('hora_salida', e.target.value)} /></div>
              <div><label className="field-label">Hora llegada</label><input className="field-input" type="time" value={form.hora_llegada} onChange={(e) => onForm('hora_llegada', e.target.value)} /></div>
              <div className="hstack" style={{ alignItems: 'flex-end', gap: 8 }}>
                <button type="button" className={`switch ${form.se_quedo_dormir ? 'on' : ''}`} onClick={() => onForm('se_quedo_dormir', !form.se_quedo_dormir)} />
                <span className="text-sm">Se quedó a dormir</span>
              </div>
            </div>
            <div className="hstack" style={{ justifyContent: 'space-between', marginTop: 16 }}>
              <div className="hstack" style={{ gap: 16 }}>
                <div><div className="text-xs muted">Chofer {incent.tramo != null ? `· ${TRAMOS[incent.tramo]}` : ''}</div><div className="fw-700 blue">{fmt(incent.chofer)}</div></div>
                <div><div className="text-xs muted">Acompañante</div><div className="fw-700 blue">{fmt(incent.acomp)}</div></div>
                <div><div className="text-xs muted">Total</div><div className="fw-700">{fmt(incent.chofer + incent.acomp)}</div></div>
              </div>
              <button className="btn btn-primary" onClick={guardar}><Icon name={editId ? 'check' : 'plus'} size={15} /> {editId ? 'Actualizar viaje' : 'Guardar viaje'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="card tbl-wrap">
        <div className="card-header"><h3 className="card-title">Viajes</h3><span className="text-sm muted">Total incentivos: <strong className="blue">{fmt(total)}</strong></span></div>
        <table className="tbl">
          <thead><tr><th>Fecha</th><th>Destino</th><th>Cliente</th><th>Chofer</th><th>Acompañante</th><th>Salida</th><th>Llegada</th><th className="right">Inc. chofer</th><th className="right">Inc. acomp.</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {viajes.map((v) => (
              <tr key={v.id}>
                <td className="muted">{v.fecha || '—'}{v.retroactivo && <span className="badge badge-amber" style={{ marginLeft: 4 }}>Retro</span>}</td><td>{v.destino || '—'}</td><td>{v.cliente || '—'}</td>
                <td>{v.chofer?.nombre || '—'}</td><td>{v.acomp?.nombre || '—'}</td>
                <td className="mono">{v.hora_salida || '—'}</td><td className="mono">{v.hora_llegada || '—'}{v.se_quedo_dormir ? ' 🌙' : ''}</td>
                <td className="right mono blue">{fmt(v.incent_chofer || 0)}</td><td className="right mono blue">{fmt(v.incent_acompanante || 0)}</td>
                {canEdit && <td><div className="hstack" style={{ gap: 2, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" title="Modificar viaje" onClick={() => editar(v)}><Icon name="edit" size={14} /></button>
                  <button className="btn btn-ghost btn-sm" title="Eliminar viaje" onClick={() => eliminar(v.id)}><Icon name="trash" size={14} /></button>
                </div></td>}
              </tr>
            ))}
            {viajes.length === 0 && <tr><td colSpan={canEdit ? 10 : 9}><div className="empty"><div className="empty-title">Sin viajes registrados</div></div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
