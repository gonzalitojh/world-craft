import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function pngSize(buffer: Buffer): { width: number; height: number } {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe('iconos del instalador', () => {
  it('genera un ICO con PNG de 16, 24, 32, 48, 64, 128 y 256 px', async () => {
    const buffer = await readFile(join(process.cwd(), 'resources', 'icon.ico'));

    expect(buffer.readUInt16LE(0)).toBe(0);
    expect(buffer.readUInt16LE(2)).toBe(1);

    const count = buffer.readUInt16LE(4);
    const expectedSizes = [16, 24, 32, 48, 64, 128, 256];

    expect(count).toBe(expectedSizes.length);

    for (const [index, expectedSize] of expectedSizes.entries()) {
      const entryOffset = 6 + index * 16;
      const width = buffer.readUInt8(entryOffset);
      const height = buffer.readUInt8(entryOffset + 1);
      const dimension = expectedSize === 256 ? 0 : expectedSize;

      expect(width).toBe(dimension);
      expect(height).toBe(dimension);
      expect(buffer.readUInt16LE(entryOffset + 4)).toBe(1);
      expect(buffer.readUInt16LE(entryOffset + 6)).toBe(32);

      const bytes = buffer.readUInt32LE(entryOffset + 8);
      const offset = buffer.readUInt32LE(entryOffset + 12);

      expect(bytes).toBeGreaterThan(0);
      expect(offset + bytes).toBeLessThanOrEqual(buffer.length);
      expect(buffer.subarray(offset, offset + 8)).toEqual(PNG_SIGNATURE);
      expect(pngSize(buffer.subarray(offset, offset + bytes))).toEqual({
        width: expectedSize,
        height: expectedSize,
      });
    }
  });

  it('genera un PNG de 512 px para la aplicación', async () => {
    const buffer = await readFile(join(process.cwd(), 'resources', 'icon.png'));

    expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    expect(pngSize(buffer)).toEqual({ width: 512, height: 512 });
  });
});
