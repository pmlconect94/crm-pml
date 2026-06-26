import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon, type IconName } from './Icon';
import { useAuth } from '@/lib/auth';

const PROVEEDORES = [
  { id: 'blufin',     label: 'Blufin Seafood',       href: '/app/importaciones/blufin',     enabled: true },
  { id: 'camanchaca', label: 'Salmones Camanchaca',  href: '/app/importaciones/camanchaca', enabled: true },
  { id: 'neptuno',    label: 'Neptuno Seafood',      href: '/app/importaciones/neptuno',    enabled: true },
];

const DEPTS: { id: string; label: string; icon: IconName; href: string }[] = [
  { id: 'logistica',      label: 'Logística',         icon: 'truck',      href: '/app/logistica' },
  { id: 'administracion', label: 'Administración',    icon: 'building',   href: '/app/administracion' },
  { id: 'ventas',         label: 'Comercial',         icon: 'cart',       href: '/app/ventas' },
  { id: 'cobranza',       label: 'Cobranza',          icon: 'coins',      href: '/app/cobranza' },
  { id: 'contabilidad',   label: 'Contabilidad',      icon: 'calculator', href: '/app/contabilidad' },
  { id: 'rh',             label: 'Recursos Humanos',  icon: 'users',      href: '/app/rh' },
];

const EMPRESAS = [
  { id: 'pml' as const,    name: 'Productos Marinos Lizárraga', sub: 'PML — Distribuidora',        disabled: false },
  { id: 'marlin' as const, name: 'Marlin Lizárraga',            sub: 'Productora · Próximamente',  disabled: true  },
];

export function Sidebar() {
  const { user, hasDept, empresaId, setEmpresa, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [impOpen, setImpOpen] = useState(() => location.pathname.startsWith('/app/importaciones'));
  const [empOpen, setEmpOpen] = useState(false);

  const empresaName = empresaId === 'pml' ? 'Productos Marinos' : 'Marlin Lizárraga';
  const empresaLogo = empresaId === 'pml' ? '/assets/pml-logo-transparent.png' : '/assets/marlin-logo.png';
  const importActiva = location.pathname.startsWith('/app/importaciones');

  return (
    <aside className="sidebar">
      {/* ── Switcher de empresa ── */}
      <div style={{ position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => setEmpOpen((o) => !o)}
          className="sidebar-brand"
          style={{ width: '100%', cursor: 'pointer', background: 'transparent', border: 'none' }}
        >
          <div
            style={{
              width: 30, height: 30, borderRadius: 'var(--r-sm)',
              background: empresaId === 'pml' ? 'rgba(255,255,255,0.06)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, flexShrink: 0,
            }}
          >
            <img src={empresaLogo} alt={empresaName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
              Empresa activa
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {empresaName}
            </div>
          </div>
          <Icon name="chevron-down" size={13} style={{ opacity: 0.6, flexShrink: 0 }} />
        </button>

        <AnimatePresence>
          {empOpen && (
            <>
              <div onClick={() => setEmpOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                style={{
                  position: 'absolute', top: 'calc(100% - 4px)', left: 8, right: 8, zIndex: 41,
                  background: 'var(--navy-800)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
                }}
              >
                {EMPRESAS.map((e) => (
                  <button
                    key={e.id}
                    disabled={e.disabled}
                    onClick={() => { if (!e.disabled) { setEmpresa(e.id); setEmpOpen(false); } }}
                    style={{
                      width: '100%', padding: '8px 12px', textAlign: 'left', border: 'none', color: 'white',
                      background: empresaId === e.id ? 'rgba(0,115,230,0.16)' : 'transparent',
                      cursor: e.disabled ? 'not-allowed' : 'pointer', opacity: e.disabled ? 0.5 : 1,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{e.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{e.sub}</div>
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ── General ── */}
      <div className="sidebar-section-label">General</div>
      <NavLink to="/app/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Icon name="home" size={15} />
        Dashboard
      </NavLink>

      {/* ── Departamentos ── */}
      <div className="sidebar-section-label">Departamentos</div>

      {hasDept('importaciones') && (
        <>
          <button
            className={`nav-item ${importActiva ? 'active' : ''}`}
            onClick={() => setImpOpen((o) => !o)}
            aria-expanded={impOpen}
          >
            <Icon name="ship" size={15} />
            Importaciones
            <Icon name="chevron-right" size={13} className={`nav-chevron ${impOpen ? 'open' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {impOpen && (
              <motion.div
                className="nav-sub"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              >
                {PROVEEDORES.map((p) =>
                  p.enabled ? (
                    <NavLink key={p.id} to={p.href} className={({ isActive }) => `nav-sub-item ${isActive ? 'active' : ''}`}>
                      <span className="nav-dot" style={{ background: 'var(--green-500)' }} />
                      {p.label}
                    </NavLink>
                  ) : (
                    <button key={p.id} className="nav-sub-item disabled" disabled title="Próximamente">
                      <span className="nav-dot" style={{ background: 'rgba(255,255,255,0.3)' }} />
                      {p.label}
                      <span className="nav-prox">PRÓX</span>
                    </button>
                  ),
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {DEPTS.map((d) => (
        <button key={d.id} className="nav-item disabled" disabled title="Próximamente">
          <Icon name={d.icon} size={15} />
          <span>{d.label}</span>
          <span className="nav-prox">PRÓX</span>
        </button>
      ))}

      <div className="spacer" />

      {/* ── Footer: usuario + cerrar sesión ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '8px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 8px' }}>
          <div
            style={{
              width: 26, height: 26, borderRadius: 999, background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0,
            }}
          >
            {user?.nombre.split(' ').map((p) => p[0]).slice(0, 2).join('')}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.nombre}
            </div>
            <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
              {user?.rol.replace('_', ' ')}
            </div>
          </div>
        </div>
        <button
          onClick={() => { signOut(); navigate('/login'); }}
          className="nav-item"
          style={{ borderLeft: 'none', borderRadius: 'var(--r-sm)', color: 'rgba(255,255,255,0.72)' }}
        >
          <Icon name="logout" size={15} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
