/**
 * Contrato de exportación del laboratorio de mapas (#80).
 *
 * Módulo puro compartido por renderer, preload y proceso principal: no importa
 * Node, Electron ni MapLibre. El renderer solo envía el tipo y los bytes; el
 * nombre, la extensión, la carpeta y el UUID se generan en el proceso principal.
 */

/** Formatos que puede guardar el spike. */
export const SPIKE_EXPORT_KINDS = [
  'svg',
  'png',
  'geojson',
  'json',
  'markdown',
] as const;

/** Tipo de exportación admitido. */
export type SpikeExportKind = (typeof SPIKE_EXPORT_KINDS)[number];

/** Extensión de archivo por tipo (el nombre final lo decide el proceso principal). */
export const SPIKE_EXPORT_EXTENSIONS: Readonly<
  Record<SpikeExportKind, 'svg' | 'png' | 'geojson' | 'json' | 'md'>
> = Object.freeze({
  svg: 'svg',
  png: 'png',
  geojson: 'geojson',
  json: 'json',
  markdown: 'md',
});

/** Un byte es el mínimo útil: un archivo vacío no se escribe. */
export const SPIKE_EXPORT_MIN_BYTES = 1;

/** Tope de contenido por exportación (12 MiB). */
export const SPIKE_EXPORT_MAX_BYTES = 12 * 1024 * 1024;

/**
 * Forma canónica del nombre generado en el proceso principal.
 *
 * El UUID de ocho caracteres hexadecimales evita colisiones sin revelar el
 * nombre original ni una ruta. `markdown` se guarda como `.md`.
 */
export const SPIKE_EXPORT_FILE_NAME_PATTERN =
  /^wc-m2-01-(svg|png|geojson|json|markdown)-[0-9a-f]{8}\.(svg|png|geojson|json|md)$/;

/** Entrada del canal de guardado. */
export interface SpikeExportInput {
  readonly kind: SpikeExportKind;
  /** Contenido binario ya serializado; nunca una ruta. */
  readonly content: Uint8Array;
}

/** Resultado de una exportación correcta. */
export interface SpikeExportResult {
  /** Nombre relativo generado dentro de `userData/data/spike-maps`. */
  readonly fileName: string;
  readonly bytes: number;
}

/** Indica si un valor es un tipo de exportación conocido. */
export function isSpikeExportKind(value: unknown): value is SpikeExportKind {
  return (
    typeof value === 'string' &&
    (SPIKE_EXPORT_KINDS as readonly string[]).includes(value)
  );
}

function fileNameMatchesKind(match: RegExpExecArray): boolean {
  const kind = match[1];
  const extension = match[2];

  if (!isSpikeExportKind(kind) || extension === undefined) {
    return false;
  }

  return SPIKE_EXPORT_EXTENSIONS[kind] === extension;
}

/**
 * Comprueba que un resultado tiene la forma exacta del contrato.
 *
 * Se usa en el preload para no reenviar una respuesta manipulada o de otra
 * versión. El nombre no puede contener separadores ni rutas.
 */
export function isSpikeExportResult(
  value: unknown,
): value is SpikeExportResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as {
    readonly fileName?: unknown;
    readonly bytes?: unknown;
  };

  if (typeof candidate.fileName !== 'string') {
    return false;
  }

  const match = SPIKE_EXPORT_FILE_NAME_PATTERN.exec(candidate.fileName);

  if (match === null || !fileNameMatchesKind(match)) {
    return false;
  }

  return (
    typeof candidate.bytes === 'number' &&
    Number.isInteger(candidate.bytes) &&
    candidate.bytes >= SPIKE_EXPORT_MIN_BYTES &&
    candidate.bytes <= SPIKE_EXPORT_MAX_BYTES
  );
}
