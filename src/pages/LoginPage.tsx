import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/Icon';

export function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/app/dashboard" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Escribe tu correo y contraseña.');
      return;
    }
    setSubmitting(true);
    const res = await signIn(email, password);
    setSubmitting(false);
    if (res.ok) navigate('/app/dashboard');
    else setError('Correo o contraseña incorrectos.');
  };

  return (
    <div
      style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', background: 'var(--ink-50)' }}
      className="login-grid"
    >
      {/* ── Izquierda — portada de marca (solo desktop) ── */}
      <aside
        className="login-aside"
        style={{
          display: 'none',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '40px 44px',
          background:
            'linear-gradient(160deg, var(--navy-900) 0%, var(--navy-800) 55%, var(--navy-700) 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* glow sutil de profundidad */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(ellipse at 78% 10%, rgba(0,163,255,0.20), transparent 58%), radial-gradient(ellipse at 18% 60%, rgba(0,115,230,0.12), transparent 62%)',
            pointerEvents: 'none',
          }}
        />

        {/* Olas animadas — océano (Productos del Mar) */}
        <div className="login-waves" aria-hidden>
          <svg className="w3" viewBox="0 0 1440 140" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,64 C120,104 240,104 360,64 C480,24 600,24 720,64 C840,104 960,104 1080,64 C1200,24 1320,24 1440,64 L1440,140 L0,140 Z" fill="rgba(0,115,230,0.10)" />
          </svg>
          <svg className="w2" viewBox="0 0 1440 140" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,64 C120,104 240,104 360,64 C480,24 600,24 720,64 C840,104 960,104 1080,64 C1200,24 1320,24 1440,64 L1440,140 L0,140 Z" fill="rgba(0,163,255,0.13)" />
          </svg>
          <svg className="w1" viewBox="0 0 1440 140" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,64 C120,104 240,104 360,64 C480,24 600,24 720,64 C840,104 960,104 1080,64 C1200,24 1320,24 1440,64 L1440,140 L0,140 Z" fill="rgba(125,205,255,0.16)" />
          </svg>
        </div>

        {/* marca arriba */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 11 }}>
          <div
            style={{
              width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: 5,
            }}
          >
            <img src="/assets/pml-logo-transparent.png" alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>Grupo Lizárraga</div>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
              ERP Corporativo
            </div>
          </div>
        </div>

        {/* logos centrales */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, maxWidth: 440, margin: '0 auto', width: '100%' }}>
          <img
            src="/assets/marlin-logo.png"
            alt="Marlin Lizárraga"
            style={{ width: 264, maxWidth: '78%', objectFit: 'contain', filter: 'drop-shadow(0 14px 34px rgba(0,0,0,0.45))' }}
          />
          <div style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', marginTop: 4 }}>
            Marlin Lizárraga, S. de R.L. de C.V.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '70%', margin: '22px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
            <span style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Grupo</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
          </div>

          <img
            src="/assets/pml-logo-transparent.png"
            alt="Productos Marinos Lizárraga"
            style={{ width: 344, maxWidth: '92%', objectFit: 'contain', filter: 'drop-shadow(0 14px 34px rgba(0,0,0,0.38))' }}
          />
          <div style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', marginTop: 2 }}>
            Productos Marinos Lizárraga, S. de R.L. de C.V.
          </div>
        </div>

        {/* footer */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          <span className="hstack" style={{ gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--green-500)' }} />
            Sistemas en línea · Zapopan, Jal.
          </span>
          <span>© 1994–2026 Grupo Lizárraga</span>
        </div>
      </aside>

      {/* ── Derecha — formulario ── */}
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <form onSubmit={onSubmit} className="login-card-enter" style={{ width: '100%', maxWidth: 380 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px', color: 'var(--ink-900)' }}>
            Bienvenido de vuelta
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-500)', margin: '0 0 26px', lineHeight: 1.5 }}>
            Inicia sesión con tu cuenta corporativa para continuar.
          </p>

          <div className="vstack" style={{ gap: 14 }}>
            <div>
              <label className="field-label" htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                className="field-input"
                placeholder="tucorreo@lizarraga.mx"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label className="field-label" htmlFor="password">Contraseña</label>
                <button
                  type="button"
                  onClick={() => setError('Pídele a un administrador que restablezca tu contraseña.')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--blue-500)' }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="field-input"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <label className="hstack" style={{ gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink-700)' }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Mantener sesión iniciada
            </label>

            {error && (
              <div
                style={{
                  fontSize: 12.5, color: 'var(--red-500)', background: 'color-mix(in srgb, var(--red-500) 8%, white)',
                  border: '1px solid color-mix(in srgb, var(--red-500) 24%, white)', borderRadius: 'var(--r-sm)', padding: '8px 10px',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 2 }}
              disabled={submitting}
            >
              {submitting ? (
                'Entrando…'
              ) : (
                <>
                  Entrar al sistema
                  <Icon name="arrow-right" size={14} />
                </>
              )}
            </button>
          </div>

          <p style={{ fontSize: 11.5, color: 'var(--ink-400)', margin: '20px 0 0', lineHeight: 1.5, textAlign: 'center' }}>
            El acceso es solo para usuarios autorizados de Grupo Lizárraga.
          </p>
        </form>
      </main>
    </div>
  );
}
