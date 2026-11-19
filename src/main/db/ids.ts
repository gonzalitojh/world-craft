/**
 * Identificadores UUIDv7 del proceso principal.
 *
 * Las tablas de dominio no usan autoincrementales: el ID se conoce antes de
 * insertar, ordena por tiempo de creación y es portable entre equipos. La
 * variante 7 de RFC 9562 incluye 48 bits de marca de tiempo en milisegundos,
 * un contador de 12 bits para que dos IDs del mismo milisegundo mantengan el
 * orden y 62 bits aleatorios.
 *
 * El reloj y la fuente de aleatoriedad se inyectan para que las pruebas sean
 * deterministas; en producción se usan `Date.now` y `crypto.randomBytes`.
 */
import { randomBytes } from 'node:crypto';

/** Forma canónica de un UUID versión 7, variante RFC 4122, en minúsculas. */
export const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Indica si un valor es un UUIDv7 canónico en minúsculas. */
export function isUuidV7(value: unknown): value is string {
  return typeof value === 'string' && UUID_V7_PATTERN.test(value);
}

/** Opciones del generador; todas se inyectan en las pruebas. */
export interface Uuidv7GeneratorOptions {
  /** Reloj en milisegundos; por defecto `Date.now`. */
  readonly now?: () => number;
  /** Fuente aleatoria; por defecto `crypto.randomBytes`. */
  readonly random?: (size: number) => Buffer;
}

/** Generador con estado: garantiza monotonía dentro del proceso. */
export interface Uuidv7Generator {
  generate(): string;
}

/** Mayor valor del contador de 12 bits de `rand_a`. */
const MAX_COUNTER = 0xfff;

const HEX_BYTES = 16;

/** Crea un generador UUIDv7 con reloj y aleatoriedad inyectables. */
export function createUuidv7Generator(
  options: Uuidv7GeneratorOptions = {},
): Uuidv7Generator {
  const now = options.now ?? Date.now;
  const random = options.random ?? ((size: number) => randomBytes(size));

  let lastTimestamp = -1;
  let counter = 0;

  return {
    generate() {
      const reading = Math.floor(now());

      if (!Number.isFinite(reading) || reading < 0) {
        throw new RangeError('El reloj debe devolver milisegundos válidos.');
      }

      let timestamp: number;

      if (reading > lastTimestamp) {
        // Milisegundo nuevo: el orden lo fija la marca de tiempo y el
        // contador arranca en un valor aleatorio para no revelar cuántos IDs
        // se han generado en el mismo instante.
        timestamp = reading;
        counter = readCounter(random);
      } else if (counter < MAX_COUNTER) {
        // Mismo milisegundo o reloj retrasado: se incrementa el contador para
        // que el ID siga siendo mayor que el anterior.
        timestamp = lastTimestamp;
        counter += 1;
      } else {
        // Contador agotado: se avanza un milisegundo virtual. El sesgo es de
        // 1 ms y evita romper la monotonía.
        timestamp = lastTimestamp + 1;
        counter = 0;
      }

      lastTimestamp = timestamp;

      return formatUuidv7(timestamp, counter, random(8));
    },
  };
}

const defaultGenerator = createUuidv7Generator();

/** Genera un UUIDv7 con el reloj y la aleatoriedad del sistema. */
export function generateUuidv7(): string {
  return defaultGenerator.generate();
}

function readCounter(random: (size: number) => Buffer): number {
  return random(2).readUInt16BE(0) & MAX_COUNTER;
}

function formatUuidv7(
  timestamp: number,
  counter: number,
  tail: Buffer,
): string {
  if (tail.length !== 8) {
    throw new RangeError('La fuente aleatoria debe devolver 8 bytes.');
  }

  const bytes = Buffer.alloc(HEX_BYTES);

  // 48 bits de marca de tiempo Unix en milisegundos.
  bytes.writeUIntBE(timestamp, 0, 6);
  // Versión 7 en los cuatro bits altos y contador en los 12 restantes.
  bytes[6] = 0x70 | ((counter >> 8) & 0x0f);
  bytes[7] = counter & 0xff;
  // Variante RFC 4122 (`10`) y 62 bits aleatorios.
  bytes[8] = 0x80 | ((tail[0] as number) & 0x3f);
  tail.copy(bytes, 9, 1);

  const hex = bytes.toString('hex');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
