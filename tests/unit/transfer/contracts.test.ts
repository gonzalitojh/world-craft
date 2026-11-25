import { describe, expect, it } from 'vitest';

import {
  TRANSFER_ERROR_CODES,
  TRANSFER_FORMAT,
  TRANSFER_FORMAT_VERSION,
  TRANSFER_MAX_ENTITIES,
  TRANSFER_EVENT_CHANNEL,
  TRANSFER_MAX_ZIP_BYTES,
  TRANSFER_PHASES,
  TRANSFER_UNITS,
  TRANSFER_WARNING_CODES,
  isTransferCancelResult,
  isTransferCounts,
  isTransferErrorCode,
  isTransferEvent,
  isTransferExportResult,
  isTransferExportRunResult,
  isTransferFileName,
  isTransferImportResult,
  isTransferImportRunResult,
  isTransferOperation,
  isTransferPhase,
  isTransferProgressEvent,
  isTransferRunResult,
  isTransferUnit,
  isTransferWarning,
  isTransferWarningCode,
} from '@/shared/contracts/transfer';
import { IPC_CHANNEL_LIST } from '@/shared/contracts/channels';
import {
  RELATION_TYPE_TRANSFER_VERSION,
  isRelationTypeTransfer,
} from '@/shared/contracts/relations';
import {
  WORLD_ACTIVITY_ACTIONS,
  isWorldActivityAction,
} from '@/shared/contracts/worlds';

