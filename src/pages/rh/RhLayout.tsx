import { Outlet } from 'react-router-dom';
import './rh.css';

// Layout del módulo RH / Nómina.
// La navegación entre secciones (Resumen, Nóminas, Empleados, Préstamos, Vacaciones) vive en
// el SIDEBAR (desplegable bajo "Recursos Humanos", igual que Importaciones), no aquí.
// La empresa activa (PML / Marlin) viene del switcher global del CRM.
//
// Sin encabezado propio a propósito: el letrero "Recursos Humanos" + el badge de empresa
// se quitaron (decisión del usuario) porque se repetían en TODAS las pantallas del módulo y
// comían espacio; el sidebar ya dice en qué sección y en qué empresa estás.
//
// El wrapper `.rh-module` activa el design system de la nómina (ver rh.css): más denso que
// el del CRM, porque estas pantallas manejan tablas de 15+ columnas y captura por día.
export function RhLayout() {
  return (
    <div className="rh-module">
      <Outlet />
    </div>
  );
}
