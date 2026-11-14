/**
 * Borra los artefactos de desarrollo y de build.
 *
 * Se usa `node:fs/promises` para que funcione igual en Windows, macOS y Linux
 * sin depender de `rimraf` ni de comandos del sistema.
 */
import { rm } from 'node:fs/promises';

const targets = [
  '.next',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
];

await Promise.all(
  targets.map((target) =>
    rm(new URL(`../${target}`, import.meta.url), {
      recursive: true,
      force: true,
    }),
  ),
);

console.log(`Limpieza completada: ${targets.join(', ')}.`);
