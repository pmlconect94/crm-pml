import { Outlet } from 'react-router-dom';
import { useEmpresa } from '@/lib/nomina/empresas';
import './rh.css';

// Layout del módulo RH / Nómina.
// La navegación entre secciones (Resumen, Nóminas, Empleados, Préstamos, Vacaciones) vive en
// el SIDEBAR (desplegable bajo "Recursos Humanos", igual que Importaciones), no aquí.
// La empresa activa (PML / Marlin) viene del switcher global del CRM.
//
// El wrapper `.rh-module` activa el design system de la nómina (ver rh.css): más denso que
// el del CRM, porque estas pantallas manejan tablas de 15+ columnas y captura por día.
export function RhLayout() {
  const { empresa } = useEmpresa();

  return (
    <div className="rh-module">
      <div className="hstack" style={{ gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          Recursos Humanos
        </h1>
        <span className="badge badge-blue">
          <span className="dot" /> {empresa.nombre}
        </span>
      </div>

      <Outlet />
    </div>
  );
}
