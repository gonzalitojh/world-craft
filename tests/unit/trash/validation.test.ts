import { describe, expect, it } from 'vitest';

import {
  TRASH_PAGE_LIMIT_DEFAULT,
  TRASH_PAGE_LIMIT_MAX,
} from '@/shared/contracts/trash';

import {
  encodeTrashCursor,
  nextTrashCursor,
  normalizeTrashLimit,
  parseTrashCursor,
} from '@/main/trash/validation';

const ID = '01900000-0000-7000-8000-000000000001';

describe('normalización de la papelera', () => {
  it('codifica y decodifica el cursor opaco', () => {
    const cursor = encodeTrashCursor({ deletedAt: 1_760_000_000_000, id: ID });

    expect(cursor).toBe(`1760000000000:${ID}`);
    expect(parseTrashCursor(cursor)).toEqual({
      deletedAt: 1_760_000_000_000,
      id: ID,
    });
    expect(parseTrashCursor(undefined)).toBeNull();
    expect(parseTrashCursor('sin-separador')).toBeNull();
    expect(parseTrashCursor(`nope:${ID}`)).toBeNull();
    expect(parseTrashCursor('1:no-es-un-id')).toBeNull();
  });

  it('acota el límite y calcula el cursor siguiente', () => {
    expect(normalizeTrashLimit(undefined)).toBe(TRASH_PAGE_LIMIT_DEFAULT);
    expect(normalizeTrashLimit(0)).toBe(1);
    expect(normalizeTrashLimit(10_000)).toBe(TRASH_PAGE_LIMIT_MAX);
    expect(normalizeTrashLimit(3.9)).toBe(3);

    const rows = [
      { deletedAt: 3, id: ID },
      { deletedAt: 2, id: ID },
    ];

    expect(nextTrashCursor(rows, 2)).toBe(`2:${ID}`);
    expect(nextTrashCursor(rows, 3)).toBeNull();
    expect(nextTrashCursor([], 2)).toBeNull();
  });
});
