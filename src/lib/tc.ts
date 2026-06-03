/**
 * Obtener el TC del día (USD → MXN) para usar como respaldo en costos.
 *
 * TODO: integrar Edge Function `tc-del-dia` de Supabase que llama a Banxico SIE
 * con un token de servidor. Por ahora devuelve `null` para que el campo
 * `tc_ponderado` quede vacío y la Central de Costos use su fallback más bajo
 * (también el TC del día — sin valor por ahora).
 *
 * Cuando la Edge Function exista, sustituir el cuerpo por:
 *   const { data, error } = await supabase.functions.invoke('tc-del-dia');
 *   if (error) return null;
 *   return data.tc as number;
 */
export async function getTcDelDia(): Promise<number | null> {
  // Stub: hasta que tengamos Edge Function con Banxico, regresa null.
  return null;
}
