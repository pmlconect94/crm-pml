import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Rol =
  | 'admin_total'
  | 'director_ops'
  | 'coord_logistica'
  | 'gerente_rh'
  | 'contador'
  | 'vendedor';

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  empresaId: 'pml' | 'marlin';
};

export const PERMISOS: Record<Rol, { depts: string[] }> = {
  admin_total:     { depts: ['importaciones','logistica','administracion','ventas','cobranza','contabilidad','rh'] },
  director_ops:    { depts: ['importaciones','logistica','administracion','rh'] },
  coord_logistica: { depts: ['importaciones','logistica'] },
  gerente_rh:      { depts: ['rh','administracion'] },
  contador:        { depts: ['contabilidad','cobranza','administracion'] },
  vendedor:        { depts: ['ventas'] },
};

// Usuarios dados de alta por nosotros (no hay auto-registro). Los 3 con permiso
// de ver todo (admin_total). TRANSICIÓN: por ahora el login valida solo el
// correo (la contraseña real se valida con Supabase Auth cuando se conecte —
// pendiente #3). Las contraseñas NO viven en el código.
const USUARIOS: Usuario[] = [
  { id: '00000000-0000-0000-0000-000000000001', nombre: 'DIEGO DIAZ LIZARRAGA',          email: 'ddl.pml2@gmail.com',              rol: 'admin_total', empresaId: 'pml' },
  { id: '00000000-0000-0000-0000-000000000002', nombre: 'ANA SILVIA LIZARRAGA JIMENEZ',   email: 'anasilvia_lizarraga@hotmail.com', rol: 'admin_total', empresaId: 'pml' },
  { id: '00000000-0000-0000-0000-000000000003', nombre: 'JESUS LIZARRAGA JIMENEZ',        email: 'lizarragajesus@hotmail.com',      rol: 'admin_total', empresaId: 'pml' },
];

type AuthContextValue = {
  user: Usuario | null;
  empresaId: 'pml' | 'marlin';
  setEmpresa: (e: 'pml' | 'marlin') => void;
  /** Devuelve true si el correo corresponde a un usuario dado de alta. */
  signIn: (email: string, password: string) => boolean;
  signOut: () => void;
  hasDept: (dept: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(() => {
    if (typeof window === 'undefined') return null;
    const cached = localStorage.getItem('crm_user');
    return cached ? (JSON.parse(cached) as Usuario) : null;
  });
  const [empresaId, setEmpresaIdState] = useState<'pml' | 'marlin'>('pml');

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      empresaId,
      setEmpresa: (e) => setEmpresaIdState(e),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      signIn: (email, _password) => {
        const u = USUARIOS.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
        if (!u) return false;
        localStorage.setItem('crm_user', JSON.stringify(u));
        setUser(u);
        return true;
      },
      signOut: () => {
        localStorage.removeItem('crm_user');
        setUser(null);
      },
      hasDept: (dept) => (user ? PERMISOS[user.rol].depts.includes(dept) : false),
    }),
    [user, empresaId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}
