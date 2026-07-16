import { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '@/lib/auth';

export function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Cerrar el menú lateral (drawer móvil) al navegar a otra pantalla.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-400)',
          fontSize: 14,
        }}
      >
        Cargando…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <Sidebar open={menuOpen} />
      {menuOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="main-area">
        <Topbar onToggleMenu={() => setMenuOpen((o) => !o)} />
        {/* RH / Nómina usa TODO el ancho (tablas de 15+ columnas); el resto del CRM
            conserva el max-width de 1400px centrado. Ver pages/rh/rh.css */}
        <div className={`content${location.pathname.startsWith('/app/rh') ? ' content-wide' : ''}`}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
