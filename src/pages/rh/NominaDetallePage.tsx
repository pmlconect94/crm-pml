import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase, dbNomina } from '@/lib/nomina/db';
import { useAuth } from '@/lib/nomina/auth';
import { useRhPermisos } from '@/lib/nomina/permisos';
import { fmtPeriodo } from '@/lib/nomina/format';
import { calcularNomina } from '@/lib/nomina/calc';
import { Icon } from '@/components/Icon';
import { TabResumen } from './tabs/TabResumen';
import { TabAsistencias } from './tabs/TabAsistencias';
import { TabComedor } from './tabs/TabComedor';
import { TabFiscal } from './tabs/TabFiscal';
import { TabPrestamosResumen } from './tabs/TabPrestamosResumen';
import { TabDescuentoProducto } from './tabs/TabDescuentoProducto';
import { TabBonos } from './tabs/TabBonos';
import { TabRetroactivos } from './tabs/TabRetroactivos';
import { ViajesPanel } from './ViajesPage';

const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'asistencias', label: 'Asistencias' },
  { key: 'viajes', label: 'Viajes' },
  { key: 'comedor', label: 'Comedor' },
  { key: 'fiscal', label: 'Fiscal' },
  { key: 'retroactivos', label: 'HE retro' },
  { key: 'descproducto', label: 'Desc. producto' },
  { key: 'bonos', label: 'Bonos' },
  { key: 'prestamos', label: 'Préstamos' },
];

