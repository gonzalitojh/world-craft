import { describe, expect, it } from 'vitest';

import type { EntityFieldDefinition } from '@/shared/contracts/entity-types';
import {
  entityFieldTemplateSchema,
  validateEntityFieldValues,
} from '@/shared/entity-types/fields';

const template: readonly EntityFieldDefinition[] = [
  {
    key: 'name',
    label: 'Nombre',
    type: 'text',
    required: true,
    maxLength: 10,
  },
  {
    key: 'age',
    label: 'Edad',
    type: 'number',
    required: false,
    min: 0,
    max: 120,
  },
  { key: 'birth', label: 'Nacimiento', type: 'date', required: false },
  {
    key: 'status',
    label: 'Estado',
    type: 'select',
    required: false,
    options: [
      { value: 'alive', label: 'Vivo' },
      { value: 'dead', label: 'Muerto' },
    ],
  },
  {
    key: 'mentor',
    label: 'Mentor',
    type: 'reference',
    required: false,
    targetTypeKey: 'character',
  },
];

describe('plantilla de campos', () => {
  it('acepta los cinco tipos de campo', () => {
    expect(entityFieldTemplateSchema.safeParse(template).success).toBe(true);
  });

  it('rechaza claves repetidas', () => {
    const result = entityFieldTemplateSchema.safeParse([
      { key: 'name', label: 'Nombre', type: 'text', required: false },
      { key: 'name', label: 'Otro', type: 'date', required: false },
    ]);

    expect(result.success).toBe(false);
  });

  it('rechaza una selección sin opciones o con valores repetidos', () => {
    expect(
      entityFieldTemplateSchema.safeParse([
        {
          key: 'status',
          label: 'Estado',
          type: 'select',
          required: false,
          options: [],
        },
      ]).success,
    ).toBe(false);

    expect(
      entityFieldTemplateSchema.safeParse([
        {
          key: 'status',
          label: 'Estado',
          type: 'select',
          required: false,
          options: [
            { value: 'alive', label: 'Vivo' },
            { value: 'alive', label: 'Otro' },
          ],
        },
      ]).success,
    ).toBe(false);
  });

  it('rechaza un rango numérico invertido y propiedades desconocidas', () => {
    expect(
      entityFieldTemplateSchema.safeParse([
        {
          key: 'age',
          label: 'Edad',
          type: 'number',
          required: false,
          min: 10,
          max: 1,
        },
      ]).success,
    ).toBe(false);

    expect(
      entityFieldTemplateSchema.safeParse([
        {
          key: 'name',
          label: 'Nombre',
          type: 'text',
          required: false,
          extra: true,
        },
      ]).success,
    ).toBe(false);
  });

  it('limita el número de campos y valida la clave', () => {
    const fields = Array.from({ length: 31 }, (_, index) => ({
      key: `field-${index}`,
      label: `Campo ${index}`,
      type: 'text' as const,
      required: false,
    }));

    expect(entityFieldTemplateSchema.safeParse(fields).success).toBe(false);

    expect(
      entityFieldTemplateSchema.safeParse([
        { key: 'Con Mayúsculas', label: 'X', type: 'text', required: false },
      ]).success,
    ).toBe(false);
  });
});

describe('validación de valores', () => {
  it('normaliza valores válidos y omite los opcionales vacíos', () => {
    expect(
      validateEntityFieldValues(template, {
        name: 'Aria',
        age: 42,
        birth: '2024-02-29',
        status: 'alive',
        mentor: '01900000-0000-7000-8000-000000000001',
      }),
    ).toEqual({
      ok: true,
      values: {
        name: 'Aria',
        age: 42,
        birth: '2024-02-29',
        status: 'alive',
        mentor: '01900000-0000-7000-8000-000000000001',
      },
    });

    expect(
      validateEntityFieldValues(template, {
        name: 'Aria',
        age: null,
        birth: '   ',
      }),
    ).toEqual({ ok: true, values: { name: 'Aria' } });
  });

  it('asocia cada error a la clave del campo', () => {
    const result = validateEntityFieldValues(template, {
      name: 'Nombre demasiado largo',
      age: -1,
      birth: '2023-02-29',
      status: 'unknown',
      mentor: '',
      extra: 'no',
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error('Se esperaba un resultado con errores.');
    }

    expect(result.errors).toEqual(
      expect.arrayContaining([
        { fieldKey: 'name', code: 'text-too-long' },
        { fieldKey: 'age', code: 'number-too-small' },
        { fieldKey: 'birth', code: 'invalid-date' },
        { fieldKey: 'status', code: 'invalid-option' },
        { fieldKey: 'extra', code: 'unknown-field' },
      ]),
    );
  });

  it('acepta fechas ISO con años de uno a tres dígitos', () => {
    const dateField = [
      {
        key: 'birth',
        label: 'Nacimiento',
        type: 'date' as const,
        required: true,
      },
    ];

    expect(
      validateEntityFieldValues(dateField, { birth: '0050-01-01' }),
    ).toEqual({ ok: true, values: { birth: '0050-01-01' } });
    expect(
      validateEntityFieldValues(dateField, { birth: '0099-12-31' }),
    ).toEqual({ ok: true, values: { birth: '0099-12-31' } });
    expect(
      validateEntityFieldValues(dateField, { birth: '0000-02-29' }),
    ).toEqual({ ok: true, values: { birth: '0000-02-29' } });
    expect(
      validateEntityFieldValues(dateField, { birth: '0100-02-29' }),
    ).toEqual({
      ok: false,
      errors: [{ fieldKey: 'birth', code: 'invalid-date' }],
    });
  });

  it('distingue tipos inválidos, obligatorios y rangos', () => {
    expect(validateEntityFieldValues(template, {})).toEqual({
      ok: false,
      errors: [{ fieldKey: 'name', code: 'required' }],
    });

    expect(
      validateEntityFieldValues(template, { name: 'Aria', age: '42' }),
    ).toEqual({
      ok: false,
      errors: [{ fieldKey: 'age', code: 'invalid-number' }],
    });

    expect(
      validateEntityFieldValues(template, { name: 'Aria', age: 121 }),
    ).toEqual({
      ok: false,
      errors: [{ fieldKey: 'age', code: 'number-too-large' }],
    });

    expect(validateEntityFieldValues(template, { name: 42 })).toEqual({
      ok: false,
      errors: [{ fieldKey: 'name', code: 'invalid-text' }],
    });

    expect(
      validateEntityFieldValues(template, {
        name: 'Aria',
        mentor: 'x'.repeat(65),
      }),
    ).toEqual({
      ok: false,
      errors: [{ fieldKey: 'mentor', code: 'invalid-reference' }],
    });
  });
});
