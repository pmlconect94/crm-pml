import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icon } from '@/components/Icon';
import { PageEnter, Stagger, StaggerItem, SPRING } from '@/components/motion';

type Proveedor = {
  id: string;
  nombre: string;
  nombreInterno: string;
  ciudad: string;
  moneda: string;
  href: string;
  logo: string;
  accent: string;
  enabled: boolean;
  descripcion: string;
};

const PROVEEDORES: Proveedor[] = [
  {
    id: 'blufin',
    nombre: 'Blufin Seafood',
    nombreInterno: 'Menita Comercial Oceánica',
    ciudad: 'Zapopan, Jalisco',
    moneda: 'USD',
    href: '/app/importaciones/blufin',
    logo: '/assets/blufin-logo.png',
    accent: '#0073E6',
    enabled: true,
    descripcion: 'Tilapia y camarón. Contratos MCO-CV con anticipo del 10% y saldo programado.',
  },
  {
    id: 'camanchaca',
    nombre: 'Salmones Camanchaca',
    nombreInterno: 'Camanchaca Chile + México',
    ciudad: 'Puerto Montt · CDMX',
    moneda: 'USD / MXN',
    href: '/app/importaciones/camanchaca',
    logo: '/assets/camanchaca-logo.png',
    accent: '#0EA5A1',
    enabled: false,
    descripcion: 'Salmón premium. Dos entidades fiscales: SA (importación) y México (compras locales).',
  },
  {
    id: 'neptuno',
    nombre: 'Neptuno Seafood',
    nombreInterno: 'Neptuno Alimentos del Mar',
    ciudad: 'Tijuana, BC',
    moneda: 'USD',
    href: '/app/importaciones/neptuno',
    logo: '/assets/neptuno-logo.png',
    accent: '#0EA5A1',
    enabled: false,
    descripcion: 'Pescados blancos, pulpo y calamar. Sin folio interno — la factura es el ID.',
  },
];

export function ImportacionesPickerPage() {
  const principal = PROVEEDORES[0];
  const secundarios = PROVEEDORES.slice(1);

  return (
    <>
      <PageEnter className="page-header">
        <div>
          <h1 className="page-title">Importaciones</h1>
          <p className="page-subtitle">
            Selecciona un proveedor para ver contratos, pagos, recepciones y costos
          </p>
        </div>
      </PageEnter>

      {/* Bento asymmetric: principal grande + secundarios apilados */}
      <Stagger
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
          gap: 16,
          alignItems: 'stretch',
        }}
        className="picker-bento"
      >

        {/* Tile principal — Blufin */}
        <StaggerItem
          whileHover={{ y: -2 }}
          transition={SPRING.snappy}
          style={{ minHeight: 280 }}
        >
        <Link
          to={principal.href}
          className="card card-elevated card-lift"
          style={{
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            textDecoration: 'none',
            color: 'inherit',
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle accent gradient */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 240,
              height: 240,
              background:
                'radial-gradient(circle at 70% 30%, rgba(0,115,230,0.08), transparent 65%)',
              pointerEvents: 'none',
            }}
          />

          <div
            className="hstack"
            style={{ justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}
          >
            <div
              style={{
                width: 120,
                height: 60,
                borderRadius: 'var(--r-md)',
                background: 'white',
                border: '1px solid var(--ink-200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
              }}
            >
              <img
                src={principal.logo}
                alt={principal.nombre}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
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
                marginBottom: 4,
              }}
            >
              {principal.nombre}
            </h2>
            <div className="text-sm muted" style={{ marginBottom: 14 }}>
              {principal.nombreInterno}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--ink-600)',
                maxWidth: 440,
              }}
            >
              {principal.descripcion}
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
              <span className="badge badge-gray">{principal.ciudad}</span>
              <span className="badge badge-gray">{principal.moneda}</span>
            </div>
            <div
              className="hstack"
              style={{
                gap: 6,
                color: principal.accent,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Abrir módulo <Icon name="arrow-right" size={14} />
            </div>
          </div>
        </Link>
        </StaggerItem>

        {/* Tiles secundarios — stack */}
        <StaggerItem style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {secundarios.map((p) => (
            <motion.div
              key={p.id}
              className="card"
              style={{
                padding: 20,
                opacity: 0.62,
                cursor: 'not-allowed',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                className="hstack"
                style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
              >
                <div
                  style={{
                    width: 80,
                    height: 40,
                    borderRadius: 'var(--r-sm)',
                    background: 'white',
                    border: '1px solid var(--ink-200)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 6,
                  }}
                >
                  <img
                    src={p.logo}
                    alt={p.nombre}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
                <span className="badge badge-gray">Próximamente</span>
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    marginBottom: 2,
                  }}
                >
                  {p.nombre}
                </h3>
                <div className="text-xs muted">{p.nombreInterno}</div>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'var(--ink-500)',
                }}
              >
                {p.descripcion}
              </p>
              <div className="hstack" style={{ gap: 6, marginTop: 'auto' }}>
                <span className="badge badge-gray" style={{ fontSize: 10 }}>{p.ciudad}</span>
                <span className="badge badge-gray" style={{ fontSize: 10 }}>{p.moneda}</span>
              </div>
            </motion.div>
          ))}
        </StaggerItem>
      </Stagger>
    </>
  );
}
