import { Fragment, type ReactNode, type CSSProperties } from 'react';

export type StatItem = {
  /** Número o texto destacado (mono, en negrita). */
  value: ReactNode;
  /** Descripción corta a la derecha del valor. Opcional. */
  label?: string;
  /** Color del valor (por defecto --ink-900). */
  color?: string;
};

/**
 * Tira de estadísticas compacta — una sola línea con valores separados por
 * puntos. Reemplaza los KPI cards grandes (grid grid-4) que ocupaban mucho
 * espacio vertical y tapaban las tablas. Patrón establecido en la lista de
 * Contratos (feedback 2026-06-18): el usuario opera 8h/día sobre tablas y los
 * KPIs son orientativos, no protagonistas.
 */
export function StatStrip({ stats, style }: { stats: StatItem[]; style?: CSSProperties }) {
  return (
    <div
      className="hstack"
      style={{
        gap: 14,
        marginBottom: 10,
        flexWrap: 'wrap',
        fontSize: 12,
        color: 'var(--ink-500)',
        ...style,
      }}
    >
      {stats.map((s, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span style={{ color: 'var(--ink-300)' }} aria-hidden>
              ·
            </span>
          )}
          <span>
            <strong className="mono" style={{ color: s.color ?? 'var(--ink-900)', fontSize: 13 }}>
              {s.value}
            </strong>
            {s.label ? <> {s.label}</> : null}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
