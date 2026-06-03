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

export const diasDesde = (s: string | null | undefined, hoy = new Date()) => {
  if (!s) return null;
  const d = new Date(s + 'T12:00:00');
  return Math.ceil((d.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
};

export const STATUS_META: Record<string, { bg: string; text: string }> = {
  Contratado:   { bg: '#E6F4FF', text: '#1E40AF' },
  'En tránsito':{ bg: '#FEF3C7', text: '#92400E' },
  'En puerto':  { bg: '#EDE9FE', text: '#5B21B6' },
  Entregado:    { bg: '#D1FAE5', text: '#065F46' },
};
