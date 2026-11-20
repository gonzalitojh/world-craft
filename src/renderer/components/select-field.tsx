import { useId, type ChangeEvent } from 'react';

import { cx } from '../lib/class-names';
import { useMessages } from '../i18n/provider';

/** Opción visible de un selector nativo. */
export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectFieldProps {
  readonly label: string;
  readonly options: readonly SelectOption[];
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly name?: string;
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly className?: string;
}

/**
 * Selector nativo con etiqueta, ayuda y error accesibles.
 *
 * Se usa `<select>` del sistema para heredar el teclado, el lector de pantalla
 * y el contraste del tema sin reconstruir un menú propio.
 */
export function SelectField({
  label,
  options,
  hint,
  error,
  required = false,
  disabled = false,
  id,
  name,
  value,
  defaultValue,
  onChange,
  className,
}: SelectFieldProps) {
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
      <select
        {...valueProps}
        id={fieldId}
        name={name}
        className="wc-field__control wc-field__control--select"
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy.length > 0 ? describedBy : undefined}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p className="wc-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="wc-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
