/**
 * Formatos regionales con `Intl`.
 *
 * Regla del ADR 0012: fechas, números, listas y plurales se resuelven con el
 * locale resuelto para la petición; no se concatenan frases visibles. Las
 * instancias de `Intl` se memoizan por locale y opciones porque construirlas es
 * la parte más costosa del formateo.
 *
 * Las fechas se interpretan y se muestran en **UTC** salvo que quien llama pida
 * otra zona explícitamente. Es la misma referencia que publica `/api/health`
 * (`timestamp` ISO), así que la página y el endpoint no se contradicen.
 */
import { defaultLocale, type Locale } from './locale';

/** Valor aceptado por los formateadores de fecha. */
export type DateInput = Date | number | string;

/** Formateadores ligados a un idioma. */
export type Formatters = {
  /** Fecha sin hora; `dateStyle: 'medium'` por defecto. */
  date: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string;
  /** Fecha y hora; `medium`/`short` por defecto. */
  dateTime: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string;
  /** Número con separadores del idioma. */
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Número con un decimal fijo (por ejemplo, un ratio de contraste). */
  decimal: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** «hace 2 días», «dentro de 3 horas»… */
  relativeTime: (
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options?: Intl.RelativeTimeFormatOptions,
  ) => string;
  /** Enumera valores con la conjunción del idioma. */
  list: (values: readonly string[], options?: Intl.ListFormatOptions) => string;
  /** Categoría plural (`one`, `other`…) para elegir la forma correcta. */
  plural: (
    count: number,
    options?: Intl.PluralRulesOptions,
  ) => Intl.LDMLPluralRule;
};

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();
const relativeTimeFormats = new Map<string, Intl.RelativeTimeFormat>();
const listFormats = new Map<string, Intl.ListFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();

function cacheKey(locale: string, options: object | undefined): string {
  return `${locale}|${options ? JSON.stringify(options) : ''}`;
}

function toDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/** Campos de fecha/hora que no se pueden mezclar con `dateStyle`/`timeStyle`. */
const EXPLICIT_DATE_FIELDS = [
  'weekday',
  'era',
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
  'fractionalSecondDigits',
  'timeZoneName',
] as const;

/**
 * Combina las opciones con el estilo por defecto.
 *
 * `Intl` prohíbe mezclar `dateStyle`/`timeStyle` con campos sueltos: si quien
 * llama pide un campo concreto (por ejemplo, el nombre de la zona), el estilo
 * por defecto no se añade.
 */
function resolveDateOptions(
  options: Intl.DateTimeFormatOptions | undefined,
  fallback: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatOptions {
  const hasExplicitFields =
    options !== undefined &&
    (options.dateStyle !== undefined ||
      options.timeStyle !== undefined ||
      EXPLICIT_DATE_FIELDS.some((field) => options[field] !== undefined));
  const merged = hasExplicitFields
    ? { ...options }
    : { ...fallback, ...options };

  return { ...merged, timeZone: merged.timeZone ?? 'UTC' };
}

function dateTimeFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions | undefined,
  fallback: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const resolved = resolveDateOptions(options, fallback);
  const key = cacheKey(locale, resolved);
  const cached = dateTimeFormats.get(key);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(locale, resolved);
  dateTimeFormats.set(key, formatter);

  return formatter;
}

function numberFormat(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = cacheKey(locale, options);
  const cached = numberFormats.get(key);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.NumberFormat(locale, options);
  numberFormats.set(key, formatter);

  return formatter;
}

function relativeTimeFormat(
  locale: string,
  options: Intl.RelativeTimeFormatOptions | undefined,
): Intl.RelativeTimeFormat {
  const resolved: Intl.RelativeTimeFormatOptions = {
    numeric: 'auto',
    ...options,
  };
  const key = cacheKey(locale, resolved);
  const cached = relativeTimeFormats.get(key);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.RelativeTimeFormat(locale, resolved);
  relativeTimeFormats.set(key, formatter);

  return formatter;
}

function listFormat(
  locale: string,
  options: Intl.ListFormatOptions | undefined,
): Intl.ListFormat {
  const resolved: Intl.ListFormatOptions = { type: 'conjunction', ...options };
  const key = cacheKey(locale, resolved);
  const cached = listFormats.get(key);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.ListFormat(locale, resolved);
  listFormats.set(key, formatter);

  return formatter;
}

/** Crea los formateadores de un idioma. */
export function createFormatters(locale: Locale = defaultLocale): Formatters {
  return {
    date: (value, options) => {
      const date = toDate(value);

      return date
        ? dateTimeFormat(locale, options, { dateStyle: 'medium' }).format(date)
        : '';
    },
    dateTime: (value, options) => {
      const date = toDate(value);

      return date
        ? dateTimeFormat(locale, options, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(date)
        : '';
    },
    number: (value, options) =>
      numberFormat(locale, options ?? {}).format(value),
    decimal: (value, options) =>
      numberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        ...options,
      }).format(value),
    relativeTime: (value, unit, options) =>
      relativeTimeFormat(locale, options).format(value, unit),
    list: (values, options) => listFormat(locale, options).format(values),
    plural: (count, options) => {
      const key = cacheKey(locale, options);
      const cached = pluralRules.get(key);

      if (cached) {
        return cached.select(count);
      }

      const rules = new Intl.PluralRules(locale, options);
      pluralRules.set(key, rules);

      return rules.select(count);
    },
  };
}
