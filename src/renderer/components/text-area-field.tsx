import { useId, type ChangeEvent } from 'react';

import { cx } from '../lib/class-names';
import { useMessages } from '../i18n/provider';

export interface TextAreaFieldProps {
  /** Etiqueta visible; nunca se sustituye por un placeholder. */
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly id?: string;
  readonly name?: string;
  readonly rows?: number;
  readonly maxLength?: number;
  readonly placeholder?: string;
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  readonly className?: string;
}

/**
 * Área de texto con etiqueta, ayuda y error accesibles.
 *
 * Comparte la estructura y los estados del campo de texto. El alto mínimo y el
 * redimensionado vertical viven en CSS; el control nunca crece en horizontal
 * para no romper la ventana de 1024 px.
 */
export function TextAreaField({
  label,
  hint,
  error,
  required = false,
  disabled = false,
  readOnly = false,
  id,
  name,
  rows = 4,
  maxLength,
  placeholder,
  value,
  defaultValue,
  onChange,
  className,
}: TextAreaFieldProps) {
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
      <textarea
        {...valueProps}
        id={fieldId}
        name={name}
        rows={rows}
        maxLength={maxLength}
        className="wc-field__control wc-field__control--area"
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy.length > 0 ? describedBy : undefined}
      />
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
