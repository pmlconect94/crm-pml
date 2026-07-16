import { useState } from 'react';
import { Icon } from './Icon';
import { TopbarClock } from './TopbarClock';
import { UsuariosModal } from './UsuariosModal';
import { useAuth } from '@/lib/auth';

const ADMIN_EMAIL = 'ddl.pml2@gmail.com';

export function Topbar({ onToggleMenu }: { onToggleMenu?: () => void }) {
  const { empresaId, user } = useAuth();
  const [usuariosOpen, setUsuariosOpen] = useState(false);
  const esAdmin = (user?.email ?? '').toLowerCase() === ADMIN_EMAIL;

  return (
    <div className="topbar">
      <div className="hstack" style={{ gap: 8, fontSize: 12 }}>
        <button
          className="btn btn-ghost btn-sm topbar-menu-btn"
          onClick={onToggleMenu}
          aria-label="Abrir menú"
          style={{ padding: 6 }}
        >
          <Icon name="menu" size={18} />
        </button>
        <span className="topbar-empresa hstack" style={{ gap: 8 }}>
          <span
            className="dot"
            style={{ background: empresaId === 'pml' ? 'var(--blue-500)' : 'var(--marlin-gold)' }}
          />
          <span className="fw-600" style={{ color: 'var(--ink-700)' }}>
            {empresaId === 'pml' ? 'Productos Marinos Lizárraga' : 'Marlin Lizárraga'}
          </span>
        </span>
      </div>

      <div className="hstack" style={{ gap: 4 }}>
        <TopbarClock />
        <button className="btn btn-ghost btn-sm" title="Notificaciones">
          <Icon name="bell" size={14} />
        </button>
        {esAdmin && (
          <button
            className="btn btn-ghost btn-sm"
            title="Usuarios y contraseñas"
            onClick={() => setUsuariosOpen(true)}
          >
            <Icon name="settings" size={14} />
          </button>
        )}
      </div>

      {esAdmin && <UsuariosModal open={usuariosOpen} onClose={() => setUsuariosOpen(false)} />}
    </div>
  );
}
