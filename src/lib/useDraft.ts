import { useEffect, useRef } from 'react';

/**
 * Persiste el estado de un formulario en localStorage para que NO se pierda
 * al salir de la pestaña o navegar a otro lado. Al montar, restaura el
 * borrador si existe; mientras se edita, lo guarda en cada cambio.
 *
 * Uso:
 *   const draft = useDraft(KEY, snapshot, applyDraft);
 *   // ...al guardar con éxito o descartar:
 *   draft.clear();
 *
 * - `snapshot`: objeto serializable con todo el estado editable (memoizado).
 * - `applyDraft`: callback que vuelca un borrador a los setters de estado.
 */
export function useDraft<T>(
  key: string,
  snapshot: T,
  applyDraft: (draft: T) => void,
): { clear: () => void } {
  const saves = useRef(0);
  const skipNext = useRef(false);

  // Restaurar una sola vez al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) applyDraft(JSON.parse(raw) as T);
    } catch {
      // borrador corrupto o storage no disponible — ignorar
    }
    // solo al montar / cambiar de key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Guardar en cada cambio del snapshot, saltando el primer render (estado inicial vacío)
  useEffect(() => {
    saves.current += 1;
    if (saves.current === 1) return;
    // Tras clear(): el reset del formulario dispara un save — lo saltamos para
    // no re-escribir un borrador vacío.
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
      // cuota llena o storage no disponible — ignorar
    }
  }, [key, snapshot]);

  return {
    clear: () => {
      skipNext.current = true;
      try {
        localStorage.removeItem(key);
      } catch {
        // ignorar
      }
    },
  };
}
