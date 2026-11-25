import { describe, expect, it } from 'vitest';

import {
  parseWorkerRequest,
  parseWorkerResponse,
  transferExportResultSchema,
} from '@/main/transfer/protocol';
import { TransferError } from '@/main/transfer/errors';

const OPERATION_ID = '018f1000-0000-7000-8000-000000000001';
const WORLD_ID = '018f1000-0000-7000-8000-000000000002';
const ABSOLUTE =
  process.platform === 'win32'
    ? 'C:\\datos\\world-craft'
    : '/datos/world-craft';

describe('protocolo del worker', () => {
  it('acepta una exportación válida', () => {
    const request = parseWorkerRequest({
      type: 'export',
      protocolVersion: 1,
      operationId: OPERATION_ID,
      worldId: WORLD_ID,
      databaseFile: `${ABSOLUTE}\\data\\db.sqlite`,
      destinationFile: `${ABSOLUTE}\\mundo.zip`,
      assetsDir: `${ABSOLUTE}\\assets`,
      appVersion: '0.1.0',
      schemaVersion: 8,
      now: 1,
    });

    expect(request.type).toBe('export');
  });

  it('acepta una importación, una cancelación y una sonda', () => {
    expect(
      parseWorkerRequest({
        type: 'import',
        protocolVersion: 1,
        operationId: OPERATION_ID,
        archiveFile: `${ABSOLUTE}\\mundo.zip`,
        importsDir: `${ABSOLUTE}\\imports`,
        assetsDir: `${ABSOLUTE}\\assets`,
        assetsTempDir: `${ABSOLUTE}\\assets\\.tmp`,
        schemaVersion: 8,
        existingSlugs: ['mundo', 'mundo-2'],
        now: 1,
      }).type,
    ).toBe('import');

    expect(
      parseWorkerRequest({
        type: 'cancel',
        protocolVersion: 1,
        operationId: OPERATION_ID,
      }).type,
    ).toBe('cancel');

    expect(
      parseWorkerRequest({
        type: 'probe',
        protocolVersion: 1,
        operationId: OPERATION_ID,
      }).type,
    ).toBe('probe');
  });

  it('rechaza versiones, IDs y rutas relativas', () => {
    const base = {
      type: 'export',
      protocolVersion: 1,
      operationId: OPERATION_ID,
      worldId: WORLD_ID,
      databaseFile: `${ABSOLUTE}\\db.sqlite`,
      destinationFile: `${ABSOLUTE}\\mundo.zip`,
      assetsDir: `${ABSOLUTE}\\assets`,
      appVersion: '0.1.0',
      schemaVersion: 8,
      now: 1,
    };

    expect(() => parseWorkerRequest({ ...base, protocolVersion: 2 })).toThrow(
      TransferError,
    );
    expect(() => parseWorkerRequest({ ...base, operationId: 'x' })).toThrow(
      TransferError,
    );
    expect(() =>
      parseWorkerRequest({ ...base, destinationFile: 'mundo.zip' }),
    ).toThrow(TransferError);
    expect(() => parseWorkerRequest({ ...base, extra: true })).toThrow(
      TransferError,
    );
  });

  it('valida los mensajes del worker orientados al renderer', () => {
    const event = parseWorkerResponse({
      type: 'event',
      protocolVersion: 1,
      operationId: OPERATION_ID,
      event: {
        operation: 'import',
        phase: 'extracting',
        completed: 1,
        total: 5,
        warnings: 0,
      },
    });

    expect(event.type).toBe('event');
    expect(JSON.stringify(event)).not.toContain(ABSOLUTE);

    expect(() =>
      parseWorkerResponse({
        type: 'error',
        protocolVersion: 1,
        operationId: OPERATION_ID,
        code: 'NOT_A_CODE',
      }),
    ).toThrow(TransferError);
  });

  it('valida el nombre de archivo del resultado de exportación', () => {
    const result = {
      worldId: WORLD_ID,
      worldName: 'Mundo',
      fileName: 'mundo..zip',
      size: 1,
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

    expect(transferExportResultSchema.safeParse(result).success).toBe(true);

    for (const fileName of [
      '../mundo.zip',
      'C:\\mundo.zip',
      'carpeta/mundo.zip',
      'mundo:zip',
      '.',
      '..',
    ]) {
      expect(
        transferExportResultSchema.safeParse({ ...result, fileName }).success,
      ).toBe(false);
    }
  });

  it('valida el resultado de importación preparada', () => {
    const response = parseWorkerResponse({
      type: 'result',
      protocolVersion: 1,
      operationId: OPERATION_ID,
      operation: 'import',
      result: {
        planFile: `${ABSOLUTE}\\imports\\.tmp\\${OPERATION_ID}\\plan.json`,
        stagingDir: `${ABSOLUTE}\\imports\\.tmp\\${OPERATION_ID}`,
        assetTempDir: `${ABSOLUTE}\\assets\\.tmp\\${OPERATION_ID}\\${WORLD_ID}`,
        worldId: WORLD_ID,
        worldName: 'Mundo',
        slug: 'mundo-2',
        slugAdjusted: true,
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
        totalAssetBytes: 0,
      },
    });

    expect(response.type).toBe('result');
  });
});
