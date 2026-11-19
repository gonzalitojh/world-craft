import { describe, expect, it } from 'vitest';

import {
  createUuidv7Generator,
  generateUuidv7,
  isUuidV7,
  UUID_V7_PATTERN,
} from '@/main/db/ids';

/** Fuente aleatoria determinista que repite un patrón. */
function createRandom(pattern: readonly number[] = [0x11, 0x22, 0x33]) {
  let index = 0;

  return (size: number): Buffer => {
    const bytes = Buffer.alloc(size);

    for (let offset = 0; offset < size; offset += 1) {
      bytes[offset] = pattern[index % pattern.length] as number;
      index += 1;
    }

    return bytes;
  };
}

function timestampOf(uuid: string): number {
  return Number.parseInt(uuid.replaceAll('-', '').slice(0, 12), 16);
}

describe('UUIDv7', () => {
  it('genera la forma canónica con versión 7 y variante RFC 4122', () => {
    const generator = createUuidv7Generator({
      now: () => 1_760_000_000_000,
      random: createRandom(),
    });
    const uuid = generator.generate();

    expect(uuid).toMatch(UUID_V7_PATTERN);
    expect(isUuidV7(uuid)).toBe(true);
    expect(uuid[14]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(uuid[19]);
    expect(uuid).toHaveLength(36);
    expect(timestampOf(uuid)).toBe(1_760_000_000_000);
  });

  it('mantiene el orden en el mismo milisegundo incrementando el contador', () => {
    const generator = createUuidv7Generator({
      now: () => 1_760_000_000_000,
      random: createRandom([0x00, 0x00]),
    });

    const first = generator.generate();
    const second = generator.generate();
    const third = generator.generate();

    expect(first < second).toBe(true);
    expect(second < third).toBe(true);
    expect(timestampOf(third)).toBe(1_760_000_000_000);
  });

  it('ordena por marca de tiempo cuando el reloj avanza', () => {
    let clock = 1_760_000_000_000;
    const generator = createUuidv7Generator({
      now: () => clock,
      random: createRandom(),
    });

    const first = generator.generate();
    clock += 5;
    const second = generator.generate();

    expect(second > first).toBe(true);
    expect(timestampOf(second)).toBe(1_760_000_000_005);
  });

  it('no retrocede si el reloj se atrasa', () => {
    let clock = 1_760_000_000_100;
    const generator = createUuidv7Generator({
      now: () => clock,
      random: createRandom(),
    });

    const first = generator.generate();
    clock -= 1_000;
    const second = generator.generate();

    expect(second > first).toBe(true);
    expect(timestampOf(second)).toBeGreaterThanOrEqual(timestampOf(first));
  });

  it('avanza un milisegundo virtual al agotar el contador de 12 bits', () => {
    const generator = createUuidv7Generator({
      now: () => 1_760_000_000_000,
      random: createRandom([0xff, 0xff]),
    });
    const first = generator.generate();

    let previous = first;

    for (let index = 0; index < 5000; index += 1) {
      const next = generator.generate();

      expect(isUuidV7(next)).toBe(true);
      expect(next > previous).toBe(true);
      previous = next;
    }

    expect(timestampOf(previous)).toBeGreaterThan(1_760_000_000_000);
  });

  it('genera identificadores distintos con el generador por defecto', () => {
    const values = new Set(Array.from({ length: 200 }, () => generateUuidv7()));

    expect(values.size).toBe(200);

    for (const value of values) {
      expect(isUuidV7(value)).toBe(true);
    }
  });

  it('rechaza valores que no son UUIDv7', () => {
    expect(isUuidV7('')).toBe(false);
    expect(isUuidV7('no-es-un-uuid')).toBe(false);
    expect(isUuidV7('018f6b7c-1111-4111-8111-111111111111')).toBe(false);
    expect(isUuidV7('018F6B7C-1111-7111-8111-111111111111')).toBe(false);
    expect(isUuidV7('018f6b7c-1111-7111-c111-111111111111')).toBe(false);
    expect(isUuidV7(1234)).toBe(false);
    expect(isUuidV7(null)).toBe(false);
  });
});
