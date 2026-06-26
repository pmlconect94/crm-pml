/** Estado de una compra MX: Pendiente · Parcial · Liquidada. */
const STATUS_META: Record<string, { bg: string; text: string; dot: string }> = {
  Pendiente: { bg: 'var(--ink-100)', text: 'var(--ink-600)', dot: 'var(--ink-400)' },
  Parcial: { bg: 'color-mix(in srgb, var(--blue-500) 12%, white)', text: '#1E40AF', dot: 'var(--blue-500)' },
  Liquidada: { bg: 'color-mix(in srgb, var(--green-500) 14%, white)', text: '#065F46', dot: 'var(--green-500)' },
};

export function CompraMXStatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.Pendiente;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 999,
        background: m.bg,
        color: m.text,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: m.dot }} />
      {status}
    </span>
  );
}
