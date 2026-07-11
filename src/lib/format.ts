export const fmtUSD = (n: number | null | undefined) =>
  n == null
    ? '—'
    : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtMXN = (n: number | null | undefined) =>
  n == null
    ? '—'
    : '$' +
      Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      ' MXN';

export const fmtKg = (n: number | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('es-MX', { maximumFractionDigits: 3 }) + ' kg';

export const fmtNum = (n: number | null | undefined, decimals = 2) =>
  n == null
    ? '—'
    : Number(n).toLocaleString('es-MX', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

export const fmtFecha = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtFechaCorta = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
};

// fmtFecha/fmtFechaCorta arriba asumen fechas *sin hora* ('YYYY-MM-DD') y anclan a
// mediodía para esquivar el corrimiento de día por timezone. Un timestamptz (ej.
// `fecha_emision`/`fecha_timbrado` de Contabilidad) ya trae hora+offset real, así que
// aplicarle el mismo truco lo rompería (el string ya no matchea 'YYYY-MM-DDT12:00:00').
// Estas dos parsean el timestamp tal cual.
export const fmtFechaTS = (s: string | null | undefined) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtFechaHoraTS = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(s);
  return (
    d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  );
};

export const diasDesde = (s: string | null | undefined, hoy = new Date()) => {
  if (!s) return null;
  const d = new Date(s + 'T12:00:00');
  return Math.ceil((d.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Formatea un monto según la moneda del propio renglón — a diferencia de los módulos
 * de importación (100% USD o 100% MXN), Contabilidad trae MXN/USD/EUR/XXX mezclados
 * por factura. 'XXX' es el código ISO 4217 de "sin efecto monetario" que el SAT usa en
 * comprobantes de tipo Pago/Traslado; ese y cualquier moneda no contemplada (EUR, etc.)
 * se muestran como número + código, sin asumir un símbolo que no les corresponde.
 */
export const fmtPorMoneda = (n: number | null | undefined, moneda: string | null | undefined) => {
  if (n == null) return '—';
  if (moneda === 'USD') return fmtUSD(n);
  if (moneda === 'MXN') return fmtMXN(n);
  return fmtNum(n) + (moneda ? ' ' + moneda : '');
};

export const STATUS_META: Record<string, { bg: string; text: string }> = {
  Contratado:   { bg: '#E6F4FF', text: '#1E40AF' },
  'En tránsito':{ bg: '#FEF3C7', text: '#92400E' },
  'En puerto':  { bg: '#EDE9FE', text: '#5B21B6' },
  Entregado:    { bg: '#D1FAE5', text: '#065F46' },
};
