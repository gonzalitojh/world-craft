import { useId, type ChangeEvent } from 'react';

import { cx } from '../lib/class-names';

export interface CheckboxProps {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly checked?: boolean;
  readonly defaultChecked?: boolean;
  readonly onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly disabled?: boolean;
  readonly name?: string;
  readonly value?: string;
  readonly id?: string;
  readonly className?: string;
  /** Ids externos que describen la casilla, además de la ayuda y el error. */
  readonly describedBy?: string;
  /** Recibe el foco cuando se abre un diálogo. */
  readonly autoFocusOnOpen?: boolean;
}

/**
 * Casilla nativa con etiqueta, ayuda y error accesibles.
 *
 * Se usa `<input type="checkbox">` para heredar teclado, lector de pantalla y
 * `accent-color` del tema. La caja mide 18 px dentro de una fila de al menos
 * 28 px, de modo que el área de clic cumple el objetivo mínimo de escritorio.
 */
export function Checkbox({
  label,
  hint,
  error,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  name,
  value,
  id,
  className,
  describedBy: describedByProp,
  autoFocusOnOpen = false,
}: CheckboxProps) {
  const generatedId = useId();
  const fieldId = id ?? `wc-checkbox-${generatedId}`;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter((entry): entry is string => entry !== null)
    .concat(
      describedByProp === undefined || describedByProp.length === 0
        ? []
        : [describedByProp],
    )
    .join(' ');

  const checkedProps =
    checked === undefined ? { defaultChecked } : { checked, onChange };

  return (
    <div
      className={cx(
        'wc-checkbox',
        error ? 'wc-checkbox--invalid' : false,
        className,
      )}
    >
      <div className="wc-checkbox__row">
        <input
          {...checkedProps}
          id={fieldId}
          name={name}
          value={value}
          type="checkbox"
          className="wc-checkbox__input"
          data-autofocus={autoFocusOnOpen ? true : undefined}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy.length > 0 ? describedBy : undefined}
        />
        <label className="wc-checkbox__label" htmlFor={fieldId}>
          {label}
        </label>
      </div>
      {hint ? (
        <p className="wc-field__hint wc-checkbox__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          className="wc-field__error wc-checkbox__error"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
