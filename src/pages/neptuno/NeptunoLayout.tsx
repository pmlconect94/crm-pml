import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';

type Tab = { id: string; label: string; href: string; icon: IconName };

const BASE = '/app/importaciones/neptuno';
const TABS: Tab[] = [
  { id: 'facturas',      label: 'Facturas',          href: `${BASE}/facturas`,      icon: 'receipt'   },
  { id: 'pagos',         label: 'Pagos',             href: `${BASE}/pagos`,         icon: 'banknote'  },
  { id: 'notas-credito', label: 'Notas de crédito',  href: `${BASE}/notas-credito`, icon: 'note'      },
  { id: 'calendario',    label: 'Calendario',        href: `${BASE}/calendario`,    icon: 'calendar'  },
  { id: 'costos',        label: 'Central de costos', href: `${BASE}/costos`,        icon: 'trend-up'  },
  { id: 'productos',     label: 'Productos',         href: `${BASE}/productos`,     icon: 'package'   },
];

export function NeptunoLayout() {
  const location = useLocation();

  return (
    <>
      <div className="hstack" style={{ gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <div
          style={{
            width: 52, height: 40, flexShrink: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'white', border: '1px solid var(--ink-200)',
            borderRadius: 'var(--r-sm)', padding: 4,
          }}
        >
          <img
            src="/assets/neptuno-logo.png"
            alt="Neptuno Seafood"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
        <h1 className="page-title" style={{ margin: 0, fontSize: 19 }}>
          Neptuno Seafood
        </h1>
        <span className="badge badge-blue">
          <span className="dot" /> Activo
        </span>
      </div>

      <div className="tabs">
        {TABS.map((t) => {
          const isActive = location.pathname.startsWith(t.href);
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
