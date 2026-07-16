import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';
import { useAuth } from '@/lib/auth';
import { MODULOS_POR_EMPRESA } from '@/lib/modulos';

const PROVEEDORES = [
  { id: 'blufin',     label: 'Blufin Seafood',       href: '/app/importaciones/blufin',     enabled: true },
  { id: 'camanchaca', label: 'Salmones Camanchaca',  href: '/app/importaciones/camanchaca', enabled: true },
  { id: 'neptuno',    label: 'Neptuno Seafood',      href: '/app/importaciones/neptuno',    enabled: true },
];

// Los módulos por empresa viven en lib/modulos (fuente de verdad compartida con
// el Dashboard). Importaciones y RH se renderizan aparte porque son desplegables.

// Sub-secciones de Recursos Humanos (se despliegan bajo el depto, como los proveedores
// bajo Importaciones). `end` = solo activo en la ruta exacta (para el índice /app/rh).
const RH_SECCIONES = [
  { id: 'resumen',    label: 'Resumen',    href: '/app/rh',            enabled: true,  end: true  },
  { id: 'nominas',    label: 'Nóminas',    href: '/app/rh/nominas',    enabled: true,  end: false },
  { id: 'empleados',  label: 'Empleados',  href: '/app/rh/empleados',  enabled: true,  end: false },
  { id: 'prestamos',  label: 'Préstamos',  href: '/app/rh/prestamos',  enabled: true,  end: false },
  { id: 'vacaciones', label: 'Vacaciones', href: '/app/rh/vacaciones', enabled: false, end: false },
];

const EMPRESAS = [
  { id: 'pml' as const,    name: 'Productos Marinos Lizárraga', sub: 'PML — Distribuidora', disabled: false },
  { id: 'marlin' as const, name: 'Marlin Lizárraga',            sub: 'Productora',          disabled: false },
];

export function Sidebar({ open = false }: { open?: boolean }) {
  const { user, hasDept, empresaId, setEmpresa, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [impOpen, setImpOpen] = useState(() => location.pathname.startsWith('/app/importaciones'));
  const [rhOpen, setRhOpen] = useState(() => location.pathname.startsWith('/app/rh'));
  const [empOpen, setEmpOpen] = useState(false);

  // Nombre COMPLETO: antes decía solo "Productos Marinos" (truncado en el código,
  // no por CSS) y encima se recortaba con ellipsis.
  const empresaName = empresaId === 'pml' ? 'Productos Marinos Lizárraga' : 'Marlin Lizárraga';
  // PML va con el logo de fondo blanco (no el transparente) porque abajo se pinta
  // un recuadro blanco: sobre el navy el transparente casi no se veía. Patrón §9
  // del CLAUDE.md: logo de fondo blanco sobre fondo oscuro => envolver en un div
  // blanco con border-radius. Marlin no lo necesita: su badge negro/dorado se ve
  // solo sobre el menú oscuro.
  const empresaLogo = empresaId === 'pml' ? '/assets/pml-logo.png' : '/assets/marlin-logo.png';
  const importActiva = location.pathname.startsWith('/app/importaciones');
  const rhActiva = location.pathname.startsWith('/app/rh');
  const esMarlin = empresaId === 'marlin';
  // El menú se arma según la EMPRESA activa y el ROL: solo los departamentos que
  // el usuario puede ver (antes los "PRÓX" salían para todos, aunque su rol no
  // los tuviera). Importaciones y RH se rendean aparte por ser desplegables.
  const depts = MODULOS_POR_EMPRESA[empresaId].filter(
    (m) => !m.expandible && hasDept(m.id),
  );

  return (
    <aside className={`sidebar${open ? ' open' : ''}${esMarlin ? ' sidebar-marlin' : ''}`}>
      {/* ── Switcher de empresa ── */}
      <div style={{ position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => setEmpOpen((o) => !o)}
          className="sidebar-brand"
          style={{ width: '100%', cursor: 'pointer', background: 'transparent', border: 'none' }}
        >
          <div
            style={{
              width: 58, height: 58, borderRadius: 'var(--r-sm)',
              // PML: recuadro BLANCO real (antes era un velo al 6% y el logo se perdía
              // contra el navy). Marlin: sin recuadro y a todo lo ancho de la caja.
              background: empresaId === 'pml' ? 'white' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: empresaId === 'pml' ? 5 : 0, flexShrink: 0,
            }}
          >
            <img src={empresaLogo} alt={empresaName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
              Empresa activa
            </div>
            {/* Sin nowrap/ellipsis: que el nombre largo se acomode en dos renglones
                en vez de cortarse. */}
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.25 }}>
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
                  background: esMarlin ? 'var(--marlin-800)' : 'var(--navy-800)',
                  border: '1px solid rgba(255,255,255,0.12)',
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

      {/* Importaciones es exclusivo de PML: Marlin no importa, produce. */}
      {!esMarlin && hasDept('importaciones') && (
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

      {depts.map((d) =>
        d.enabled ? (
          <NavLink key={d.id} to={d.href} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon name={d.icon} size={15} />
            <span>{d.label}</span>
          </NavLink>
        ) : (
          <button key={d.id} className="nav-item disabled" disabled title="Próximamente">
            <Icon name={d.icon} size={15} />
            <span>{d.label}</span>
            <span className="nav-prox">PRÓX</span>
          </button>
        ),
      )}

      {/* ── Recursos Humanos (desplegable, como Importaciones) ── */}
      {hasDept('rh') && (
        <>
          <button
            className={`nav-item ${rhActiva ? 'active' : ''}`}
            onClick={() => setRhOpen((o) => !o)}
            aria-expanded={rhOpen}
          >
            <Icon name="users" size={15} />
            Recursos Humanos
            <Icon name="chevron-right" size={13} className={`nav-chevron ${rhOpen ? 'open' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {rhOpen && (
              <motion.div
                className="nav-sub"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              >
                {RH_SECCIONES.map((s) =>
                  s.enabled ? (
                    <NavLink
                      key={s.id}
                      to={s.href}
                      end={s.end}
                      className={({ isActive }) => `nav-sub-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="nav-dot" style={{ background: 'var(--green-500)' }} />
                      {s.label}
                    </NavLink>
                  ) : (
                    <button key={s.id} className="nav-sub-item disabled" disabled title="Próximamente">
                      <span className="nav-dot" style={{ background: 'rgba(255,255,255,0.3)' }} />
                      {s.label}
                      <span className="nav-prox">PRÓX</span>
                    </button>
                  ),
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

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
