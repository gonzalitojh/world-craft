import { describe, expect, it } from 'vitest';

import {
  ENTITY_COUNT_INITIAL,
  entityCountFromResult,
} from '@/renderer/lib/entity-count';
import type { EntitySummary } from '@/shared/contracts/entities';
import { ipcErr, ipcOk } from '@/shared/contracts/result';

/** Lista simulada: el recuento solo depende de su longitud. */
function summaries(count: number): readonly EntitySummary[] {
  return Object.freeze(
    Array.from({ length: count }, (_, index) => ({
      id: `entity-${index}`,
    })) as unknown as readonly EntitySummary[],
  );
}

describe('recuento de fichas de un mundo', () => {
  it('parte de un estado de carga sin recuento', () => {
    expect(ENTITY_COUNT_INITIAL).toEqual({
      state: 'loading',
      count: null,
      capped: false,
    });
  });

  it('cuenta cero fichas sin marcar el tope', () => {
    expect(entityCountFromResult(ipcOk(summaries(0)), 200)).toEqual({
      state: 'ready',
      count: 0,
      capped: false,
    });
  });

  it('cuenta tres fichas sin marcar el tope', () => {
    expect(entityCountFromResult(ipcOk(summaries(3)), 200)).toEqual({
      state: 'ready',
      count: 3,
      capped: false,
    });
  });

  it('marca el tope cuando la respuesta alcanza el límite', () => {
    expect(entityCountFromResult(ipcOk(summaries(200)), 200)).toEqual({
      state: 'ready',
      count: 200,
      capped: true,
    });
  });

  it('omite el recuento cuando la lectura falla', () => {
    expect(
      entityCountFromResult(
        ipcErr<readonly EntitySummary[]>('INTERNAL_ERROR'),
        200,
      ),
    ).toEqual({
      state: 'error',
      count: null,
      capped: false,
    });
  });

  it('no muta la lista recibida', () => {
    const data = summaries(3);
    const snapshot = Object.freeze({ ok: true as const, data });

    entityCountFromResult(snapshot, 200);

    expect(snapshot.data).toBe(data);
    expect(data).toHaveLength(3);
    expect(data[0]?.id).toBe('entity-0');
  });
});
