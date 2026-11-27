/**
 * Verifica el paquete generado por electron-builder.
 *
 * Modo por defecto: comprueba `release/win-*-unpacked` (asar, módulos nativos
 * desempaquetados, app-update.yml, licencias y ProductVersion). Con
 * `--installer` exige además el instalador, `latest.yml`, blockmap y
 * `SHA256SUMS`. No detecta instaladores antiguos por su cuenta.
 *
 * Solo se ejecuta en Windows porque lee la versión del ejecutable con
 * PowerShell. Sale con código 1 si falta cualquier comprobación.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const RELEASE_DIR = 'release';
const REQUIRED_LICENSE_FILES = [
  'sharp-LICENSE.txt',
  'img-sharp-win32-LICENSE.txt',
  'libvips-LICENSE.txt',
  'gpl-3.0.txt',
  'maplibre-gl-LICENSE.txt',
  'terra-draw-LICENSE.txt',
  'terra-draw-maplibre-gl-adapter-LICENSE.txt',
  'electron-updater-LICENSE.txt',
  'tiptap-LICENSE.txt',
  'source-serif-4-OFL.txt',
  'yauzl-LICENSE.txt',
  'yazl-LICENSE.txt',
  'pend-LICENSE.txt',
  'buffer-crc32-LICENSE.txt',
];

const failures = [];

function fail(message) {
  failures.push(message);
}

async function exists(path) {
  return (await stat(path).catch(() => null)) !== null;
}

async function checkFile(path) {
  const info = await stat(path).catch(() => null);

  if (info === null) {
    fail(`Falta el archivo ${path}.`);
    return false;
  }

  if (!info.isFile() || info.size === 0) {
    fail(`El archivo ${path} está vacío o no es un archivo.`);
    return false;
  }

  return true;
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  const files = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

/**
 * Lista el contenido de `app.asar` con la librería que ya usa
 * electron-builder. Se resuelve desde su carpeta para no depender de que el
 * paquete esté hoisteado en la raíz.
 *
 * @param {string} asarPath
 * @returns {readonly string[] | null}
 */
function listAsarContents(asarPath) {
  try {
    const electronBuilderDirectory = dirname(
      require.resolve('electron-builder'),
    );
    const asar = require(
      require.resolve('@electron/asar', {
        paths: [electronBuilderDirectory],
      }),
    );
    const files = asar.listPackage(asarPath);

    return Array.isArray(files)
      ? files.map((file) => file.replaceAll('\\', '/'))
      : null;
  } catch {
    return null;
  }
}

function checkWorkerInAsar(asarPath) {
  const files = listAsarContents(asarPath);

  if (files === null) {
    fail('No se pudo leer el contenido de app.asar.');
    return;
  }

  for (const required of [
    '/out/main/index.cjs',
    '/out/main/transfer-worker.cjs',
  ]) {
    if (!files.some((file) => file.endsWith(required))) {
      fail(`app.asar no contiene ${required}.`);
    }
  }
}

async function findUnpackedDirectory() {
  const candidates = [
    'win-unpacked',
    'win-arm64-unpacked',
    'win-ia32-unpacked',
  ];

  for (const candidate of candidates) {
    const directory = join(RELEASE_DIR, candidate);

    if (await exists(directory)) {
      return directory;
    }
  }

  return null;
}

function readScalar(text, key) {
  const match = text.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));

  if (match === null) {
    return null;
  }

  return (match[1] ?? '').trim().replace(/^['"]|['"]$/g, '');
}

function runPowerShellProductVersion(exePath) {
  const escaped = exePath.replaceAll("'", "''");
  const script = `(Get-Item -LiteralPath '${escaped}').VersionInfo.ProductVersion`;
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { encoding: 'utf8', windowsHide: true },
  );

  if (result.error !== undefined || result.status !== 0) {
    return null;
  }

  return result.stdout.trim();
}

async function hashFile(file, algorithm = 'sha256', encoding = 'hex') {
  const hash = createHash(algorithm);

  await new Promise((resolve, reject) => {
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', resolve);
  });

  return hash.digest(encoding);
}

