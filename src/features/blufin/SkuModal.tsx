/**
 * Modal de alta/edición de SKU del catálogo Blufin.
 * La descripción no se captura: se genera con composeDescripcion.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { useAuth } from '@/lib/auth';
import {
  PRODUCTOS_BLUFIN,
  MARCAS_BLUFIN,
  TALLAS_BLUFIN,
  PORCENTAJES_BLUFIN,
  composeDescripcion,
  createSku,
  updateSku,
  type SkuParams,
} from '@/features/blufin/productos-queries';
import type { CatalogoSku } from '@/types/database';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';

type Props = {
  open: boolean;
  onClose: () => void;
  /** SKU a editar — null para alta nueva */
  sku: CatalogoSku | null;
};

export function SkuModal({ open, onClose, sku }: Props) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const backdrop = useBackdropDismiss(onClose);

  const [code, setCode] = useState('');
  const [producto, setProducto] = useState('');
  const [marca, setMarca] = useState('');
  const [pct, setPct] = useState('');
  const [talla, setTalla] = useState('');
  const [kgCaja, setKgCaja] = useState('');

  useEffect(() => {
    if (!open) return;
    setCode(sku?.code ?? '');
    setProducto(sku?.producto ?? '');
    setMarca(sku?.marca ?? '');
    setPct(sku?.pct ?? '');
    setTalla(sku?.talla ?? '');
    setKgCaja(sku?.kg_caja != null ? String(sku.kg_caja) : '');
  }, [open, sku]);

  // La descripción no se captura — se genera en vivo desde la ficha
  const descripcion = composeDescripcion(producto, marca, talla, pct);

  const valid = code.trim() !== '' && producto.trim() !== '' && parseFloat(kgCaja) > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const params: SkuParams = {
        code: code.trim(),
        producto: producto.trim(),
        descripcion,
        marca: marca.trim() || null,
        pct: pct.trim() || null,
        talla: talla.trim() || null,
        kg_caja: parseFloat(kgCaja),
      };
      if (sku) await updateSku(sku.id, params);
      else await createSku(empresaId, params);
    },
    onSuccess: () => {
      toast.success(sku ? `SKU ${code.trim()} actualizado` : `SKU ${code.trim()} agregado al catálogo`);
      qc.invalidateQueries({ queryKey: ['blufin_skus'] });
      qc.invalidateQueries({ queryKey: ['blufin_catalogos'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          {...backdrop}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 37, 64, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 100,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={SPRING.snappy}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-xl)',
              maxWidth: 520,
              width: '100%',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--ink-100)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  {sku ? 'Editar SKU' : 'Nuevo SKU'}
                </h2>
                <p className="card-subtitle" style={{ marginTop: 4 }}>
                  {sku
                    ? `Catálogo Blufin · ${sku.code}`
                    : 'Agregar producto al catálogo de Blufin Seafood'}
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={onClose}
                aria-label="Cerrar"
                style={{ padding: 6 }}
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            <div
              style={{
                padding: '16px 24px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">Producto (lo que es) *</label>
                <input
                  className="field-input"
                  list="sku-productos"
                  value={producto}
                  onChange={(e) => setProducto(e.target.value)}
                  placeholder="Ej: Filete Basa"
                />
                <datalist id="sku-productos">
                  {PRODUCTOS_BLUFIN.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="field-label">Código SKU *</label>
                <input
                  className="field-input mono"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ej: 202010"
                />
              </div>
              <div>
                <label className="field-label">Kg por caja *</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  className="field-input mono"
                  value={kgCaja}
                  onChange={(e) => setKgCaja(e.target.value)}
                  placeholder="10.000"
                />
              </div>
              <div>
                <label className="field-label">Marca</label>
                <input
                  className="field-input"
                  list="sku-marcas"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Ej: Pangabay"
                />
                <datalist id="sku-marcas">
                  {MARCAS_BLUFIN.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="field-label">Talla</label>
                <input
                  className="field-input mono"
                  list="sku-tallas"
                  value={talla}
                  onChange={(e) => setTalla(e.target.value)}
                  placeholder="Ej: 5/7 oz"
                />
                <datalist id="sku-tallas">
                  {TALLAS_BLUFIN.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">% peso neto</label>
                <input
                  className="field-input mono"
                  list="sku-pcts"
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                  placeholder="Ej: 70%"
                />
                <datalist id="sku-pcts">
                  {PORCENTAJES_BLUFIN.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--ink-50)',
                    border: '1px solid var(--ink-200)',
                  }}
                >
                  <div className="text-xs muted" style={{ marginBottom: 2 }}>
                    Descripción (se genera sola: producto - marca - peso neto - talla)
                  </div>
                  <div className="text-sm fw-600" style={{ color: descripcion ? 'var(--ink-900)' : 'var(--ink-400)' }}>
                    {descripcion || 'Captura el producto para verla…'}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--ink-100)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                background: 'var(--ink-50)',
                borderRadius: '0 0 var(--r-lg) var(--r-lg)',
              }}
            >
              <button className="btn btn-ghost btn-sm" onClick={onClose}>
                Cancelar
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!valid || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? (
                  <div className="spinner" style={{ width: 12, height: 12 }} />
                ) : (
                  <Icon name="check" size={13} />
                )}
                {sku ? 'Guardar cambios' : 'Guardar SKU'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
