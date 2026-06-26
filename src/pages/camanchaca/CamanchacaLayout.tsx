import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';

type Tab = { id: string; label: string; href: string; icon: IconName };

const SA = '/app/importaciones/camanchaca/sa';
const MX = '/app/importaciones/camanchaca/mx';

const TABS_SA: Tab[] = [
  { id: 'planeacion',    label: 'Planeación',        href: `${SA}/planeacion`,    icon: 'calendar'  },
  { id: 'contenedores',  label: 'Contenedores',      href: `${SA}/contenedores`,  icon: 'container' },
  { id: 'pagos',         label: 'Pagos',             href: `${SA}/pagos`,         icon: 'banknote'  },
  { id: 'recepcion',     label: 'Recepción',         href: `${SA}/recepcion`,     icon: 'inbox'     },
  { id: 'notas-credito', label: 'Notas de crédito',  href: `${SA}/notas-credito`, icon: 'note'      },
  { id: 'calendario',    label: 'Calendario',        href: `${SA}/calendario`,    icon: 'ship'      },
  { id: 'costos',        label: 'Central de costos', href: `${SA}/costos`,        icon: 'trend-up'  },
  { id: 'productos',     label: 'Productos',         href: `${SA}/productos`,     icon: 'package'   },
];

const TABS_MX: Tab[] = [
  { id: 'compras',       label: 'Compras',           href: `${MX}/compras`,       icon: 'cart'      },
  { id: 'pagos',         label: 'Pagos',             href: `${MX}/pagos`,         icon: 'banknote'  },
  { id: 'notas-credito', label: 'Notas de crédito',  href: `${MX}/notas-credito`, icon: 'note'      },
  { id: 'costos',        label: 'Central de costos', href: `${MX}/costos`,        icon: 'trend-up'  },
  { id: 'productos',     label: 'Productos',         href: `${MX}/productos`,     icon: 'package'   },
];

export function CamanchacaLayout() {
  const location = useLocation();
  const esMX = location.pathname.startsWith(MX);
  const tabs = esMX ? TABS_MX : TABS_SA;

  return (
    <>
      <div
        className="hstack"
        style={{ gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}
      >
        <div
          style={{
            width: 52, height: 40, flexShrink: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'white', border: '1px solid var(--ink-200)',
            borderRadius: 'var(--r-sm)', padding: 4,
          }}
        >
          <img
            src="/assets/camanchaca-logo.png"
            alt="Salmones Camanchaca"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
        <h1 className="page-title" style={{ margin: 0, fontSize: 19 }}>
          Salmones Camanchaca
        </h1>

        {/* Switch de entidad fiscal */}
        <div
          className="hstack"
          style={{
            gap: 2, marginLeft: 6, padding: 3,
            background: 'var(--ink-100)', borderRadius: 'var(--r-md)',
          }}
        >
          <EntidadBtn to={`${SA}/contenedores`} activo={!esMX} label="Chile · SA" sub="USD" />
          <EntidadBtn to={`${MX}/compras`} activo={esMX} label="México · MX" sub="MXN" />
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t) => {
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

function EntidadBtn({ to, activo, label, sub }: { to: string; activo: boolean; label: string; sub: string }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex', flexDirection: 'column', lineHeight: 1.15,
        padding: '4px 12px', borderRadius: 'var(--r-sm)', textDecoration: 'none',
        background: activo ? 'white' : 'transparent',
        boxShadow: activo ? 'var(--shadow-sm)' : 'none',
        color: activo ? 'var(--ink-900)' : 'var(--ink-500)',
        fontWeight: activo ? 700 : 600,
      }}
    >
      <span style={{ fontSize: 12 }}>{label}</span>
      <span className="mono" style={{ fontSize: 9, color: activo ? 'var(--camanchaca)' : 'var(--ink-400)' }}>{sub}</span>
    </Link>
  );
}
