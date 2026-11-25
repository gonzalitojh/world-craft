/**
 * Comprueba el utility process de transferencia.
 *
 * Electron lanza `out/main/transfer-worker.cjs` con `utilityProcess.fork` y le
 * pide una sonda. El worker carga better-sqlite3 y sharp desde `node_modules`
 * externalizado y devuelve sus versiones. Si el worker no arranca, no puede
 * cargar un módulo nativo o no responde, el comando falla.
 *
 * Uso: `pnpm build && pnpm verify:worker`.
 */
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
/**
 * Sin argumento comprueba el build de desarrollo. Con un argumento permite
 * probar el worker dentro de `app.asar` de una build empaquetada; en ese caso
 * `stat` no puede leer la ruta (solo Electron entiende el asar) y se deja que
 * `utilityProcess.fork` valide la carga real.
 */
const workerArgument = process.argv[2];
const WORKER_PATH = resolve(workerArgument ?? 'out/main/transfer-worker.cjs');

if (workerArgument === undefined) {
  const workerInfo = await stat(WORKER_PATH).catch(() => null);

  if (workerInfo === null || !workerInfo.isFile() || workerInfo.size === 0) {
    console.error(
      'verify:worker ha fallado: falta out/main/transfer-worker.cjs. Ejecuta pnpm build antes.',
    );
    process.exit(1);
  }
}

const electronBinary = require('electron');
const applicationRoot = await mkdtemp(join(tmpdir(), 'world-craft-worker-'));
const mainScript = join(applicationRoot, 'main.cjs');
const resultFile = join(applicationRoot, 'result.json');
const operationId = '018f0000-0000-7000-8000-00000000feed';

const source = `
const { app, utilityProcess } = require('electron');
const { writeFileSync } = require('node:fs');

const resultFile = ${JSON.stringify(resultFile)};
const workerPath = ${JSON.stringify(WORKER_PATH)};
const operationId = ${JSON.stringify(operationId)};

let finished = false;

function finish(result, code) {
  if (finished) return;
  finished = true;

  try {
    writeFileSync(resultFile, JSON.stringify(result), 'utf8');
  } catch {
    code = 1;
  }

  app.exit(code);
}

const timer = setTimeout(() => finish({ error: 'timeout' }, 1), 30000);

app.whenReady().then(() => {
  const child = utilityProcess.fork(workerPath, [], {
    serviceName: 'world-craft-transfer-probe',
    stdio: 'ignore',
  });

  child.on('message', (message) => {
    if (message && message.type === 'probe-result') {
      clearTimeout(timer);
      finish(message, 0);
    } else if (message && message.type === 'error') {
      clearTimeout(timer);
      finish({ error: message.code }, 1);
    }
  });

  child.on('exit', (code) => {
    clearTimeout(timer);
    finish({ error: 'worker-exit', code }, 1);
  });

  child.postMessage({
    type: 'probe',
    protocolVersion: 1,
    operationId,
  });
});
`;

try {
  await writeFile(mainScript, source, 'utf8');

  const result = spawnSync(electronBinary, [mainScript], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    timeout: 60_000,
    windowsHide: true,
    stdio: 'ignore',
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Electron terminó con código ${result.status}.`);
  }

  const probe = JSON.parse(await readFile(resultFile, 'utf8'));

  if (
    typeof probe.sqliteVersion !== 'string' ||
    typeof probe.vipsVersion !== 'string'
  ) {
    throw new Error('El worker no devolvió las versiones de los módulos.');
  }

  if (probe.type !== 'probe-result') {
    throw new Error('El worker devolvió una respuesta inesperada.');
  }

  console.log(
    `verify:worker correcto: utility process con better-sqlite3 ${probe.sqliteVersion} y libvips ${probe.vipsVersion}.`,
  );
} catch (error) {
  console.error(
    `verify:worker ha fallado: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  await rm(applicationRoot, { recursive: true, force: true });
}
