/**
 * Marca procedural de un mundo.
 *
 * Es una función pura y determinista: la semilla es solo el `id` inmutable del
 * mundo, de modo que renombrar o editar el mundo no cambia su marca. No usa
 * `Math.random`, ni la fecha, ni estado: el mismo `id` pinta siempre la misma
 * trama y el mismo tono.
 */

/** Trama estática del sello de mapa. */
export type WorldMarkMotif = 0 | 1 | 2 | 3;

/** Pareja de tokens `--entity-*` legible en ambos temas. */
export type WorldMarkTone = 0 | 1 | 2 | 3;

export interface WorldMarkVariant {
  readonly motif: WorldMarkMotif;
  readonly tone: WorldMarkTone;
}

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a de 32 bits sobre las unidades UTF-16 de `id`. */
function hashId(id: string): number {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }

  return hash;
}

/**
 * Traduce el `id` de un mundo en una variante de cuatro tramas por cuatro
 * tonos. El motivo usa los dos bits bajos y el tono los siguientes, para que
 * ambos cambien de forma independiente.
 */
export function worldMarkVariant(id: string): WorldMarkVariant {
  const hash = hashId(id);

  return {
    motif: (hash % 4) as WorldMarkMotif,
    tone: ((hash >>> 3) % 4) as WorldMarkTone,
  };
}
