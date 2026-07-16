import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

/**
 * Guard de ruta por departamento.
 *
 * El Sidebar ya esconde los links que el rol no puede ver, pero eso es solo
 * cosmético: sin este guard, cualquiera con sesión podía entrar tecleando la URL
 * (ej. un gerente de RH abriendo /app/contabilidad y viendo todas las facturas
 * del SAT). Aquí el permiso se aplica de verdad: si el rol no tiene el
 * departamento, se manda al dashboard.
 *
 * Ojo: esto es un candado de UI. El RLS de Supabase sigue siendo `auth_all`
 * (cualquier autenticado lee/escribe), así que la rendición de cuentas real
 * está en la bitácora `crm.audit_log`. Endurecer el RLS por rol es el paso
 * siguiente si se quiere un candado a prueba de API directa.
 */
export function RequireDept({ dept }: { dept: string }) {
  const { hasDept } = useAuth();
  if (!hasDept(dept)) return <Navigate to="/app/dashboard" replace />;
  return <Outlet />;
}