async function checkUnpacked(pkg) {
  const unpacked = await findUnpackedDirectory();

  if (unpacked === null) {
    fail('No existe release/win-unpacked ni release/win-<arch>-unpacked.');
    return null;
  }

  const resources = join(unpacked, 'resources');
  const asar = join(resources, 'app.asar');
  const asarUnpacked = join(resources, 'app.asar.unpacked');
  const exe = join(unpacked, 'World Craft.exe');
  const appUpdate = join(resources, 'app-update.yml');

  if (await checkFile(asar)) {
    checkWorkerInAsar(asar);
  }

  await checkFile(exe);
  await checkFile(join(unpacked, 'LICENSE'));
  await checkFile(join(unpacked, 'THIRD-PARTY-NOTICES.md'));

  for (const name of REQUIRED_LICENSE_FILES) {
    await checkFile(join(unpacked, 'licenses', name));
  }

  await checkFile(join('resources', 'icon.ico'));

  if (!(await exists(asarUnpacked))) {
    fail('Falta resources/app.asar.unpacked.');
    return unpacked;
  }

  await checkFile(join(asarUnpacked, 'node_modules', 'sharp', 'package.json'));
  await checkFile(
    join(asarUnpacked, 'node_modules', 'better-sqlite3', 'package.json'),
  );

  const unpackedFiles = await collectFiles(asarUnpacked);
  const nativeFiles = unpackedFiles.filter((file) => file.endsWith('.node'));
  const imgNativeFiles = nativeFiles.filter((file) =>
    file.includes(`${join('node_modules', '@img')}`),
  );
  const sqliteNativeFiles = nativeFiles.filter((file) =>
    file.includes(`${join('node_modules', 'better-sqlite3')}`),
  );

  if (sqliteNativeFiles.length === 0) {
    fail('better-sqlite3 no incluye ningún binario .node desempaquetado.');
  }

  if (imgNativeFiles.length === 0) {
    fail('@img/sharp-win32-* no incluye ningún binario .node desempaquetado.');
  }

  if (!sqliteNativeFiles.some((file) => file.endsWith('win32-x64.node'))) {
    fail('better-sqlite3 no incluye el prebuild win32-x64.node.');
  }

  if (
    !imgNativeFiles.some(
      (file) => file.includes('sharp-win32-x64') && file.endsWith('.node'),
    )
  ) {
    fail('@img/sharp-win32-x64 no incluye su binario .node.');
  }

  if (nativeFiles.length < 2) {
    fail('app.asar.unpacked no contiene los binarios nativos esperados.');
  }

  const foreignNativeFiles = nativeFiles.filter((file) => {
    const normalized = file.replaceAll('\\', '/');

    return (
      normalized.includes('sharp-win32-arm64') ||
      normalized.includes('sharp-win32-ia32') ||
      /(?:darwin|linux|linuxmusl|freebsd|win32-arm64|win32-ia32)/.test(
        normalized,
      )
    );
  });

  if (foreignNativeFiles.length > 0) {
    fail(
      `El paquete x64 incluye binarios nativos de otra plataforma: ${foreignNativeFiles
        .map((file) => file.split('app.asar.unpacked/')[1] ?? file)
        .join(', ')}.`,
    );
  }

  if (await checkFile(appUpdate)) {
    const text = await readFile(appUpdate, 'utf8');

    if (readScalar(text, 'provider') !== 'github') {
      fail('app-update.yml no declara el proveedor github.');
    }

    if (readScalar(text, 'owner') !== 'gonzalitojh') {
      fail('app-update.yml no apunta al propietario esperado.');
    }

    if (readScalar(text, 'repo') !== 'world-craft') {
      fail('app-update.yml no apunta al repositorio esperado.');
    }

    if (readScalar(text, 'updaterCacheDirName') === null) {
      fail('app-update.yml no declara updaterCacheDirName.');
    }

    if (readScalar(text, 'publisherName') !== null) {
      fail('app-update.yml incluye publisherName en un instalador sin firma.');
    }

    for (const forbidden of ['token', 'password', 'secret', 'authorization']) {
      if (text.toLowerCase().includes(forbidden)) {
        fail(`app-update.yml contiene el campo prohibido "${forbidden}".`);
      }
    }
  }

  const productVersion = runPowerShellProductVersion(exe);

  if (productVersion === null) {
    fail('No se pudo leer ProductVersion del ejecutable.');
  } else {
    const normalized = productVersion.split('.').slice(0, 3).join('.');

    if (normalized !== pkg.version) {
      fail(
        `ProductVersion (${productVersion}) no coincide con package.json (${pkg.version}).`,
      );
    }
  }

  return { unpacked, nativeFiles };
}

