/**
 * Genera los iconos del instalador a partir del SVG del renderer.
 *
 * `resources/icon.ico` contiene PNG de 16, 24, 32, 48, 64, 128 y 256 px y
 * `resources/icon.png` una imagen de 512 px. No se añade ninguna dependencia:
 * sharp ya es una dependencia de ejecución y el contenedor ICO se escribe a
 * mano (cabecera de 6 bytes + una entrada de 16 bytes por imagen + blobs PNG).
 *
 * Uso: `pnpm icons`. Los archivos generados se versionan.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = join(ROOT, 'src/renderer/assets/world-craft-logo.svg');
const RESOURCES_DIR = join(ROOT, 'resources');

/** Tamaños que Windows espera en un ICO multirresolución. */
export const ICO_SIZES = Object.freeze([16, 24, 32, 48, 64, 128, 256]);

/** Tamaño del PNG suelto que se usa como icono de aplicación. */
export const PNG_SIZE = 512;

const ICO_HEADER_SIZE = 6;
const ICO_ENTRY_SIZE = 16;

/**
 * Construye un ICO con imágenes PNG.
 *
 * El campo de anchura/alto usa `0` para 256 px, como exige el formato. El
 * offset de cada blob se calcula después de la tabla de entradas.
 *
 * @param {readonly { readonly size: number; readonly png: Buffer }[]} images
 * @returns {Buffer}
 */
export function createIco(images) {
  const header = Buffer.alloc(ICO_HEADER_SIZE);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo 1 = icono
  header.writeUInt16LE(images.length, 4);

  const entries = Buffer.alloc(images.length * ICO_ENTRY_SIZE);
  let offset = ICO_HEADER_SIZE + entries.length;

  images.forEach((image, index) => {
    const entryOffset = index * ICO_ENTRY_SIZE;
    const dimension = image.size >= 256 ? 0 : image.size;

    entries.writeUInt8(dimension, entryOffset);
    entries.writeUInt8(dimension, entryOffset + 1);
    entries.writeUInt8(0, entryOffset + 2); // colores de paleta
    entries.writeUInt8(0, entryOffset + 3); // reservado
    entries.writeUInt16LE(1, entryOffset + 4); // planos
    entries.writeUInt16LE(32, entryOffset + 6); // bits por píxel
    entries.writeUInt32LE(image.png.length, entryOffset + 8);
    entries.writeUInt32LE(offset, entryOffset + 12);

    offset += image.png.length;
  });

  return Buffer.concat([header, entries, ...images.map((image) => image.png)]);
}

/**
 * Renderiza el SVG en PNG cuadrado.
 *
 * @param {Buffer} svg
 * @param {number} size
 * @returns {Promise<Buffer>}
 */
export async function renderPng(svg, size) {
  return sharp(svg, { density: 384 })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const svg = await readFile(SOURCE);

  await mkdir(RESOURCES_DIR, { recursive: true });

  const images = await Promise.all(
    ICO_SIZES.map(async (size) => ({ size, png: await renderPng(svg, size) })),
  );

  await writeFile(join(RESOURCES_DIR, 'icon.ico'), createIco(images));
  await writeFile(
    join(RESOURCES_DIR, 'icon.png'),
    await renderPng(svg, PNG_SIZE),
  );

  console.log(
    `Iconos generados: resources/icon.ico (${ICO_SIZES.join(', ')} px) y resources/icon.png (${PNG_SIZE} px).`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
