import { supabase } from './supabase';

/**
 * TC del día USD → MXN.
 *
 * Lo entrega la Edge Function `tc-del-dia` de Supabase, que trae el tipo de
 * cambio de una API de mercado en vivo (frankfurter / open-er-api, sin token),
 * lo cachea por día en `crm.tc_dia` y lo devuelve. Se usa como respaldo en
 * costos y para prellenar el "TC del día estimado" en Central de Costos.
 */

export type TcDelDiaInfo = { tc: number; fecha: string; fuente: string };

export async function getTcDelDiaInfo(): Promise<TcDelDiaInfo | null> {
  try {
    const { data, error } = await supabase.functions.invoke('tc-del-dia');
    if (error) return null;
    const tc = Number((data as { tc?: unknown })?.tc);
    if (!(tc > 0)) return null;
    return {
      tc,
      fecha: String((data as { fecha?: unknown }).fecha ?? ''),
      fuente: String((data as { fuente?: unknown }).fuente ?? ''),
    };
  } catch {
    return null;
  }
}

export async function getTcDelDia(): Promise<number | null> {
  const info = await getTcDelDiaInfo();
  return info?.tc ?? null;
}
