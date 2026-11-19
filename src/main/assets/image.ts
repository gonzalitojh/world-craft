/**
 * Validación y normalización de imágenes.
 *
 * El formato se decide por **contenido real** (magic bytes), nunca por la
 * extensión del archivo. SVG, BMP y cualquier formato no listado se rechazan
 * antes de decodificar. Después se aplican los límites de tamaño, lado y
 * píxeles totales, se orienta según EXIF, se convierte a sRGB y se re-codifica
 * a WebP sin metadatos. La miniatura se genera en el mismo paso.
 */
import { createHash } from 'node:crypto';

import sharp from 'sharp';

import {
  ASSET_MAX_DIMENSION_PX,
  ASSET_MAX_FILE_BYTES,
  ASSET_MAX_PIXELS,
  ASSET_MIME_WEBP,
  ASSET_THUMBNAIL_MAX_PX,
  ASSET_THUMBNAIL_QUALITY,
  ASSET_WEBP_EFFORT,
  ASSET_WEBP_QUALITY,
  type SupportedImageFormat,
} from './constants';
import { AssetError, toAssetError } from './errors';

/** Resultado del procesamiento de una imagen. */
export interface ProcessedImage {
  /** WebP completo, ya orientado y sin metadatos. */
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
  readonly size: number;
  /** SHA-256 del WebP servible. */
  readonly hash: string;
  readonly mime: typeof ASSET_MIME_WEBP;
  readonly thumbnail: {
    readonly data: Buffer;
    readonly width: number;
    readonly height: number;
    readonly size: number;
  };
}

/** Límites opcionales; las pruebas los reducen para ser rápidas. */
export interface ProcessImageLimits {
  readonly maxBytes?: number;
  readonly maxDimensionPx?: number;
  readonly maxPixels?: number;
}

/** Firma de PNG. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Firma de JPEG. */
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

/** Formatos de sharp que corresponden a cada formato detectado. */
const SHARP_FORMATS: Record<SupportedImageFormat, readonly string[]> = {
  png: ['png'],
  jpeg: ['jpeg'],
  webp: ['webp'],
  gif: ['gif'],
  // sharp decodifica AVIF con el decodificador HEIF.
  avif: ['heif'],
};

/**
 * Detecta el formato por magic bytes.
 *
 * Devuelve `null` para cualquier contenido no admitido: SVG, BMP, TIFF,
 * archivos truncados que no llegan a la firma y datos arbitrarios.
 */
export function detectImageFormat(
  data: Uint8Array,
): SupportedImageFormat | null {
  if (startsWith(data, PNG_SIGNATURE)) {
    return 'png';
  }

  if (startsWith(data, JPEG_SIGNATURE)) {
    return 'jpeg';
  }

  if (matchesAscii(data, 0, 'GIF87a') || matchesAscii(data, 0, 'GIF89a')) {
    return 'gif';
  }

  if (matchesAscii(data, 0, 'RIFF') && matchesAscii(data, 8, 'WEBP')) {
    return 'webp';
  }

  if (
    matchesAscii(data, 4, 'ftyp') &&
    (matchesAscii(data, 8, 'avif') || matchesAscii(data, 8, 'avis'))
  ) {
    return 'avif';
  }

  return null;
}

/**
 * Procesa una imagen y genera el WebP servible y su miniatura.
 *
 * Lanza `ASSET_TOO_LARGE` antes de decodificar si el búfer supera el límite,
 * `ASSET_UNSUPPORTED_FORMAT` si el contenido no está admitido y
 * `ASSET_DIMENSIONS_TOO_LARGE` si las dimensiones reales exceden los topes. Un
 * archivo truncado o ilegible termina en `ASSET_IMAGE_INVALID`.
 */
export async function processImage(
  data: Buffer,
  limits: ProcessImageLimits = {},
): Promise<ProcessedImage> {
  const maxBytes = limits.maxBytes ?? ASSET_MAX_FILE_BYTES;
  const maxDimensionPx = limits.maxDimensionPx ?? ASSET_MAX_DIMENSION_PX;
  const maxPixels = limits.maxPixels ?? ASSET_MAX_PIXELS;

  if (data.byteLength === 0) {
    throw new AssetError('ASSET_IMAGE_INVALID');
  }

  if (data.byteLength > maxBytes) {
    throw new AssetError('ASSET_TOO_LARGE');
  }

  const format = detectImageFormat(data);

  if (format === null) {
    throw new AssetError('ASSET_UNSUPPORTED_FORMAT');
  }

  try {
    // El metadata se lee sin límite de píxeles: solo recorre la cabecera y es
    // lo que permite distinguir "demasiado grande" de "imagen dañada". El
    // límite real se aplica al decodificar, después de validar las medidas.
    const header = sharp(data, { limitInputPixels: false, failOn: 'error' });
    const metadata = await header.metadata();

    if (!SHARP_FORMATS[format].includes(metadata.format)) {
      throw new AssetError('ASSET_UNSUPPORTED_FORMAT');
    }

    // `autoOrient` refleja las dimensiones después de aplicar la orientación
    // EXIF; es lo que verá el usuario y lo que hay que limitar.
    const width = metadata.autoOrient?.width ?? metadata.width;
    const height = metadata.autoOrient?.height ?? metadata.height;

    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0
    ) {
      throw new AssetError('ASSET_IMAGE_INVALID');
    }

    if (
      width > maxDimensionPx ||
      height > maxDimensionPx ||
      width * height > maxPixels
    ) {
      throw new AssetError('ASSET_DIMENSIONS_TOO_LARGE');
    }

    const main = await sharp(data, { limitInputPixels: maxPixels })
      .rotate()
      .toColourspace('srgb')
      .webp({ quality: ASSET_WEBP_QUALITY, effort: ASSET_WEBP_EFFORT })
      .toBuffer({ resolveWithObject: true });

    const thumbnail = await sharp(data, { limitInputPixels: maxPixels })
      .rotate()
      .toColourspace('srgb')
      .resize({
        width: ASSET_THUMBNAIL_MAX_PX,
        height: ASSET_THUMBNAIL_MAX_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: ASSET_THUMBNAIL_QUALITY, effort: ASSET_WEBP_EFFORT })
      .toBuffer({ resolveWithObject: true });

    return {
      data: main.data,
      width: main.info.width,
      height: main.info.height,
      size: main.data.byteLength,
      hash: sha256(main.data),
      mime: ASSET_MIME_WEBP,
      thumbnail: {
        data: thumbnail.data,
        width: thumbnail.info.width,
        height: thumbnail.info.height,
        size: thumbnail.data.byteLength,
      },
    };
  } catch (error) {
    throw toAssetError(error, 'ASSET_IMAGE_INVALID');
  }
}

/** SHA-256 hexadecimal de un búfer. */
export function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function startsWith(data: Uint8Array, signature: readonly number[]): boolean {
  if (data.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => data[index] === byte);
}

function matchesAscii(data: Uint8Array, offset: number, text: string): boolean {
  if (data.length < offset + text.length) {
    return false;
  }

  for (let index = 0; index < text.length; index += 1) {
    if (data[offset + index] !== text.charCodeAt(index)) {
      return false;
    }
  }

  return true;
}
