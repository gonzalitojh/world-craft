import { crc32 } from 'node:zlib';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { AssetError } from '@/lib/assets/errors';
import { processAssetImage } from '@/lib/assets/image';
import {
  MAX_ASSET_BYTES,
  MAX_INPUT_DIMENSION,
  MAX_INPUT_PIXELS,
  MAX_OUTPUT_DIMENSION,
  THUMBNAIL_DIMENSION,
} from '@/lib/assets/limits';

/** Genera una imagen PNG de color plano. */
async function createPng(width: number, height: number): Promise<Uint8Array> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 40, b: 60 },
    },
  })
    .png()
    .toBuffer();

  return new Uint8Array(buffer);
}

/** Genera un JPEG con EXIF y orientación. */
async function createJpegWithExif(): Promise<Uint8Array> {
  const buffer = await sharp({
    create: {
      width: 64,
      height: 48,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: { IFD0: { Copyright: 'World Craft test' } },
    })
    .toBuffer();

  return new Uint8Array(buffer);
}

/**
 * Crea un PNG cuya cabecera declara dimensiones enormes sin pagar el coste de
 * generarlas de verdad. Solo se usa para probar la validación de límites.
 */
async function createPngHeader(
  width: number,
  height: number,
): Promise<Uint8Array> {
  const base = Buffer.from(await createPng(16, 16));
  const buffer = Buffer.from(base);

  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer.writeUInt32BE(crc32(buffer.subarray(12, 29)), 29);

  return new Uint8Array(buffer);
}

/** Comprueba el código de un error de assets. */
async function expectAssetError(
  promise: Promise<unknown>,
  code: AssetError['code'],
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AssetError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('processAssetImage', () => {
  it('convierte PNG a WebP sin metadatos y genera miniatura', async () => {
    const result = await processAssetImage(await createPng(120, 80));

    expect(result.mime).toBe('image/webp');
    expect(result.inputMime).toBe('image/png');
    expect(result.width).toBe(120);
    expect(result.height).toBe(80);
    expect(result.thumbnail.width).toBeLessThanOrEqual(THUMBNAIL_DIMENSION);

    const body = await sharp(result.body).metadata();
    expect(body.format).toBe('webp');
    expect(body.exif).toBeUndefined();

    const thumb = await sharp(result.thumbnail.body).metadata();
    expect(thumb.format).toBe('webp');
    expect(thumb.exif).toBeUndefined();
  });

  it('acepta JPEG y elimina EXIF y orientación', async () => {
    const result = await processAssetImage(await createJpegWithExif());

    expect(result.inputMime).toBe('image/jpeg');

    const metadata = await sharp(result.body).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  it('acepta WebP', async () => {
    const input = new Uint8Array(
      await sharp({
        create: {
          width: 40,
          height: 40,
          channels: 3,
          background: '#ffffff',
        },
      })
        .webp()
        .toBuffer(),
    );

    const result = await processAssetImage(input);

    expect(result.inputMime).toBe('image/webp');
    expect(result.mime).toBe('image/webp');
  });

  it('acepta AVIF si sharp lo soporta', async () => {
    const input = new Uint8Array(
      await sharp({
        create: {
          width: 32,
          height: 32,
          channels: 3,
          background: '#ffffff',
        },
      })
        .avif()
        .toBuffer(),
    );

    const result = await processAssetImage(input);

    expect(result.inputMime).toBe('image/avif');
  });

  it('reduce el lado mayor a 4096 px', async () => {
    const result = await processAssetImage(await createPng(5000, 100));

    expect(result.width).toBe(MAX_OUTPUT_DIMENSION);
    expect(result.height).toBeLessThan(result.width);
  });

  it('genera una miniatura de 480 px de lado mayor', async () => {
    const result = await processAssetImage(await createPng(1000, 800));

    expect(result.thumbnail.width).toBe(THUMBNAIL_DIMENSION);
    expect(result.thumbnail.height).toBe(384);
  });

  it('rechaza texto disfrazado de imagen', async () => {
    const fake = new TextEncoder().encode('esto no es una imagen');

    await expectAssetError(processAssetImage(fake), 'invalid_image');
  });

  it('acepta GIF estático y lo convierte a WebP', async () => {
    const input = new Uint8Array(
      await sharp({
        create: {
          width: 32,
          height: 32,
          channels: 3,
          background: '#ffffff',
        },
      })
        .gif()
        .toBuffer(),
    );

    const result = await processAssetImage(input);

    expect(result.inputMime).toBe('image/gif');
    expect(result.mime).toBe('image/webp');
  });

  it('rechaza GIF animado', async () => {
    // GIF 1x1 con dos frames; el rechazo por animación ocurre antes del
    // tamaño mínimo.
    const animated = Uint8Array.from(
      Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAQABAAACAUwAIfkEAAoAAAAsAAAAAAEAAQAAAgFMADs=',
        'base64',
      ),
    );

    await expectAssetError(processAssetImage(animated), 'unsupported_type');
  });

  it('rechaza SVG y TIFF por formato', async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32"/></svg>',
    );
    const tiff = new Uint8Array(
      await sharp({
        create: {
          width: 32,
          height: 32,
          channels: 3,
          background: '#ffffff',
        },
      })
        .tiff()
        .toBuffer(),
    );

    for (const input of [svg, tiff]) {
      await expectAssetError(processAssetImage(input), 'unsupported_type');
    }
  });

  it('rechaza un archivo de más de 10 MiB antes de decodificar', async () => {
    await expectAssetError(
      processAssetImage(new Uint8Array(MAX_ASSET_BYTES + 1)),
      'too_large',
    );
  });

  it('rechaza dimensiones por encima de 8192 px o 25 MP', async () => {
    await expectAssetError(
      processAssetImage(await createPngHeader(MAX_INPUT_DIMENSION + 1, 32)),
      'too_large',
    );
    await expectAssetError(
      processAssetImage(await createPngHeader(5000, 5001)),
      'too_large',
    );
    expect(MAX_INPUT_PIXELS).toBe(25_000_000);
  });

  it('rechaza imágenes menores de 16 px', async () => {
    await expectAssetError(
      processAssetImage(await createPng(15, 32)),
      'invalid_image',
    );
  });

  it('rechaza un archivo vacío', async () => {
    await expectAssetError(
      processAssetImage(new Uint8Array()),
      'invalid_image',
    );
  });
});
