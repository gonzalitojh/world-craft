import {
  createContext,
  useContext,
  useId,
  type ChangeEvent,
  type ReactNode,
} from 'react';

import { cx } from '../lib/class-names';

interface RadioGroupContextValue {
  readonly name: string;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps {
  /** Leyenda obligatoria del grupo; se renderiza como `<legend>`. */
  readonly legend: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly name?: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Grupo de opciones exclusivas sobre `<fieldset>`/`<legend>`.
 *
 * El nombre compartido y los mensajes se propagan a cada `Radio` por contexto,
 * de modo que las flechas del navegador mueven la selección sin código propio.
 * El error se asocia al grupo completo con `aria-describedby` y `aria-invalid`.
 */
export function RadioGroup({
  legend,
  hint,
  error,
  name,
  children,
  className,
}: RadioGroupProps) {
  const generatedId = useId();
  const groupName = name ?? `wc-radio-${generatedId}`;
  const hintId = `${generatedId}-hint`;
  const errorId = `${generatedId}-error`;

  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter((entry): entry is string => entry !== null)
    .join(' ');

  return (
    <fieldset
      className={cx(
        'wc-radio-group',
        error ? 'wc-radio-group--invalid' : false,
        className,
      )}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy.length > 0 ? describedBy : undefined}
    >
      <legend className="wc-radio-group__legend">{legend}</legend>
      {hint ? (
        <p className="wc-field__hint wc-radio-group__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <div className="wc-radio-group__options">
        <RadioGroupContext.Provider value={{ name: groupName }}>
          {children}
        </RadioGroupContext.Provider>
      </div>
      {error ? (
        <p
          className="wc-field__error wc-radio-group__error"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export interface RadioProps {
  readonly label: string;
  readonly value: string;
  readonly checked?: boolean;
  readonly defaultChecked?: boolean;
  readonly onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly disabled?: boolean;
  readonly name?: string;
  readonly id?: string;
  readonly className?: string;
}

/**
 * Opción de un `RadioGroup`.
 *
 * Dentro del grupo hereda el nombre y los mensajes; fuera de él se comporta
 * como un radio nativo suelto con su propio `name`.
 */
export function Radio({
  label,
  value,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  name,
  id,
  className,
}: RadioProps) {
  const group = useContext(RadioGroupContext);
  const generatedId = useId();
  const fieldId = id ?? `wc-radio-${generatedId}`;

  const checkedProps =
    checked === undefined ? { defaultChecked } : { checked, onChange };

  return (
    <div className={cx('wc-radio', className)}>
      <input
        {...checkedProps}
        id={fieldId}
        name={name ?? group?.name}
        value={value}
        type="radio"
        className="wc-radio__input"
        disabled={disabled}
      />
      <label className="wc-radio__label" htmlFor={fieldId}>
        {label}
      </label>
    </div>
  );
}
