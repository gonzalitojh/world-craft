import { describe, expect, it } from 'vitest';

import { createFormatters } from '@/renderer/i18n/formats';
import {
  buildProgressCount,
  formatBytes,
  progressPercent,
} from '@/renderer/transfer/format';
import { es } from '@/renderer/messages/es';

const formats = createFormatters('es');
const progress = es.transfer.progress;

describe('formatos de transferencia', () => {
  it('calcula el porcentaje y devuelve indeterminado sin total', () => {
    expect(progressPercent(1, 4)).toBe(25);
    expect(progressPercent(0, 10)).toBe(0);
    expect(progressPercent(20, 10)).toBe(100);
    expect(progressPercent(-2, 10)).toBe(0);
    expect(progressPercent(1, null)).toBeNull();
    expect(progressPercent(1, 0)).toBeNull();
    expect(progressPercent(1, Number.NaN)).toBeNull();
  });

  it('compone recuentos de archivos y pasos con plurales', () => {
    expect(buildProgressCount(2, 5, 'files', progress, formats)).toBe(
      '2 de 5 archivos',
    );
    expect(buildProgressCount(1, 1, 'files', progress, formats)).toBe(
      '1 de 1 archivo',
    );
    expect(buildProgressCount(3, null, 'files', progress, formats)).toBe(
      '3 archivos',
    );
    expect(buildProgressCount(2, 5, 'steps', progress, formats)).toBe(
      'Paso 2 de 5',
    );
    expect(buildProgressCount(2, null, 'steps', progress, formats)).toBe(
      'Paso 2',
    );
  });

  it('formatea bytes con Intl y una sola unidad', () => {
    const expectedBytes = formats.formatNumber(512, {
      style: 'unit',
      unit: 'byte',
      unitDisplay: 'short',
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    });
    const expectedKilobytes = formats.formatNumber(1.5, {
      style: 'unit',
      unit: 'kilobyte',
      unitDisplay: 'short',
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    });
    const expectedMegabytes = formats.formatNumber(2, {
      style: 'unit',
      unit: 'megabyte',
      unitDisplay: 'short',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
    const expectedZero = formats.formatNumber(0, {
      style: 'unit',
      unit: 'byte',
      unitDisplay: 'short',
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    });

    expect(formatBytes(512, formats)).toBe(expectedBytes);
    expect(formatBytes(1536, formats)).toBe(expectedKilobytes);
    expect(formatBytes(2 * 1024 ** 2, formats)).toBe(expectedMegabytes);
    expect(formatBytes(0, formats)).toBe(expectedZero);
  });
});
