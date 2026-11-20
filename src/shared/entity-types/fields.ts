/**
 * Validación compartida de plantillas y valores de los campos de entidad.
 *
 * La plantilla se valida con Zod en el proceso principal antes de guardarla y
 * en la interfaz antes de enviarla. Los valores de una ficha se validan con la
 * misma plantilla y devuelven un código por clave de campo, sin textos
 * visibles: el renderer resuelve el mensaje en su catálogo.
 *
 * Este módulo importa Zod, pero no Electron ni Node, así que puede usarse desde
 * el proceso principal, el renderer y las pruebas.
 */
import { z } from 'zod';

import {
  ENTITY_FIELD_KEY_MAX_LENGTH,
  ENTITY_FIELD_LABEL_MAX_LENGTH,
  ENTITY_REFERENCE_VALUE_MAX_LENGTH,
  ENTITY_SELECT_OPTION_LABEL_MAX_LENGTH,
  ENTITY_SELECT_OPTION_VALUE_MAX_LENGTH,
  ENTITY_SELECT_OPTIONS_MAX,
  ENTITY_TEXT_MAX_LENGTH,
  ENTITY_TYPE_FIELDS_MAX,
  ENTITY_TYPE_KEY_MAX_LENGTH,
  ENTITY_TYPE_KEY_PATTERN,
  type EntityFieldDefinition,
} from '../contracts/entity-types';

const fieldKeySchema = z
  .string()
  .min(1)
  .max(ENTITY_FIELD_KEY_MAX_LENGTH)
  .regex(ENTITY_TYPE_KEY_PATTERN);

const fieldLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(ENTITY_FIELD_LABEL_MAX_LENGTH);

const selectOptionSchema = z.strictObject({
  value: z
    .string()
    .min(1)
    .max(ENTITY_SELECT_OPTION_VALUE_MAX_LENGTH)
    .regex(ENTITY_TYPE_KEY_PATTERN),
  label: z.string().trim().min(1).max(ENTITY_SELECT_OPTION_LABEL_MAX_LENGTH),
});

const textFieldSchema = z.strictObject({
  key: fieldKeySchema,
  label: fieldLabelSchema,
  type: z.literal('text'),
  required: z.boolean(),
  maxLength: z.number().int().min(1).max(ENTITY_TEXT_MAX_LENGTH).optional(),
});

const numberFieldSchema = z
  .strictObject({
    key: fieldKeySchema,
    label: fieldLabelSchema,
    type: z.literal('number'),
    required: z.boolean(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  })
  .refine(
    (field) =>
      field.min === undefined ||
      field.max === undefined ||
      field.min <= field.max,
    { message: 'El mínimo no puede superar el máximo.' },
  );

const dateFieldSchema = z.strictObject({
  key: fieldKeySchema,
  label: fieldLabelSchema,
  type: z.literal('date'),
  required: z.boolean(),
});

const selectFieldSchema = z
  .strictObject({
    key: fieldKeySchema,
    label: fieldLabelSchema,
    type: z.literal('select'),
    required: z.boolean(),
    options: z.array(selectOptionSchema).min(1).max(ENTITY_SELECT_OPTIONS_MAX),
  })
  .refine(
    (field) =>
      new Set(field.options.map((option) => option.value)).size ===
      field.options.length,
    { message: 'Las opciones de selección no pueden repetir su valor.' },
  );

const referenceFieldSchema = z.strictObject({
  key: fieldKeySchema,
  label: fieldLabelSchema,
  type: z.literal('reference'),
  required: z.boolean(),
  targetTypeKey: z
    .string()
    .min(1)
    .max(ENTITY_TYPE_KEY_MAX_LENGTH)
    .regex(ENTITY_TYPE_KEY_PATTERN)
    .optional(),
});

const entityFieldSchema = z.discriminatedUnion('type', [
  textFieldSchema,
  numberFieldSchema,
  dateFieldSchema,
  selectFieldSchema,
  referenceFieldSchema,
]);

/**
 * Plantilla de campos de un tipo.
 *
 * Las claves son únicas para que el JSON de valores no se pise y el orden se
 * conserva para que la ficha muestre los campos en el orden definido.
 */
export const entityFieldTemplateSchema = z
  .array(entityFieldSchema)
  .max(ENTITY_TYPE_FIELDS_MAX)
  .refine(
    (fields) =>
      new Set(fields.map((field) => field.key)).size === fields.length,
    { message: 'Los campos no pueden repetir su clave.' },
  );

export type EntityFieldTemplate = z.infer<typeof entityFieldTemplateSchema>;

/** Valor guardable de un campo. */
export type EntityFieldValue = string | number;

/** Códigos de error de valor, asociados siempre a la clave del campo. */
export type EntityFieldValueErrorCode =
  | 'required'
  | 'unknown-field'
  | 'invalid-text'
  | 'text-too-long'
  | 'invalid-number'
  | 'number-too-small'
  | 'number-too-large'
  | 'invalid-date'
  | 'invalid-option'
  | 'invalid-reference';

/** Error de un valor concreto. */
export interface EntityFieldValueError {
  readonly fieldKey: string;
  readonly code: EntityFieldValueErrorCode;
}

/** Resultado de validar los valores de una ficha. */
export type EntityFieldValuesResult =
  | {
      readonly ok: true;
      readonly values: Readonly<Record<string, EntityFieldValue>>;
    }
  | {
      readonly ok: false;
      readonly errors: readonly EntityFieldValueError[];
    };

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);

  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // `Date.UTC` interpreta los años 0–99 como 1900–1999; `setUTCFullYear`
  // conserva el año literal y permite validar fechas ISO antiguas.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim().length === 0)
  );
}

