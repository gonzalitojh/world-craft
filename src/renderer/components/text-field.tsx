import { useId, type ChangeEvent } from 'react';

import { cx } from '../lib/class-names';
import { useMessages } from '../i18n/provider';

export interface TextFieldProps {
  /** Etiqueta visible; nunca se sustituye por un placeholder. */
  readonly label: string;
  /** Texto de ayuda asociado al campo. */
  readonly hint?: string;
  /** Error asociado al campo; marca el control como inválido. */
  readonly error?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  /** Identificador explícito; si falta se genera con `useId`. */
  readonly id?: string;
  readonly name?: string;
  readonly type?: 'text' | 'search' | 'email' | 'url';
  readonly placeholder?: string;
  readonly autoComplete?: string;
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly className?: string;
}

/**
 * Campo de texto con etiqueta, ayuda y error accesibles.
 *
 * Acepta uso controlado (`value` + `onChange`) o no controlado
 * (`defaultValue`). La ayuda y el error se enlazan con `aria-describedby` y el
 * error activa `aria-invalid`, de modo que el lector de pantalla anuncia la
 * causa y no solo el color del borde.
 */
export function TextField({
  label,
  hint,
  error,
  required = false,
  disabled = false,
  readOnly = false,
  id,
  name,
  type = 'text',
  placeholder,
  autoComplete,
  value,
  defaultValue,
  onChange,
  className,
}: TextFieldProps) {
  const messages = useMessages();
  const generatedId = useId();
  const fieldId = id ?? `wc-field-${generatedId}`;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter((entry): entry is string => entry !== null)
    .join(' ');

  const valueProps =
    value === undefined ? { defaultValue } : { value, onChange };

  return (
    <div
      className={cx('wc-field', error ? 'wc-field--invalid' : false, className)}
    >
      <label className="wc-field__label" htmlFor={fieldId}>
        {label}
        {required ? (
          <>
            {' '}
            <span className="wc-field__required" aria-hidden="true">
              {messages.components.form.requiredMark}
            </span>
          </>
        ) : null}
      </label>
      <input
        {...valueProps}
        id={fieldId}
        name={name}
        type={type}
        className="wc-field__control"
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy.length > 0 ? describedBy : undefined}
      />
      {hint ? (
        <p className="wc-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="wc-field__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
