import { supabase } from '@/lib/supabase';
import { createContrato } from './queries';
import type {
  BlufinImportLoteEnriquecido,
  BlufinImportContratoConLineas,
  CatalogoSku,
} from '@/types/database';

const BUCKET = 'documentos-importacion';

// ─── Lectura ────────────────────────────────────────────────────────────────

/** Lotes de importación con el desglose de contratos por status (para la lista). */
export async function fetchImportLotes(empresaId: string): Promise<BlufinImportLoteEnriquecido[]> {
  const { data, error } = await supabase
    .from('blufin_import_lotes')
    .select('*, contratos:blufin_import_contratos(status, duplicado)')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BlufinImportLoteEnriquecido[];
}

/** Contratos de un lote con sus renglones y el SKU sugerido (para la revisión). */
export async function fetchImportLoteDetalle(loteId: string): Promise<BlufinImportContratoConLineas[]> {
  const { data, error } = await supabase
    .from('blufin_import_contratos')
    .select('*, lineas:blufin_import_lineas(*, sku:catalogo_sku(code, descripcion))')
    .eq('lote_id', loteId)
    .order('folio', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as unknown as BlufinImportContratoConLineas[];
  // las líneas vienen sin orden garantizado — ordenarlas por su columna `orden`
  rows.forEach((c) => c.lineas?.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)));
  return rows;
}

/** URL firmada (1h) para abrir el PDF individual de un contrato. */
export async function getImportPdfUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

// ─── Edición de la revisión ──────────────────────────────────────────────────

/** Reasigna el SKU de un renglón. Si el usuario lo eligió a mano, confianza = alta. */
export async function updateImportLineaSku(lineaId: string, skuId: string | null): Promise<void> {
  const { error } = await supabase
    .from('blufin_import_lineas')
    .update({ sku_id: skuId, match_confianza: skuId ? 'alta' : 'sin_match' })
    .eq('id', lineaId);
  if (error) throw error;
}

export type ImportContratoPatch = {
  fecha?: string | null;
  eta_puerto?: string | null;
  eta_bodega?: string | null;
  bodega_destino?: string | null;
  presentacion?: string | null;
  anticipo_usd?: number | null;
  anticipo_fecha?: string | null;
  saldo_usd?: number | null;
  saldo_fecha?: string | null;
  observaciones?: string | null;
};

export async function updateImportContrato(id: string, patch: ImportContratoPatch): Promise<void> {
  const { error } = await supabase.from('blufin_import_contratos').update(patch).eq('id', id);
  if (error) throw error;
}

/** Marca/desmarca un contrato como omitido (no se importará). */
export async function toggleOmitirContrato(id: string, omitir: boolean): Promise<void> {
  const { error } = await supabase
    .from('blufin_import_contratos')
    .update({ status: omitir ? 'omitido' : 'pendiente' })
    .eq('id', id);
  if (error) throw error;
}

// ─── Importar (promover staging → tablas reales) ─────────────────────────────

export type ImportResult = {
  importados: number;
  omitidos: number;
  errores: { folio: string; error: string }[];
};

/**
 * Promueve los contratos pendientes del lote a las tablas reales
 * (blufin_contratos + blufin_contrato_productos), reusando createContrato.
 * - Los duplicados (folio ya existe) se marcan omitidos.
 * - Un contrato con renglones sin SKU no se importa (queda pendiente con error).
 * - Cada renglón final usa la ficha del SKU del catálogo (descripción, marca, %,
 *   talla) y las cantidades/precio del PDF — igual que la captura manual.
 */
export async function importarLote(loteId: string, empresaId: string): Promise<ImportResult> {
  const contratos = await fetchImportLoteDetalle(loteId);
  const { data: skusData, error: skuErr } = await supabase
    .from('catalogo_sku')
    .select('*')
    .eq('proveedor', 'blufin')
    .eq('empresa_id', empresaId);
  if (skuErr) throw skuErr;
  const skuById = new Map<string, CatalogoSku>((skusData ?? []).map((s) => [s.id, s as CatalogoSku]));

  const result: ImportResult = { importados: 0, omitidos: 0, errores: [] };

  for (const c of contratos) {
    if (c.status === 'importado') continue;
    if (c.status === 'omitido') {
      result.omitidos++;
      continue;
    }
    if (c.duplicado) {
      await supabase.from('blufin_import_contratos').update({ status: 'omitido' }).eq('id', c.id);
      result.omitidos++;
      continue;
    }

    const lineas = c.lineas ?? [];
    const sinSku = lineas.filter((l) => !l.sku_id);
    if (lineas.length === 0 || sinSku.length > 0) {
      result.errores.push({
        folio: c.folio,
        error: lineas.length === 0 ? 'sin renglones' : `${sinSku.length} renglón(es) sin SKU asignado`,
      });
      continue;
    }

    try {
      const nuevo = await createContrato(
        {
          empresa_id: empresaId,
          folio: c.folio,
          fecha: c.fecha,
          status: 'Contratado',
          eta_puerto: c.eta_puerto,
          eta_bodega: c.eta_bodega,
          presentacion: c.presentacion,
          bodega_destino: c.bodega_destino,
          contenedor: c.contenedor,
          total_usd: c.total_usd,
          total_kg: c.total_kg,
          anticipo_usd: c.anticipo_usd,
          anticipo_fecha: c.anticipo_fecha,
          anticipo_pagado: false,
          saldo_usd: c.saldo_usd,
          saldo_fecha: c.saldo_fecha,
          saldo_pagado: false,
          tc_ponderado: null,
          observaciones: c.observaciones,
          contrato_pdf_path: c.pdf_path,
        },
        lineas.map((l) => {
          const sku = l.sku_id ? skuById.get(l.sku_id) : null;
          return {
            sku_id: l.sku_id,
            descripcion: sku?.descripcion ?? l.descripcion_pdf ?? null,
            marca: sku?.marca ?? l.marca_pdf ?? null,
            pct: sku?.pct ?? l.pct_pdf ?? null,
            talla: sku?.talla ?? l.talla_pdf ?? null,
            kg: l.kg ?? 0,
            kg_caja: l.kg_caja ?? sku?.kg_caja ?? 0,
            cajas: l.cajas ?? null,
            precio_usd: l.precio_usd ?? 0,
            total_usd: l.total_usd ?? 0,
          };
        }),
      );
      await supabase
        .from('blufin_import_contratos')
        .update({ status: 'importado', contrato_id: nuevo.id })
        .eq('id', c.id);
      result.importados++;
    } catch (e) {
      result.errores.push({ folio: c.folio, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Si ya no quedan contratos 'pendiente', el lote se da por importado.
  const { data: restantes } = await supabase
    .from('blufin_import_contratos')
    .select('id')
    .eq('lote_id', loteId)
    .eq('status', 'pendiente');
  if (!restantes || restantes.length === 0) {
    await supabase.from('blufin_import_lotes').update({ status: 'importado' }).eq('id', loteId);
  }

  return result;
}

/** Descarta un lote completo: borra sus PDFs de Storage y el lote (cascade). */
export async function descartarLote(loteId: string): Promise<void> {
  const { data: contratos } = await supabase
    .from('blufin_import_contratos')
    .select('pdf_path')
    .eq('lote_id', loteId);
  const paths = (contratos ?? []).map((c) => c.pdf_path).filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from('blufin_import_lotes').delete().eq('id', loteId);
  if (error) throw error;
}
