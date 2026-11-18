/**
 * Comprueba los módulos nativos en los dos runtimes.
 *
 * better-sqlite3 13 y sharp 0.35 usan Node-API, así que los mismos binarios
 * deben cargar en Node y en Electron. Se verifica la versión de SQLite, la
 * disponibilidad de FTS5, una consulta real sobre una tabla virtual y que sharp
 * genere y lea un WebP 2×2.
 */
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function checkWithBetterSqlite3() {
  const Database = require('better-sqlite3');
  const database = new Database(':memory:');

  try {
    const version = database
      .prepare('SELECT sqlite_version() AS version')
      .get().version;
    const compileOptions = database
      .pragma('compile_options')
      .map((row) => row.compile_options);
    const fts5 = compileOptions.includes('ENABLE_FTS5');

    if (!fts5) {
      throw new Error('SQLite no incluye FTS5.');
    }

    database.exec(
      "CREATE VIRTUAL TABLE probe USING fts5(text); INSERT INTO probe(text) VALUES ('world craft');",
    );

    const match = database
      .prepare("SELECT count(*) AS total FROM probe WHERE probe MATCH 'craft'")
      .get().total;

    if (match !== 1) {
      throw new Error('FTS5 no devuelve resultados.');
    }

    return { sqliteVersion: version, fts5 };
  } finally {
    database.close();
  }
}

async function checkWithSharp() {
  const sharp = require('sharp');
  const buffer = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 12, g: 34, b: 56 },
    },
  })
    .webp()
    .toBuffer();
  const metadata = await sharp(buffer).metadata();

  if (
    metadata.format !== 'webp' ||
    metadata.width !== 2 ||
    metadata.height !== 2
  ) {
    throw new Error('sharp no genera y lee un WebP 2×2.');
  }

  return { vips: sharp.versions.vips };
}

async function checkInNode() {
  if (process.versions.electron !== undefined) {
    throw new Error('Este proceso no es Node puro.');
  }

  return {
    ...checkWithBetterSqlite3(),
    ...(await checkWithSharp()),
  };
}

async function checkInElectron() {
  const electronBinary = require('electron');
  const betterSqlite3Path = require.resolve('better-sqlite3');
  const sharpPath = require.resolve('sharp');
  const applicationRoot = await mkdtemp(join(tmpdir(), 'world-craft-native-'));
  const script = join(applicationRoot, 'main.cjs');
  const resultFile = join(applicationRoot, 'result.json');

  const source = `
const { app } = require('electron');
const { writeFileSync } = require('node:fs');
// Rutas absolutas: el script vive fuera del repositorio y Node no encontraría
// node_modules al subir desde la carpeta temporal.
const Database = require(${JSON.stringify(betterSqlite3Path)});
const sharp = require(${JSON.stringify(sharpPath)});

const resultFile = ${JSON.stringify(resultFile)};

function finish(result, code) {
  try {
    writeFileSync(resultFile, JSON.stringify(result), 'utf8');
  } catch {
    code = 1;
  }

  app.exit(code);
}

app.whenReady().then(async () => {
  const database = new Database(':memory:');

  try {
    const version = database.prepare('SELECT sqlite_version() AS version').get().version;
    const fts5 = database
      .pragma('compile_options')
      .some((row) => row.compile_options === 'ENABLE_FTS5');

    if (!fts5) {
      throw new Error('SQLite no incluye FTS5.');
    }

    database.exec("CREATE VIRTUAL TABLE probe USING fts5(text); INSERT INTO probe(text) VALUES ('world craft');");
    const match = database.prepare("SELECT count(*) AS total FROM probe WHERE probe MATCH 'craft'").get().total;

    if (match !== 1) {
      throw new Error('FTS5 no devuelve resultados.');
    }

    const webp = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: { r: 12, g: 34, b: 56 },
      },
    })
      .webp()
      .toBuffer();
    const metadata = await sharp(webp).metadata();

    if (metadata.format !== 'webp' || metadata.width !== 2 || metadata.height !== 2) {
      throw new Error('sharp no genera y lee un WebP 2×2.');
    }

    finish({ sqliteVersion: version, fts5, vips: sharp.versions.vips }, 0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    finish({ error: true }, 1);
  } finally {
    database.close();
  }
});
`;

  try {
    await writeFile(script, source, 'utf8');

    const result = spawnSync(electronBinary, [script], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
      timeout: 60_000,
      windowsHide: true,
      // Electron lanza procesos auxiliares que pueden heredar los pipes;
      // esperar al cierre de stdio alargaría el comando hasta el timeout. El
      // resultado real se lee del archivo JSON.
      stdio: 'ignore',
    });

    if (result.error !== undefined) {
      throw result.error;
    }

    if (result.status !== 0) {
      throw new Error(`Electron terminó con código ${result.status}.`);
    }

    return JSON.parse(await readFile(resultFile, 'utf8'));
  } finally {
    await rm(applicationRoot, { recursive: true, force: true });
  }
}

const nodeResult = await checkInNode();
const electronResult = await checkInElectron();

if (nodeResult.sqliteVersion !== electronResult.sqliteVersion) {
  console.error(
    `verify:native ha fallado: Node usa SQLite ${nodeResult.sqliteVersion} y Electron ${electronResult.sqliteVersion}.`,
  );
  process.exit(1);
}

if (nodeResult.vips !== electronResult.vips) {
  console.error(
    `verify:native ha fallado: Node usa libvips ${nodeResult.vips} y Electron ${electronResult.vips}.`,
  );
  process.exit(1);
}

console.log(
  `verify:native correcto: better-sqlite3 y sharp cargan en Node y Electron; SQLite ${nodeResult.sqliteVersion} con FTS5, libvips ${nodeResult.vips}.`,
);
