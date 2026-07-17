import * as XLSX from 'xlsx';
import { fmt, fmtPeriodo, fmtFecha, nomexLabel } from '@/lib/nomina/format';
import { supabase, dbNomina } from '@/lib/nomina/db';
import { getEmpresa } from '@/lib/nomina/empresas';

// Genera y descarga un .xlsx a partir de una matriz [filas][columnas].
export function descargarXLSX(aoa: (string | number)[][], sheetName: string, filename: string) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

// Formatos de impresión / exportación de la nómina.
export type TipoImpresion = 'incidencias' | 'viajeshe' | 'dispersion' | 'fiscal';

const EMPRESA = 'Productos Marinos Lizárraga'; // fallback si la nómina no trae empresa

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
const byBanco = (a: any, b: any) => (a.empleado.id_banco ?? 9e9) - (b.empleado.id_banco ?? 9e9);
const m = (n: number) => esc(fmt(n));

// Colores por código de incidencia (impresión).
const COD_BG: Record<string, string> = { A: '#9FDB86', F: '#F58A8A', D: '#F4CE6B', V: '#86BCEC', PSG: '#F2A94E', PCG: '#B79AEC', TXT: '#74D4B4', SUS: '#EE82AE', INC: '#5FC9DC' };

const CSS = (landscape: boolean) => `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, system-ui, 'Segoe UI', Roboto, Arial, sans-serif; color: #0A2540; margin: 0; padding: 18px 22px; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0A2540; padding-bottom: 8px; margin-bottom: 14px; }
  .head h1 { font-size: 16px; margin: 0; }
  .head .sub { font-size: 12px; color: #5b6b7d; margin-top: 2px; }
  .head .meta { text-align: right; font-size: 10.5px; color: #5b6b7d; }
  h2 { font-size: 12px; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 6px; }
  th { background: #0A2540; color: #fff; text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.03em; padding: 5px 6px; font-weight: 600; }
  td { padding: 4px 6px; border-bottom: 1px solid #e7ebf0; }
  th.c, td.c { text-align: center; }
  th.r, td.r { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:nth-child(even) td { background: #f7f9fb; }
  tfoot td { font-weight: 700; border-top: 2px solid #0A2540; background: #eef2f6 !important; }
  .mono { font-variant-numeric: tabular-nums; }
  .muted { color: #8a97a6; }
  .neg { color: #c0392b; }
  .cols { display: flex; gap: 18px; align-items: flex-start; }
  .firma { margin-top: 34px; display: flex; gap: 50px; }
  .firma div { flex: 1; border-top: 1px solid #0A2540; padding-top: 5px; font-size: 10.5px; text-align: center; color: #5b6b7d; }
  @media print { @page { size: letter ${landscape ? 'landscape' : 'portrait'}; margin: 9mm; } }
`;

function abrirVentana(): Window | null {
  const w = window.open('', '_blank', 'width=1150,height=780');
  if (!w) { alert('Permite las ventanas emergentes para imprimir.'); return null; }
  w.document.open();
  w.document.write('<!doctype html><title>Generando…</title><body style="font-family:sans-serif;padding:40px;color:#0A2540">Generando documento…</body>');
  w.document.close();
  return w;
}

