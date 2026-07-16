// Adaptador de auth para el módulo RH / Nómina.
// Las pages de la nómina esperan un useAuth() con la forma { user{rol:'admin'|'editor'|'viewer'},
// rolPendiente, loading, signOut, reauth }. El CRM tiene su propio useAuth (roles por
// user_metadata + hasDept + capturar). Este hook envuelve el del CRM y expone la forma vieja,
// así el port de las pantallas es solo cambiar la ruta del import (no su código).
import { useAuth as useCrmAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export type Rol = 'admin' | 'editor' | 'viewer';

export type Usuario = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
};

// Mapa CRM → rol de nómina:
//  - admin_total / gerente_rh → 'admin' (acceso total de RH: edita sueldos, ficha del banco).
//  - cualquier otro con captura habilitada → 'editor'.
//  - resto → 'viewer' (solo lectura).
function mapRol(crmRol: string | undefined, capturar: boolean): Rol {
  if (crmRol === 'admin_total' || crmRol === 'gerente_rh') return 'admin';
  return capturar ? 'editor' : 'viewer';
}

export function useAuth() {
  const a = useCrmAuth();
  const user: Usuario | null = a.user
    ? { id: a.user.id, email: a.user.email, nombre: a.user.nombre, rol: mapRol(a.user.rol, a.user.capturar) }
    : null;

  return {
    user,
    // En el CRM el rol siempre existe (default admin_total en metadata), así que no hay "rol pendiente".
    rolPendiente: false,
    loading: a.loading,
    signOut: a.signOut,
    // Re-verifica la contraseña del usuario logueado (candado de Sueldos / Ficha del banco).
    reauth: async (password: string): Promise<boolean> => {
      if (!a.user?.email) return false;
      const { error } = await supabase.auth.signInWithPassword({ email: a.user.email, password });
      return !error;
    },
  };
}
