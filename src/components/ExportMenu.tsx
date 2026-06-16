/**
 * Botón "Exportar Excel" con menú de opciones. Reutilizable.
 * Click-outside con mousedown + contains() (no se dispara al seleccionar texto).
 */
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export type ExportMenuItem = { label: string; hint?: string; onSelect: () => void };

export function ExportMenu({
  items,
  label = 'Exportar Excel',
}: {
  items: ExportMenuItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn btn-outline btn-sm" onClick={() => setOpen((o) => !o)}>
        <Icon name="download" size={13} /> {label}
        <Icon name="chevron-down" size={12} style={{ marginLeft: -2, opacity: 0.7 }} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 250,
            background: 'white',
            border: '1px solid var(--ink-200)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-50)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                border: 'none',
                background: 'white',
                cursor: 'pointer',
                borderBottom: i < items.length - 1 ? '1px solid var(--ink-100)' : 'none',
              }}
            >
              <div className="text-sm fw-600" style={{ color: 'var(--ink-900)' }}>
                {it.label}
              </div>
              {it.hint && (
                <div className="text-xs muted" style={{ marginTop: 2 }}>
                  {it.hint}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