/**
 * Valida y normaliza los valores de una ficha.
 *
 * Los valores opcionales vacíos se omiten del resultado; los desconocidos se
 * rechazan para que el JSON no acumule datos que la plantilla ya no define. El
 * resultado correcto contiene solo claves de la plantilla y valores del tipo
 * esperado.
 */
export function validateEntityFieldValues(
  fields: readonly EntityFieldDefinition[],
  values: Readonly<Record<string, unknown>>,
): EntityFieldValuesResult {
  const errors: EntityFieldValueError[] = [];
  const normalized: Record<string, EntityFieldValue> = {};
  const fieldKeys = new Set(fields.map((field) => field.key));

  for (const key of Object.keys(values)) {
    if (!fieldKeys.has(key)) {
      errors.push({ fieldKey: key, code: 'unknown-field' });
    }
  }

  for (const field of fields) {
    const value = values[field.key];

    if (isEmpty(value)) {
      if (field.required) {
        errors.push({ fieldKey: field.key, code: 'required' });
      }

      continue;
    }

    switch (field.type) {
      case 'text': {
        if (typeof value !== 'string') {
          errors.push({ fieldKey: field.key, code: 'invalid-text' });
          break;
        }

        const maxLength = field.maxLength ?? ENTITY_TEXT_MAX_LENGTH;

        if (value.length > maxLength) {
          errors.push({ fieldKey: field.key, code: 'text-too-long' });
          break;
        }

        normalized[field.key] = value;
        break;
      }

      case 'number': {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          errors.push({ fieldKey: field.key, code: 'invalid-number' });
          break;
        }

        if (field.min !== undefined && value < field.min) {
          errors.push({ fieldKey: field.key, code: 'number-too-small' });
          break;
        }

        if (field.max !== undefined && value > field.max) {
          errors.push({ fieldKey: field.key, code: 'number-too-large' });
          break;
        }

        normalized[field.key] = value;
        break;
      }

      case 'date': {
        if (typeof value !== 'string' || !isIsoDate(value)) {
          errors.push({ fieldKey: field.key, code: 'invalid-date' });
          break;
        }

        normalized[field.key] = value;
        break;
      }

      case 'select': {
        if (
          typeof value !== 'string' ||
          !field.options.some((option) => option.value === value)
        ) {
          errors.push({ fieldKey: field.key, code: 'invalid-option' });
          break;
        }

        normalized[field.key] = value;
        break;
      }

      case 'reference': {
        if (
          typeof value !== 'string' ||
          value.length === 0 ||
          value.length > ENTITY_REFERENCE_VALUE_MAX_LENGTH
        ) {
          errors.push({ fieldKey: field.key, code: 'invalid-reference' });
          break;
        }

        normalized[field.key] = value;
        break;
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, values: normalized };
}
