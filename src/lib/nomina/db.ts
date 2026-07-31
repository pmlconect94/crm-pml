// Cliente Supabase del módulo RH / Nómina.
// Usa el MISMO proyecto y la MISMA sesión de auth del CRM (un solo GoTrue),
// pero apunta al schema `nomina` en vez del `crm` por defecto.
// Las tablas de nómina viven en el schema `nomina` del proyecto crm-pml.
//
// Uso en las pages del módulo: `dbNomina.from('empleados')…` (en vez de `supabase.from`).
// Para auth (login / reauth del candado de sueldos) se usa el `supabase` del CRM directamente.
import type { SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// El `supabase` del CRM está tipado con `Database`, que solo declara el schema `crm`; por eso
// `.schema('nomina')` no pasa el tipado. Las pantallas de nómina nunca usaron tipos generados
// (trabajan con `any`), así que exponemos el schema `nomina` a través de un cliente SIN tipar:
// mismo comportamiento que tenía la app de nómina por separado, sin perder la sesión del CRM.
// Si algún día se generan los tipos del schema `nomina`, este cast es el único punto a cambiar.
export const dbNomina = (supabase as unknown as SupabaseClient).schema('nomina');

/**
 * Aviso VISIBLE de que una captura NO se guardó.
 *
 * ⚠️ supabase-js **NO lanza excepción** cuando el RLS rechaza una escritura: devuelve
 * `{ error }`. Por eso una captura envuelta solo en `try/catch` falla de forma
 * 100% silenciosa — la pantalla pinta el cambio (update optimista), la base nunca lo
 * recibe, y al recargar desaparece. Toda escritura de captura debe revisar el error
 * explícitamente (`const { error } = await …; if (error) throw error;`), revertir el
 * estado local y llamar a esta función.
 *
 * Bug real 2026-07-31: Efraín y María Isabel capturaron 9 días en falso porque les
 * faltaba el renglón en `nomina.usuarios_roles`. Ver CLAUDE.md §18.8.
 */
export function avisarNoGuardado(err: unknown) {
  const e = err as { code?: string; message?: string } | null;
  const sinPermiso = e?.code === '42501' || /row-level security|permission denied/i.test(e?.message || '');
  toast.error(
    sinPermiso
      ? 'NO se guardó: tu usuario no tiene permiso de captura en Nómina. Avisa a sistemas.'
      : `NO se guardó: ${e?.message || 'sin conexión'}. Revisa e intenta de nuevo.`,
    { duration: 8000 },
  );
}

// Reexport por conveniencia: lo que necesite auth/storage usa el cliente base del CRM.
export { supabase };
