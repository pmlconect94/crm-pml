/**
 * Permisos GRANULARES del módulo RH / Nómina (por usuario).
 *
 * Viven en `user_metadata.rh` (objeto crudo que expone lib/auth como `user.rh`).
 * Sin la llave => acceso COMPLETO (usuarios previos: los 3 admin_total y
 * Francisco gerente_rh no cambian). Con la llave, cada campo restringe; lo que
 * no venga en el objeto usa el default indicado abajo.
 *
 * Forma en metadata (ej. Efraín, capturista de Marlin — 2026-07-18):
 *   rh: {
 *     nominas_tipos: ['semanal'],
 *     secciones: ['resumen','nominas','empleados'],
 *     tabs: ['asistencias','comedor','retroactivos','descproducto'],
 *     resumen: ['incidencias','motivos_he','comedor','empleados'],
 *     empleados: { imss:false, calculo:false, jornada:true, sueldos:false, banco:false },
 *     crear_nomina: false,
 *     cerrar_nomina: false,
 *   }
 *
 * OJO: esto es candado de UI (igual que el resto de permisos del CRM). El RLS
 * de `nomina` sigue siendo por rol admin/editor; la rendición de cuentas real
 * está en la bitácora. Endurecer RLS por-permiso es un paso futuro.
 */
import { useMemo } from 'react';
import { useAuth as useCrmAuth } from '@/lib/auth';

export type RhPermisos = {
  /** true = sin restricciones (metadata sin llave `rh`). */
  completo: boolean;
  /** Tipos de nómina que puede ver/abrir. */
  nominasTipos: ('semanal' | 'quincenal')[];
  /** Secciones del menú RH visibles (ids de RH_SECCIONES del Sidebar). */
  secciones: string[];
  /** Pestañas del detalle de nómina visibles (keys de TABS). */
  tabs: string[];
  /** Tarjetas del Resumen (dashboard RH) visibles. */
  resumen: string[];
  /** Restricciones dentro de Empleados. */
  emp: { imss: boolean; calculo: boolean; jornada: boolean; sueldos: boolean; banco: boolean };
  /** Puede crear nóminas nuevas. */
  crearNomina: boolean;
  /** Puede guardar/cerrar (y desbloquear) una nómina. */
  cerrarNomina: boolean;
};

const TODO: RhPermisos = {
  completo: true,
  nominasTipos: ['semanal', 'quincenal'],
  secciones: ['resumen', 'nominas', 'empleados', 'prestamos', 'catalogos', 'vacaciones'],
  tabs: ['resumen', 'asistencias', 'viajes', 'comedor', 'fiscal', 'retroactivos', 'descproducto', 'bonos', 'prestamos'],
  resumen: ['incidencias', 'motivos_he', 'comedor', 'empleados', 'viajes', 'prestamos'],
  emp: { imss: true, calculo: true, jornada: true, sueldos: true, banco: true },
  crearNomina: true,
  cerrarNomina: true,
};

export function normalizarRhPermisos(raw: Record<string, unknown> | null | undefined): RhPermisos {
  if (!raw) return TODO;
  const arr = (v: unknown, def: string[]) => (Array.isArray(v) ? (v as string[]) : def);
  const empRaw = (raw.empleados && typeof raw.empleados === 'object' ? raw.empleados : {}) as Record<string, unknown>;
  const b = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
  return {
    completo: false,
    nominasTipos: arr(raw.nominas_tipos, TODO.nominasTipos) as RhPermisos['nominasTipos'],
    secciones: arr(raw.secciones, TODO.secciones),
    tabs: arr(raw.tabs, TODO.tabs),
    resumen: arr(raw.resumen, TODO.resumen),
    emp: {
      imss: b(empRaw.imss, true),
      calculo: b(empRaw.calculo, true),
      jornada: b(empRaw.jornada, true),
      sueldos: b(empRaw.sueldos, true),
      banco: b(empRaw.banco, true),
    },
    // Con permisos granulares, cerrar/crear nómina es opt-in explícito: son las
    // acciones más delicadas (crear duplica semanas; cerrar descuenta préstamos).
    crearNomina: b(raw.crear_nomina, false),
    cerrarNomina: b(raw.cerrar_nomina, false),
  };
}

/** Permisos de RH del usuario logueado (normalizados, con defaults). */
export function useRhPermisos(): RhPermisos {
  const { user } = useCrmAuth();
  return useMemo(() => normalizarRhPermisos(user?.rh), [user]);
}
