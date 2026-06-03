import { NavLink, useLocation } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { useAuth } from '@/lib/auth';

type Dept = {
  id: string;
  label: string;
  icon: IconName;
  href: string;
  enabled: boolean;
};

const DEPTS: Dept[] = [
  { id: 'importaciones',   label: 'Importaciones',  icon: 'ship',       href: '/app/importaciones',   enabled: true  },
  { id: 'logistica',       label: 'Logística',      icon: 'truck',      href: '/app/logistica',       enabled: false },
  { id: 'administracion',  label: 'Administración', icon: 'building',   href: '/app/administracion',  enabled: false },
  { id: 'ventas',          label: 'Ventas',         icon: 'cart',       href: '/app/ventas',          enabled: false },
  { id: 'cobranza',        label: 'Cobranza',       icon: 'coins',      href: '/app/cobranza',        enabled: false },
  { id: 'contabilidad',    label: 'Contabilidad',   icon: 'calculator', href: '/app/contabilidad',    enabled: false },
  { id: 'rh',              label: 'Recursos Humanos', icon: 'users',    href: '/app/rh',              enabled: false },
];

export function Sidebar() {
  const { user, hasDept, empresaId } = useAuth();
  const location = useLocation();

  const empresaName = empresaId === 'pml' ? 'PML' : 'Marlin';
  const empresaLogo =
    empresaId === 'pml' ? '/assets/pml-logo-transparent.png' : '/assets/marlin-logo.png';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--r-sm)',
            background: empresaId === 'pml' ? 'rgba(255,255,255,0.06)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            flexShrink: 0,
          }}
        >
          <img
            src={empresaLogo}
            alt={empresaName}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>
            CRM Lizárraga
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{empresaName}</div>
        </div>
      </div>

      <NavLink
        to="/app/dashboard"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        style={{ marginTop: 8 }}
      >
        <Icon name="home" size={16} />
        Dashboard
      </NavLink>

      <div className="sidebar-section-label">Departamentos</div>

      {DEPTS.map((d) => {
        const permitido = hasDept(d.id);
        const disabled = !d.enabled || !permitido;
        if (disabled) {
          return (
            <button
              key={d.id}
              className="nav-item disabled"
              disabled
              title={!permitido ? 'No tienes acceso' : 'Próximamente'}
            >
              <Icon name={d.icon} size={16} />
              <span>{d.label}</span>
              {!d.enabled && (
                <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.7 }}>SOON</span>
              )}
            </button>
          );
        }
        const isActive = location.pathname.startsWith(d.href);
        return (
          <NavLink
            key={d.id}
            to={d.href}
            className={`nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name={d.icon} size={16} />
            {d.label}
          </NavLink>
        );
      })}

      <div className="spacer" />

      <div
        style={{
          padding: '14px 20px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          {user?.nombre
            .split(' ')
            .map((p) => p[0])
            .slice(0, 2)
            .join('')}
        </div>
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.nombre}</div>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'capitalize',
            }}
          >
            {user?.rol.replace('_', ' ')}
          </div>
        </div>
      </div>
    </aside>
  );
}
