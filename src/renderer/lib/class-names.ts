/**
 * Une nombres de clase descartando valores falsos.
 *
 * Evita concatenaciones frágiles con espacios dobles cuando un modificador es
 * opcional.
 */
export function cx(
  ...values: ReadonlyArray<string | false | null | undefined>
): string {
  return values
    .filter(
      (value): value is string => typeof value === 'string' && value !== '',
    )
    .join(' ');
}
