/**
 * Formatos del diálogo de transferencia.
 *
 * Los recuentos y los tamaños usan `Intl`; los componentes no concatenan
 * unidades ni deciden plurales. `formatBytes` elige una unidad admitida por
 * `Intl.NumberFormat` y no escribe ninguna cadena de unidad.
 */
import type { Formatters } from '../i18n/formats';
import type { MessageCatalog } from '../messages';
import type { TransferUnit } from '../../shared/contracts/transfer';

/** Porcentaje entero de progreso, o `null` si no hay total útil. */
export function progressPercent(
  completed: number,
  total: number | null,
): number | null {
  if (
    total === null ||
    !Number.isFinite(total) ||
    total <= 0 ||
    !Number.isFinite(completed)
  ) {
    return null;
  }

  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
}

/** Construye el texto accesible del recuento de una fase. */
export function buildProgressCount(
  completed: number,
  total: number | null,
  unit: TransferUnit,
  messages: MessageCatalog['transfer']['progress'],
  formats: Formatters,
): string {
  const safeCompleted = Math.max(0, Math.trunc(completed));
  const formattedCompleted = formats.formatNumber(safeCompleted);
  const hasTotal = total !== null && Number.isFinite(total) && total > 0;
  const formattedTotal = hasTotal
    ? formats.formatNumber(Math.trunc(total))
    : null;

  if (unit === 'files') {
    const pluralBase = hasTotal ? Math.trunc(total) : safeCompleted;
    const unitLabel = formats.plural(pluralBase, messages.files);

    return formattedTotal === null
      ? messages.filesOpen(formattedCompleted, unitLabel)
      : messages.filesCount(formattedCompleted, formattedTotal, unitLabel);
  }

  return formattedTotal === null
    ? messages.stepOpen(formattedCompleted)
    : messages.step(formattedCompleted, formattedTotal);
}

/** Formatea un tamaño en la unidad legible más cercana. */
export function formatBytes(size: number, formats: Formatters): string {
  const safeSize = Number.isFinite(size) && size > 0 ? Math.trunc(size) : 0;

  let value = safeSize;
  let unit: 'byte' | 'kilobyte' | 'megabyte' | 'gigabyte' = 'byte';

  if (safeSize >= 1024 ** 3) {
    value = safeSize / 1024 ** 3;
    unit = 'gigabyte';
  } else if (safeSize >= 1024 ** 2) {
    value = safeSize / 1024 ** 2;
    unit = 'megabyte';
  } else if (safeSize >= 1024) {
    value = safeSize / 1024;
    unit = 'kilobyte';
  }

  return formats.formatNumber(value, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: value < 10 ? 1 : 0,
    minimumFractionDigits: 0,
  });
}
