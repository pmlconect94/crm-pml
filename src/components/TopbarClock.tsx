/**
 * Reloj de la barra superior. Actualiza cada 30s para no gastar render.
 * Formato: "jue 29 may · 14:32"
 */
import { useEffect, useState } from 'react';

function formatDate(d: Date) {
  const dateStr = d.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  const timeStr = d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return { dateStr, timeStr };
}

export function TopbarClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Alinear el primer tick al inicio del próximo minuto, luego cada 30s
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const { dateStr, timeStr } = formatDate(now);

  return (
    <div
      className="hstack topbar-clock"
      style={{
        gap: 8,
        padding: '6px 10px',
        background: 'var(--ink-50)',
        border: '1px solid var(--ink-200)',
        borderRadius: 'var(--r-md)',
        fontSize: 11,
      }}
      title={now.toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'medium' })}
    >
      <span style={{ color: 'var(--ink-600)', fontWeight: 500, textTransform: 'capitalize' }}>
        {dateStr}
      </span>
      <span
        style={{
          width: 3,
          height: 3,
          borderRadius: 999,
          background: 'var(--ink-300)',
          display: 'inline-block',
        }}
      />
      <span
        className="mono fw-600"
        style={{ color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}
      >
        {timeStr}
      </span>
    </div>
  );
}
