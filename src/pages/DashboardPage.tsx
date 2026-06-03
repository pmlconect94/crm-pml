import { Link } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';
import { PageEnter, Stagger, StaggerItem, SPRING } from '@/components/motion';
import { useAuth } from '@/lib/auth';

const MODULOS_PROXIMOS: { icon: IconName; label: string; descripcion: string }[] = [
  { icon: 'truck',      label: 'Logística',        descripcion: 'Rutas, flota propia y entregas' },
  { icon: 'cart',       label: 'Ventas',           descripcion: 'Pipeline retail, HORECA, exportación' },
  { icon: 'coins',      label: 'Cobranza',         descripcion: 'CxC, antigüedad, recordatorios' },
  { icon: 'calculator', label: 'Contabilidad',     descripcion: 'CxP, CFDI, conciliaciones' },
  { icon: 'building',   label: 'Administración',   descripcion: 'KPIs, bancos, flujo de caja' },
  { icon: 'users',      label: 'Recursos Humanos', descripcion: 'Expedientes, nómina, vacaciones' },
];

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <>
      <PageEnter className="page-header">
        <div>
          <h1 className="page-title">Bienvenido, {user?.nombre.split(' ')[0]}</h1>
          <p className="page-subtitle">
            Resumen ejecutivo de operaciones ·{' '}
            {new Date().toLocaleDateString('es-MX', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </PageEnter>

      {/* KPIs — mount instantáneo, son data */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="kpi">
          <div className="kpi-label">Contenedores en tránsito</div>
          <div className="kpi-value">—</div>
          <div className="kpi-delta">Conecta datos para ver KPIs</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">CxP USD próximos 30d</div>
          <div className="kpi-value">—</div>
          <div className="kpi-delta">Por venir</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Inventario kg</div>
          <div className="kpi-value">—</div>
          <div className="kpi-delta">Por venir</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">TC del día</div>
          <div className="kpi-value">—</div>
          <div className="kpi-delta">Integrar Banxico</div>
        </div>
      </div>

      {/* Asymmetric layout: CTA principal + lista compacta */}
      <Stagger
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: 16,
        }}
        className="dashboard-split"
      >

        {/* CTA principal — Importaciones */}
        <StaggerItem whileHover={{ y: -2 }} transition={SPRING.snappy} style={{ minHeight: 240 }}>
        <Link
          to="/app/importaciones"
          className="card card-elevated card-lift"
          style={{
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            textDecoration: 'none',
            color: 'inherit',
            position: 'relative',
            overflow: 'hidden',
            height: '100%',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 280,
              height: 280,
              background:
                'radial-gradient(circle at center, rgba(0,115,230,0.08), transparent 65%)',
              pointerEvents: 'none',
            }}
          />
          <div
            className="hstack"
            style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'var(--blue-100)',
                color: 'var(--blue-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="ship" size={22} />
            </div>
            <span className="badge badge-blue">
              <span className="dot" /> Activo
            </span>
          </div>

          <div style={{ position: 'relative' }}>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                marginBottom: 6,
              }}
            >
              Importaciones
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--ink-600)',
                maxWidth: 440,
              }}
            >
              Contratos, recepciones, pagos al proveedor, notas de crédito y central de costos.
              3 proveedores · Blufin activo.
            </p>
          </div>

          <div
            style={{
              marginTop: 'auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              position: 'relative',
            }}
          >
            <div className="hstack" style={{ gap: 6 }}>
              <span className="badge badge-gray">Blufin</span>
              <span className="badge badge-gray">Camanchaca</span>
              <span className="badge badge-gray">Neptuno</span>
            </div>
            <div
              className="hstack"
              style={{ gap: 6, color: 'var(--blue-500)', fontSize: 13, fontWeight: 600 }}
            >
              Abrir módulo <Icon name="arrow-right" size={14} />
            </div>
          </div>
        </Link>
        </StaggerItem>

        {/* Lista compacta de próximos módulos */}
        <StaggerItem className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--ink-100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h3 className="card-title">Próximos módulos</h3>
              <p className="card-subtitle">Se activan uno a uno</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {MODULOS_PROXIMOS.map((m, i) => (
              <div
                key={m.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 20px',
                  borderBottom:
                    i < MODULOS_PROXIMOS.length - 1 ? '1px solid var(--ink-100)' : 'none',
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
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--ink-800)',
                      lineHeight: 1.3,
                    }}
                  >
                    {m.label}
                  </div>
                  <div className="text-xs muted" style={{ marginTop: 1 }}>
                    {m.descripcion}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--ink-500)',
                    letterSpacing: '0.08em',
                    background: 'var(--ink-100)',
                    padding: '3px 7px',
                    borderRadius: 4,
                  }}
                >
                  SOON
                </span>
              </div>
            ))}
          </div>
        </StaggerItem>
      </Stagger>
    </>
  );
}
