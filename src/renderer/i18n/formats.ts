/**
 * Formatos localizados con `Intl`.
 *
 * Las fechas se guardan en UTC y aquí se muestran en la zona del equipo. Los
 * números, porcentajes, listas y plurales usan el locale del perfil; ningún
 * componente concatena fragmentos ni decide plurales con `if`.
 */
import { toIntlLocale, type Locale } from '../../shared/contracts/locale';

/** Formas de plural admitidas por `Intl.PluralRules`. */
export interface PluralForms {
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
}

/** Utilidades de formato ligadas a un idioma. */
export interface Formatters {
  readonly locale: Locale;
  readonly intlLocale: string;
  readonly formatDate: (
    value: Date | number | string,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  readonly formatDateTime: (
    value: Date | number | string,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  readonly formatNumber: (
    value: number,
    options?: Intl.NumberFormatOptions,
  ) => string;
  readonly formatPercent: (
    value: number,
    options?: Intl.NumberFormatOptions,
  ) => string;
  /** Formatea un tamaño en la unidad legible más cercana. */
  readonly formatBytes: (size: number) => string;
  readonly formatList: (
    values: readonly string[],
    options?: Intl.ListFormatOptions,
  ) => string;
  /**
   * Distancia relativa entre `value` y `now` con `Intl.RelativeTimeFormat`.
   *
   * `now` se puede inyectar para que las pruebas sean deterministas; por
   * defecto usa el reloj del equipo. Las fechas futuras se recortan a «ahora».
   */
  readonly formatRelativeTime: (
    value: Date | number | string,
    now?: number,
  ) => string;
  readonly plural: (count: number, forms: PluralForms) => string;
  readonly compare: (left: string, right: string) => number;
}

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
};

const DEFAULT_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
};

const DEFAULT_PERCENT_OPTIONS: Intl.NumberFormatOptions = {
  style: 'percent',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
};

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function toDate(value: Date | number | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Redondeo mínimo de una unidad para no pintar «hace 0 minutos». */
function units(delta: number, size: number): number {
  return Math.max(1, Math.round(delta / size));
}

/**
 * Crea los formateadores de un idioma.
 *
 * Es una función pura y sin caché: los formateadores de `Intl` se construyen
 * bajo demanda y el proveedor memoiza el objeto completo por locale.
 */
export function createFormatters(locale: Locale): Formatters {
  const intlLocale = toIntlLocale(locale);
  const pluralRules = new Intl.PluralRules(intlLocale);
  const collator = new Intl.Collator(intlLocale);
  const relativeFormat = new Intl.RelativeTimeFormat(intlLocale, {
    numeric: 'auto',
  });

  const formatDate = (
    value: Date | number | string,
    options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
  ): string =>
    new Intl.DateTimeFormat(intlLocale, options).format(toDate(value));

  const formatNumber = (
    value: number,
    options?: Intl.NumberFormatOptions,
  ): string => new Intl.NumberFormat(intlLocale, options).format(value);

  const formatBytes = (size: number): string => {
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

    return formatNumber(value, {
      style: 'unit',
      unit,
      unitDisplay: 'short',
      maximumFractionDigits: value < 10 ? 1 : 0,
      minimumFractionDigits: 0,
    });
  };

  const formatRelativeTime = (
    value: Date | number | string,
    now: number = Date.now(),
  ): string => {
    // Un reloj desfasado no debe producir «dentro de 2 horas» en una ficha.
    const delta = Math.max(0, now - toDate(value).getTime());

    if (delta < 45 * SECOND) {
      return relativeFormat.format(0, 'second');
    }

    if (delta < 45 * MINUTE) {
      return relativeFormat.format(-units(delta, MINUTE), 'minute');
    }

    if (delta < 22 * HOUR) {
      return relativeFormat.format(-units(delta, HOUR), 'hour');
    }

    if (delta < 6 * DAY) {
      return relativeFormat.format(-units(delta, DAY), 'day');
    }

    if (delta < 4 * WEEK) {
      return relativeFormat.format(-units(delta, WEEK), 'week');
    }

    if (delta < 11 * MONTH) {
      return relativeFormat.format(-units(delta, MONTH), 'month');
    }

    return relativeFormat.format(-units(delta, YEAR), 'year');
  };

  return {
    locale,
    intlLocale,
    formatDate,
    formatDateTime: (value, options = DEFAULT_DATE_TIME_OPTIONS) =>
      formatDate(value, options),
    formatRelativeTime,
    formatNumber,
    formatBytes,
    formatPercent: (value, options = DEFAULT_PERCENT_OPTIONS) =>
      new Intl.NumberFormat(intlLocale, options).format(value),
    formatList: (values, options) =>
      new Intl.ListFormat(intlLocale, options).format(values),
    plural: (count, forms) => {
      const rule = pluralRules.select(count);
      const template = forms[rule] ?? forms.other;

      return template.replace(
        '{count}',
        new Intl.NumberFormat(intlLocale).format(count),
      );
    },
    compare: (left, right) => collator.compare(left, right),
  };
}
