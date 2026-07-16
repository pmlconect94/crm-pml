import { useEffect, useState } from 'react';
import { supabase, dbNomina } from '@/lib/nomina/db';
import { fmt, toISO } from '@/lib/nomina/format';

const COSTO = 30;
const DIAS_C = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function TabComedor({ semana, nominas, empleados, canEdit }: any) {
  const [marcados, setMarcados] = useState<Map<string, number>>(new Map()); // "nomId|fecha" -> cantidad (1 o 2)
  const [loading, setLoading] = useState(true);

  // Días hábiles (lunes a viernes) del comedor.
  function diasHabiles() {
    const out: Date[] = [];
    const ini = new Date(semana.fecha_inicio + 'T12:00:00');

    if (semana.tipo === 'quincenal') {
      // Quincena: días hábiles del periodo (1–15 o 16–fin), máx 10. El 11º pasa a la otra quincena.
      const fin = new Date(semana.fecha_fin + 'T12:00:00');
      for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (dow >= 1 && dow <= 5) out.push(new Date(d));
      }
      return out.slice(0, 10);
    }

    // MARLIN: la nómina cierra el JUEVES → el comedor corre del JUEVES anterior al JUEVES de la semana
    // (un día más que PML): jue (lun−4), vie, lun, mar, mié, jue (lun+3) = 6 días.
    // Ej.: semana lun 15 jun → comedor jue 11, vie 12, lun 15, mar 16, mié 17, jue 18.
    const esMarlin = semana.empresa === 'MARLIN';
    const start = new Date(ini); start.setDate(ini.getDate() - (esMarlin ? 4 : 3)); // jueves (Marlin) / viernes (PML) anterior
    const end = new Date(ini); end.setDate(ini.getDate() + 3);                       // jueves de la semana
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow >= 1 && dow <= 5) out.push(new Date(d));
    }
    return out;
  }
  const dias = diasHabiles();
  const fechasValidas = new Set(dias.map((d) => toISO(d)));

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await dbNomina.from('comedor_registro').select('nomina_id,fecha,cantidad').eq('semana_id', semana.id);
      const s = new Map<string, number>();
      (data || []).forEach((r: any) => s.set(`${r.nomina_id}|${r.fecha}`, r.cantidad || 1));
      setMarcados(s);
      setLoading(false);
    })();
  }, [semana.id]);

  // Total de COMIDAS del empleado (suma cantidades; un día doble cuenta 2).
  function countNom(nomId: string, map: Map<string, number>) {
    let n = 0;
    map.forEach((cant, k) => {
      const [id, fecha] = k.split('|');
      if (id === nomId && fechasValidas.has(fecha)) n += cant;
    });
    return n;
  }

  async function syncMonto(empId: string, nomId: string, next: Map<string, number>) {
    const monto = countNom(nomId, next) * COSTO;
    if (nominas[empId]) nominas[empId].comedor = monto;
    await dbNomina.from('nominas').update({ comedor: monto }).eq('id', nomId);
  }

  // Marca / desmarca el día (cantidad 1). Desmarcar borra el registro.
  async function toggle(empId: string, nomId: string, fecha: string) {
    if (!canEdit) return;
    const key = `${nomId}|${fecha}`;
    const next = new Map(marcados);
    const checked = next.has(key);
    if (checked) next.delete(key); else next.set(key, 1);
    setMarcados(next);
    try {
      if (checked) await dbNomina.from('comedor_registro').delete().eq('nomina_id', nomId).eq('fecha', fecha);
      else await dbNomina.from('comedor_registro').insert({ semana_id: semana.id, nomina_id: nomId, empleado_id: empId, fecha, cantidad: 1 });
      await syncMonto(empId, nomId, next);
    } catch (err) { console.error(err); }
  }

  // Comida doble: pone la cantidad del día en 2 (o de vuelta en 1). Solo si el día ya está marcado.
  async function setDoble(empId: string, nomId: string, fecha: string, doble: boolean) {
    if (!canEdit) return;
    const key = `${nomId}|${fecha}`;
    if (!marcados.has(key)) return;
    const cant = doble ? 2 : 1;
    const next = new Map(marcados);
    next.set(key, cant);
    setMarcados(next);
    try {
      await dbNomina.from('comedor_registro').update({ cantidad: cant }).eq('nomina_id', nomId).eq('fecha', fecha);
      await syncMonto(empId, nomId, next);
    } catch (err) { console.error(err); }
  }

  let totalDias = 0;
  marcados.forEach((cant, k) => { if (fechasValidas.has(k.split('|')[1])) totalDias += cant; });

  return (
    <div>
      <p className="muted text-sm" style={{ marginTop: 0 }}>
        Marca los días que cada empleado usó el comedor (solo lunes a viernes). Costo por día: <strong>{fmt(COSTO)}</strong>. Queda registrado por día para el reporte mensual.
        Si un día comió <strong>dos veces</strong>, marca el día y pulsa el pequeño <strong>×2</strong>.
      </p>
      {loading ? <div className="empty"><span className="spinner" /></div> : (
        <div className="card tbl-freeze">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>Empleado</th>
                {dias.map((d, i) => (
                  <th key={i} className="center" style={{ borderLeft: '1px solid var(--ink-200)' }}>
                    {DIAS_C[d.getDay()]}<br /><span className="muted">{d.getDate()} {MESES_C[d.getMonth()]}</span>
                  </th>
                ))}
                <th className="right">Comidas</th>
                <th className="right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {empleados.map((emp: any) => {
                const nom = nominas[emp.id];
                if (!nom) return null;
                const n = countNom(nom.id, marcados);
                return (
                  <tr key={emp.id}>
                    <td><div className="fw-600">{emp.nombre}</div><div className="text-xs muted">{emp.area}</div></td>
                    {dias.map((d, i) => {
                      const fecha = toISO(d);
                      const cant = marcados.get(`${nom.id}|${fecha}`) || 0;
                      const on = cant > 0;
                      return (
                        <td key={i} className="center" style={{ borderLeft: '1px solid var(--ink-100)' }}>
                          <div className="hstack" style={{ gap: 3, justifyContent: 'center', alignItems: 'center' }}>
                            <input type="checkbox" checked={on} disabled={!canEdit} onChange={() => toggle(emp.id, nom.id, fecha)} style={{ width: 17, height: 17, cursor: canEdit ? 'pointer' : 'default', accentColor: 'var(--blue-500)' }} />
                            {on && (
                              <button
                                onClick={() => setDoble(emp.id, nom.id, fecha, cant !== 2)}
                                disabled={!canEdit}
                                title={cant === 2 ? 'Comió 2 veces este día — clic para volver a 1' : 'Marcar comida doble (2 veces este día)'}
                                style={{ fontSize: 9, lineHeight: 1, padding: '2px 3px', borderRadius: 4, border: '1px solid var(--ink-200)', background: cant === 2 ? 'var(--blue-500)' : 'transparent', color: cant === 2 ? 'white' : 'var(--ink-400)', cursor: canEdit ? 'pointer' : 'default', fontWeight: 700 }}
                              >×2</button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="right mono fw-600">{n}</td>
                    <td className={`right mono ${n > 0 ? 'neg' : 'zero'}`}>{n > 0 ? '-' + fmt(n * COSTO) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--ink-50)', fontWeight: 700 }}>
                <td>Total</td>
                <td colSpan={dias.length} className="right">{totalDias} comidas</td>
                <td className="right mono">{totalDias}</td>
                <td className="right mono neg">-{fmt(totalDias * COSTO)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
