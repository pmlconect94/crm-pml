import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { PageEnter, Stagger, StaggerItem, SPRING } from '@/components/motion';
import { useAuth } from '@/lib/auth';
import { MODULOS_POR_EMPRESA, type Modulo } from '@/lib/modulos';

/**
 * Dashboard = punto de entrada personalizado.
 *
 * Antes era estático: mostraba lo mismo a todo el mundo (KPIs en "—", una
 * tarjeta que siempre llevaba a Importaciones aunque estuvieras en Marlin o no
 * tuvieras el permiso, y anunciaba Contabilidad/RH como "próximos" cuando ya
 * existían). Ahora se arma de MODULOS_POR_EMPRESA cruzado con el rol (hasDept),
 * así cada quien ve solo lo suyo en la empresa activa.
 */
export function DashboardPage() {
  const { user, empresaId, hasDept } = useAuth();

  const empresaNombre =
    empresaId === 'pml' ? 'Productos Marinos Lizárraga' : 'Marlin Lizárraga';

  // Solo los módulos que existen en esta empresa Y que el rol puede ver.
  const visibles = MODULOS_POR_EMPRESA[empresaId].filter((m) => hasDept(m.id));
  const activos = visibles.filter((m) => m.enabled);
  const proximos = visibles.filter((m) => !m.enabled);

  return (
    <>
      <PageEnter className="page-header">
        <div>
          <h1 className="page-title">Bienvenido, {user?.nombre.split(' ')[0]}</h1>
          <p className="page-subtitle">
            {empresaNombre} ·{' '}
            {new Date().toLocaleDateString('es-MX', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </PageEnter>

      {activos.length === 0 ? (
        <div className="card">
          <div className="empty">
            <Icon name="lock" size={36} />
            <div className="empty-title">Sin módulos asignados</div>
            <p className="muted">
              Tu usuario todavía no tiene acceso a ningún módulo de {empresaNombre}. Pide a un
              administrador que te asigne permisos.
            </p>
          </div>
        </div>
      ) : (
        <Stagger
          className="grid grid-3"
          style={{ gap: 16, marginBottom: proximos.length > 0 ? 24 : 0 }}
        >
          {activos.map((m) => (
            <StaggerItem key={m.id} whileHover={{ y: -2 }} transition={SPRING.snappy}>
              <ModuloCard modulo={m} />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {proximos.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--ink-100)',
            }}
          >
            <h3 className="card-title">Próximos módulos</h3>
            <p className="card-subtitle">Se activan uno a uno</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {proximos.map((m, i) => (
              <div
                key={m.id}
                className="hstack"
                style={{
                  gap: 12,
                  padding: '12px 20px',
                  borderBottom: i < proximos.length - 1 ? '1px solid var(--ink-100)' : 'none',
                  opacity: 0.62,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--ink-100)',
                    color: 'var(--ink-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={m.icon} size={15} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="fw-600" style={{ fontSize: 13, color: 'var(--ink-800)' }}>
                    {m.label}
                  </div>
                  <div className="text-xs muted" style={{ marginTop: 1 }}>
                    {m.descripcion}
                  </div>
                </div>
                <span className="nav-prox" style={{ color: 'var(--ink-500)', borderColor: 'var(--ink-200)' }}>
                  PRÓX
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** Tarjeta de un módulo activo (clicable). */
function ModuloCard({ modulo }: { modulo: Modulo }) {
  return (
    <Link
      to={modulo.href}
      className="card card-elevated card-lift"
      style={{
        padding: 22,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        textDecoration: 'none',
        color: 'inherit',
        height: '100%',
        minHeight: 168,
      }}
    >
      <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: 'var(--blue-100)',
            color: 'var(--blue-500)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={modulo.icon} size={20} />
        </div>
        <span className="badge badge-blue">
          <span className="dot" /> Activo
        </span>
      </div>

      <div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>
          {modulo.label}
        </h2>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 12.5,
            lineHeight: 1.5,
            color: 'var(--ink-600)',
          }}
        >
          {modulo.descripcion}
        </p>
      </div>

      <div
        className="hstack"
        style={{
          marginTop: 'auto',
          gap: 6,
          color: 'var(--blue-500)',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Abrir módulo <Icon name="arrow-right" size={14} />
      </div>
    </Link>
  );
}
