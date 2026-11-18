/**
 * Verifica los artefactos del build de escritorio.
 *
 * Comprueba que existen los tres procesos, que el HTML lleva la CSP de
 * producción antes de los scripts y que no se cuela contenido remoto ni
 * `unsafe-eval` / `unsafe-inline`. Sale con código 1 si algo falla; el job
 * `build` de CI lo ejecuta después de `pnpm build`.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const RENDERER_DIR = 'out/renderer';

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

const html = await checkArtifact('out/renderer/index.html');

for (const artifact of REQUIRED_ARTIFACTS) {
  if (artifact !== 'out/renderer/index.html') {
    await checkArtifact(artifact);
  }
}

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
  'verify:build correcto: artefactos presentes, CSP estricta y sin URLs remotas.',
);
