/**
 * Pipeline de imagen de los assets.
 *
 * Objetivos (M0-10, issue #40):
 * 1. **MIME real**, no la cabecera declarada: se detecta con sharp. Un archivo
 *    de texto renombrado a `.png` falla aquí.
 * 2. Límites: 10 MiB, 25 MP y 8192 px de entrada; 16 px de mínimo.
 * 3. Salida WebP de calidad 82, lado máximo 4096 px y **sin metadatos** (sharp
 *    los elimina por defecto; no se llama nunca a `withMetadata`).
 * 4. Miniatura WebP de 480 px y calidad 72.
 * 5. Rechazo de SVG, HEIC, TIFF y animaciones; GIF estático permitido.
 *
 * El resultado es determinista salvo por el codificador de sharp, así que los
 * tests comprueban formato, dimensiones, ausencia de EXIF y errores; no bytes
 * exactos.
 */
import sharp, { type Metadata } from 'sharp';

import { AssetError } from './errors';
import {
  MAX_ASSET_BYTES,
  MAX_INPUT_DIMENSION,
  MAX_INPUT_PIXELS,
  MAX_OUTPUT_DIMENSION,
  MIN_IMAGE_DIMENSION,
  OUTPUT_ASSET_MIME,
  THUMBNAIL_DIMENSION,
  THUMBNAIL_WEBP_QUALITY,
  WEBP_QUALITY,
  type AllowedInputMime,
} from './limits';

/** Resultado del pipeline. */
export interface ProcessedImage {
  body: Uint8Array;
  mime: typeof OUTPUT_ASSET_MIME;
  width: number;
  height: number;
  thumbnail: {
    body: Uint8Array;
    mime: typeof OUTPUT_ASSET_MIME;
    width: number;
    height: number;
  };
  /** MIME real detectado en la entrada. */
  inputMime: AllowedInputMime;
}

/** Opciones de decodificación comunes: sin animaciones y con límite de píxeles. */
const decodeOptions = {
  animated: false,
  limitInputPixels: MAX_INPUT_PIXELS,
  failOn: 'error',
} as const;

/**
 * Opciones para leer solo la cabecera.
 *
 * `limitInputPixels` se desactiva porque `metadata()` no decodifica píxeles y un
 * archivo con dimensiones enormes debe llegar a nuestra validación, que devuelve
 * `too_large` en vez de un error opaco de sharp.
 */
const metadataOptions = {
  animated: false,
  limitInputPixels: false,
} as const;

/** Traduce un error de sharp a un error de dominio. */
function mapSharpError(error: unknown): AssetError {
  if (error instanceof AssetError) {
    return error;
  }

  return new AssetError(
    'invalid_image',
    'La imagen no se pudo decodificar o no es una imagen válida.',
    { cause: error },
  );
}

/** Determina el MIME real a partir de los metadatos de sharp. */
function detectInputMime(metadata: Metadata): AllowedInputMime | undefined {
  switch (metadata.format) {
    case 'png':
      return 'image/png';
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'heif':
      // AVIF es HEIF con compresión AV1; HEIC no está permitido.
      return metadata.compression === 'av1' ? 'image/avif' : undefined;
    case 'gif':
      return 'image/gif';
    default:
      return undefined;
  }
}

/**
 * Procesa una imagen subida y devuelve el WebP principal y su miniatura.
 *
 * Lanza `AssetError` con un código estable en todos los casos de rechazo.
 */
export async function processAssetImage(
  input: Uint8Array,
): Promise<ProcessedImage> {
  if (input.byteLength === 0) {
    throw new AssetError('invalid_image', 'El archivo está vacío.');
  }

  if (input.byteLength > MAX_ASSET_BYTES) {
    throw new AssetError(
      'too_large',
      `El archivo supera el máximo de ${MAX_ASSET_BYTES} bytes.`,
    );
  }

  let metadata: Metadata;

  try {
    metadata = await sharp(input, metadataOptions).metadata();
  } catch (error) {
    throw mapSharpError(error);
  }

  const inputMime = detectInputMime(metadata);

  if (inputMime === undefined) {
    throw new AssetError(
      'unsupported_type',
      `Formato no permitido: ${metadata.format ?? 'desconocido'}. Usa PNG, JPEG, WebP, AVIF o GIF estático.`,
    );
  }

  if (metadata.pages !== undefined && metadata.pages > 1) {
    throw new AssetError(
      'unsupported_type',
      'Las imágenes animadas no están permitidas.',
    );
  }

  const width = metadata.width;
  const height = metadata.height;

  if (width === undefined || height === undefined) {
    throw new AssetError(
      'invalid_image',
      'No se pudieron leer las dimensiones de la imagen.',
    );
  }

  if (width > MAX_INPUT_DIMENSION || height > MAX_INPUT_DIMENSION) {
    throw new AssetError(
      'too_large',
      `La imagen supera los ${MAX_INPUT_DIMENSION} px de lado.`,
    );
  }

  if (width * height > MAX_INPUT_PIXELS) {
    throw new AssetError(
      'too_large',
      `La imagen supera los ${MAX_INPUT_PIXELS} píxeles.`,
    );
  }

  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    throw new AssetError(
      'invalid_image',
      `La imagen debe medir al menos ${MIN_IMAGE_DIMENSION} px de lado.`,
    );
  }

  try {
    const main = await sharp(input, decodeOptions)
      // Aplica la orientación EXIF antes de redimensionar y elimina el EXIF.
      .rotate()
      .resize({
        width: MAX_OUTPUT_DIMENSION,
        height: MAX_OUTPUT_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    // La guarda de la migración 0007 y el contrato de almacenamiento limitan
    // también el WebP publicado: una entrada válida de 10 MiB puede crecer al
    // recodificar. Se rechaza antes de subir nada.
    if (main.data.byteLength > MAX_ASSET_BYTES) {
      throw new AssetError(
        'too_large',
        `La imagen procesada supera el máximo de ${MAX_ASSET_BYTES} bytes.`,
      );
    }

    const thumbnail = await sharp(main.data, decodeOptions)
      .resize({
        width: THUMBNAIL_DIMENSION,
        height: THUMBNAIL_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: THUMBNAIL_WEBP_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    return {
      body: new Uint8Array(main.data),
      mime: OUTPUT_ASSET_MIME,
      width: main.info.width,
      height: main.info.height,
      thumbnail: {
        body: new Uint8Array(thumbnail.data),
        mime: OUTPUT_ASSET_MIME,
        width: thumbnail.info.width,
        height: thumbnail.info.height,
      },
      inputMime,
    };
  } catch (error) {
    throw mapSharpError(error);
  }
}
