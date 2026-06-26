// Pill de status para contenedores Camanchaca SA. Los labels difieren de Blufin
// (Planeado / En tránsito / En Manzanillo / Entregado), así que tiene su propio
// mapa de colores; mismo lenguaje visual que StatusPill de Blufin.
const META: Record<string, { bg: string; text: string; dot: string }> = {
  Planeado: { bg: '#E6F4FF', text: '#1E40AF', dot: 'var(--blue-500)' },
  'En tránsito': { bg: '#FEF3C7', text: '#92400E', dot: 'var(--amber-500)' },
  'En Manzanillo': { bg: '#EDE9FE', text: '#5B21B6', dot: '#8B5CF6' },
  Entregado: { bg: '#D1FAE5', text: '#065F46', dot: 'var(--green-500)' },
};

export function CamSAStatusPill({ status }: { status: string }) {
  const m = META[status] ?? { bg: 'var(--ink-100)', text: 'var(--ink-700)', dot: 'var(--ink-500)' };
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
      <span style={{ width: 6, height: 6, borderRadius: 999, background: m.dot }} />
      {status}
    </span>
  );
}
