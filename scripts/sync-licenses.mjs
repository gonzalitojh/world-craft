/**
 * Copia a `resources/licenses/` los textos completos de licencia de las
 * dependencias de ejecución que acompañan al instalador.
 *
 * Se versionan para que el paquete pueda distribuirse sin depender de que la
 * carpeta `node_modules` esté presente. Si falta algún paquete, el script falla
 * con un mensaje accionable: no se generan avisos incompletos.
 *
 * Uso: `pnpm licenses:sync`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT_DIR = join(ROOT, 'resources/licenses');
/**
 * Texto OFL de la fuente empaquetada. La copia canónica vive junto al activo
 * (`src/renderer/assets/fonts/source-serif-4/OFL.txt`) y se replica aquí para
 * que el instalador la publique en `licenses/`; no se edita en este script.
 */
const SOURCE_SERIF_OFL = join(
  ROOT,
  'src/renderer/assets/fonts/source-serif-4/OFL.txt',
);

/**
 * Resuelve la carpeta de un paquete instalado. `@img/sharp-win32-*` es una
 * dependencia opcional: en Windows solo está instalada la del adaptador
 * nativo de la máquina.
 *
 * @param {string} specifier
 * @returns {string}
 */
function resolvePackageDirectory(specifier) {
  // `require.resolve(specifier)` apunta al entrypoint; se sube hasta la
  // carpeta cuyo package.json declara el mismo nombre. Algunos paquetes no
  // exportan `./package.json`, así que no se puede resolver directamente.
  let directory = dirname(require.resolve(specifier));

  while (true) {
    const packageFile = join(directory, 'package.json');

    if (existsSync(packageFile)) {
      const manifest = JSON.parse(readFileSync(packageFile, 'utf8'));

      if (manifest.name === specifier) {
        return directory;
      }
    }

    const parent = dirname(directory);

    if (parent === directory) {
      throw new Error(`No se encontró la carpeta del paquete ${specifier}.`);
    }

    directory = parent;
  }
}

/**
 * Copia un archivo de licencia verificando que existe y no está vacío.
 *
 * @param {string} source
 * @param {string} targetName
 * @returns {Promise<string>}
 */
async function copyLicense(source, targetName) {
  const info = await stat(source).catch(() => null);

  if (info === null || !info.isFile() || info.size === 0) {
    throw new Error(`No se encontró el texto de licencia: ${source}`);
  }

  const contents = await readFile(source, 'utf8');

  if (contents.trim().length === 0) {
    throw new Error(`El texto de licencia está vacío: ${source}`);
  }

  await copyFile(source, join(OUTPUT_DIR, targetName));

  return targetName;
}

/**
 * Localiza el paquete de plataforma de sharp. El texto es idéntico para
 * `@img/sharp-win32-x64` y `@img/sharp-win32-arm64`; se usa el instalado en la
 * máquina y se publica con un nombre neutro.
 *
 * @returns {string}
 */
function resolveSharpPlatformPackage() {
  const sharpDirectory = resolvePackageDirectory('sharp');
  const imageModulesDirectory = join(sharpDirectory, '..', '@img');

  for (const name of [
    'sharp-win32-x64',
    'sharp-win32-arm64',
    'sharp-win32-ia32',
  ]) {
    const candidate = join(imageModulesDirectory, name);

    if (existsSync(join(candidate, 'LICENSE'))) {
      return candidate;
    }
  }

  throw new Error(
    'No se encontró ningún paquete @img/sharp-win32-* instalado.',
  );
}

/**
 * Textos curados a mano desde las fuentes oficiales de GNU.
 *
 * No se generan desde `node_modules` porque el paquete de plataforma de sharp
 * solo incluye Apache-2.0; LGPL-3.0 y GPL-3.0 se copian del texto publicado
 * por la Free Software Foundation y se versionan en `resources/licenses/`.
 * Este script comprueba que siguen ahí y que no están vacíos.
 */
const CURATED_LICENSES = [
  {
    name: 'libvips-LICENSE.txt',
    marker: 'GNU LESSER GENERAL PUBLIC LICENSE',
  },
  {
    name: 'gpl-3.0.txt',
    marker: 'GNU GENERAL PUBLIC LICENSE',
  },
];

/**
 * Comprueba un texto de licencia curado.
 *
 * @param {{ readonly name: string; readonly marker: string }} license
 * @returns {Promise<string>}
 */
async function assertCuratedLicense(license) {
  const file = join(OUTPUT_DIR, license.name);
  const info = await stat(file).catch(() => null);

  if (info === null || !info.isFile() || info.size === 0) {
    throw new Error(
      `Falta el texto de licencia curado ${license.name}. Recupéralo de https://www.gnu.org/licenses/ antes de empaquetar.`,
    );
  }

  const contents = await readFile(file, 'utf8');

  if (!contents.includes(license.marker)) {
    throw new Error(
      `El texto de licencia ${license.name} no contiene "${license.marker}".`,
    );
  }

  return license.name;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const sharpDirectory = resolvePackageDirectory('sharp');
  const sharpPlatformDirectory = resolveSharpPlatformPackage();
  const electronUpdaterDirectory = resolvePackageDirectory('electron-updater');
  const tiptapDirectory = resolvePackageDirectory('@tiptap/react');

  const copied = [
    await copyLicense(join(sharpDirectory, 'LICENSE'), 'sharp-LICENSE.txt'),
    await copyLicense(
      join(sharpPlatformDirectory, 'LICENSE'),
      'img-sharp-win32-LICENSE.txt',
    ),
    await copyLicense(
      join(electronUpdaterDirectory, 'LICENSE'),
      'electron-updater-LICENSE.txt',
    ),
    await copyLicense(
      join(tiptapDirectory, 'LICENSE.md'),
      'tiptap-LICENSE.txt',
    ),
    await copyLicense(SOURCE_SERIF_OFL, 'source-serif-4-OFL.txt'),
  ];

  for (const license of CURATED_LICENSES) {
    copied.push(await assertCuratedLicense(license));
  }

  console.log(
    `Licencias sincronizadas en ${resolve(OUTPUT_DIR)}: ${copied.join(', ')}.`,
  );
}

await main();
