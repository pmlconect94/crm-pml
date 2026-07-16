import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';
import { useEmpresa } from '@/lib/nomina/empresas';

type Tab = { id: string; label: string; href: string; icon: IconName; enabled: boolean };

// Sub-navegación del módulo RH / Nómina. La empresa activa (PML / Marlin) viene del
// switcher global del CRM (Sidebar), no de un selector propio del módulo.
const TABS: Tab[] = [
  { id: 'resumen',    label: 'Resumen',     href: '/app/rh',            icon: 'trend-up',  enabled: true  },
  { id: 'nominas',    label: 'Nóminas',     href: '/app/rh/nominas',    icon: 'file-text', enabled: true  },
  { id: 'empleados',  label: 'Empleados',   href: '/app/rh/empleados',  icon: 'users',     enabled: true  },
  { id: 'prestamos',  label: 'Préstamos',   href: '/app/rh/prestamos',  icon: 'coins',     enabled: true  },
  { id: 'vacaciones', label: 'Vacaciones',  href: '/app/rh/vacaciones', icon: 'calendar',  enabled: false },
];

export function RhLayout() {
  const location = useLocation();
  const { empresa } = useEmpresa();

  return (
    <>
      <div className="hstack" style={{ gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <h1 className="page-title" style={{ margin: 0, fontSize: 19 }}>
          Recursos Humanos
        </h1>
        <span className="badge badge-blue">
          <span className="dot" /> {empresa.nombre}
        </span>
      </div>

      <div className="tabs">
        {TABS.map((t) => {
          // "Resumen" vive en el índice: solo activo en la ruta exacta, si no se marcaría siempre.
          const isActive = t.href === '/app/rh'
            ? location.pathname === '/app/rh'
            : location.pathname.startsWith(t.href);

          if (!t.enabled) {
            return (
              <button key={t.id} className="tab disabled" disabled title="Próximamente">
                <Icon name={t.icon} size={13} />
                {t.label}
                <span style={{ fontSize: 9, background: 'var(--ink-100)', color: 'var(--ink-500)', padding: '1px 6px', borderRadius: 6, marginLeft: 4 }}>
                  SOON
                </span>
              </button>
            );
          }
          return (
            <NavLink key={t.id} to={t.href} className={`tab ${isActive ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
              <Icon name={t.icon} size={13} />
              {t.label}
            </NavLink>
          );
        })}
      </div>

      <Outlet />
    </>
  );
}
