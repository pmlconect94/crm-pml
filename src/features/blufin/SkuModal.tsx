/**
 * Modal de alta/edición de SKU del catálogo Blufin.
 * Form de 5 campos — cabe en modal (ver §17).
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { useAuth } from '@/lib/auth';
import {
  CATEGORIAS_BLUFIN,
  createSku,
  updateSku,
  type SkuParams,
} from '@/features/blufin/productos-queries';
import type { CatalogoSku } from '@/types/database';

type Props = {
  open: boolean;
  onClose: () => void;
  /** SKU a editar — null para alta nueva */
  sku: CatalogoSku | null;
};

export function SkuModal({ open, onClose, sku }: Props) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const [code, setCode] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [kgCaja, setKgCaja] = useState('');
  const [cajasTipo, setCajasTipo] = useState('');

  useEffect(() => {
    if (!open) return;
    setCode(sku?.code ?? '');
    setDescripcion(sku?.descripcion ?? '');
    setCategoria(sku?.categoria ?? '');
    setKgCaja(sku?.kg_caja != null ? String(sku.kg_caja) : '');
    setCajasTipo(sku?.cajas_tipo ?? '');
  }, [open, sku]);

  const valid = code.trim() !== '' && descripcion.trim() !== '' && parseFloat(kgCaja) > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const params: SkuParams = {
        code: code.trim(),
        descripcion: descripcion.trim(),
        categoria: categoria || null,
        kg_caja: parseFloat(kgCaja),
        cajas_tipo: cajasTipo.trim() || null,
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
          onClick={onClose}
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
                <label className="field-label">Categoría</label>
                <select
                  className="field-input"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                >
                  <option value="">Sin categoría</option>
                  {CATEGORIAS_BLUFIN.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">Descripción *</label>
                <input
                  className="field-input"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej: TILAPIA FILLET 95% IQF 3-5"
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
                <label className="field-label">Tipo de cajas (opcional)</label>
                <input
                  className="field-input"
                  value={cajasTipo}
                  onChange={(e) => setCajasTipo(e.target.value)}
                  placeholder="Ej: Master"
                />
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
