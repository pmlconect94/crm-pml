export const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

export function fmt(n?: number | null): string {
  return '$' + (Math.round((n || 0) * 100) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtFecha(str?: string | null): string {
  if (!str) return '—';
  const d = new Date(str + 'T12:00:00');
  if (isNaN(d.getTime())) return str;
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

export function fmtFechaLarga(str?: string | null): string {
  if (!str) return '';
  const d = new Date(str + 'T12:00:00');
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtFechaHora(str?: string | null): string {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtPeriodo(ini?: string | null, fin?: string | null): string {
  if (!ini || !fin) return '';
  const di = new Date(ini + 'T12:00:00');
  const df = new Date(fin + 'T12:00:00');
  if (di.getMonth() === df.getMonth())
    return `${di.getDate()} – ${df.getDate()} ${MESES[df.getMonth()]} ${df.getFullYear()}`;
  return `${di.getDate()} ${MESES[di.getMonth()]} – ${df.getDate()} ${MESES[df.getMonth()]} ${df.getFullYear()}`;
}

export function toISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function calcEdad(fechaNac?: string | null): number | null {
  if (!fechaNac) return null;
  const n = new Date(fechaNac + 'T12:00:00');
  if (isNaN(n.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - n.getFullYear();
  const m = hoy.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) edad--;
  return edad;
}

// NOMEX con prefijo según esquema: Quincenal → Q-0000, Semanal → S-0000.
export function nomexLabel(empleado: { id_nomex?: number | null; esquema_pago?: string | null }): string {
  if (empleado?.id_nomex == null || empleado.id_nomex === ('' as any)) return '—';
  const pref = empleado.esquema_pago === 'Quincenal' ? 'Q' : 'S';
  return `${pref}-${String(empleado.id_nomex).padStart(4, '0')}`;
}

export function iniciales(nombre?: string | null): string {
  if (!nombre) return '?';
  return nombre.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
