'use client';

import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Props que `Field` calcula y entrega al control.
 *
 * Se pasan al `<input>`, `<textarea>` o `<select>` con un *spread*. La forma de
 * uso es una función hija para que el componente no tenga que adivinar qué
 * control hay dentro (y para no clonar nodos ni inyectar props a ciegas):
 *
 * ```tsx
 * <Field label="Nombre" description="Aparece en el mapa">
 *   {(control) => <Input {...control} name="name" />}
 * </Field>
 * ```
 */
export type FieldControlProps = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

export type FieldProps = {
  /** Etiqueta visible, asociada al control por `htmlFor`/`id`. */
  label: string;
  /** Texto de ayuda, asociado por `aria-describedby`. */
  description?: string;
  /** Mensaje de error: marca el control como inválido y se anuncia. */
  error?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
};

/**
 * Envoltorio de campo: etiqueta, descripción y error en un solo sitio.
 *
 * El `id` lo genera el propio campo con `useId`, así que no puede repetirse ni
 * quedarse sin asociar. `aria-describedby` concatena descripción y error en ese
 * orden; los dos textos se leen como ayuda del control.
 */
export function Field({
  label,
  description,
  error,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy = [
    description ? descriptionId : null,
    error ? errorId : null,
  ]
    .filter((value): value is string => value !== null)
    .join(' ');

  const control: FieldControlProps = { id };

  if (describedBy) {
    control['aria-describedby'] = describedBy;
  }

  if (error) {
    control['aria-invalid'] = true;
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children(control)}
      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
