import { describe, expect, it } from 'vitest';

import { computeSqlChecksum, normalizeSql } from '@/main/db/checksum';

describe('checksum de migraciones', () => {
  it('normaliza CRLF y CR a LF', () => {
    expect(normalizeSql('CREATE TABLE a;\r\nSELECT 1;\rSELECT 2;')).toBe(
      'CREATE TABLE a;\nSELECT 1;\nSELECT 2;',
    );
  });

  it('ignora el BOM inicial', () => {
    expect(normalizeSql('\uFEFFSELECT 1;')).toBe('SELECT 1;');
  });

  it('calcula el mismo SHA-256 con finales de línea distintos', () => {
    const unix = 'CREATE TABLE a (\n  id TEXT\n);\n';
    const windows = 'CREATE TABLE a (\r\n  id TEXT\r\n);\r\n';

    expect(computeSqlChecksum(windows)).toBe(computeSqlChecksum(unix));
    expect(computeSqlChecksum(unix)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('cambia el checksum si cambia el contenido', () => {
    expect(computeSqlChecksum('SELECT 1;')).not.toBe(
      computeSqlChecksum('SELECT 2;'),
    );
  });
});
