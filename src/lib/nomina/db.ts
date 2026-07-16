// Cliente Supabase del módulo RH / Nómina.
// Usa el MISMO proyecto y la MISMA sesión de auth del CRM (un solo GoTrue),
// pero apunta al schema `nomina` en vez del `crm` por defecto.
// Las tablas de nómina viven en el schema `nomina` del proyecto crm-pml.
//
// Uso en las pages del módulo: `dbNomina.from('empleados')…` (en vez de `supabase.from`).
// Para auth (login / reauth del candado de sueldos) se usa el `supabase` del CRM directamente.
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// El `supabase` del CRM está tipado con `Database`, que solo declara el schema `crm`; por eso
// `.schema('nomina')` no pasa el tipado. Las pantallas de nómina nunca usaron tipos generados
// (trabajan con `any`), así que exponemos el schema `nomina` a través de un cliente SIN tipar:
// mismo comportamiento que tenía la app de nómina por separado, sin perder la sesión del CRM.
// Si algún día se generan los tipos del schema `nomina`, este cast es el único punto a cambiar.
export const dbNomina = (supabase as unknown as SupabaseClient).schema('nomina');

// Reexport por conveniencia: lo que necesite auth/storage usa el cliente base del CRM.
export { supabase };
