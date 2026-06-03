import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Icon } from './Icon';
import { Popover } from './motion';
import { TopbarClock } from './TopbarClock';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';

export function Topbar() {
  const { empresaId, setEmpresa, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="topbar">
      <div className="hstack" style={{ gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="btn btn-outline btn-sm"
            style={{ minWidth: 160, justifyContent: 'space-between' }}
          >
            <span className="hstack" style={{ gap: 8 }}>
              <span
                className="dot"
                style={{ background: empresaId === 'pml' ? 'var(--blue-500)' : 'var(--cyan-500)' }}
              />
              {empresaId === 'pml' ? 'Productos Marinos Lizárraga' : 'Marlin Lizárraga'}
            </span>
            <Icon name="chevron-down" size={14} />
          </button>
          <AnimatePresence>
          {open && (
            <Popover
              origin="top left"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                background: 'white',
                borderRadius: 'var(--r-md)',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--ink-200)',
                minWidth: 260,
                zIndex: 50,
                overflow: 'hidden',
              }}
            >
              {[
                { id: 'pml' as const, name: 'Productos Marinos Lizárraga', sub: 'PML — Distribuidora', dotColor: 'var(--blue-500)' },
                { id: 'marlin' as const, name: 'Marlin Lizárraga', sub: 'MAR — Productora (Próximamente)', dotColor: 'var(--cyan-500)', disabled: true },
              ].map((e) => (
                <button
                  key={e.id}
                  disabled={e.disabled}
                  onClick={() => {
                    if (e.disabled) return;
                    setEmpresa(e.id);
                    setOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    opacity: e.disabled ? 0.5 : 1,
                    cursor: e.disabled ? 'not-allowed' : 'pointer',
                    background: empresaId === e.id ? 'var(--blue-50)' : 'transparent',
                  }}
                >
                  <span className="dot" style={{ background: e.dotColor }} />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{e.sub}</div>
                  </div>
                  {empresaId === e.id && (
                    <Icon
                      name="check"
                      size={14}
                      style={{ marginLeft: 'auto', color: 'var(--blue-500)' }}
                    />
                  )}
                </button>
              ))}
            </Popover>
          )}
          </AnimatePresence>
        </div>
      </div>

      <div className="hstack" style={{ gap: 8 }}>
        <TopbarClock />
        <button className="btn btn-ghost btn-sm" title="Notificaciones">
          <Icon name="bell" size={14} />
        </button>
        <button className="btn btn-ghost btn-sm" title="Configuración">
          <Icon name="settings" size={14} />
        </button>
        <button
          className="btn btn-ghost btn-sm"
          title={`Cerrar sesión — ${user?.email}`}
          onClick={() => {
            signOut();
            navigate('/login');
          }}
        >
          <Icon name="logout" size={14} />
        </button>
      </div>
    </div>
  );
}
