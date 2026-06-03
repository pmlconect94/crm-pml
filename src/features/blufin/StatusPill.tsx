import { STATUS_META } from '@/lib/format';

const COLOR: Record<string, string> = {
  Contratado: 'var(--blue-500)',
  'En tránsito': 'var(--amber-500)',
  'En puerto': '#8B5CF6',
  Entregado: 'var(--green-500)',
};

export function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { bg: 'var(--ink-100)', text: 'var(--ink-700)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 9px',
        borderRadius: 999,
        background: m.bg,
        color: m.text,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: COLOR[status] ?? 'var(--ink-500)',
        }}
      />
      {status}
    </span>
  );
}
