import { describe, expect, it } from 'vitest';

import {
  dataDeleteAllPayloadSchema,
  dataEmptyPayloadSchema,
  dataOpenFolderPayloadSchema,
  dataPurgeOrphansPayloadSchema,
} from '@/main/ipc/schemas/data';

describe('esquemas IPC de datos', () => {
  it('exige objetos vacíos estrictos donde no hay payload', () => {
    expect(dataEmptyPayloadSchema.safeParse({}).success).toBe(true);
    expect(dataEmptyPayloadSchema.safeParse({ extra: true }).success).toBe(
      false,
    );
  });

  it('valida la carpeta del enum y rechaza extras', () => {
    expect(
      dataOpenFolderPayloadSchema.safeParse({ folder: 'assets' }).success,
    ).toBe(true);
    expect(
      dataOpenFolderPayloadSchema.safeParse({ folder: 'otra' }).success,
    ).toBe(false);
    expect(
      dataOpenFolderPayloadSchema.safeParse({
        folder: 'logs',
        extra: true,
      }).success,
    ).toBe(false);
  });

  it('exige los tokens literales', () => {
    expect(
      dataPurgeOrphansPayloadSchema.safeParse({
        confirmation: 'purge-orphans',
      }).success,
    ).toBe(true);
    expect(
      dataPurgeOrphansPayloadSchema.safeParse({
        confirmation: 'otro',
      }).success,
    ).toBe(false);

    expect(
      dataDeleteAllPayloadSchema.safeParse({
        confirmation: 'delete-all-data',
        keepBackups: false,
      }).success,
    ).toBe(true);
    expect(
      dataDeleteAllPayloadSchema.safeParse({
        confirmation: 'ELIMINAR TODO',
        keepBackups: false,
      }).success,
    ).toBe(false);
    expect(
      dataDeleteAllPayloadSchema.safeParse({
        confirmation: 'delete-all-data',
        keepBackups: 'no',
      }).success,
    ).toBe(false);
    expect(
      dataDeleteAllPayloadSchema.safeParse({
        confirmation: 'delete-all-data',
        keepBackups: true,
        extra: true,
      }).success,
    ).toBe(false);
  });
});
