import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/Icon';

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/app/dashboard" replace />;

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        background: 'var(--ink-50)',
      }}
      className="login-grid"
    >
      {/* Left — brand panel (only on desktop, controlled in index.css) */}
      <aside
        className="login-aside"
        style={{
          display: 'none',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 48,
          background:
            'linear-gradient(135deg, var(--navy-900) 0%, var(--navy-700) 60%, var(--navy-600) 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle texture overlay */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 70% 20%, rgba(0,163,255,0.18), transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(0,115,230,0.12), transparent 55%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: 'var(--blue-400)',
              }}
            />
            Grupo Lizárraga · CRM
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 460 }}>
          <h2
            style={{
              fontSize: 48,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              margin: 0,
              marginBottom: 20,
            }}
          >
            Importación,<br />
            logística y ventas<br />
            <span style={{ color: 'var(--cyan-500)' }}>en un solo lugar.</span>
          </h2>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.55,
              color: 'rgba(255,255,255,0.7)',
              margin: 0,
              maxWidth: 420,
            }}
          >
            Plataforma operativa para Productos Marinos Lizárraga y Marlin Lizárraga.
            Contratos, recepciones, pagos, cobranza y contabilidad — el ciclo completo del negocio.
          </p>
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            gap: 24,
            paddingTop: 24,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            fontSize: 12,
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: 'white', fontSize: 13 }}>3 proveedores</div>
            <div>Blufin · Camanchaca · Neptuno</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div>
            <div style={{ fontWeight: 600, color: 'white', fontSize: 13 }}>2 empresas</div>
            <div>PML · Marlin Lizárraga</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div>
            <div style={{ fontWeight: 600, color: 'white', fontSize: 13 }}>7 departamentos</div>
            <div>Operación end-to-end</div>
          </div>
        </div>
      </aside>

      {/* Right — auth form */}
      <main
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <div
          className="login-card-enter"
          style={{
            width: '100%',
            maxWidth: 380,
          }}
        >
          <div style={{ marginBottom: 32 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'var(--navy-900)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
                marginBottom: 20,
              }}
            >
              <img
                src="/assets/pml-logo-transparent.png"
                alt="Grupo Lizárraga"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            </div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                margin: 0,
                marginBottom: 8,
                color: 'var(--ink-900)',
              }}
            >
              Entrar al CRM
            </h1>
            <p
              style={{
                fontSize: 14,
                color: 'var(--ink-500)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Continúa con tu cuenta corporativa de Google o Microsoft.
            </p>
          </div>

          <div className="vstack" style={{ gap: 10 }}>
            <button
              className="btn btn-outline btn-lg"
              style={{ width: '100%', justifyContent: 'flex-start', paddingLeft: 18 }}
              onClick={() => alert('Google Workspace SSO — pendiente de configurar')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C4 19.98 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 4 4.02 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span style={{ flex: 1, textAlign: 'left' }}>Google Workspace</span>
            </button>

            <button
              className="btn btn-outline btn-lg"
              style={{ width: '100%', justifyContent: 'flex-start', paddingLeft: 18 }}
              onClick={() => alert('Microsoft Entra ID SSO — pendiente de configurar')}
            >
              <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden>
                <rect x="1" y="1"  width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              <span style={{ flex: 1, textAlign: 'left' }}>Microsoft Entra ID</span>
            </button>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => {
                signIn();
                navigate('/app/dashboard');
              }}
            >
              <Icon name="arrow-right" size={14} />
              Entrar como admin (modo desarrollo)
            </button>

            <p
              style={{
                fontSize: 12,
                color: 'var(--ink-400)',
                margin: '12px 0 0',
                lineHeight: 1.5,
              }}
            >
              SSO con Google Workspace y Microsoft Entra está pendiente de configurar.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
