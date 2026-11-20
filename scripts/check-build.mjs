/**
 * Verifica los artefactos del build de escritorio.
 *
 * Comprueba que existen los tres procesos, que el HTML lleva la CSP de
 * producción antes de los scripts, que no se cuela contenido remoto ni
 * `unsafe-eval` / `unsafe-inline`, que las migraciones se copian a
 * `out/main/drizzle` y que el módulo nativo y Drizzle quedan externalizados.
 * Sale con código 1 si algo falla; el job `build` de CI lo ejecuta después de
 * `pnpm build`.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const RENDERER_DIR = 'out/renderer';
const DRIZZLE_DIR = 'out/main/drizzle';

const REQUIRED_ARTIFACTS = [
  'out/main/index.cjs',
  'out/preload/index.cjs',
  'out/renderer/index.html',
];

const REQUIRED_CSP_DIRECTIVES = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: wc-asset:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
];

/**
 * `http://www.w3.org/...` son identificadores de espacio de nombres XML que
 * React incluye como cadenas; `https://react.dev/errors/` es el prefijo de los
 * enlaces de documentación de los mensajes de error de React. Ninguno se
 * solicita por red.
 */
const ALLOWED_REMOTE_HOSTS = new Set(['www.w3.org', 'react.dev']);

/** El HTML generado escapa las comillas simples de la CSP como `&#39;`. */
function decodeHtmlEntities(text) {
  return text
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

const failures = [];

function fail(message) {
  failures.push(message);
}

async function checkArtifact(relativePath) {
  const info = await stat(relativePath).catch(() => null);

  if (info === null) {
    fail(`Falta el artefacto ${relativePath}.`);
    return null;
  }

  if (!info.isFile() || info.size === 0) {
    fail(`El artefacto ${relativePath} está vacío o no es un archivo.`);
    return null;
  }

  return readFile(relativePath, 'utf8');
}

function checkContentSecurityPolicy(html) {
  const metaTag = html.match(
    /<meta[^>]*http-equiv="Content-Security-Policy"[^>]*>/i,
  );

  if (metaTag === null) {
    fail('El HTML de producción no incluye la meta Content-Security-Policy.');
    return;
  }

  const content = decodeHtmlEntities(
    metaTag[0].match(/content="([^"]+)"/i)?.[1] ?? '',
  );

  for (const directive of REQUIRED_CSP_DIRECTIVES) {
    if (!content.includes(directive)) {
      fail(`La CSP de producción no incluye la directiva: ${directive}.`);
    }
  }

  for (const forbidden of ["'unsafe-eval'", "'unsafe-inline'"]) {
    if (content.includes(forbidden)) {
      fail(`La CSP de producción contiene ${forbidden}.`);
    }
  }

  const scriptIndex = html.search(/<script\b/i);
  if (scriptIndex !== -1 && html.indexOf(metaTag[0]) > scriptIndex) {
    fail('La meta Content-Security-Policy debe ir antes de cualquier script.');
  }
}

