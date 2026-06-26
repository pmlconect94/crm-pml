/**
 * Modal de alta/edición de SKU del catálogo Camanchaca (compartido con MX).
 * La descripción es editable; "Generar de la ficha" la arma con composeDescripcionCam.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/Icon';
import { SPRING } from '@/components/motion';
import { useAuth } from '@/lib/auth';
import {
  PRODUCTOS_CAMANCHACA,
  MARCAS_CAMANCHACA,
  TALLAS_CAMANCHACA,
  PORCENTAJES_CAMANCHACA,
  composeDescripcionCam,
  createSkuCam,
  updateSkuCam,
  type SkuParamsCam,
} from '@/features/camanchaca/productos-queries';
import type { CatalogoSku } from '@/types/database';
import { useBackdropDismiss } from '@/lib/useBackdropDismiss';

type Props = {
  open: boolean;
  onClose: () => void;
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
  const [descripcion, setDescripcion] = useState('');

  useEffect(() => {
    if (!open) return;
    setCode(sku?.code ?? '');
    setProducto(sku?.producto ?? '');
    setMarca(sku?.marca ?? '');
    setPct(sku?.pct ?? '');
    setTalla(sku?.talla ?? '');
    setKgCaja(sku?.kg_caja != null ? String(sku.kg_caja) : '');
    setDescripcion(sku?.descripcion ?? '');
  }, [open, sku]);

  const valid = code.trim() !== '' && producto.trim() !== '' && parseFloat(kgCaja) > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const params: SkuParamsCam = {
        code: code.trim(),
        producto: producto.trim(),
        descripcion: descripcion.trim() || composeDescripcionCam(producto, marca, talla, pct),
        marca: marca.trim() || null,
        pct: pct.trim() || null,
        talla: talla.trim() || null,
        kg_caja: parseFloat(kgCaja),
      };
      if (sku) await updateSkuCam(sku.id, params);
      else await createSkuCam(empresaId, params);
    },
    onSuccess: () => {
      toast.success(sku ? `SKU ${code.trim()} actualizado` : `SKU ${code.trim()} agregado al catálogo`);
      qc.invalidateQueries({ queryKey: ['camanchaca_skus'] });
      qc.invalidateQueries({ queryKey: ['cam_sa_catalogos'] });
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
                  {sku ? `Catálogo Camanchaca · ${sku.code}` : 'Agregar producto al catálogo de Salmones Camanchaca'}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar" style={{ padding: 6 }}>
                <Icon name="x" size={14} />
              </button>
            </div>

            <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">Producto (lo que es) *</label>
                <input
                  className="field-input"
                  list="cam-sku-productos"
                  value={producto}
                  onChange={(e) => setProducto(e.target.value)}
                  placeholder="Ej: Salmón lonja"
                />
                <datalist id="cam-sku-productos">
                  {PRODUCTOS_CAMANCHACA.map((p) => (
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
                  placeholder="Ej: 301010"
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
                  placeholder="20.000"
                />
              </div>
              <div>
                <label className="field-label">Marca</label>
                <input
                  className="field-input"
                  list="cam-sku-marcas"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Ej: Camanchaca"
                />
                <datalist id="cam-sku-marcas">
                  {MARCAS_CAMANCHACA.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="field-label">Talla</label>
                <input
                  className="field-input mono"
                  list="cam-sku-tallas"
                  value={talla}
                  onChange={(e) => setTalla(e.target.value)}
                  placeholder="Ej: 4/5 lb"
                />
                <datalist id="cam-sku-tallas">
                  {TALLAS_CAMANCHACA.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">% peso neto</label>
                <input
                  className="field-input mono"
                  list="cam-sku-pcts"
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                  placeholder="Ej: 100%"
                />
                <datalist id="cam-sku-pcts">
                  {PORCENTAJES_CAMANCHACA.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="field-label" style={{ marginBottom: 0 }}>
                    Descripción (como en Intelisis)
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    onClick={() => setDescripcion(composeDescripcionCam(producto, marca, talla, pct))}
                    title="Rellenar con producto - marca - peso neto - talla"
                  >
                    <Icon name="edit" size={11} /> Generar de la ficha
                  </button>
                </div>
                <input
                  className="field-input"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej: Salmón lonja Camanchaca 100% 4/5 lb (20.00 kg / Caja)"
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