describe('contrato de transferencia', () => {
  it('fija el formato, las fases y los límites aprobados', () => {
    expect(TRANSFER_FORMAT).toBe('world-craft-world');
    expect(TRANSFER_FORMAT_VERSION).toBe(1);
    expect(TRANSFER_PHASES).toContain('importing');
    expect(TRANSFER_PHASES).toContain('saving');
    expect(TRANSFER_MAX_ZIP_BYTES).toBe(8 * 1024 ** 3);
    expect(TRANSFER_MAX_ENTITIES).toBe(50_000);
    expect(TRANSFER_ERROR_CODES).toContain('TRANSFER_CANCELLED');
    expect(TRANSFER_ERROR_CODES).toContain('TRANSFER_UNAVAILABLE');
    expect(TRANSFER_ERROR_CODES).toHaveLength(17);
    expect(TRANSFER_WARNING_CODES).toContain('broken-entity-link');
    expect(TRANSFER_UNITS).toEqual(['files', 'steps']);
    expect(TRANSFER_EVENT_CHANNEL).toBe('transfer:event');
    expect(IPC_CHANNEL_LIST).not.toContain(TRANSFER_EVENT_CHANNEL);
  });

  it('reconoce operaciones, fases, avisos y errores', () => {
    expect(isTransferOperation('export')).toBe(true);
    expect(isTransferOperation('import')).toBe(true);
    expect(isTransferOperation('move')).toBe(false);
    expect(isTransferPhase('extracting')).toBe(true);
    expect(isTransferPhase('done')).toBe(false);
    expect(isTransferWarningCode('missing-tag')).toBe(true);
    expect(isTransferWarningCode('other')).toBe(false);
    expect(isTransferErrorCode('TRANSFER_BUSY')).toBe(true);
    expect(isTransferErrorCode('BOOM')).toBe(false);
  });

  it('valida eventos sin datos internos', () => {
    const event = {
      operation: 'import',
      phase: 'extracting',
      completed: 3,
      total: 10,
      warnings: 1,
    };

    expect(isTransferEvent(event)).toBe(true);
    expect(isTransferEvent({ ...event, completed: -1 })).toBe(false);
    expect(isTransferEvent({ ...event, total: 'muchos' })).toBe(false);
  });

  it('valida unidades, nombres de archivo y eventos de progreso', () => {
    expect(isTransferUnit('files')).toBe(true);
    expect(isTransferUnit('steps')).toBe(true);
    expect(isTransferUnit('items')).toBe(false);
    expect(isTransferFileName('mundo.zip')).toBe(true);
    expect(isTransferFileName('mundo..zip')).toBe(true);
    expect(isTransferFileName('.')).toBe(false);
    expect(isTransferFileName('..')).toBe(false);
    expect(isTransferFileName('../mundo.zip')).toBe(false);
    expect(isTransferFileName('C:\\mundo.zip')).toBe(false);
    expect(isTransferFileName('carpeta/mundo.zip')).toBe(false);
    expect(isTransferFileName('mundo:zip')).toBe(false);
    expect(isTransferFileName('mundo\0.zip')).toBe(false);

    const event = {
      operation: 'export',
      operationId: '018f1000-0000-7000-8000-000000000001',
      phase: 'packaging',
      unit: 'files',
      cancelable: true,
      completed: 1,
      total: 2,
      warnings: 0,
    };

    expect(isTransferProgressEvent(event)).toBe(true);
    expect(isTransferProgressEvent({ ...event, unit: 'items' })).toBe(false);
    expect(
      isTransferProgressEvent({ ...event, operationId: 'no-es-uuid' }),
    ).toBe(false);
    expect(isTransferProgressEvent({ ...event, cancelable: 'sí' })).toBe(false);
  });

  it('valida avisos, recuentos y resultados', () => {
    expect(isTransferWarning({ code: 'missing-tag', count: 2 })).toBe(true);
    expect(isTransferWarning({ code: 'missing-tag', count: 0 })).toBe(true);
    expect(isTransferWarning({ code: 'missing-tag', count: -1 })).toBe(false);

    const counts = {
      entities: 2,
      entityTypes: 1,
      relationTypes: 1,
      tags: 2,
      relations: 3,
      versions: 2,
      assets: 5,
    };

    expect(isTransferCounts(counts)).toBe(true);
    expect(isTransferCounts({ ...counts, assets: -1 })).toBe(false);

    expect(
      isTransferExportResult({
        worldId: '018f1000-0000-7000-8000-000000000001',
        worldName: 'Mundo',
        fileName: 'mundo.zip',
        size: 10,
        counts,
        warnings: [],
      }),
    ).toBe(true);

    expect(
      isTransferImportResult({
        worldId: '018f1000-0000-7000-8000-000000000001',
        worldName: 'Mundo',
        slug: 'mundo-2',
        slugAdjusted: true,
        counts,
        warnings: [],
      }),
    ).toBe(true);

    expect(isTransferCancelResult({ cancelled: true })).toBe(true);
    expect(isTransferCancelResult({ cancelled: 'sí' })).toBe(false);

    expect(
      isTransferExportResult({
        worldId: '018f1000-0000-7000-8000-000000000001',
        worldName: 'Mundo',
        fileName: '../mundo.zip',
        size: 10,
        counts,
        warnings: [],
      }),
    ).toBe(false);
  });

  it('valida el resultado de extremo a extremo y conserva el código de dominio', () => {
    const data = {
      worldId: '018f1000-0000-7000-8000-000000000001',
      worldName: 'Mundo',
      fileName: 'mundo.zip',
      size: 10,
      counts: {
        entities: 0,
        entityTypes: 0,
        relationTypes: 0,
        tags: 0,
        relations: 0,
        versions: 0,
        assets: 0,
      },
      warnings: [],
    };

    expect(
      isTransferRunResult(
        { status: 'completed', data },
        isTransferExportResult,
      ),
    ).toBe(true);
    expect(isTransferExportRunResult({ status: 'cancelled' })).toBe(true);
    expect(
      isTransferExportRunResult({
        status: 'failed',
        code: 'TRANSFER_BUSY',
      }),
    ).toBe(true);
    expect(
      isTransferExportRunResult({
        status: 'failed',
        code: 'BOOM',
      }),
    ).toBe(false);
    expect(
      isTransferImportRunResult({
        status: 'completed',
        data: {
          worldId: '018f1000-0000-7000-8000-000000000001',
          worldName: 'Mundo',
          slug: 'mundo-2',
          slugAdjusted: true,
          counts: data.counts,
          warnings: [],
        },
      }),
    ).toBe(true);
  });

  it('el bloque de tipos de relación tiene su propia versión', () => {
    expect(RELATION_TYPE_TRANSFER_VERSION).toBe(1);
    expect(
      isRelationTypeTransfer({
        version: 1,
        types: [
          {
            key: 'founded-by',
            name: 'Fundado por',
            inverseName: 'Fundó',
            color: 'ochre',
          },
        ],
      }),
    ).toBe(true);
    expect(
      isRelationTypeTransfer({
        version: 2,
        types: [],
      }),
    ).toBe(false);
  });

  it('registra world.imported como actividad conocida', () => {
    expect(WORLD_ACTIVITY_ACTIONS).toContain('world.imported');
    expect(isWorldActivityAction('world.imported')).toBe(true);
  });
});
