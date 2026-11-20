/**
 * Formatos del panel de actualizaciones.
 *
 * Usa `Intl` y un locale explícito para que fechas y porcentajes respeten el
 * perfil del usuario sin concatenaciones frágiles (ADR 0009). Devuelve `null`
 * cuando la marca de tiempo no es válida para que la interfaz muestre el texto
 * de «nunca comprobado» en lugar de una fecha inventada.
 */
export function formatLastChecked(
  isoTimestamp: string | null,
  locale = 'es-ES',
): string | null {
  if (isoTimestamp === null) {
    return null;
  }

  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/** Formatea el porcentaje de descarga sin decimales. */
export function formatPercent(percent: number, locale = 'es-ES'): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(percent);
}