function render(w: Window, opts: { titulo: string; periodo: string; tipoSemana: string; body: string; landscape: boolean; firmas?: boolean; empresa?: string }) {
  const generado = new Date().toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const doc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(opts.titulo)} · ${esc(opts.periodo)}</title><style>${CSS(opts.landscape)}</style></head>
  <body>
    <div class="head">
      <div><h1>${esc(opts.empresa || EMPRESA)}</h1><div class="sub">${esc(opts.titulo)} · Semana del ${esc(opts.periodo)}</div></div>
      <div class="meta">${esc(opts.tipoSemana)}<br>Generado: ${esc(generado)}</div>
    </div>
    ${opts.body}
    ${opts.firmas ? '<div class="firma"><div>Elaboró</div><div>Revisó</div><div>Autorizó</div></div>' : ''}
    <script>window.onload=function(){window.focus();window.print();}<\/script>
  </body></html>`;
  w.document.open(); w.document.write(doc); w.document.close();
}

function diasSemana(semana: any): Date[] {
  const out: Date[] = [];
  const ini = new Date(semana.fecha_inicio + 'T12:00:00');
  const fin = new Date(semana.fecha_fin + 'T12:00:00');
  for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) out.push(new Date(d));
  return out;
}
const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// ───────────────────────── INCIDENCIAS ─────────────────────────
function bodyIncidencias(calcData: any[], semana: any): string {
  const data = [...calcData].sort(byBanco);
  const days = diasSemana(semana);
  const top = `<tr><th rowspan="2" style="min-width:180px">Nombre</th>${days.map((d) => `<th colspan="3" class="c">${DOW[d.getDay()].slice(0, 3)} ${d.getDate()} ${MES3[d.getMonth()]}</th>`).join('')}</tr>`;
  const sub = `<tr>${days.map(() => '<th class="c">Asist</th><th class="c">R</th><th class="c">T.E</th>').join('')}</tr>`;
  const filas = data.map((d) => {
    const porDia: Record<number, any> = {};
    (d.asistencias || []).forEach((a: any) => (porDia[a.dia_index] = a));
    const celdas = days.map((_, i) => {
      const a = porDia[i] || {};
      const cod = a.codigo || '';
      const bg = COD_BG[cod] || '';
      const ret = (parseFloat(a.retardo_min) || 0) || '';
      const te = (parseFloat(a.te_horas) || 0) || '';
      return `<td class="c" style="${bg ? `background:${bg};font-weight:700` : ''}">${esc(cod)}</td><td class="c">${esc(ret)}</td><td class="c">${esc(te)}</td>`;
    }).join('');
    return `<tr><td>${esc(d.empleado.nombre)}</td>${celdas}</tr>`;
  });
  return `<table>${top}${sub}<tbody>${filas.join('')}</tbody></table>`;
}

// ───────────────────────── VIAJES + HORAS EXTRA ─────────────────────────
async function bodyViajesHE(calcData: any[], semana: any): Promise<string> {
  const empNombre: Record<string, string> = {};
  calcData.forEach((d) => (empNombre[d.empleado.id] = d.empleado.nombre));

  const [{ data: viajes }, { data: retro }] = await Promise.all([
    dbNomina.from('viajes').select('*, chofer:chofer_id(nombre), acomp:acompanante_id(nombre)').eq('semana_id', semana.id).order('fecha'),
    dbNomina.from('nomina_retroactivo').select('empleado_id,horas,descripcion,periodo_origen,tipo').eq('semana_id', semana.id),
  ]);
  const vs = viajes || [];

  // 1) Tabla de viajes
  const filasViajes = vs.map((v: any) => `<tr>
    <td>${esc(fmtFecha(v.fecha))}</td><td>${esc(v.destino || '—')}</td><td>${esc(v.cliente || '—')}</td>
    <td>${esc(v.vehiculo || '—')}</td><td>${esc(v.chofer?.nombre || '—')}</td><td>${esc(v.acomp?.nombre || '—')}</td>
    <td class="c mono">${esc(v.hora_salida || '—')}</td><td class="c mono">${esc(v.hora_llegada || '—')}${v.se_quedo_dormir ? ' 🌙' : ''}</td></tr>`);
  const tablaViajes = `<table>
    <thead><tr><th>Fecha</th><th>Destino</th><th>Cliente</th><th>Vehículo</th><th>Chofer</th><th>Acompañante</th><th class="c">Salida</th><th class="c">Llegada</th></tr></thead>
    <tbody>${filasViajes.join('') || '<tr><td colspan="8" class="muted c">Sin viajes</td></tr>'}</tbody></table>`;

  // 2) Horas extra (normales + retroactivas)
  type HE = { nombre: string; fecha: string; motivo: string; horas: number; retro?: boolean };
  const he: HE[] = [];
  calcData.forEach((d) => (d.asistencias || []).forEach((a: any) => {
    const h = parseFloat(a.te_horas) || 0;
    if (h > 0) he.push({ nombre: d.empleado.nombre, fecha: a.fecha, motivo: a.te_motivo || '—', horas: h });
  }));
  (retro || []).forEach((r: any) => {
    const h = parseFloat(r.horas) || 0;
    if (h > 0) he.push({ nombre: empNombre[r.empleado_id] || '—', fecha: r.periodo_origen || '', motivo: (r.descripcion || '—') + ' (retro)', horas: h, retro: true });
  });
  he.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || a.nombre.localeCompare(b.nombre));
  const totHE = he.reduce((s, x) => s + x.horas, 0);
  const filasHE = he.map((x) => `<tr><td>${esc(x.nombre)}</td><td>${esc(x.fecha ? fmtFecha(x.fecha) : '—')}</td><td>${esc(x.motivo)}</td><td class="r mono">${esc(x.horas)}</td></tr>`);
  const tablaHE = `<table>
    <thead><tr><th>Nombre</th><th>Fecha</th><th>Motivo</th><th class="r">Horas</th></tr></thead>
    <tbody>${filasHE.join('') || '<tr><td colspan="4" class="muted c">Sin horas extra</td></tr>'}</tbody>
    <tfoot><tr><td colspan="3">Total horas</td><td class="r mono">${esc(totHE % 1 === 0 ? totHE : totHE.toFixed(2))}</td></tr></tfoot></table>`;

  // 3) Resumen chofer / acompañante
  const chof: Record<string, { nombre: string; viajes: number; dinero: number }> = {};
  const acmp: Record<string, { nombre: string; viajes: number; dinero: number }> = {};
  vs.forEach((v: any) => {
    if (v.chofer_id) { (chof[v.chofer_id] ||= { nombre: v.chofer?.nombre || '—', viajes: 0, dinero: 0 }); chof[v.chofer_id].viajes++; chof[v.chofer_id].dinero += v.incent_chofer || 0; }
    if (v.acompanante_id) { (acmp[v.acompanante_id] ||= { nombre: v.acomp?.nombre || '—', viajes: 0, dinero: 0 }); acmp[v.acompanante_id].viajes++; acmp[v.acompanante_id].dinero += v.incent_acompanante || 0; }
  });
  const tablaRol = (titulo: string, obj: Record<string, any>) => {
    const arr = Object.values(obj).sort((a: any, b: any) => b.dinero - a.dinero);
    const tot = arr.reduce((s: number, x: any) => s + x.dinero, 0);
    return `<h2>${titulo}</h2><table>
      <thead><tr><th>Nombre</th><th class="r">Viajes</th><th class="r">Dinero</th></tr></thead>
      <tbody>${arr.map((x: any) => `<tr><td>${esc(x.nombre)}</td><td class="r mono">${esc(x.viajes)}</td><td class="r mono">${m(x.dinero)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted c">—</td></tr>'}</tbody>
      <tfoot><tr><td>Total</td><td class="r mono">${arr.reduce((s: number, x: any) => s + x.viajes, 0)}</td><td class="r mono">${m(tot)}</td></tr></tfoot></table>`;
  };

  // 4) Cruce: quién tuvo VIAJE y HORAS EXTRA el mismo día (para mapearlo).
  const heDia: Record<string, { horas: number; motivo: string }> = {}; // `${empId}|${fecha}` -> HE
  calcData.forEach((d) => (d.asistencias || []).forEach((a: any) => {
    const h = parseFloat(a.te_horas) || 0;
    if (h > 0 && a.fecha) heDia[`${d.empleado.id}|${a.fecha}`] = { horas: h, motivo: a.te_motivo || '—' };
  }));
  const cruces: { nombre: string; fecha: string; rol: string; destino: string; llegada: string; horas: number; motivo: string }[] = [];
  const vistos = new Set<string>();
  vs.forEach((v: any) => {
    ([['Chofer', v.chofer_id, v.chofer?.nombre], ['Acompañante', v.acompanante_id, v.acomp?.nombre]] as [string, string, string][]).forEach(([rol, id, nom]) => {
      if (!id || !v.fecha) return;
      const k = `${id}|${v.fecha}`;
      const he = heDia[k];
      if (!he) return;
      const dk = `${k}|${v.id}|${rol}`;
      if (vistos.has(dk)) return; vistos.add(dk);
      cruces.push({ nombre: nom || empNombre[id] || '—', fecha: v.fecha, rol, destino: v.destino || '—', llegada: v.hora_llegada || '—', horas: he.horas, motivo: he.motivo });
    });
  });
  cruces.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || a.nombre.localeCompare(b.nombre));
  const tablaCruce = cruces.length
    ? `<table>
        <thead><tr><th>Nombre</th><th>Fecha</th><th>Rol</th><th>Viaje (destino · llegada)</th><th class="r">Horas extra</th><th>Motivo HE</th></tr></thead>
        <tbody>${cruces.map((o) => `<tr><td>${esc(o.nombre)}</td><td>${esc(fmtFecha(o.fecha))}</td><td>${esc(o.rol)}</td><td>${esc(o.destino)} · ${esc(o.llegada)}</td><td class="r mono">${esc(o.horas)}</td><td>${esc(o.motivo)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="muted" style="font-size:10.5px;margin:2px 0 0">Nadie tuvo viaje y horas extra el mismo día.</p>';

  return `<h2>Viajes de la semana</h2>${tablaViajes}
    <h2>⚠ Mismo día con viaje y horas extra</h2>${tablaCruce}
    <div class="cols">
      <div style="flex:1.6"><h2>Horas extra</h2>${tablaHE}</div>
      <div style="flex:1">${tablaRol('Chofer', chof)}${tablaRol('Acompañante', acmp)}</div>
    </div>`;
}

