import { useState } from 'react';
import { Icon } from './Icon';
import { TopbarClock } from './TopbarClock';
import { UsuariosModal } from './UsuariosModal';
import { useAuth } from '@/lib/auth';

const ADMIN_EMAIL = 'ddl.pml2@gmail.com';

export function Topbar() {
  const { empresaId, user } = useAuth();
  const [usuariosOpen, setUsuariosOpen] = useState(false);
  const esAdmin = (user?.email ?? '').toLowerCase() === ADMIN_EMAIL;

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