export function NominaDetallePage() {
  const { semanaId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const rhPerm = useRhPermisos();
  const canEdit = user?.rol !== 'viewer';

  const [semana, setSemana] = useState<any>(null);
  // Pestaña inicial = la primera permitida (un capturista sin "Resumen" aterriza
  // en Asistencias en vez de en una pestaña que no puede ver).
  const [tab, setTab] = useState(() => (rhPerm.tabs.includes('resumen') ? 'resumen' : (rhPerm.tabs[0] ?? 'resumen')));
  const [busca, setBusca] = useState('');                                // buscador de empleado (aplica a todas las pestañas de captura)
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [nominas, setNominas] = useState<Record<string, any>>({});
  const [asistencias, setAsistencias] = useState<Record<string, any[]>>({});
  const [incentivos, setIncentivos] = useState<Record<string, number>>({});
  const [prestamosDesc, setPrestamosDesc] = useState<Record<string, number>>({});
  const [prestamosData, setPrestamosData] = useState<any[]>([]);
  const [descProductoMap, setDescProductoMap] = useState<Record<string, number>>({});
  const [bonoMap, setBonoMap] = useState<Record<string, number>>({});
  const [retroIncentMap, setRetroIncentMap] = useState<Record<string, number>>({}); // incentivo de viajes retro
  const [heRetroMap, setHeRetroMap] = useState<Record<string, number>>({});          // horas extra retro
  const [viajesEmp, setViajesEmp] = useState<Record<string, any[]>>({});
  const [viajeDias, setViajeDias] = useState<Record<string, string>>({});             // "nomId|fecha" -> hora_llegada
  const [loading, setLoading] = useState(true);
  const [unlock, setUnlock] = useState(false);
  const [pin, setPin] = useState('');
  const [, setCalcTick] = useState(0);                                  // fuerza recálculo (Fiscal reactivo)
  const [omitidos, setOmitidos] = useState<Set<string>>(new Set());     // préstamo_ids con descuento omitido esta semana
  const recomputar = () => setCalcTick((t) => t + 1);

  const timbrada = semana?.status === 'timbrada';

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data: sem } = await dbNomina.from('semanas').select('*').eq('id', semanaId).single();
    if (!sem) { setLoading(false); return; }
    setSemana(sem);

    const esquema = sem.tipo === 'semanal' ? 'Semanal' : 'Quincenal';
    const [empRes, nomRes, viajesRes, prestRes, descRes, bonoRes, retroRes, bpRes, bxRes, omitRes] = await Promise.all([
      dbNomina.from('empleados').select('*').eq('activo', true).eq('esquema_pago', esquema).eq('empresa', sem.empresa).order('id_banco', { ascending: true, nullsFirst: false }),
      dbNomina.from('nominas').select('*').eq('semana_id', sem.id),
      dbNomina.from('viajes').select('*').eq('semana_id', sem.id),
      dbNomina.from('prestamos').select('*, empleado:empleado_id(nombre,area)').eq('activo', true),
      dbNomina.from('nomina_descuento_producto').select('empleado_id,monto').eq('semana_id', sem.id),
      dbNomina.from('nomina_bono').select('empleado_id,monto').eq('semana_id', sem.id),
      dbNomina.from('nomina_retroactivo').select('empleado_id,horas').eq('semana_id', sem.id),
      dbNomina.from('bono_permanente').select('id,empleado_id,monto').eq('activo', true),
      dbNomina.from('bono_permanente_excluido').select('bono_permanente_id').eq('semana_id', sem.id),
      dbNomina.from('prestamo_omitir').select('prestamo_id').eq('semana_id', sem.id),
    ]);
    setEmpleados(empRes.data || []);

    // Asegura que TODO empleado activo de este esquema tenga su fila en `nominas`
    // (p.ej. si se dio de alta DESPUÉS de crear la nómina). Solo si sigue abierta.
    let nominasData: any[] = nomRes.data || [];
    const conNomina = new Set(nominasData.map((n: any) => n.empleado_id));
    const faltantes = (empRes.data || []).filter((e: any) => !conNomina.has(e.id));
    if (faltantes.length && sem.status !== 'timbrada') {
      const { data: nuevas } = await dbNomina.from('nominas').insert(faltantes.map((e: any) => ({ semana_id: sem.id, empleado_id: e.id }))).select();
      if (nuevas?.length) nominasData = [...nominasData, ...nuevas];
    }

    const nomMap: any = {}; nominasData.forEach((n: any) => (nomMap[n.empleado_id] = n)); setNominas(nomMap);

    const nomIds = nominasData.map((n: any) => n.id);
    const aMap: any = {};
    if (nomIds.length) {
      const { data: aData } = await dbNomina.from('asistencias').select('*').in('nomina_id', nomIds);
      (aData || []).forEach((a) => { (aMap[a.nomina_id] ||= []).push(a); });
    }
    setAsistencias(aMap);

    const iMap: any = {};        // incentivo de viajes normales (bucket Viajes)
    const riMap: any = {};       // incentivo de viajes retroactivos (bucket Retroactivo)
    const vEmp: any = {};
    const vDias: any = {};       // "nomId|fecha" -> hora_llegada (para validación con HE)
    (viajesRes.data || []).forEach((v) => {
      const dest = v.retroactivo ? riMap : iMap;
      if (v.chofer_id) { dest[v.chofer_id] = (dest[v.chofer_id] || 0) + (v.incent_chofer || 0); (vEmp[v.chofer_id] ||= []).push({ fecha: v.fecha, destino: v.destino, rol: 'Chofer', monto: v.incent_chofer || 0, retro: v.retroactivo }); }
      if (v.acompanante_id) { dest[v.acompanante_id] = (dest[v.acompanante_id] || 0) + (v.incent_acompanante || 0); (vEmp[v.acompanante_id] ||= []).push({ fecha: v.fecha, destino: v.destino, rol: 'Acompañante', monto: v.incent_acompanante || 0, retro: v.retroactivo }); }
      [v.chofer_id, v.acompanante_id].forEach((eid) => { if (eid && nomMap[eid] && v.fecha) vDias[`${nomMap[eid].id}|${v.fecha}`] = v.hora_llegada || ''; });
    });
    setIncentivos(iMap);
    setRetroIncentMap(riMap);
    setViajesEmp(vEmp);
    setViajeDias(vDias);

    const dpMap: any = {}; (descRes.data || []).forEach((d: any) => { dpMap[d.empleado_id] = (dpMap[d.empleado_id] || 0) + (d.monto || 0); }); setDescProductoMap(dpMap);
    const bMap: any = {}; (bonoRes.data || []).forEach((b: any) => { bMap[b.empleado_id] = (bMap[b.empleado_id] || 0) + (b.monto || 0); });
    // Bonos permanentes: aplican por default, salvo los excluidos en esta nómina.
    const excl = new Set((bxRes.data || []).map((x: any) => x.bono_permanente_id));
    (bpRes.data || []).forEach((bp: any) => { if (!excl.has(bp.id)) bMap[bp.empleado_id] = (bMap[bp.empleado_id] || 0) + (bp.monto || 0); });
    setBonoMap(bMap);
    const hrMap: any = {}; (retroRes.data || []).forEach((r: any) => { hrMap[r.empleado_id] = (hrMap[r.empleado_id] || 0) + (r.horas || 0); }); setHeRetroMap(hrMap);

    const fechaIni = new Date(sem.fecha_inicio + 'T12:00:00');
    const dMap: any = {};
    // SOLO préstamos de empleados que están en ESTA nómina (misma empresa + esquema). Si no se
    // filtra, se mezclan préstamos de las dos empresas y al guardar se descuentan saldos ajenos.
    const empIdSet = new Set((empRes.data || []).map((e: any) => e.id));
    const activos = (prestRes.data || []).filter((p) => {
      if (!empIdSet.has(p.empleado_id)) return false;
      if (p.saldo <= 0) return false;
      const fp = new Date(p.fecha_prestamo + 'T12:00:00');
      const espera = p.tipo === 'semanal' ? 7 : 15;
      const primera = new Date(fp); primera.setDate(fp.getDate() + espera);
      return fechaIni >= primera;
    });
    // Préstamos con el descuento OMITIDO esta semana (switch en la pestaña Préstamos).
    const omitSet = new Set((omitRes.data || []).map((o: any) => o.prestamo_id));
    setOmitidos(omitSet);
    // Descuento por nómina = monto fijo definido en el préstamo (fallback 10% para los viejos); tope = saldo.
    // Si el préstamo está omitido esta semana → 0 (esta semana se salta, no se descuenta).
    activos.forEach((p) => {
      if (omitSet.has(p.id)) return;
      const d = p.descuento_nomina != null ? Number(p.descuento_nomina) : p.monto * 0.1;
      dMap[p.empleado_id] = (dMap[p.empleado_id] || 0) + Math.min(d, p.saldo);
    });
    setPrestamosDesc(dMap); setPrestamosData(activos);
    setLoading(false);
  }, [semanaId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Switch por préstamo: omitir (o reactivar) el descuento SOLO en esta semana.
  async function toggleOmitir(prestamoId: string) {
    const isOm = omitidos.has(prestamoId);
    const next = new Set(omitidos);
    if (isOm) next.delete(prestamoId); else next.add(prestamoId);
    setOmitidos(next);
    // Recalcula los descuentos con el nuevo set (sin recargar todo).
    const dMap: Record<string, number> = {};
    prestamosData.forEach((p) => {
      if (next.has(p.id)) return;
      const d = p.descuento_nomina != null ? Number(p.descuento_nomina) : p.monto * 0.1;
      dMap[p.empleado_id] = (dMap[p.empleado_id] || 0) + Math.min(d, p.saldo);
    });
    setPrestamosDesc(dMap);
    try {
      if (isOm) await dbNomina.from('prestamo_omitir').delete().eq('semana_id', semana.id).eq('prestamo_id', prestamoId);
      else await dbNomina.from('prestamo_omitir').insert({ semana_id: semana.id, prestamo_id: prestamoId });
    } catch (err) { console.error(err); }
  }

  async function guardar() {
    if (!confirm('¿Guardar y cerrar la nómina? Ya no podrá editarse.')) return;
    const ops: any[] = [];
    prestamosData.forEach((p) => {
      if (omitidos.has(p.id)) return; // descuento omitido esta semana → no se toca el saldo
      const nomId = nominas[p.empleado_id]?.id;
      if (!nomId) return; // empleado no pertenece a esta nómina → NO tocar su saldo (evita descuentos ajenos)
      const bruto = p.descuento_nomina != null ? Number(p.descuento_nomina) : p.monto * 0.1;
      const real = parseFloat(Math.min(bruto, p.saldo).toFixed(2));
      if (real <= 0) return;
      const nuevo = parseFloat((p.saldo - real).toFixed(2));
      ops.push(dbNomina.from('prestamos').update({ saldo: nuevo, activo: nuevo > 0 }).eq('id', p.id));
      ops.push(dbNomina.from('prestamo_descuentos').insert({ prestamo_id: p.id, nomina_id: nomId, semana_id: semana.id, monto_descontado: real, saldo_anterior: p.saldo, saldo_posterior: nuevo }));
    });
    await Promise.all(ops);
    await dbNomina.from('semanas').update({ status: 'timbrada', timbrada_at: new Date().toISOString() }).eq('id', semana.id);
    toast.success('Nómina guardada');
    navigate('/app/rh/nominas');
  }

  async function desbloquear() {
    const maestro = import.meta.env.VITE_MASTER_PIN || '1424798';
    if (pin !== maestro) { toast.error('PIN incorrecto'); setPin(''); return; }
    if (!confirm('¿Desbloquear? Se revertirán los descuentos de préstamos de esta semana.')) return;
    const { data: descs } = await dbNomina.from('prestamo_descuentos').select('*').eq('semana_id', semana.id);
    if (descs?.length) {
      await Promise.all(descs.map((d) => dbNomina.from('prestamos').update({ saldo: d.saldo_anterior, activo: true }).eq('id', d.prestamo_id)));
      await dbNomina.from('prestamo_descuentos').delete().eq('semana_id', semana.id);
    }
    await dbNomina.from('semanas').update({ status: 'abierta', timbrada_at: null }).eq('id', semana.id);
    toast.success('Nómina desbloqueada');
    setUnlock(false); setPin(''); cargar();
  }

  if (loading) return <div className="loading-screen"><span className="spinner" /></div>;
  if (!semana) return <div className="empty"><div className="empty-title">Nómina no encontrada</div></div>;
  // Permisos granulares: tipo de nómina no permitido (ej. quincenal para un
  // capturista solo-semanales) → de regreso a la lista, aunque tecleen la URL.
  if (!rhPerm.nominasTipos.includes(semana.tipo)) return <Navigate to="/app/rh/nominas" replace />;

  // Buscador de empleado: filtra la lista que alimenta a TODAS las pestañas de
  // captura (un solo buscador arriba en vez de uno por pestaña). Es solo de vista:
  // el guardado usa `nominas`/`prestamosData` (completos), no esta lista filtrada.
  const q = busca.trim().toLowerCase();
  const empleadosFiltrados = q
    ? empleados.filter((e) =>
        (e.nombre ?? '').toLowerCase().includes(q) ||
        (e.area ?? '').toLowerCase().includes(q) ||
        String(e.id_nomex ?? '').includes(q),
      )
    : empleados;
  const TABS_CON_BUSCADOR = new Set(['resumen', 'asistencias', 'comedor', 'fiscal', 'retroactivos', 'descproducto', 'bonos']);

  const calcData = empleadosFiltrados.map((e) => {
    const nom = nominas[e.id];
    const asist = nom ? (asistencias[nom.id] || []) : [];
    return { empleado: e, nomina: nom, asistencias: asist, viajes: viajesEmp[e.id] || [], calc: calcularNomina(e, nom, asist, incentivos[e.id] || 0, prestamosDesc[e.id] || 0, semana.tipo, descProductoMap[e.id] || 0, bonoMap[e.id] || 0, retroIncentMap[e.id] || 0, heRetroMap[e.id] || 0) };
  });

  return (
    <div className="page-enter">
      <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="hstack" style={{ gap: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/app/rh/nominas')}><Icon name="arrow-left" size={14} /> Nóminas</button>
          <div>
            <div className="fw-700">{fmtPeriodo(semana.fecha_inicio, semana.fecha_fin)}</div>
            <div className="text-xs muted" style={{ textTransform: 'capitalize' }}>{semana.tipo}</div>
          </div>
          <span className={`badge ${timbrada ? 'badge-green' : 'badge-blue'}`}><span className="dot" />{timbrada ? 'Guardada' : 'Abierta'}</span>
        </div>
        {canEdit && rhPerm.cerrarNomina && (timbrada
          ? <button className="btn btn-danger btn-sm" onClick={() => setUnlock(true)}><Icon name="lock" size={14} /> Desbloquear</button>
          : <button className="btn btn-primary" onClick={guardar}><Icon name="check" size={15} /> Guardar nómina</button>)}
      </div>

      <div className="tabs">
        {TABS.filter((t) => rhPerm.tabs.includes(t.key) && !(t.key === 'viajes' && semana.empresa === 'MARLIN')).map((t) => <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </div>

      {/* Buscador de empleado — filtra las pestañas de captura por empleado (uno
          solo para todas, en vez de uno por pestaña). No se muestra en Viajes ni
          Préstamos (no son tablas por empleado). */}
      {TABS_CON_BUSCADOR.has(tab) && (
        <div className="hstack" style={{ gap: 8, margin: '10px 0', maxWidth: 420 }}>
          <div className="hstack" style={{ gap: 8, flex: 1, padding: '7px 10px', background: 'white', border: '1px solid var(--ink-200)', borderRadius: 'var(--r-md)' }}>
            <Icon name="search" size={14} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar empleado por nombre, área o NOMEX…"
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, background: 'transparent', color: 'var(--ink-900)' }}
            />
            {busca && <button className="btn btn-ghost btn-sm" style={{ padding: 3 }} onClick={() => setBusca('')} aria-label="Limpiar"><Icon name="x" size={13} /></button>}
          </div>
          {q && <span className="text-xs muted" style={{ whiteSpace: 'nowrap' }}>{empleadosFiltrados.length} de {empleados.length}</span>}
        </div>
      )}

      {tab === 'resumen' && <TabResumen calcData={calcData} semana={semana} />}
      {tab === 'asistencias' && <TabAsistencias semana={semana} nominas={nominas} empleados={empleadosFiltrados} asistencias={asistencias} viajeDias={viajeDias} canEdit={canEdit && !timbrada} />}
      {tab === 'viajes' && semana.empresa !== 'MARLIN' && <ViajesPanel semana={semana} canEdit={canEdit && !timbrada} onChanged={cargar} />}
      {tab === 'comedor' && <TabComedor semana={semana} nominas={nominas} empleados={empleadosFiltrados} canEdit={canEdit && !timbrada} />}
      {tab === 'descproducto' && <TabDescuentoProducto semana={semana} nominas={nominas} empleados={empleadosFiltrados} canEdit={canEdit && !timbrada} onChanged={cargar} />}
      {tab === 'bonos' && <TabBonos semana={semana} nominas={nominas} empleados={empleadosFiltrados} canEdit={canEdit && !timbrada} onChanged={cargar} />}
      {tab === 'retroactivos' && <TabRetroactivos semana={semana} nominas={nominas} empleados={empleadosFiltrados} canEdit={canEdit && !timbrada} onChanged={cargar} />}
      {tab === 'prestamos' && <TabPrestamosResumen prestamos={prestamosData} descMap={prestamosDesc} semana={semana} omitidos={omitidos} canEdit={canEdit && !timbrada} onToggleOmitir={toggleOmitir} />}
      {tab === 'fiscal' && <TabFiscal calcData={calcData} nominas={nominas} semana={semana} canEdit={canEdit && !timbrada} onChanged={recomputar} />}

      {unlock && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setUnlock(false)}>
          <div className="modal page-enter" style={{ maxWidth: 400 }}>
            <div className="modal-header"><h3 className="modal-title">Autorización requerida</h3><button className="btn btn-ghost btn-sm" onClick={() => setUnlock(false)}><Icon name="x" size={16} /></button></div>
            <div className="modal-body">
              <p className="muted" style={{ marginTop: 0 }}>Ingresa el PIN maestro para desbloquear esta nómina.</p>
              <input className="field-input" type="password" autoFocus value={pin} placeholder="PIN" style={{ textAlign: 'center', letterSpacing: 6, fontSize: 18 }} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && desbloquear()} />
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setUnlock(false)}>Cancelar</button><button className="btn btn-danger" onClick={desbloquear}>Autorizar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