// ───────────────────────── DISPERSIÓN ─────────────────────────
function bodyDispersion(calcData: any[], semana: any): string {
  void semana;
  const data = [...calcData].sort(byBanco);
  const fila = (d: any) => {
    const c = d.calc;
    const sueldo = c.asistMonto + c.septimo;
    // Dep. Banco = banco + toka (vales) = depósito fiscal/corregido.
    const vals = [sueldo, c.prestDesc, c.comedor, c.descuentoProducto, c.infonavit, c.retardoMonto, c.bono, c.retroactivoTotal, (c.te || 0), (c.incentivos || 0), c.neto, c.depositoCorregido, c.efectivo];
    const ded = new Set([1, 2, 3, 4, 5]); // índices de deducciones (rojo)
    return `<tr><td class="c mono">${esc(d.empleado.id_banco ?? '—')}</td><td>${esc(d.empleado.nombre)}</td>${vals.map((v, i) => `<td class="r mono ${ded.has(i) && v > 0 ? 'neg' : ''}">${v ? m(v) : '—'}</td>`).join('')}</tr>`;
  };
  const tot = data.reduce((a: any, d: any) => {
    const c = d.calc; a.sueldo += c.asistMonto + c.septimo; a.prest += c.prestDesc; a.com += c.comedor; a.dp += c.descuentoProducto; a.inf += c.infonavit; a.fr += c.retardoMonto; a.bono += c.bono; a.retro += c.retroactivoTotal; a.he += (c.te || 0); a.viajes += (c.incentivos || 0); a.neto += c.neto; a.banco += c.depositoCorregido; a.efvo += c.efectivo; return a;
  }, { sueldo: 0, prest: 0, com: 0, dp: 0, inf: 0, fr: 0, bono: 0, retro: 0, he: 0, viajes: 0, neto: 0, banco: 0, efvo: 0 });
  const totVals = [tot.sueldo, tot.prest, tot.com, tot.dp, tot.inf, tot.fr, tot.bono, tot.retro, tot.he, tot.viajes, tot.neto, tot.banco, tot.efvo];
  const heads = ['Sueldo', 'Préstamo', 'Comedor', 'Desc. Prod.', 'Infonavit', 'Falta/Ret.', 'Bono', 'Retro.', 'Horas Extra', 'Viajes', 'Neto', 'Dep. Banco', 'Efectivo'];
  return `<table>
    <thead><tr><th class="c">ID Banco</th><th>Empleado</th>${heads.map((h) => `<th class="r">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${data.map(fila).join('')}</tbody>
    <tfoot><tr><td colspan="2">Totales (${data.length})</td>${totVals.map((v) => `<td class="r mono">${m(v)}</td>`).join('')}</tr></tfoot>
  </table>
  <p class="muted" style="font-size:10px;margin-top:8px">Sueldo = asistencia + séptimo · Horas Extra y Viajes (incentivos) van separados · Falta/Ret. = descuento por retardos (las faltas ya están reflejadas en el sueldo) · <strong>Dep. Banco = depósito a banco + toka (vales)</strong>, igual al depósito fiscal/corregido.</p>`;
}

// ───────────────────────── REPORTE FISCAL ─────────────────────────
// ID NOMEX · Nombre · Vales · Dep. Banco (solo banco) · Asistencia y Séptimo día EN DÍAS (número) ·
// Infonavit · Comedor · Retardos · Préstamo · Desc. Producto (en dinero).
function bodyFiscal(calcData: any[], semana: any): string {
  void semana;
  const data = [...calcData].sort((a, b) => (a.empleado.id_nomex ?? 9e9) - (b.empleado.id_nomex ?? 9e9));
  // Número de días (entero si es redondo, si no 2 decimales). 0 → "—".
  const nd = (n: number) => { const r = Math.round(n * 100) / 100; return r === 0 ? '—' : (Number.isInteger(r) ? String(r) : r.toFixed(2)); };
  // días de séptimo = monto / sueldo diario base (real o fiscal según el switch de Marlin).
  const septDias = (c: any) => { const base = c.dBase ?? c.dDR; return base > 0 ? c.septimo / base : 0; };
  const fila = (d: any) => {
    const e = d.empleado, c = d.calc;
    return `<tr>
      <td class="mono">${esc(nomexLabel(e))}</td>
      <td>${esc(e.nombre)}</td>
      <td class="r mono">${c.valesPago ? m(c.valesPago) : '—'}</td>
      <td class="r mono">${c.depositoBanco ? m(c.depositoBanco) : '—'}</td>
      <td class="r mono">${nd(c.diasA || 0)}</td>
      <td class="r mono">${nd(septDias(c))}</td>
      <td class="r mono">${c.infonavit ? m(c.infonavit) : '—'}</td>
      <td class="r mono">${c.comedor ? m(c.comedor) : '—'}</td>
      <td class="r mono">${c.retardoMonto ? m(c.retardoMonto) : '—'}</td>
      <td class="r mono">${c.prestDesc ? m(c.prestDesc) : '—'}</td>
      <td class="r mono">${c.descuentoProducto ? m(c.descuentoProducto) : '—'}</td>
    </tr>`;
  };
  const tot = data.reduce((a: any, d: any) => {
    const c = d.calc;
    a.vales += c.valesPago || 0; a.banco += c.depositoBanco || 0;
    a.asis += c.diasA || 0; a.sept += septDias(c);
    a.inf += c.infonavit || 0; a.com += c.comedor || 0; a.ret += c.retardoMonto || 0; a.prest += c.prestDesc || 0; a.dp += c.descuentoProducto || 0;
    return a;
  }, { vales: 0, banco: 0, asis: 0, sept: 0, inf: 0, com: 0, ret: 0, prest: 0, dp: 0 });
  return `<table>
    <thead><tr><th>ID NOMEX</th><th>Nombre</th><th class="r">Vales</th><th class="r">Dep. Banco</th><th class="r">Asistencia</th><th class="r">Séptimo día</th><th class="r">Infonavit</th><th class="r">Comedor</th><th class="r">Retardos</th><th class="r">Préstamo</th><th class="r">Desc. Producto</th></tr></thead>
    <tbody>${data.map(fila).join('')}</tbody>
    <tfoot><tr><td colspan="2">Totales (${data.length})</td><td class="r mono">${m(tot.vales)}</td><td class="r mono">${m(tot.banco)}</td><td class="r mono">${nd(tot.asis)}</td><td class="r mono">${nd(tot.sept)}</td><td class="r mono">${m(tot.inf)}</td><td class="r mono">${m(tot.com)}</td><td class="r mono">${m(tot.ret)}</td><td class="r mono">${m(tot.prest)}</td><td class="r mono">${m(tot.dp)}</td></tr></tfoot>
  </table>
  <p class="muted" style="font-size:10px;margin-top:8px"><strong>Asistencia y Séptimo día van en número de días</strong> (no en dinero): semana completa = 6 y 1. Dep. Banco = solo banco (los vales/toka van en su columna).</p>`;
}

// ───────────────────────── orquestador de impresión ─────────────────────────
export async function imprimirNomina(tipo: TipoImpresion, calcData: any[], semana: any) {
  const w = abrirVentana();
  if (!w) return;
  const periodo = semana ? fmtPeriodo(semana.fecha_inicio, semana.fecha_fin) : '';
  const tipoSemana = semana?.tipo || '';
  const empresa = getEmpresa(semana?.empresa).nombre;
  try {
    if (tipo === 'incidencias') {
      render(w, { titulo: 'Incidencias', periodo, tipoSemana, empresa, body: bodyIncidencias(calcData, semana), landscape: true });
    } else if (tipo === 'viajeshe') {
      const body = await bodyViajesHE(calcData, semana);
      render(w, { titulo: 'Viajes y horas extra', periodo, tipoSemana, empresa, body, landscape: false });
    } else if (tipo === 'dispersion') {
      render(w, { titulo: 'Dispersión de nómina', periodo, tipoSemana, empresa, body: bodyDispersion(calcData, semana), landscape: true, firmas: true });
    } else if (tipo === 'fiscal') {
      render(w, { titulo: 'Reporte fiscal', periodo, tipoSemana, empresa, body: bodyFiscal(calcData, semana), landscape: true, firmas: true });
    }
  } catch (e) {
    w.document.open(); w.document.write('<body style="font-family:sans-serif;padding:40px">Error al generar el documento. Revisa la consola.</body>'); w.document.close();
    console.error(e);
  }
}

// ───────────────────────── EXPORT VALES (.xlsx) ─────────────────────────
export function exportarValesXLSX(calcData: any[], semana: any) {
  const vales = getEmpresa(semana?.empresa).vales;
  if (!vales) { alert('Esta empresa aún no tiene configurada su cuenta de vales.'); return; }
  const data = [...calcData].sort(byBanco).filter((d) => (d.calc.valesPago || 0) > 0.005);
  const sinToka = data.filter((d) => d.empleado.id_toka == null || d.empleado.id_toka === '');
  const buenos = data.filter((d) => !(d.empleado.id_toka == null || d.empleado.id_toka === ''));

  if (!buenos.length) { alert('No hay empleados con vales (y con ID Toka) en esta nómina.'); return; }

  const aoa: (string | number)[][] = [['ID', 'NOMINA', 'MONTO', 'PRODUCTO']];
  buenos.forEach((d) => {
    const monto = Math.round((d.calc.valesPago || 0) * 100) / 100;
    aoa.push([Number(vales.idCuenta), d.empleado.id_toka, monto, vales.producto]);
  });
  const periodo = semana ? `${semana.fecha_inicio}_a_${semana.fecha_fin}` : 'nomina';
  descargarXLSX(aoa, 'Vales', `vales_easyvale_${periodo}.xlsx`);

  if (sinToka.length) {
    alert(`Se exportaron ${buenos.length} empleados con vales.\n\n${sinToka.length} con vales NO se incluyeron por no tener ID Toka:\n` + sinToka.map((d) => `· ${d.empleado.nombre}`).join('\n'));
  }
}

// ───────────────────────── EXPORT DEPÓSITO A BANCO (.xlsx) ─────────────────────────
// Tres columnas: ID Banco, Nombre y monto de depósito a banco. Solo quienes depositan (> 0).
export function exportarDispersionBancoXLSX(calcData: any[], semana: any) {
  const data = [...calcData].sort(byBanco).filter((d) => (d.calc.depositoBanco || 0) > 0.005);
  const sinBanco = data.filter((d) => d.empleado.id_banco == null || d.empleado.id_banco === '');

  if (!data.length) { alert('No hay empleados con depósito a banco en esta nómina.'); return; }

  const aoa: (string | number)[][] = [['ID BANCO', 'NOMBRE', 'DEPOSITO']];
  data.forEach((d) => {
    const monto = Math.round((d.calc.depositoBanco || 0) * 100) / 100;
    aoa.push([d.empleado.id_banco ?? '', d.empleado.nombre || '', monto]);
  });
  const periodo = semana ? `${semana.fecha_inicio}_a_${semana.fecha_fin}` : 'nomina';
  descargarXLSX(aoa, 'Deposito banco', `deposito_banco_${periodo}.xlsx`);

  if (sinBanco.length) {
    alert(`Se exportaron ${data.length} empleados con depósito a banco.\n\n${sinBanco.length} tienen depósito pero NO tienen ID Banco (salen con ID vacío):\n` + sinBanco.map((d) => `· ${d.empleado.nombre}`).join('\n'));
  }
}

// ───────────────────────── EXPORT BANORTE (.pag) ─────────────────────────
// Archivo de dispersión de pago de nómina de Banorte (ancho fijo, 165 chars por línea).
// Header:  HNE + emisora(5) + fecha AAAAMMDD(8) + consecutivo(2) + nºregs(6) + importeTotal centavos(15)
//          + ceros(61) + cuenta de cargo(10) + ceros(55)
// Detalle: D + fecha(8) + nºempleado=ID Banco(10) + nombre en blanco(80) + importe centavos(15)
//          + banco receptor(3) + tipo cuenta(2) + cuenta(18) + '0' + ' ' + '00000000' + espacios(18)
// (La emisora y cuenta de cargo se toman de la config de la empresa de la nómina.)

export function exportarBanortePag(calcData: any[], semana: any) {
  const banorte = getEmpresa(semana?.empresa).banorte;
  if (!banorte) { alert('Esta empresa aún no tiene configurada su cuenta de cargo Banorte.'); return; }
  const z = (v: any, n: number) => String(v ?? '').replace(/\D/g, '').padStart(n, '0').slice(-n);
  const conDeposito = [...calcData].sort(byBanco).filter((d) => (d.calc.depositoBanco || 0) > 0.005);
  if (!conDeposito.length) { alert('No hay empleados con depósito a banco en esta nómina.'); return; }

  // Faltan datos bancarios → no se pueden dispersar (se excluyen y se avisa).
  const faltan = conDeposito.filter((d) => {
    const e = d.empleado;
    return e.id_banco == null || e.id_banco === '' || !e.banco_cuenta || !e.banco_receptor || !e.banco_tipo_cuenta;
  });
  const incluidos = conDeposito.filter((d) => !faltan.includes(d));
  if (!incluidos.length) { alert('Ningún empleado con depósito tiene la ficha del banco completa (cuenta, receptor, tipo).'); return; }

  // Parámetros del archivo.
  const hoy = new Date();
  const defFecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const fechaIn = window.prompt('Fecha de aplicación (AAAA-MM-DD):', defFecha);
  if (!fechaIn) return;
  const ymd = fechaIn.replace(/\D/g, '').slice(0, 8);
  if (!/^\d{8}$/.test(ymd)) { alert('Fecha inválida. Usa el formato AAAA-MM-DD.'); return; }
  const cons = z(window.prompt('Consecutivo del archivo (2 dígitos):', '01') || '01', 2);

  // Detalles.
  let totalCent = 0;
  const detalles = incluidos.map((d) => {
    const cent = Math.round((d.calc.depositoBanco || 0) * 100);
    totalCent += cent;
    const noEmp = z(d.empleado.id_banco, 10);
    const nombre = ' '.repeat(80);
    const imp = z(cent, 15);
    const receptor = z(d.empleado.banco_receptor, 3);
    const tipo = z(d.empleado.banco_tipo_cuenta, 2);
    const cuenta = z(d.empleado.banco_cuenta, 18);
    return `D${ymd}${noEmp}${nombre}${imp}${receptor}${tipo}${cuenta}0 00000000${' '.repeat(18)}`;
  });

  const header = `HNE${banorte.emisora}${ymd}${cons}${z(incluidos.length, 6)}${z(totalCent, 15)}${'0'.repeat(61)}${banorte.cuentaCargo}${'0'.repeat(55)}`;
  const contenido = [header, ...detalles].join('\r\n') + '\r\n';

  // Descarga como .pag (texto plano ASCII, sin BOM).
  const blob = new Blob([contenido], { type: 'text/plain;charset=us-ascii' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `NI${banorte.emisora}${cons}.pag`;
  a.click();
  URL.revokeObjectURL(url);

  const totalPesos = (totalCent / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 });
  let msg = `Archivo Banorte generado: ${incluidos.length} registros · importe total $${totalPesos}.`;
  if (faltan.length) {
    msg += `\n\n⚠ ${faltan.length} con depósito NO se incluyeron por ficha del banco incompleta:\n` + faltan.map((d) => `· ${d.empleado.nombre}`).join('\n');
  }
  alert(msg);
}
