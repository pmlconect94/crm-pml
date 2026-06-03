/**
 * PIN del superadministrador para acciones destructivas (eliminar pagos,
 * contratos, forwards, etc).
 *
 * STUB: por ahora el PIN vive en localStorage. Cuando integremos auth real
 * con Supabase, el PIN será un campo en `crm.usuarios.pin_eliminacion` y
 * solo lo conocerá quien tenga rol `admin_total`. Para verificar, llamaremos
 * una Edge Function `verify-admin-pin` que compara el hash.
 *
 * Default: '1234'. Cambia con setSuperAdminPin() o desde Configuración.
 */

const STORAGE_KEY = 'crm_admin_pin';
const DEFAULT_PIN = '1234';

export function getSuperAdminPin(): string {
  if (typeof window === 'undefined') return DEFAULT_PIN;
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_PIN;
}

export function setSuperAdminPin(pin: string): void {
  if (typeof window === 'undefined') return;
  if (!/^\d{4}$/.test(pin)) throw new Error('El PIN debe ser de 4 dígitos');
  localStorage.setItem(STORAGE_KEY, pin);
}

export function verifyPin(input: string): boolean {
  return input === getSuperAdminPin();
}

/**
 * Hash placeholder para cuando movamos PIN a la DB.
 * TODO: usar bcrypt o argon2 en Edge Function al persistir.
 */
export async function hashPin(_pin: string): Promise<string> {
  return Promise.reject(new Error('Persistir en DB pendiente — usar Edge Function'));
}
