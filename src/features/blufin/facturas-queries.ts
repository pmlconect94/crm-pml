/**
 * Facturas Blufin: revisión de la factura del proveedor vs el contrato.
 * Sube el PDF/imagen a Storage (bucket privado `facturas-pdf`) y guarda la
 * comparación línea-por-línea (contrato vs factura) con sus diferencias.
 */
import { supabase } from '@/lib/supabase';
import { recalcFlagsContrato } from './pagos-queries';
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
  /** SKU del catálogo al que mapea la línea (requerido para aprobar — reescribe el contrato). */
  sku_id: string | null;
  sku_contrato: string | null;
  confianza?: string | null;
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
  // Metadatos de origen (la rutina de correo los llena; captura manual los deja por defecto).
  origen?: 'manual' | 'correo';
  factura_num?: string | null;
  xml_path?: string | null;
  email_message_id?: string | null;
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
      origen: params.origen ?? 'manual',
      factura_num: params.factura_num ?? null,
      xml_path: params.xml_path ?? null,
      email_message_id: params.email_message_id ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;

  const lineas: BlufinFacturaLineaInsert[] = params.lineas.map((l) => ({
    factura_id: factura.id,
    sku_id: l.sku_id,
    confianza: l.confianza ?? null,
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

/**
 * Aprobar una factura = la factura se vuelve la verdad del contrato.
 * (Decisión 2026-06-18): al aprobar se **reescriben las líneas del contrato**
 * con lo facturado (SKU mapeado + kg/precio de la factura) y se recalcula
 * total/total_kg/saldo. Los **pagos ya hechos NO se tocan** — se conservan; solo
 * el saldo (= total − anticipo) y los flags se recalculan vía `recalcFlagsContrato`.
 *
 * Requiere que TODAS las líneas tengan `sku_id` mapeado (igual que la carga masiva
 * bloquea contratos con renglones sin SKU).
 */
export async function approveFactura(facturaId: string): Promise<void> {
  // 1) Factura + sus líneas
  const { data: factura, error: fErr } = await supabase
    .from('blufin_facturas')
    .select('id, contrato_id, status')
    .eq('id', facturaId)
    .single();
  if (fErr) throw fErr;
  if (!factura.contrato_id) {
    throw new Error('La factura no está ligada a un contrato — no se puede aprobar.');
  }

  const { data: lineasData, error: lErr } = await supabase
    .from('blufin_factura_lineas')
    .select('sku_id, descripcion_factura, kg_factura, precio_factura, total_factura')
    .eq('factura_id', facturaId);
  if (lErr) throw lErr;
  const lineas = lineasData ?? [];
  if (lineas.length === 0) throw new Error('La factura no tiene líneas.');
  const sinSku = lineas.filter((l) => !l.sku_id).length;
  if (sinSku > 0) {
    throw new Error(`${sinSku} línea(s) sin SKU asignado — mapea el SKU antes de aprobar.`);
  }

  // 2) Snapshot del catálogo para cada SKU mapeado
  const skuIds = Array.from(new Set(lineas.map((l) => l.sku_id as string)));
  const { data: skus, error: sErr } = await supabase
    .from('catalogo_sku')
    .select('id, descripcion, marca, pct, talla, kg_caja')
    .in('id', skuIds);
  if (sErr) throw sErr;
  const skuById = new Map((skus ?? []).map((s) => [s.id as string, s]));

  // 3) Contrato (anticipo para recomputar el saldo)
  const { data: contrato, error: cErr } = await supabase
    .from('blufin_contratos')
    .select('id, anticipo_usd')
    .eq('id', factura.contrato_id)
    .single();
  if (cErr) throw cErr;

  // 4) Reescribir las líneas del contrato con lo facturado
  const { error: delErr } = await supabase
    .from('blufin_contrato_productos')
    .delete()
    .eq('contrato_id', factura.contrato_id);
  if (delErr) throw delErr;

  const nuevas = lineas.map((l, idx) => {
    const sku = skuById.get(l.sku_id as string);
    const kg = Number(l.kg_factura ?? 0);
    const precio = Number(l.precio_factura ?? 0);
    const kgCaja = sku?.kg_caja != null ? Number(sku.kg_caja) : null;
    return {
      contrato_id: factura.contrato_id,
      sku_id: l.sku_id,
      descripcion: sku?.descripcion ?? l.descripcion_factura ?? null,
      marca: sku?.marca ?? null,
      pct: sku?.pct ?? null,
      talla: sku?.talla ?? null,
      kg,
      kg_caja: kgCaja,
      cajas: kgCaja && kgCaja > 0 ? Math.round(kg / kgCaja) : null,
      precio_usd: precio,
      total_usd: l.total_factura != null ? Number(l.total_factura) : kg * precio,
      orden: idx,
    };
  });
  const { error: insErr } = await supabase.from('blufin_contrato_productos').insert(nuevas);
  if (insErr) throw insErr;

  // 5) Totales del contrato (mantener pagos; saldo = total − anticipo, nunca negativo)
  const totalUsd = nuevas.reduce((s, n) => s + Number(n.total_usd ?? 0), 0);
  const totalKg = nuevas.reduce((s, n) => s + Number(n.kg ?? 0), 0);
  const anticipo = Number(contrato.anticipo_usd ?? 0);
  const saldoUsd = Math.max(0, totalUsd - anticipo);
  const { error: upErr } = await supabase
    .from('blufin_contratos')
    .update({ total_usd: totalUsd, total_kg: totalKg, saldo_usd: saldoUsd })
    .eq('id', factura.contrato_id);
  if (upErr) throw upErr;

  // 6) Recalcular flags (los pagos se conservan; anticipo_pagado/saldo_pagado se recomputan)
  await recalcFlagsContrato(factura.contrato_id);

  // 7) Marcar la factura como aprobada
  const { error: aErr } = await supabase
    .from('blufin_facturas')
    .update({ status: 'Aprobada' })
    .eq('id', facturaId);
  if (aErr) throw aErr;
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
