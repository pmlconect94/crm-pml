import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';
import { useAuth } from '@/lib/auth';

type Tab = {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  enabled: boolean;
};

const TABS: Tab[] = [
  { id: 'contratos',     label: 'Contratos',         href: '/app/importaciones/blufin/contratos',     icon: 'file-text', enabled: true  },
  { id: 'recepcion',     label: 'Recepción',         href: '/app/importaciones/blufin/recepcion',     icon: 'inbox',     enabled: true  },
  { id: 'pagos',         label: 'Pagos',             href: '/app/importaciones/blufin/pagos',         icon: 'banknote',  enabled: true  },
  { id: 'notas-credito', label: 'Notas de crédito',  href: '/app/importaciones/blufin/notas-credito', icon: 'note',      enabled: true  },
  { id: 'facturas',      label: 'Facturas',          href: '/app/importaciones/blufin/facturas',      icon: 'receipt',   enabled: true  },
  { id: 'calendario',    label: 'Calendario',        href: '/app/importaciones/blufin/calendario',    icon: 'calendar',  enabled: true  },
  { id: 'costos',        label: 'Central de costos', href: '/app/importaciones/blufin/costos',        icon: 'trend-up',  enabled: true  },
  { id: 'productos',     label: 'Productos',         href: '/app/importaciones/blufin/productos',     icon: 'package',   enabled: true  },
];

export function BlufinLayout() {
  const location = useLocation();
  const { puedeTab } = useAuth();

  const visibles = TABS.filter((t) => puedeTab(t.id));
  // Si la ruta actual no está permitida para el usuario, mandarlo a su 1ª pestaña.
  const actual = TABS.find((t) => location.pathname.startsWith(t.href));
  if (actual && !puedeTab(actual.id)) {
    return <Navigate to={visibles[0]?.href ?? '/app/dashboard'} replace />;
  }

  return (
    <>
      <div
        className="hstack"
        style={{
          gap: 10,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 52,
            height: 40,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="/assets/blufin-logo.png"
            alt="Blufin Seafood"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
        <h1 className="page-title" style={{ margin: 0, fontSize: 19 }}>
          Blufin Seafood
        </h1>
        <span className="badge badge-blue">
          <span className="dot" /> Activo
        </span>
      </div>

      <div className="tabs">
        {visibles.map((t) => {
          const isActive = location.pathname.startsWith(t.href);
          if (!t.enabled) {
            return (
              <button key={t.id} className="tab disabled" disabled title="Próximamente">
                <Icon name={t.icon} size={13} />
                {t.label}
                <span
                  style={{
                    fontSize: 9,
                    background: 'var(--ink-100)',
                    color: 'var(--ink-500)',
                    padding: '1px 6px',
                    borderRadius: 6,
                    marginLeft: 4,
                  }}
                >
                  SOON
                </span>
              </button>
            );
          }
          return (
            <NavLink
              key={t.id}
              to={t.href}
              className={`tab ${isActive ? 'active' : ''}`}
              style={{ textDecoration: 'none' }}
            >
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
