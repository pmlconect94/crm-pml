import { useRef } from 'react';
import type { MouseEvent } from 'react';

/**
 * Cierre por backdrop a prueba de selección de texto.
 *
 * Un `onClick={onClose}` simple en el overlay cierra el modal cuando el usuario
 * arrastra para seleccionar el texto de un input y suelta el cursor sobre el
 * fondo oscuro: el navegador dispara un `click` cuyo `target` es el overlay y el
 * modal se cierra "solo". Para evitarlo, solo cerramos cuando el gesto EMPEZÓ y
 * TERMINÓ sobre el propio overlay (no cuando empezó dentro del contenido).
 *
 * Uso: llamar en el cuerpo del componente (regla de hooks — sin condicionales)
 * y esparcir el resultado en el `motion.div` del overlay:
 *
 *   const backdrop = useBackdropDismiss(onClose);
 *   <motion.div {...backdrop} style={overlay}>…</motion.div>
 */
export function useBackdropDismiss(onClose: () => void) {
  const downOnSelf = useRef(false);
  return {
    onMouseDown: (e: MouseEvent) => {
      // El press cuenta como "sobre el overlay" solo si el target ES el overlay
      downOnSelf.current = e.target === e.currentTarget;
    },
    onClick: (e: MouseEvent) => {
      if (downOnSelf.current && e.target === e.currentTarget) onClose();
      downOnSelf.current = false;
    },
  };
}
