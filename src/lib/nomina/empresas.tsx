import { useAuth as useCrmAuth } from '@/lib/auth';

// ── Multi-empresa ─────────────────────────────────────────────
// Cada empleado y cada nómina pertenece a una empresa (columna `empresa`).
// Aquí vive la config por empresa (nombre, razón social, cuentas de vales/Banorte).

export type EmpresaCode = 'PML' | 'MARLIN';

export type Empresa = {
  code: EmpresaCode;
  nombre: string;        // nombre corto (UI / encabezados)
  razonSocial: string;   // razón social (impresiones)
  areas: string[];       // áreas para el dropdown del catálogo
  vales?: { idCuenta: string; producto: string };          // EasyVale / Toka
  banorte?: { emisora: string; cuentaCargo: string };      // dispersión Banorte (.pag)
};

export const EMPRESAS: Empresa[] = [
  {
    code: 'PML',
    nombre: 'Productos Marinos Lizárraga',
    razonSocial: 'Productos Marinos Lizarraga, S. de R.L. de C.V.',
    areas: ['Administración', 'Cobranza', 'Contabilidad', 'Logistica/Almacen', 'Recursos Humanos', 'Ventas'],
    vales: { idCuenta: '26260', producto: 'EASYVALE CHIP' },
    banorte: { emisora: '21659', cuentaCargo: '0265911011' },
  },
  {
    code: 'MARLIN',
    nombre: 'Marlin Lizárraga',
    razonSocial: 'Marlin Lizarraga, S. de R.L. de C.V.',
    areas: ['Administración', 'Empaque', 'Estilado', 'Fileteado', 'Hornos', 'Inyección', 'Mantenimiento', 'Parrillas', 'Producción', 'Recursos Humanos', 'Salmon', 'Subida de Tambos'],
    vales: { idCuenta: '27352', producto: 'EASYVALE CHIP' },
    banorte: { emisora: '61016', cuentaCargo: '0528568240' },
  },
];

export const getEmpresa = (code?: string | null): Empresa =>
  EMPRESAS.find((e) => e.code === code) || EMPRESAS[0];

// El módulo RH NO tiene su propio provider de empresa: toma la EMPRESA ACTIVA del CRM
// (switcher global pml/marlin del Sidebar, via useAuth). Este useEmpresa adapta ese estado
// a la forma { empresa, code, setCode } que ya esperan las pantallas de nómina.
export function useEmpresa() {
  const { empresaId, setEmpresa } = useCrmAuth();
  const code: EmpresaCode = empresaId === 'marlin' ? 'MARLIN' : 'PML';
  return {
    empresa: getEmpresa(code),
    code,
    setCode: (c: EmpresaCode) => setEmpresa(c === 'MARLIN' ? 'marlin' : 'pml'),
  };
}
