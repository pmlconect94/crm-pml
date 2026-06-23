import { Icon } from './Icon';
import { TopbarClock } from './TopbarClock';
import { useAuth } from '@/lib/auth';

export function Topbar() {
  const { empresaId } = useAuth();

  return (
    <div className="topbar">
      <div className="hstack" style={{ gap: 8, fontSize: 12 }}>
        <span
          className="dot"
          style={{ background: empresaId === 'pml' ? 'var(--blue-500)' : 'var(--cyan-500)' }}
        />
        <span className="fw-600" style={{ color: 'var(--ink-700)' }}>
          {empresaId === 'pml' ? 'Productos Marinos Lizárraga' : 'Marlin Lizárraga'}
        </span>
      </div>

      <div className="hstack" style={{ gap: 4 }}>
        <TopbarClock />
        <button className="btn btn-ghost btn-sm" title="Notificaciones">
          <Icon name="bell" size={14} />
        </button>
        <button className="btn btn-ghost btn-sm" title="Configuración">
          <Icon name="settings" size={14} />
        </button>
      </div>
    </div>
  );
}