function checkRemoteUrls(label, text) {
  const matches = text.matchAll(/(?:https?|wss?):\/\/[^\s"'`<>)\\]+/g);

  for (const match of matches) {
    const rawUrl = match[0];
    let hostname;

    try {
      hostname = new URL(rawUrl).hostname;
    } catch {
      continue;
    }

    // Los filtros de `webRequest` son patrones (`http://*/*`, `ws://*/*`), no
    // destinos que se carguen.
    if (hostname.includes('*')) {
      continue;
    }

    if (!ALLOWED_REMOTE_HOSTS.has(hostname)) {
      fail(`Se encontró una URL remota en ${label}: ${rawUrl}.`);
    }
  }
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
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

/** Comprueba que las migraciones viajan con el bundle de `main`. */
async function checkDrizzleMigrations() {
  const journalText = await checkArtifact(`${DRIZZLE_DIR}/meta/_journal.json`);

  await checkArtifact(`${DRIZZLE_DIR}/0000_init.sql`);

  if (journalText === null) {
    return;
  }

  let journal;

  try {
    journal = JSON.parse(journalText);
  } catch {
    fail('El journal de migraciones copiado al build no es JSON válido.');
    return;
  }

  if (
    journal === null ||
    typeof journal !== 'object' ||
    !Array.isArray(journal.entries) ||
    journal.entries.length === 0
  ) {
    fail('El journal de migraciones copiado al build no tiene entradas.');
    return;
  }

  for (const [index, entry] of journal.entries.entries()) {
    if (
      entry === null ||
      typeof entry !== 'object' ||
      typeof entry.tag !== 'string' ||
      !/^\d{4}_[a-z0-9]+(?:_[a-z0-9]+)*$/.test(entry.tag)
    ) {
      fail(
        `El journal contiene una etiqueta de migración no válida: ${index}.`,
      );
      continue;
    }

    if (entry.idx !== index) {
      fail(
        `El journal contiene una secuencia de migraciones no válida: ${index}.`,
      );
    }

    await checkArtifact(`${DRIZZLE_DIR}/${entry.tag}.sql`);
  }
}

/** Comprueba que los módulos nativos y Drizzle no se han empaquetado. */
function checkExternalizedDependencies(mainBundle) {
  if (mainBundle === null) {
    return;
  }

  if (!/require\(["']better-sqlite3["']\)/.test(mainBundle)) {
    fail('better-sqlite3 no está externalizado en out/main/index.cjs.');
  }

  if (!/require\(["']drizzle-orm\/better-sqlite3["']\)/.test(mainBundle)) {
    fail('drizzle-orm no está externalizado en out/main/index.cjs.');
  }
}

/**
 * Comprueba que electron-updater y su runtime no viajan dentro del bundle.
 *
 * El actualizador conserva su propio ciclo de vida y usa la sesión de Electron;
 * debe cargarse desde `node_modules` y quedar como dependencia, nunca inlineado
 * en los chunks de `out/main`. El adaptador se carga con `import()` dinámico,
 * así que se aceptan tanto `require()` como `import()`.
 */
async function checkUpdaterNotBundled(mainBundles) {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const bundleText = mainBundles.join('\n');

  for (const dependency of ['electron-updater', 'builder-util-runtime']) {
    const version = packageJson.dependencies?.[dependency];

    if (typeof version !== 'string' || version.length === 0) {
      fail(`${dependency} no está declarado como dependencia de ejecución.`);
    }
  }

  for (const dependency of ['electron-updater', 'builder-util-runtime']) {
    const externalized = new RegExp(
      `(?:require\\(["']${dependency}["']\\)|import\\(["']${dependency}["']\\))`,
    ).test(bundleText);

    if (!externalized) {
      fail(`${dependency} no está externalizado en out/main.`);
    }
  }

  for (const marker of [
    'node_modules/electron-updater',
    'node_modules\\\\electron-updater',
    'electron-updater/out/AppUpdater',
    'builder-util-runtime/out/',
  ]) {
    if (bundleText.includes(marker)) {
      fail('El actualizador está empaquetado dentro de out/main.');
    }
  }
}

/**
 * Comprueba que sharp es una dependencia de ejecución y no viaja empaquetado.
 *
 * `src/main/assets/image.ts` importa sharp, pero hoy ese módulo no es
 * alcanzable desde el entrypoint (la importación se expone con las fichas, en
 * M1), así que el bundle puede no mencionarlo. Lo que nunca debe ocurrir es que
 * su código y sus binarios acaben dentro del bundle: eso se detecta por las
 * rutas internas del paquete y por el cargador de libvips.
 */
async function checkSharpNotBundled(mainBundle) {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

  if (
    typeof packageJson.dependencies?.sharp !== 'string' ||
    packageJson.dependencies.sharp.length === 0
  ) {
    fail('sharp no está declarado como dependencia de ejecución.');
  }

  if (mainBundle === null) {
    return;
  }

  for (const marker of [
    'node_modules/sharp',
    'node_modules\\\\sharp',
    'sharp/lib/constructor',
    'libvips-cpp',
  ]) {
    if (mainBundle.includes(marker)) {
      fail('sharp está empaquetado dentro de out/main/index.cjs.');
    }
  }
}

const html = await checkArtifact('out/renderer/index.html');
const mainBundle = await checkArtifact('out/main/index.cjs');
const mainBundles = await Promise.all(
  (await collectFiles('out/main').catch(() => []))
    .filter((file) => file.endsWith('.cjs') || file.endsWith('.js'))
    .map((file) => readFile(file, 'utf8')),
);

for (const artifact of REQUIRED_ARTIFACTS) {
  if (
    artifact !== 'out/renderer/index.html' &&
    artifact !== 'out/main/index.cjs'
  ) {
    await checkArtifact(artifact);
  }
}

await checkDrizzleMigrations();
checkExternalizedDependencies(mainBundle);
await checkSharpNotBundled(mainBundle);
await checkUpdaterNotBundled(mainBundles);

if (html !== null) {
  checkContentSecurityPolicy(html);
  checkRemoteUrls('out/renderer/index.html', html);
}

// Se revisan los tres procesos: el renderer es lo que carga la ventana y main y
// preload pueden contener destinos de red. Los patrones de filtro de
// `webRequest` con comodín se ignoran porque no son peticiones reales.
const builtFiles = await collectFiles(RENDERER_DIR).catch(() => []);

for (const directory of ['out/main', 'out/preload']) {
  builtFiles.push(...(await collectFiles(directory).catch(() => [])));
}

for (const file of builtFiles) {
  if (file === join(RENDERER_DIR, 'index.html')) {
    continue;
  }

  const contents = await readFile(file, 'utf8');
  checkRemoteUrls(file, contents);
}

if (failures.length > 0) {
  console.error('verify:build ha fallado:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log(
  'verify:build correcto: artefactos presentes, CSP estricta, sin URLs remotas, migraciones copiadas y módulos nativos y actualizador externalizados.',
);
