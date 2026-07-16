import type { IconName } from '@/components/Icon';

/**
 * Fuente de verdad de los módulos del ERP: qué existe, en qué empresa y con qué
 * etiqueta. La usan el Sidebar y el Dashboard.
 *
 * Vivía duplicado (el Sidebar tenía su lista y el Dashboard otra hardcodeada), y
 * por eso se desincronizaron: el Dashboard seguía ofreciendo Importaciones en
 * Marlin y anunciando Contabilidad/RH como "próximos" cuando ya estaban vivos.
 * Si se agrega o activa un módulo, se cambia AQUÍ y ambos lo reflejan.
 *
 * Ojo: esto define qué EXISTE por empresa. Quién puede verlo lo decide el rol
 * (`hasDept` en lib/auth), y el candado real de las rutas es <RequireDept>.
 */
export type Modulo = {
  /** Debe coincidir con el `dept` de PERMISOS en lib/auth. */
  id: string;
  label: string;
  descripcion: string;
  icon: IconName;
  href: string;
  /** El módulo ya está construido. false => se muestra como "PRÓXIMAMENTE". */
  enabled: boolean;
  /** En el Sidebar se despliega con sub-secciones propias (no es un link simple). */
  expandible?: boolean;
};

export const MODULOS_POR_EMPRESA: Record<'pml' | 'marlin', Modulo[]> = {
  // PML — distribuidora: importa y vende.
  pml: [
    { id: 'importaciones',  label: 'Importaciones',     descripcion: 'Contratos, recepciones, pagos al proveedor, notas de crédito y central de costos', icon: 'ship',       href: '/app/importaciones',  enabled: true,  expandible: true },
    { id: 'logistica',      label: 'Logística',         descripcion: 'Rutas, flota propia y entregas',                    icon: 'truck',      href: '/app/logistica',      enabled: false },
    { id: 'administracion', label: 'Administración',    descripcion: 'KPIs, bancos y flujo de caja',                      icon: 'building',   href: '/app/administracion', enabled: false },
    { id: 'ventas',         label: 'Comercial',         descripcion: 'Pipeline retail, HORECA y exportación',             icon: 'cart',       href: '/app/ventas',         enabled: false },
    { id: 'cobranza',       label: 'Cobranza',          descripcion: 'CxC, antigüedad de saldos y recordatorios',         icon: 'coins',      href: '/app/cobranza',       enabled: false },
    { id: 'contabilidad',   label: 'Contabilidad',      descripcion: 'Facturas del SAT, pagos y conciliación',            icon: 'calculator', href: '/app/contabilidad',   enabled: true  },
    { id: 'rh',             label: 'Recursos Humanos',  descripcion: 'Nómina, empleados y préstamos',                     icon: 'users',      href: '/app/rh',             enabled: true,  expandible: true },
  ],
  // Marlin — productora: maquila para PML (no importa).
  marlin: [
    { id: 'produccion',     label: 'Producción',        descripcion: 'Órdenes de maquila, materia prima y almacenes',     icon: 'package',    href: '/app/produccion',     enabled: false },
    { id: 'administracion', label: 'Administración',    descripcion: 'KPIs, bancos y flujo de caja',                      icon: 'building',   href: '/app/administracion', enabled: false },
    { id: 'ventas',         label: 'Comercial',         descripcion: 'Pipeline y pedidos',                                icon: 'cart',       href: '/app/ventas',         enabled: false },
    { id: 'contabilidad',   label: 'Contabilidad',      descripcion: 'Facturas del SAT, pagos y conciliación',            icon: 'calculator', href: '/app/contabilidad',   enabled: true  },
    { id: 'rh',             label: 'Recursos Humanos',  descripcion: 'Nómina, empleados y préstamos',                     icon: 'users',      href: '/app/rh',             enabled: true,  expandible: true },
  ],
};
