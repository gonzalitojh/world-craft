import { describe, expect, it } from 'vitest';

import {
  transferCancelPayloadSchema,
  transferExportPayloadSchema,
  transferImportPayloadSchema,
} from '@/main/ipc/schemas/transfer';

const WORLD_ID = '018f1000-0000-7000-8000-000000000001';

describe('esquemas IPC de transferencia', () => {
  it('acepta un worldId UUIDv7 y rechaza extras', () => {
    expect(
      transferExportPayloadSchema.safeParse({ worldId: WORLD_ID }).success,
    ).toBe(true);
    expect(
      transferExportPayloadSchema.safeParse({
        worldId: WORLD_ID,
        destino: 'C:\\secreto.zip',
      }).success,
    ).toBe(false);
    expect(
      transferExportPayloadSchema.safeParse({ worldId: 'no-uuid' }).success,
    ).toBe(false);
    expect(transferExportPayloadSchema.safeParse({}).success).toBe(false);
  });

  it('exige objetos vacíos estrictos para importar y cancelar', () => {
    expect(transferImportPayloadSchema.safeParse({}).success).toBe(true);
    expect(transferCancelPayloadSchema.safeParse({}).success).toBe(true);

    for (const schema of [
      transferImportPayloadSchema,
      transferCancelPayloadSchema,
    ]) {
      expect(schema.safeParse(null).success).toBe(false);
      expect(schema.safeParse(undefined).success).toBe(false);
      expect(schema.safeParse({ ruta: 'C:\\x.zip' }).success).toBe(false);
    }
  });
});