async function checkInstaller(pkg, required) {
  const setupName = `world-craft-${pkg.version}-setup.exe`;
  const setupPath = join(RELEASE_DIR, setupName);
  const blockmapPath = `${setupPath}.blockmap`;
  const latestPath = join(RELEASE_DIR, 'latest.yml');
  const sumsPath = join(RELEASE_DIR, 'SHA256SUMS');
  const hasSetup = await exists(setupPath);

  if (!hasSetup && !required) {
    return false;
  }

  await checkFile(setupPath);
  await checkFile(blockmapPath);

  if (!(await checkFile(latestPath))) {
    return hasSetup;
  }

  const latest = await readFile(latestPath, 'utf8');
  const latestVersion = readScalar(latest, 'version');
  const latestPathField = readScalar(latest, 'path');
  const latestSha = readScalar(latest, 'sha512');
  const latestSize = Number(readScalar(latest, 'size'));

  if (latestVersion !== pkg.version) {
    fail(
      `latest.yml declara la versión ${latestVersion ?? 'desconocida'} y package.json ${pkg.version}.`,
    );
  }

  if (latestPathField !== setupName) {
    fail(`latest.yml no apunta a ${setupName}.`);
  }

  if (latestSha === null || latestSha.length === 0) {
    fail('latest.yml no incluye sha512.');
  }

  const setupInfo = await stat(setupPath).catch(() => null);

  if (!Number.isFinite(latestSize) || latestSize <= 0) {
    fail('latest.yml no incluye un tamaño válido.');
  } else if (setupInfo !== null && latestSize !== setupInfo.size) {
    fail('El tamaño de latest.yml no coincide con el instalador.');
  }

  if (latestSha !== null && latestSha.length > 0) {
    const actualSha = await hashFile(setupPath, 'sha512', 'base64');

    if (actualSha !== latestSha) {
      fail('El sha512 de latest.yml no coincide con el instalador.');
    }
  }

  if (!(await checkFile(sumsPath))) {
    return hasSetup;
  }

  const sumsText = await readFile(sumsPath, 'utf8');
  const sums = new Map();

  for (const line of sumsText.split(/\r?\n/)) {
    const match = line.match(/^([0-9a-f]{64}) {2}(.+)$/);

    if (match !== null) {
      sums.set(match[2], match[1]);
    }
  }

  for (const name of [setupName, `${setupName}.blockmap`, 'latest.yml']) {
    const expected = sums.get(name);

    if (expected === undefined) {
      fail(`SHA256SUMS no incluye ${name}.`);
      continue;
    }

    const actual = await hashFile(join(RELEASE_DIR, name));

    if (actual !== expected) {
      fail(`El SHA-256 de ${name} no coincide con SHA256SUMS.`);
    }
  }

  return hasSetup;
}

const pkg = JSON.parse(await readFile('package.json', 'utf8'));

if (process.platform !== 'win32') {
  console.error('verify:package solo se ejecuta en Windows.');
  process.exit(1);
}

const unpacked = await checkUnpacked(pkg);
const requireInstaller = process.argv.includes('--installer');
const installer = requireInstaller ? await checkInstaller(pkg, true) : false;

if (requireInstaller && !installer) {
  fail('Se exigió el instalador pero no existe world-craft-*-setup.exe.');
}

if (failures.length > 0) {
  console.error('verify:package ha fallado:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

const nativeList = unpacked?.nativeFiles
  .map((file) => file.replaceAll('\\', '/').split('app.asar.unpacked/')[1])
  .sort();

console.log(
  `verify:package correcto: ${unpacked?.unpacked ?? 'sin carpeta'} con ${nativeList?.length ?? 0} binarios nativos y ${installer ? 'instalador verificado' : 'sin instalador'}.`,
);

for (const file of nativeList ?? []) {
  console.log(`- ${file}`);
}
