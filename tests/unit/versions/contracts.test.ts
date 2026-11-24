import { describe, expect, it } from 'vitest';

import {
  isEntityVersionList,
  isEntityVersionSummary,
  isVersionCreateResult,
  isVersionRestoreResult,
} from '@/shared/contracts/versions';

import {
  versionCreatePayloadSchema,
  versionListPayloadSchema,
  versionRestorePayloadSchema,
} from '@/main/ipc/schemas/versions';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const ENTITY_ID = '01900000-0000-7000-8000-000000000002';
const VERSION_ID = '01900000-0000-7000-8000-000000000003';

const summary = {
  id: VERSION_ID,
  entityId: ENTITY_ID,
  origin: 'auto' as const,
  label: null,
  createdAt: 1_760_000_000_000,
  descriptionTextPreview: 'Texto anterior',
};

describe('contrato de versiones', () => {
  it('valida metadatos, listas y resultados', () => {
    expect(isEntityVersionSummary(summary)).toBe(true);
    expect(isEntityVersionSummary({ ...summary, origin: 'inventado' })).toBe(
      false,
    );
    expect(isEntityVersionList([summary])).toBe(true);
    expect(isEntityVersionList([{ ...summary, createdAt: -1 }])).toBe(false);
    expect(isVersionCreateResult({ created: true, version: summary })).toBe(
      true,
    );
    expect(
      isVersionCreateResult({ created: false, reason: 'manual-limit' }),
    ).toBe(true);
    expect(
      isVersionCreateResult({ created: false, reason: 'backup-failed' }),
    ).toBe(false);
    expect(isVersionRestoreResult({ restored: true })).toBe(true);
    expect(
      isVersionRestoreResult({ restored: false, reason: 'unchanged' }),
    ).toBe(true);
    expect(
      isVersionRestoreResult({ restored: false, reason: 'world-in-trash' }),
    ).toBe(false);
  });
});

describe('esquemas Zod de versiones', () => {
  it('valida lista, creación con etiqueta y restauración', () => {
    expect(
      versionListPayloadSchema.safeParse({
        worldId: WORLD_ID,
        entityId: ENTITY_ID,
        limit: 10,
      }).success,
    ).toBe(true);
    expect(
      versionListPayloadSchema.safeParse({
        worldId: WORLD_ID,
        entityId: ENTITY_ID,
        limit: 0,
      }).success,
    ).toBe(false);

    const created = versionCreatePayloadSchema.safeParse({
      worldId: WORLD_ID,
      entityId: ENTITY_ID,
      label: '  Antes de reescribir  ',
    });

    expect(created.success).toBe(true);
    expect(created.success ? created.data.label : '').toBe(
      'Antes de reescribir',
    );
    expect(
      versionCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        entityId: ENTITY_ID,
        label: '   ',
      }).success,
    ).toBe(false);
    expect(
      versionCreatePayloadSchema.safeParse({
        worldId: WORLD_ID,
        entityId: ENTITY_ID,
        label: 'x'.repeat(121),
      }).success,
    ).toBe(false);

    expect(
      versionRestorePayloadSchema.safeParse({
        worldId: WORLD_ID,
        entityId: ENTITY_ID,
        versionId: VERSION_ID,
      }).success,
    ).toBe(true);
    expect(
      versionRestorePayloadSchema.safeParse({
        worldId: WORLD_ID,
        entityId: ENTITY_ID,
        versionId: 'nope',
      }).success,
    ).toBe(false);
  });
});
