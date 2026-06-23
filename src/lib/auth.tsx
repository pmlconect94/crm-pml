import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

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

// El nombre y el rol viven en el user_metadata del usuario de Supabase Auth
// (se setean al darlo de alta). No hay módulo de usuarios: se crean a mano.
function usuarioDeSesion(session: Session | null): Usuario | null {
  const u = session?.user;
  if (!u) return null;
  const m = (u.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: u.id,
    nombre: (m.nombre as string) || u.email || 'Usuario',
    email: u.email ?? '',
    rol: ((m.rol as Rol) ?? 'admin_total'),
    empresaId: ((m.empresa_id as 'pml' | 'marlin') ?? 'pml'),
  };
}

type AuthContextValue = {
  user: Usuario | null;
  /** true mientras se resuelve la sesión inicial (evita parpadeo al recargar). */
  loading: boolean;
  empresaId: 'pml' | 'marlin';
  setEmpresa: (e: 'pml' | 'marlin') => void;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  hasDept: (dept: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaIdState] = useState<'pml' | 'marlin'>('pml');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(usuarioDeSesion(data.session));
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(usuarioDeSesion(session));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      empresaId,
      setEmpresa: (e) => setEmpresaIdState(e),
      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) return { ok: false, error: error.message };
        setUser(usuarioDeSesion(data.session));
        return { ok: true };
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setUser(null);
      },
      hasDept: (dept) => (user ? PERMISOS[user.rol].depts.includes(dept) : false),
    }),
    [user, loading, empresaId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}
