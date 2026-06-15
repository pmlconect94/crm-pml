import { useEffect, useId, useState } from 'react';

export type ComboOption = { id: string; label: string };

/**
 * Selector buscable: input + datalist nativo. Permite escribir (p. ej. el
 * número de contrato) para filtrar; el popup nativo no se recorta por el
 * overflow de modales/tablas. Resuelve el texto a un id por etiqueta exacta.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  className = 'field-input mono',
}: {
  options: ComboOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const listId = useId();
  const [text, setText] = useState('');

  // Sincroniza el texto cuando cambia la selección desde afuera (reset, prefill)
  const selectedLabel = options.find((o) => o.id === value)?.label ?? '';
  useEffect(() => {
    setText(selectedLabel);
  }, [value, selectedLabel]);

  return (
    <>
      <input
        className={className}
        list={listId}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const match = options.find((o) => o.label === t.trim());
          onChange(match ? match.id : null);
        }}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.id} value={o.label} />
        ))}
      </datalist>
    </>
  );
}
