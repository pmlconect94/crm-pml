import { useState, useMemo } from 'react';
import { fmt, fmtFecha, nomexLabel } from '@/lib/nomina/format';
import { Icon } from '@/components/Icon';
import { imprimirNomina, exportarValesXLSX, exportarBanortePag } from './printNomina';

function Linea({ label, value, neg, bold, red }: any) {
  if (!value && !bold) return null;
  return (
    <div className="hstack" style={{ justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--ink-100)', fontWeight: bold ? 700 : 400 }}>
      <span className={bold ? '' : 'muted'} style={red ? { color: 'var(--red-500)' } : undefined}>{label}</span>
      <span className={`mono ${neg ? 'neg' : ''}`} style={red ? { color: 'var(--red-500)' } : undefined}>{neg && value ? '-' : ''}{fmt(value)}</span>
    </div>
  );
}

function ReciboModal({ d, onClose }: { d: any; onClose: () => void }) {
  const e = d.empleado, c = d.calc;
  const descPrestamo = c.totalDed - c.infonavit - c.comedor - c.retardoMonto - (c.descuentoProducto || 0);
  const diasHE = (d.asistencias || []).filter((a: any) => (parseFloat(a.te_horas) || 0) > 0);
  const viajes = d.viajes || [];
  return (
    <div className="modal-backdrop" onClick={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="modal page-enter" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{e.nombre}</h3>
            <div className="text-xs muted">{nomexLabel(e)} · {e.puesto || '—'} · {e.area || '—'}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="grid grid-3" style={{ marginBottom: 14 }}>
            <div className="kpi"><span className="kpi-label">Días asistencia</span><span className="kpi-value">{c.diasA}</span></div>
            <div className="kpi"><span className="kpi-label">Faltas</span><span className="kpi-value">{c.diasF}</span></div>
            <div className="kpi"><span className="kpi-label">Sueldo diario{c.usaFiscalBase ? ' (fiscal)' : ''}</span><span className="kpi-value">{fmt(c.dBase ?? c.dDR)}</span></div>
          </div>

          <div className="form-section-title">Percepciones</div>
          <Linea label={`Asistencias + séptimo día (${c.diasA} días)`} value={c.asistMonto + c.septimo} />
          <Linea label={`Horas extra (${c.totalTEHrs}h)`} value={c.te} />
          <Linea label="Viajes / incentivos" value={c.incentivos} />
          <Linea label="Bono" value={c.bono} />
          <Linea label="Retroactivo · viajes" value={c.retroactivo} />
          <Linea label={`Retroactivo · horas extra (${c.teRetroHrs}h)`} value={c.teRetro} />
          <Linea label="Comisiones" value={c.comisiones} />
          <Linea label="Retroactivos" value={c.retroactivos} />
          {c.usaFiscalBase && <Linea label="Previsión social" value={c.prevSocial} />}
          {c.usaFiscalBase && <Linea label="Vales de despensa" value={c.vales} />}
          <Linea label="Total percepciones" value={c.usaFiscalBase ? (c.totalPerc + c.vales + c.prevSocial) : c.totalPerc} bold />

          {diasHE.length > 0 && (
            <div style={{ marginTop: 6, paddingLeft: 8 }}>
              <div className="text-xs muted" style={{ marginBottom: 2 }}>Días con horas extra:</div>
              {diasHE.map((a: any, i: number) => (
                <div key={i} className="text-xs hstack" style={{ justifyContent: 'space-between' }}>
                  <span>{fmtFecha(a.fecha)} · {a.te_horas}h {a.te_motivo ? `· ${a.te_motivo}` : ''}</span>
                </div>
              ))}
            </div>
          )}
          {viajes.length > 0 && (
            <div style={{ marginTop: 6, paddingLeft: 8 }}>
              <div className="text-xs muted" style={{ marginBottom: 2 }}>Viajes:</div>
              {viajes.map((v: any, i: number) => (
                <div key={i} className="text-xs hstack" style={{ justifyContent: 'space-between' }}>
                  <span>{fmtFecha(v.fecha)} · {v.destino || '—'} ({v.rol})</span>
                  <span className="mono">{fmt(v.monto)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="form-section-title">Deducciones</div>
          <Linea label="Infonavit" value={c.infonavit} neg />
          <Linea label="Comedor" value={c.comedor} neg />
          <Linea label="Descuento de producto" value={c.descuentoProducto} neg />
          <Linea label={`Retardos (${(c.totalRetHrs || 0).toFixed(2)}h)`} value={c.retardoMonto} neg />
          <Linea label="Préstamos" value={descPrestamo} neg />
          {c.usaFiscalBase && <Linea label="ISR" value={c.isr} neg />}
          {c.usaFiscalBase && <Linea label="IMSS" value={c.imss} neg />}
          <Linea label="Total deducciones" value={c.usaFiscalBase ? (c.totalDed + c.isr + c.imss) : c.totalDed} neg bold />

          <div className="form-section-title">Resultado</div>
          <div className="hstack" style={{ justifyContent: 'space-between', padding: '10px 12px', background: 'var(--green-100)', borderRadius: 'var(--r-md)', marginBottom: 14 }}>
            <span className="fw-700">Neto a pagar</span><span className="mono fw-700" style={{ fontSize: 18 }}>{fmt(c.neto)}</span>
          </div>

          {c.altaImss && !c.usaFiscalBase && (
            <>
              <div className="form-section-title">Parte fiscal (no afecta el neto)</div>
              <Linea label="Sueldo fiscal del periodo" value={c.sueldoFiscalPeriodo} />
              <Linea label="Previsión social (prorrateada)" value={c.prevSocial} />
              <Linea label="Vales de despensa (prorrateados)" value={c.vales} />
              <Linea label="Infonavit" value={c.infonavit} neg />
              <Linea label={`Retardos (${(c.totalRetHrs || 0).toFixed(2)}h)`} value={c.retardoMonto} neg />
              <Linea label="Préstamos" value={c.prestDesc} neg />
              <Linea label="Descuento de producto" value={c.descuentoProducto} neg />
              {/* PML: el comedor SÍ baja el depósito fiscal → se muestra como renglón para que el
                  total cuadre. Marlin: no baja el depósito (cae al efectivo) → se aclara al pie. */}
              {!c.esMarlin && c.comedor > 0 && <Linea label="Comedor" value={c.comedor} neg />}
              <Linea label="ISR" value={c.isr} neg />
              <Linea label="IMSS" value={c.imss} neg />
              <Linea label="Depósito fiscal (calculado)" value={c.depositoFiscal} bold />
              {c.esMarlin && c.comedor > 0 && (
                <div className="text-xs muted" style={{ padding: '4px 0' }}>
                  El comedor ({fmt(c.comedor)}) NO se resta del depósito; se descuenta del efectivo.
                </div>
              )}
            </>
          )}

          <div className="form-section-title">Distribución del pago</div>
          {(!c.altaImss || c.puroEfectivo) ? (
            <Linea label={c.puroEfectivo ? 'Efectivo (todo · dep. corregido en 0)' : 'Efectivo'} value={c.efectivo} bold />
          ) : c.modeloMarlin ? (
            <>
              <Linea label="Depósito total (banco + vales)" value={c.depositoCorregido} bold red={c.tieneCorregido} />
              <Linea label="Depósito a banco" value={c.depositoBanco} />
              <Linea label="Vales de despensa" value={c.valesPago} />
              <Linea label="Efectivo" value={c.efectivo} bold />
            </>
          ) : (
            <>
              {c.tieneCorregido && <Linea label="Depósito corregido (manual)" value={c.depositoCorregido} bold red />}
              {!c.tieneCorregido && <Linea label="Depósito a depositar" value={c.depositoCorregido} bold />}
              <Linea label="Vales de despensa" value={c.valesPago} />
              <Linea label="Depósito a banco" value={c.depositoBanco} />
              <Linea label="Efectivo" value={c.efectivo} />
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => window.print()}><Icon name="printer" size={14} /> Imprimir</button>
          <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export function TabResumen({ calcData, semana }: { calcData: any[]; semana: any }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'id_banco', dir: 1 });
  const [detalleId, setDetalleId] = useState<string | null>(null);
  // El recibo se deriva del cálculo EN VIVO (no una foto): si cambia algo (préstamo, séptimo,
  // ISR/IMSS…) mientras está abierto, se actualiza al instante.
  const detalle = detalleId != null ? calcData.find((r: any) => r.empleado.id === detalleId) : null;
  const [printMenu, setPrintMenu] = useState(false);
  // El menú depende de la empresa: Marlin NO tiene viajes, así que su reporte es
  // "Horas extras" (solo HE) y suma "Bonos". PML conserva "Viajes y horas extra".
  const esMarlin = semana?.empresa === 'MARLIN';
  const acciones: { label: string; run: () => void; disabled?: boolean }[] = esMarlin
    ? [
        { label: '🖨  Incidencias', run: () => imprimirNomina('incidencias', calcData, semana) },
        { label: '🖨  Horas extras', run: () => imprimirNomina('horasextra', calcData, semana) },
        { label: '🖨  Bonos', run: () => imprimirNomina('bonos', calcData, semana) },
        { label: '🖨  Dispersión', run: () => imprimirNomina('dispersion', calcData, semana) },
        { label: '🖨  Reporte fiscal', run: () => imprimirNomina('fiscal', calcData, semana) },
        { label: '⬇  Vales — Excel (.xlsx)', run: () => exportarValesXLSX(calcData, semana) },
        { label: '🏦  Dispersión Banorte (.pag)', run: () => exportarBanortePag(calcData, semana) },
      ]
    : [
        { label: '🖨  Incidencias', run: () => imprimirNomina('incidencias', calcData, semana) },
        { label: '🖨  Viajes y horas extra', run: () => imprimirNomina('viajeshe', calcData, semana) },
        { label: '🖨  Dispersión', run: () => imprimirNomina('dispersion', calcData, semana) },
        { label: '🖨  Reporte fiscal', run: () => imprimirNomina('fiscal', calcData, semana) },
        { label: '⬇  Vales — Excel (.xlsx)', run: () => exportarValesXLSX(calcData, semana) },
        { label: '🏦  Dispersión Banorte (.pag)', run: () => exportarBanortePag(calcData, semana) },
      ];

  const t = calcData.reduce((acc, d) => {
    acc.perc += d.calc.totalPerc; acc.ded += d.calc.totalDed; acc.neto += d.calc.neto;
    acc.dep += d.calc.deposito; acc.vales += d.calc.valesPago; acc.depBanco += d.calc.depositoBanco; acc.efectivo += d.calc.efectivo;
    return acc;
  }, { perc: 0, ded: 0, neto: 0, dep: 0, vales: 0, depBanco: 0, efectivo: 0 });

  function val(d: any, key: string) {
    switch (key) {
      case 'nombre': return (d.empleado.nombre || '').toLowerCase();
      case 'id_banco': return d.empleado.id_banco ?? Number.MAX_SAFE_INTEGER;
      case 'neto': return d.calc.neto;
      case 'depBanco': return d.calc.depositoBanco;
      case 'efectivo': return d.calc.efectivo;
      default: return 0;
    }
  }
  const rows = useMemo(() => {
    return [...calcData].sort((a, b) => {
      const va = val(a, sort.key), vb = val(b, sort.key);
      if (va < vb) return -1 * sort.dir;
      if (va > vb) return 1 * sort.dir;
      return 0;
    });
  }, [calcData, sort]);

  function clickSort(key: string) {
    setSort((s) => s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) } : { key, dir: 1 });
  }
  const Th = ({ k, children, right }: any) => (
    <th onClick={() => clickSort(k)} className={right ? 'right' : ''} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {children}{' '}
      <span style={{ opacity: sort.key === k ? 1 : 0.25 }}>{sort.key === k ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
    </th>
  );

  return (
    <div>
      <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 className="card-title">Resumen de nómina</h3>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-outline btn-sm" onClick={() => setPrintMenu((o) => !o)}><Icon name="printer" size={14} /> Imprimir / Exportar ▾</button>
          {printMenu && (
            <>
              <div onClick={() => setPrintMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 50, background: 'white', border: '1px solid var(--ink-200)', borderRadius: 'var(--r-md)', boxShadow: '0 10px 28px rgba(10,37,64,0.14)', minWidth: 250, overflow: 'hidden', padding: 4 }}>
                {acciones.map((a) => (
                  <button
                    key={a.label}
                    disabled={a.disabled}
                    onClick={() => { if (a.disabled) return; a.run(); setPrintMenu(false); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: 13, background: 'white', borderRadius: 8, color: a.disabled ? 'var(--ink-400)' : 'var(--ink-800)', cursor: a.disabled ? 'default' : 'pointer' }}
                    onMouseOver={(e) => { if (!a.disabled) e.currentTarget.style.background = 'var(--blue-50)'; }}
                    onMouseOut={(e) => (e.currentTarget.style.background = 'white')}
                  >{a.label}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-4" style={{ marginBottom: 14, gridTemplateColumns: 'repeat(5,1fr)' }}>
        <div className="kpi"><span className="kpi-label">Percepciones</span><span className="kpi-value">{fmt(t.perc)}</span></div>
        <div className="kpi"><span className="kpi-label">Deducciones</span><span className="kpi-value neg">{fmt(t.ded)}</span></div>
        <div className="kpi"><span className="kpi-label">Neto a pagar</span><span className="kpi-value pos">{fmt(t.neto)}</span></div>
        <div className="kpi"><span className="kpi-label">Depósito banco</span><span className="kpi-value orange">{fmt(t.depBanco)}</span></div>
        <div className="kpi"><span className="kpi-label">Efectivo</span><span className="kpi-value blue">{fmt(t.efectivo)}</span></div>
      </div>
      <div className="card tbl-wrap">
        <table className="tbl" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <Th k="id_banco">ID Banco</Th>
              <Th k="nombre">Empleado</Th>
              <th className="right">T. extra</th><th className="right">Viajes</th><th className="right">Bono</th><th className="right">Retro.</th>
              <th className="right">Infonavit</th><th className="right">Comedor</th><th className="right">Retardos</th><th className="right">Préstamos</th><th className="right">Desc. prod.</th>
              <Th k="neto" right>Neto</Th><Th k="depBanco" right>Dep. banco</Th><th className="right">Vales</th><Th k="efectivo" right>Efectivo</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const e = row.empleado, c = row.calc;
              const descPrestamo = c.totalDed - c.infonavit - c.comedor - c.retardoMonto - (c.descuentoProducto || 0);
              return (
                <tr key={e.id} className="clickable" style={{ cursor: 'pointer' }} onClick={() => setDetalleId(e.id)} title="Ver tarjeta de nómina">
                  <td className="mono fw-600">{e.id_banco ?? '—'}</td>
                  <td><div className="fw-600">{e.nombre}</div><div className="text-xs muted">{e.area}</div></td>
                  <td className="right mono">{c.te > 0 ? fmt(c.te) : '—'}</td>
                  <td className="right mono">{c.incentivos > 0 ? fmt(c.incentivos) : '—'}</td>
                  <td className="right mono pos">{c.bono > 0 ? fmt(c.bono) : '—'}</td>
                  <td className="right mono pos" title={c.teRetro > 0 ? `Incluye ${fmt(c.teRetro)} de HE retro (${c.teRetroHrs}h)` : undefined}>{c.retroactivoTotal > 0 ? fmt(c.retroactivoTotal) : '—'}</td>
                  <td className="right mono">{c.infonavit > 0 ? '-' + fmt(c.infonavit) : '—'}</td>
                  <td className="right mono">{c.comedor > 0 ? '-' + fmt(c.comedor) : '—'}</td>
                  <td className="right mono">{c.retardoMonto > 0 ? '-' + fmt(c.retardoMonto) : '—'}</td>
                  <td className="right mono">{descPrestamo > 0 ? '-' + fmt(descPrestamo) : '—'}</td>
                  <td className="right mono">{c.descuentoProducto > 0 ? '-' + fmt(c.descuentoProducto) : '—'}</td>
                  <td className="right mono fw-700">{fmt(c.neto)}</td>
                  <td className="right mono orange">{fmt(c.depositoBanco)}</td>
                  <td className="right mono orange">{fmt(c.valesPago)}</td>
                  <td className="right mono blue">{fmt(c.efectivo)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--ink-50)', fontWeight: 700 }}>
              <td colSpan={2}>Totales</td><td colSpan={9}></td>
              <td className="right mono">{fmt(t.neto)}</td><td className="right mono orange">{fmt(t.depBanco)}</td><td className="right mono orange">{fmt(t.vales)}</td><td className="right mono blue">{fmt(t.efectivo)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {detalle && <ReciboModal d={detalle} onClose={() => setDetalleId(null)} />}
    </div>
  );
}
