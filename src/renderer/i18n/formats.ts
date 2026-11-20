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
  readonly formatList: (
    values: readonly string[],
    options?: Intl.ListFormatOptions,
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

function toDate(value: Date | number | string): Date {
  return value instanceof Date ? value : new Date(value);
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

  const formatDate = (
    value: Date | number | string,
    options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
  ): string =>
    new Intl.DateTimeFormat(intlLocale, options).format(toDate(value));

  return {
    locale,
    intlLocale,
    formatDate,
    formatDateTime: (value, options = DEFAULT_DATE_TIME_OPTIONS) =>
      formatDate(value, options),
    formatNumber: (value, options) =>
      new Intl.NumberFormat(intlLocale, options).format(value),
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
