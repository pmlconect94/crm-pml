/**
 * Facturas Blufin: revisión de la factura del proveedor vs el contrato.
 * Sube el PDF/imagen a Storage (bucket privado `facturas-pdf`) y guarda la
 * comparación línea-por-línea (contrato vs factura) con sus diferencias.
 */
import { supabase } from '@/lib/supabase';
import type {
  BlufinFacturaEnriquecida,
  BlufinFacturaLinea,
  BlufinFacturaLineaInsert,
} from '@/types/database';

const BUCKET = 'facturas-pdf';

/** Una diferencia detectada en una línea (se guarda en la jsonb `diferencias`). */
export type FacturaDiferencia = {
  campo: 'kg' | 'precio' | 'total';
  valorContrato: number;
  valorFactura: number;
  delta: number;
};

export async function fetchFacturas(empresaId: string): Promise<BlufinFacturaEnriquecida[]> {
  const { data, error } = await supabase
    .from('blufin_facturas')
    .select('*, contrato:blufin_contratos!inner(folio, total_usd, status, empresa_id)')
    .eq('contrato.empresa_id', empresaId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BlufinFacturaEnriquecida[];
}

export type FacturaDetalle = {
  factura: BlufinFacturaEnriquecida;
  lineas: BlufinFacturaLinea[];
};

export async function fetchFacturaDetalle(facturaId: string): Promise<FacturaDetalle | null> {
  const [{ data: factura, error: fErr }, { data: lineas, error: lErr }] = await Promise.all([
    supabase
      .from('blufin_facturas')
      .select('*, contrato:blufin_contratos(folio, total_usd, status)')
      .eq('id', facturaId)
      .maybeSingle(),
    supabase.from('blufin_factura_lineas').select('*').eq('factura_id', facturaId).order('id'),
  ]);
  if (fErr) throw fErr;
  if (lErr) throw lErr;
  if (!factura) return null;
  return {
    factura: factura as unknown as BlufinFacturaEnriquecida,
    lineas: (lineas ?? []) as BlufinFacturaLinea[],
  };
}

/** Sube el archivo de la factura; devuelve el path en el bucket y el nombre original. */
export async function uploadFacturaArchivo(
  file: File,
  contratoFolio: string,
): Promise<{ path: string; nombre: string }> {
  const safeFolio = (contratoFolio || 'factura').replace(/[^a-zA-Z0-9_-]/g, '_');
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'pdf';
  const path = `${safeFolio}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return { path, nombre: file.name };
}

/** URL firmada temporal (1h) para ver el archivo del bucket privado. */
export async function getFacturaUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export type NuevaFacturaLinea = {
  descripcion: string;
  sku_contrato: string | null;
  kg_contrato: number;
  precio_contrato: number;
  total_contrato: number;
  kg_factura: number;
  precio_factura: number;
  total_factura: number;
  match: 'ok' | 'diferente';
  diferencias: FacturaDiferencia[];
  aceptado: boolean;
  nota_revision: string | null;
};

export type NuevaFactura = {
  contrato_id: string;
  fecha_subida: string;
  nombre_archivo: string | null;
  storage_path: string | null;
  status: 'Pendiente revisión' | 'Aprobada';
  total_contrato: number;
  total_factura: number;
  lineas: NuevaFacturaLinea[];
};

export async function createFactura(params: NuevaFactura): Promise<string> {
  const { data: factura, error } = await supabase
    .from('blufin_facturas')
    .insert({
      contrato_id: params.contrato_id,
      fecha_subida: params.fecha_subida,
      nombre_archivo: params.nombre_archivo,
      storage_path: params.storage_path,
      status: params.status,
      total_contrato: params.total_contrato,
      total_factura: params.total_factura,
    })
    .select('id')
    .single();
  if (error) throw error;

  const lineas: BlufinFacturaLineaInsert[] = params.lineas.map((l) => ({
    factura_id: factura.id,
    sku_contrato: l.sku_contrato,
    descripcion_contrato: l.descripcion,
    kg_contrato: l.kg_contrato,
    precio_contrato: l.precio_contrato,
    total_contrato: l.total_contrato,
    descripcion_factura: l.descripcion,
    kg_factura: l.kg_factura,
    precio_factura: l.precio_factura,
    total_factura: l.total_factura,
    match: l.match,
    diferencias: l.diferencias as unknown as Record<string, unknown>[],
    aceptado: l.aceptado,
    nota_revision: l.nota_revision,
  }));
  const { error: lErr } = await supabase.from('blufin_factura_lineas').insert(lineas);
  if (lErr) throw lErr;

  return factura.id as string;
}

export async function approveFactura(facturaId: string): Promise<void> {
  const { error } = await supabase
    .from('blufin_facturas')
    .update({ status: 'Aprobada' })
    .eq('id', facturaId);
  if (error) throw error;
}

export async function deleteFactura(facturaId: string, storagePath: string | null): Promise<void> {
  // Borramos líneas → factura → archivo (el FK puede ser cascade, pero lo hacemos explícito).
  const { error: lErr } = await supabase.from('blufin_factura_lineas').delete().eq('factura_id', facturaId);
  if (lErr) throw lErr;
  const { error } = await supabase.from('blufin_facturas').delete().eq('id', facturaId);
  if (error) throw error;
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]); // best-effort
  }
}
