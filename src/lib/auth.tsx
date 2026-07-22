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
  | 'vendedor'
  | 'operativo'
  /** Sin permisos. Es el default de un usuario sin `rol` en su metadata: la base
   *  de Supabase es COMPARTIDA con otros sistemas, así que una cuenta ajena que
   *  se loguee aquí no debe ver nada hasta que un admin le asigne rol. */
  | 'sin_acceso';

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  empresaId: 'pml' | 'marlin';
  /** Pestañas de Blufin permitidas. null = todas (admin). */
  tabs: string[] | null;
  /** Puede capturar/editar/borrar. false = solo ver. */
  capturar: boolean;
  /** Empresas a las que el usuario tiene acceso (switcher). Default: ambas. */
  empresas: ('pml' | 'marlin')[];
  /** Permisos granulares del módulo RH (crudo de user_metadata.rh).
   *  null = acceso completo a RH (usuarios previos). Lo normaliza
   *  `lib/nomina/permisos.ts`. */
  rh: Record<string, unknown> | null;
};

// Los ids deben coincidir con los de MODULOS_POR_EMPRESA (lib/modulos).
// 'produccion' es de Marlin (maquila); los demás son de PML o compartidos.
export const PERMISOS: Record<Rol, { depts: string[] }> = {
  admin_total:     { depts: ['importaciones','produccion','logistica','administracion','ventas','cobranza','contabilidad','rh'] },
  director_ops:    { depts: ['importaciones','produccion','logistica','administracion','rh'] },
  coord_logistica: { depts: ['importaciones','logistica'] },
  // Decisión del usuario 2026-07-16: el gerente de RH ve SOLO Recursos Humanos
  // por ahora (antes traía también 'administracion').
  gerente_rh:      { depts: ['rh'] },
  contador:        { depts: ['contabilidad','cobranza','administracion'] },
  vendedor:        { depts: ['ventas'] },
  operativo:       { depts: ['importaciones'] },
  sin_acceso:      { depts: [] },
};

// nombre/rol/permisos viven en el user_metadata del usuario de Supabase Auth.
function usuarioDeSesion(session: Session | null): Usuario | null {
  const u = session?.user;
  if (!u) return null;
  const m = (u.user_metadata ?? {}) as Record<string, unknown>;
  // Sin `rol` en la metadata => SIN ACCESO. Antes el default era 'admin_total',
  // así que cualquier cuenta de Auth sin metadata del CRM (la base es compartida
  // con otros sistemas) entraba como administrador total y veía todo, incluida
  // la nómina. El acceso ahora es explícito: lo da un admin asignando el rol.
  const rol: Rol = (m.rol as Rol) ?? 'sin_acceso';
  const esAdmin = rol === 'admin_total';
  // Empresas permitidas en el switcher. Sin la llave en metadata = ambas
  // (usuarios previos); con lista explícita, solo esas (ej. Efraín: ['marlin']).
  const empresasRaw = Array.isArray(m.empresas)
    ? (m.empresas as string[]).filter((x): x is 'pml' | 'marlin' => x === 'pml' || x === 'marlin')
    : [];
  const empresas: ('pml' | 'marlin')[] = empresasRaw.length > 0 ? empresasRaw : ['pml', 'marlin'];
  return {
    id: u.id,
    nombre: (m.nombre as string) || u.email || 'Usuario',
    email: u.email ?? '',
    rol,
    empresaId: ((m.empresa_id as 'pml' | 'marlin') ?? 'pml'),
    tabs: esAdmin ? null : Array.isArray(m.tabs) ? (m.tabs as string[]) : [],
    capturar: esAdmin ? true : m.capturar === true,
    empresas,
    rh: m.rh && typeof m.rh === 'object' ? (m.rh as Record<string, unknown>) : null,
  };
}

type AuthContextValue = {
  user: Usuario | null;
  loading: boolean;
  empresaId: 'pml' | 'marlin';
  setEmpresa: (e: 'pml' | 'marlin') => void;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  hasDept: (dept: string) => boolean;
  /** ¿El usuario puede ver esta pestaña de Blufin? (admin = todas). */
  puedeTab: (tabId: string) => boolean;
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

  // Si el usuario NO tiene acceso a la empresa activa (ej. solo Marlin), se
  // aterriza en su primera empresa permitida — el default 'pml' no aplica a todos.
  useEffect(() => {
    if (user && !user.empresas.includes(empresaId)) setEmpresaIdState(user.empresas[0]);
  }, [user, empresaId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      empresaId,
      // Guard: no se puede cambiar a una empresa fuera de las permitidas.
      setEmpresa: (e) => { if (!user || user.empresas.includes(e)) setEmpresaIdState(e); },
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
      // `?.` a propósito: si la metadata trae un rol desconocido (typo), PERMISOS
      // no lo tiene y sin el opcional reventaría la app. Rol raro => sin acceso.
      hasDept: (dept) => (user ? (PERMISOS[user.rol]?.depts.includes(dept) ?? false) : false),
      puedeTab: (tabId) => (user ? user.tabs === null || user.tabs.includes(tabId) : false),
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
