/**
 * Genera `release/SHA256SUMS` con los artefactos publicables.
 *
 * Incluye el instalador, su blockmap y `latest.yml`. El formato es el habitual
 * de `sha256sum`: `<hash>  <nombre>`, para que el usuario pueda verificar la
 * descarga con una herramienta estándar. No se incluye el propio archivo.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const RELEASE_DIR = 'release';
const SETUP_PATTERN = /^world-craft-.+-setup\.exe$/;

async function hashFile(file) {
  const hash = createHash('sha256');

  await new Promise((resolve, reject) => {
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', resolve);
  });

  return hash.digest('hex');
}

const entries = await readdir(RELEASE_DIR).catch(() => null);

if (entries === null) {
  console.error(
    `No existe la carpeta ${RELEASE_DIR}. Ejecuta antes "pnpm dist".`,
  );
  process.exit(1);
}

const setupFiles = entries.filter((name) => SETUP_PATTERN.test(name));

if (setupFiles.length === 0) {
  console.error(
    'No hay ningún instalador world-craft-*-setup.exe en release/.',
  );
  process.exit(1);
}

const artifacts = entries
  .filter(
    (name) =>
      SETUP_PATTERN.test(name) ||
      name.endsWith('.exe.blockmap') ||
      name === 'latest.yml',
  )
  .sort();

if (!artifacts.includes('latest.yml')) {
  console.error('Falta release/latest.yml; el instalador no es actualizable.');
  process.exit(1);
}

const lines = [];

for (const name of artifacts) {
  const info = await stat(join(RELEASE_DIR, name));

  if (!info.isFile() || info.size === 0) {
    console.error(`El artefacto ${name} está vacío.`);
    process.exit(1);
  }

  lines.push(`${await hashFile(join(RELEASE_DIR, name))}  ${name}`);
}

await writeFile(
  join(RELEASE_DIR, 'SHA256SUMS'),
  `${lines.join('\n')}\n`,
  'utf8',
);

console.log(
  `SHA256SUMS generado con ${lines.length} artefactos: ${artifacts.join(', ')}.`,
);
