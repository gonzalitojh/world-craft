import { describe, expect, it } from 'vitest';

import {
  TRASH_EMPTY_CONFIRMATION,
  TRASH_PURGE_CONFIRMATION,
  isTrashEmptyResult,
  isTrashItem,
  isTrashPage,
  isTrashPurgeResult,
  isTrashRestoreResult,
} from '@/shared/contracts/trash';

import {
  trashEmptyPayloadSchema,
  trashListPayloadSchema,
  trashPurgePayloadSchema,
  trashRestorePayloadSchema,
} from '@/main/ipc/schemas/trash';

const WORLD_ID = '01900000-0000-7000-8000-000000000001';
const ENTITY_ID = '01900000-0000-7000-8000-000000000002';
const TYPE_ID = '01900000-0000-7000-8000-000000000003';

describe('contrato de papelera', () => {
  it('acepta los tres tipos de elemento y rechaza formas incompletas', () => {
    expect(
      isTrashItem({
        kind: 'world',
        id: WORLD_ID,
        name: 'Las Mareas Grises',
        deletedAt: 1,
      }),
    ).toBe(true);
    expect(
      isTrashItem({
        kind: 'entity',
        id: ENTITY_ID,
        name: 'Mara',
        worldId: WORLD_ID,
        worldName: 'Las Mareas Grises',
        typeName: 'Personaje',
        worldDeletedAt: null,
        deletedAt: 1,
      }),
    ).toBe(true);
    expect(
      isTrashItem({
        kind: 'entityType',
        id: TYPE_ID,
        name: 'Reliquia',
        worldId: WORLD_ID,
        worldName: 'Las Mareas Grises',
        key: 'reliquia',
        worldDeletedAt: 1,
        deletedAt: 2,
      }),
    ).toBe(true);
    expect(isTrashItem({ kind: 'entity', id: ENTITY_ID })).toBe(false);
    expect(isTrashItem({ kind: 'map', id: ENTITY_ID })).toBe(false);
  });

  it('valida páginas, restauraciones, purgas y vaciados', () => {
    expect(
      isTrashPage({
        items: [
          {
            kind: 'world',
            id: WORLD_ID,
            name: 'Mundo',
            deletedAt: 1,
          },
        ],
        nextCursor: '1:01900000-0000-7000-8000-000000000001',
      }),
    ).toBe(true);
    expect(isTrashPage({ items: [{}], nextCursor: null })).toBe(false);
    expect(isTrashRestoreResult({ restored: true })).toBe(true);
    expect(
      isTrashRestoreResult({ restored: false, reason: 'world-in-trash' }),
    ).toBe(true);
    expect(isTrashRestoreResult({ restored: false, reason: 'inventado' })).toBe(
      false,
    );
    expect(isTrashPurgeResult({ purged: true })).toBe(true);
    expect(isTrashPurgeResult({ purged: false, reason: 'backup-failed' })).toBe(
      true,
    );
    expect(isTrashPurgeResult({ purged: false, reason: 'assets-in-use' })).toBe(
      true,
    );
    expect(isTrashPurgeResult({ purged: false, reason: 'nope' })).toBe(false);
    expect(
      isTrashEmptyResult({
        backup: 'created',
        purged: { worlds: 1, entities: 2, entityTypes: 0 },
        skipped: 0,
      }),
    ).toBe(true);
    expect(
      isTrashEmptyResult({ backup: 'created', purged: {}, skipped: 0 }),
    ).toBe(false);
  });
});

describe('esquemas Zod de papelera', () => {
  it('valida grupo, cursor y límite', () => {
    expect(
      trashListPayloadSchema.safeParse({
        group: 'entities',
        cursor: '1760000000000:01900000-0000-7000-8000-000000000001',
        limit: 200,
      }).success,
    ).toBe(true);
    expect(trashListPayloadSchema.safeParse({ group: 'maps' }).success).toBe(
      false,
    );
    expect(
      trashListPayloadSchema.safeParse({ group: 'worlds', limit: 201 }).success,
    ).toBe(false);
    expect(
      trashListPayloadSchema.safeParse({ group: 'worlds', cursor: 'nope' })
        .success,
    ).toBe(false);
    expect(
      trashListPayloadSchema.safeParse({ group: 'worlds', extra: true })
        .success,
    ).toBe(false);
  });

  it('exige identificadores y literales de confirmación', () => {
    expect(
      trashRestorePayloadSchema.safeParse({ kind: 'entity', id: ENTITY_ID })
        .success,
    ).toBe(true);
    expect(
      trashRestorePayloadSchema.safeParse({ kind: 'entity', id: 'nope' })
        .success,
    ).toBe(false);
    expect(
      trashPurgePayloadSchema.safeParse({
        kind: 'world',
        id: WORLD_ID,
        confirm: TRASH_PURGE_CONFIRMATION,
      }).success,
    ).toBe(true);
    expect(
      trashPurgePayloadSchema.safeParse({
        kind: 'world',
        id: WORLD_ID,
        confirm: 'si',
      }).success,
    ).toBe(false);
    expect(
      trashEmptyPayloadSchema.safeParse({
        confirm: TRASH_EMPTY_CONFIRMATION,
      }).success,
    ).toBe(true);
    expect(trashEmptyPayloadSchema.safeParse({ confirm: true }).success).toBe(
      false,
    );
  });
});
