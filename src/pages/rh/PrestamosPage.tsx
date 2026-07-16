import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase, dbNomina } from '@/lib/nomina/db';
import { useAuth } from '@/lib/nomina/auth';
import { useEmpresa } from '@/lib/nomina/empresas';
import { fmt, fmtFecha, fmtFechaHora, fmtPeriodo, MESES } from '@/lib/nomina/format';
import { Icon } from '@/components/Icon';

// Descuento por nómina del préstamo: el monto definido; para préstamos viejos sin captura, 10% del monto.
const descLoan = (p: any) => (p?.descuento_nomina != null ? Number(p.descuento_nomina) : Math.round((p?.monto || 0) * 0.1 * 100) / 100);
import { PageEnter } from '@/components/motion';

export function PrestamosPage() {
  const { user } = useAuth();
  const { code: empresa } = useEmpresa();
  const canEdit = user?.rol !== 'viewer';
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({ empleado_id: '', monto: '', desc_nomina: '', fecha_prestamo: '', tipo: 'semanal' });
  const [abonoP, setAbonoP] = useState<any>(null); // préstamo al que se le abona fuera de nómina
  const [abonoMonto, setAbonoMonto] = useState('');
  const [detalleP, setDetalleP] = useState<any>(null); // préstamo cuyo desglose de pagos se ve
  const [hist, setHist] = useState<any[]>([]);
  const [histLoad, setHistLoad] = useState(false);

  async function verDetalle(p: any) {
    setDetalleP(p); setHist([]); setHistLoad(true);
    const { data } = await dbNomina
      .from('prestamo_descuentos')
      .select('*, semana:semana_id(fecha_inicio,fecha_fin)')
      .eq('prestamo_id', p.id)
      .order('created_at', { ascending: true });
    setHist(data || []); setHistLoad(false);
  }
  const totalAbonado = (p: any) => (p ? p.monto - p.saldo : 0);

  useEffect(() => { fetchP(); fetchE(); }, [empresa]);
  async function fetchP() { const { data } = await dbNomina.from('prestamos').select('*, empleado:empleado_id!inner(nombre,area,empresa)').eq('empleado.empresa', empresa).order('created_at', { ascending: false }); setPrestamos(data || []); }
  async function fetchE() { const { data } = await dbNomina.from('empleados').select('id,nombre,id_banco').eq('activo', true).eq('empresa', empresa).order('id_banco', { ascending: true, nullsFirst: false }); setEmpleados(data || []); }

  async function guardar() {
    const monto = parseFloat(form.monto);
    const descN = parseFloat(form.desc_nomina);
    if (!form.empleado_id || !(monto > 0) || !form.fecha_prestamo) return;
    if (!(descN > 0)) { toast.error('Captura el descuento por nómina'); return; }
    await dbNomina.from('prestamos').insert({ empleado_id: form.empleado_id, monto, saldo: monto, descuento_nomina: descN, fecha_prestamo: form.fecha_prestamo, tipo: form.tipo, activo: true });
    toast.success('Préstamo registrado');
    setModal(false); setForm({ empleado_id: '', monto: '', desc_nomina: '', fecha_prestamo: '', tipo: 'semanal' }); fetchP();
  }
  async function archivar(id: string) { if (!confirm('¿Archivar este préstamo?')) return; await dbNomina.from('prestamos').update({ activo: false }).eq('id', id); fetchP(); }

  // Editar el descuento por nómina de un préstamo existente.
  async function setDescuento(p: any, valor: string) {
    const n = parseFloat(valor);
    if (!(n > 0)) { toast.error('El descuento debe ser mayor a 0'); fetchP(); return; }
    if (n === descLoan(p)) return;
    setPrestamos((prev) => prev.map((x) => x.id === p.id ? { ...x, descuento_nomina: n } : x));
    const { error } = await dbNomina.from('prestamos').update({ descuento_nomina: n }).eq('id', p.id);
    if (error) { toast.error(error.message); fetchP(); return; }
    toast.success('Descuento actualizado');
  }

  // Abono fuera de nómina: reduce el saldo. El descuento por nómina NO cambia (sigue 10% del monto).
  async function abonar() {
    const monto = parseFloat(abonoMonto) || 0;
    if (monto <= 0) { toast.error('Captura el monto del abono'); return; }
    const real = Math.min(monto, abonoP.saldo);
    const nuevo = parseFloat((abonoP.saldo - real).toFixed(2));
    await dbNomina.from('prestamos').update({ saldo: nuevo }).eq('id', abonoP.id);
    await dbNomina.from('prestamo_descuentos').insert({ prestamo_id: abonoP.id, nomina_id: null, semana_id: null, monto_descontado: real, saldo_anterior: abonoP.saldo, saldo_posterior: nuevo });
    toast.success(`Abono de ${fmt(real)} registrado`);
    setAbonoP(null); setAbonoMonto(''); fetchP();
  }

  function primerDesc(fecha: string) {
    if (!fecha) return '';
    const d = new Date(fecha + 'T12:00:00'); d.setDate(d.getDate() + 7);
    return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
  }

  const activos = prestamos.filter((p) => p.activo !== false);
  const totPrestado = activos.reduce((s, p) => s + p.monto, 0);
  const totPend = activos.reduce((s, p) => s + p.saldo, 0);
  const desc = parseFloat(form.desc_nomina) || 0;
  const noms = (form.monto && desc > 0) ? Math.ceil(parseFloat(form.monto) / desc) : 0;

  return (
    <PageEnter>
      <div className="page-header">
        <div><h1 className="page-title">Préstamos</h1><p className="page-subtitle">El primer descuento aplica una semana después de la fecha</p></div>
        {canEdit && <button className="btn btn-primary" onClick={() => setModal(true)}><Icon name="plus" size={15} /> Nuevo préstamo</button>}
      </div>
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="kpi"><span className="kpi-label">Total prestado</span><span className="kpi-value">{fmt(totPrestado)}</span></div>
        <div className="kpi"><span className="kpi-label">Saldo pendiente</span><span className="kpi-value orange">{fmt(totPend)}</span></div>
        <div className="kpi"><span className="kpi-label">Préstamos activos</span><span className="kpi-value">{activos.length}</span></div>
      </div>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Empleado</th><th>Fecha</th><th>Tipo</th><th className="right">Monto</th><th className="right">Saldo</th><th className="right">Desc./nómina</th><th>Avance</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {prestamos.length === 0 && <tr><td colSpan={9}><div className="empty"><div className="empty-title">Sin préstamos</div></div></td></tr>}
            {prestamos.map((p) => {
              const d = descLoan(p);
              const pct = Math.round(((p.monto - p.saldo) / p.monto) * 100);
              const liq = p.saldo === 0, arch = p.activo === false;
              return (
                <tr key={p.id} className={`clickable ${arch ? 'row-inactive' : ''}`} style={{ cursor: 'pointer' }} onClick={() => verDetalle(p)} title="Ver desglose de pagos">
                  <td><div className="fw-600">{p.empleado?.nombre || '—'}</div><div className="text-xs muted">{p.empleado?.area || ''}</div></td>
                  <td className="muted">{fmtFecha(p.fecha_prestamo)}</td>
                  <td><span className="badge badge-gray">{p.tipo === 'semanal' ? 'Semanal' : 'Quincenal'}</span></td>
                  <td className="right mono">{fmt(p.monto)}</td>
                  <td className={`right mono ${liq ? 'pos' : 'orange'}`}>{liq ? 'Liquidado' : fmt(p.saldo)}</td>
                  <td className="right">
                    {canEdit && !arch && !liq && p.descuento_nomina == null
                      ? <input className="field-input mono" type="number" min="0" step="0.01" defaultValue={d} title="Captura el monto a descontar por nómina" placeholder="0.00" onClick={(e) => e.stopPropagation()} onBlur={(e) => setDescuento(p, e.target.value)} style={{ width: 100, textAlign: 'right', padding: '4px 6px' }} />
                      : <span className="mono blue" title="Capturado al alta (no editable)">{liq ? '—' : fmt(d)}</span>}
                  </td>
                  <td style={{ minWidth: 120 }}><div className="text-xs muted" style={{ marginBottom: 3 }}>{pct}%</div><div className="progress"><div className="progress-fill" style={{ width: pct + '%' }} /></div></td>
                  <td><span className={`badge ${arch ? 'badge-gray' : liq ? 'badge-green' : 'badge-blue'}`}>{arch ? 'Archivado' : liq ? 'Liquidado' : 'Activo'}</span></td>
                  {canEdit && <td><div className="hstack" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    {!arch && !liq && <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); setAbonoP(p); setAbonoMonto(''); }} title="Abono fuera de nómina">Abonar</button>}
                    {!arch && <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); archivar(p.id); }}><Icon name="trash" size={14} /></button>}
                  </div></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detalleP && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setDetalleP(null)}>
          <div className="modal page-enter" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Desglose de pagos</h3>
                <div className="text-xs muted">{detalleP.empleado?.nombre} · préstamo {fmt(detalleP.monto)} · {fmtFecha(detalleP.fecha_prestamo)}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetalleP(null)}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="grid grid-3" style={{ marginBottom: 14 }}>
                <div className="kpi"><span className="kpi-label">Monto</span><span className="kpi-value">{fmt(detalleP.monto)}</span></div>
                <div className="kpi"><span className="kpi-label">Abonado</span><span className="kpi-value pos">{fmt(totalAbonado(detalleP))}</span></div>
                <div className="kpi"><span className="kpi-label">Saldo</span><span className="kpi-value orange">{fmt(detalleP.saldo)}</span></div>
              </div>
              {histLoad ? <div className="empty"><span className="spinner" /></div> : hist.length === 0 ? (
                <div className="empty"><div className="empty-title">Sin pagos registrados</div><div className="text-xs muted">Los descuentos se registran al guardar cada nómina.</div></div>
              ) : (
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr><th>Fecha</th><th>Concepto</th><th className="right">Abono</th><th className="right">Saldo anterior</th><th className="right">Saldo después</th></tr></thead>
                    <tbody>
                      {hist.map((h) => (
                        <tr key={h.id}>
                          <td className="muted">{fmtFechaHora(h.created_at)}</td>
                          <td>{h.semana_id ? <span className="badge badge-blue">Nómina {h.semana ? fmtPeriodo(h.semana.fecha_inicio, h.semana.fecha_fin) : ''}</span> : <span className="badge badge-gray">Abono fuera de nómina</span>}</td>
                          <td className="right mono pos">{fmt(h.monto_descontado)}</td>
                          <td className="right mono muted">{fmt(h.saldo_anterior)}</td>
                          <td className="right mono">{fmt(h.saldo_posterior)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer"><button className="btn btn-primary" onClick={() => setDetalleP(null)}>Cerrar</button></div>
          </div>
        </div>
      )}

      {abonoP && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setAbonoP(null)}>
          <div className="modal page-enter" style={{ maxWidth: 440 }}>
            <div className="modal-header"><h3 className="modal-title">Abono fuera de nómina</h3><button className="btn btn-ghost btn-sm" onClick={() => setAbonoP(null)}><Icon name="x" size={16} /></button></div>
            <div className="modal-body">
              <p className="muted text-sm" style={{ marginTop: 0 }}>{abonoP.empleado?.nombre} · saldo actual <strong className="mono">{fmt(abonoP.saldo)}</strong>. El abono reduce el saldo; el descuento por nómina sigue igual.</p>
              <div><label className="field-label">Monto del abono</label><input className="field-input mono" type="number" autoFocus value={abonoMonto} onChange={(e) => setAbonoMonto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && abonar()} /></div>
              {parseFloat(abonoMonto) > 0 && <p className="text-xs muted" style={{ marginTop: 8 }}>Saldo después: <strong className="mono">{fmt(Math.max(0, abonoP.saldo - (parseFloat(abonoMonto) || 0)))}</strong></p>}
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setAbonoP(null)}>Cancelar</button><button className="btn btn-primary" onClick={abonar} disabled={!(parseFloat(abonoMonto) > 0)}>Registrar abono</button></div>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal page-enter" style={{ maxWidth: 520 }}>
            <div className="modal-header"><h3 className="modal-title">Nuevo préstamo</h3><button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}><Icon name="x" size={16} /></button></div>
            <div className="modal-body">
              <div className="form-grid">
                <div><label className="field-label">Empleado</label><select className="field-input" value={form.empleado_id} onChange={(e) => setForm((f: any) => ({ ...f, empleado_id: e.target.value }))}><option value="">— Selecciona —</option>{empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>
              </div>
              <div className="form-grid form-grid-2" style={{ marginTop: 14 }}>
                <div><label className="field-label">Monto del préstamo</label><input className="field-input mono" type="number" value={form.monto} onChange={(e) => setForm((f: any) => ({ ...f, monto: e.target.value }))} /></div>
                <div><label className="field-label">Descuento por nómina</label><input className="field-input mono" type="number" placeholder="Cantidad a descontar" value={form.desc_nomina} onChange={(e) => setForm((f: any) => ({ ...f, desc_nomina: e.target.value }))} /></div>
              </div>
              <div className="form-grid form-grid-2" style={{ marginTop: 14 }}>
                <div><label className="field-label">Fecha del préstamo</label><input className="field-input" type="date" value={form.fecha_prestamo} onChange={(e) => setForm((f: any) => ({ ...f, fecha_prestamo: e.target.value }))} /></div>
                <div><label className="field-label">Tipo</label><select className="field-input" value={form.tipo} onChange={(e) => setForm((f: any) => ({ ...f, tipo: e.target.value }))}><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option></select></div>
              </div>
              {form.monto > 0 && desc > 0 && form.fecha_prestamo && (
                <div style={{ marginTop: 14, background: 'var(--ink-50)', borderRadius: 'var(--r-md)', padding: 12 }} className="text-sm">
                  <div className="hstack" style={{ justifyContent: 'space-between' }}><span className="muted">Descuento por nómina</span><span className="mono fw-600">{fmt(desc)}</span></div>
                  <div className="hstack" style={{ justifyContent: 'space-between' }}><span className="muted">Nóminas para liquidar</span><span className="fw-600">{noms}</span></div>
                  <div className="hstack" style={{ justifyContent: 'space-between' }}><span className="muted">Primer descuento aprox.</span><span className="fw-600">{primerDesc(form.fecha_prestamo)}</span></div>
                </div>
              )}
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={guardar} disabled={!form.empleado_id || !(parseFloat(form.monto) > 0) || !(parseFloat(form.desc_nomina) > 0) || !form.fecha_prestamo}>Guardar</button></div>
          </div>
        </div>
      )}
    </PageEnter>
  );
}
