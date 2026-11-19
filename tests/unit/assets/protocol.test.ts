import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { AssetLogger, AssetLogEntry } from '@/main/assets/logger';
import {
  handleAssetRequest,
  registerAssetProtocol,
  registerAssetScheme,
  statusForAssetErrorCode,
  toAssetResponse,
  type AssetProtocolHost,
  type AssetProtocolResponse,
} from '@/main/assets/protocol';
import type { AssetRecord } from '@/main/assets/store';
import { createUuidv7Generator } from '@/main/db/ids';

const generator = createUuidv7Generator({
  now: () => 1_760_000_000_000,
  random: (size) => Buffer.alloc(size, 0x66),
});

const WORLD_ID = generator.generate();
const ASSET_ID = generator.generate();

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-protocol-'));
  temporaryDirectories.push(directory);

  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function relativePath(worldId = WORLD_ID, thumb = false): string {
  return `worlds/${worldId}/${ASSET_ID}${thumb ? '.thumb.webp' : '.webp'}`;
}

function createRecord(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    id: ASSET_ID,
    worldId: WORLD_ID,
    kind: 'image',
    relativePath: relativePath(),
    mime: 'image/webp',
    size: 4,
    width: 10,
    height: 10,
    alt: null,
    hash: 'c'.repeat(64),
    createdAt: 1_760_000_000_000,
    ...overrides,
  };
}

async function writeAsset(
  assetsDir: string,
  relative: string,
  contents: string,
): Promise<string> {
  const absolutePath = join(assetsDir, ...relative.split('/'));

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, 'utf8');

  return absolutePath;
}

function createLogger(): { logger: AssetLogger; entries: AssetLogEntry[] } {
  const entries: AssetLogEntry[] = [];

  return {
    entries,
    logger: {
      log(entry) {
        entries.push(entry);
      },
    },
  };
}

describe('registro del protocolo', () => {
  it('registra wc-asset como estándar, seguro y con streaming', () => {
    const registered: unknown[] = [];
    const host: AssetProtocolHost = {
      registerSchemesAsPrivileged(schemes) {
        registered.push(...schemes);
      },
      handle() {
        throw new Error('no se esperaba registrar el handler');
      },
    };

    registerAssetScheme(host);

    expect(registered).toEqual([
      {
        scheme: 'wc-asset',
        privileges: {
          standard: true,
          secure: true,
          stream: true,
          bypassCSP: false,
          supportFetchAPI: false,
          corsEnabled: false,
        },
      },
    ]);
  });

  it('instala el handler y responde con un Response', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');

    await writeAsset(assetsDir, relativePath(), 'datos-webp');

    let scheme: string | null = null;
    let handler: ((request: { url: string }) => Promise<Response>) | null =
      null;

    registerAssetProtocol(
      {
        registerSchemesAsPrivileged() {},
        handle(receivedScheme, receivedHandler) {
          scheme = receivedScheme;
          handler = receivedHandler;
        },
      },
      {
        assetsDir,
        repository: {
          findById: () => createRecord(),
        },
      },
    );

    expect(scheme).toBe('wc-asset');
    expect(handler).not.toBeNull();

    const response = await handler!({ url: `wc-asset://asset/${ASSET_ID}` });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.text()).toBe('datos-webp');
  });
});

describe('handler de peticiones de assets', () => {
  it('sirve el archivo con cabeceras seguras y longitud exacta', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const contents = 'webp-de-prueba';
    const { logger, entries } = createLogger();

    await writeAsset(assetsDir, relativePath(), contents);

    const result = await handleAssetRequest(
      { assetsDir, repository: { findById: () => createRecord() }, logger },
      `wc-asset://asset/${ASSET_ID}`,
    );

    expect(result.status).toBe(200);
    expect(result.headers).toMatchObject({
      'content-type': 'image/webp',
      'content-length': String(Buffer.byteLength(contents)),
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, max-age=31536000, immutable',
      'content-security-policy': "default-src 'none'",
    });
    expect(Buffer.from(result.body as Uint8Array).toString('utf8')).toBe(
      contents,
    );
    expect(entries).toEqual([
      { event: 'asset.request', outcome: 'served', status: 200 },
    ]);
  });

  it('sirve la miniatura y devuelve 404 si no existe', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');

    await writeAsset(assetsDir, relativePath(), 'principal');
    await writeAsset(assetsDir, relativePath(WORLD_ID, true), 'mini');

    const dependencies = {
      assetsDir,
      repository: { findById: () => createRecord() },
    };

    const thumbnail = await handleAssetRequest(
      dependencies,
      `wc-asset://thumb/${ASSET_ID}`,
    );

    expect(thumbnail.status).toBe(200);
    expect(Buffer.from(thumbnail.body as Uint8Array).toString('utf8')).toBe(
      'mini',
    );

    await rm(join(assetsDir, 'worlds', WORLD_ID, `${ASSET_ID}.thumb.webp`));

    const missing = await handleAssetRequest(
      dependencies,
      `wc-asset://thumb/${ASSET_ID}`,
    );

    expect(missing.status).toBe(404);
  });

  it('responde 400 a URLs malformadas', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const dependencies = {
      assetsDir,
      repository: { findById: () => createRecord() },
    };

    for (const url of [
      `wc-asset://otro/${ASSET_ID}`,
      `wc-asset://asset/${ASSET_ID}?x=1`,
      `wc-asset://asset/../${ASSET_ID}`,
      `wc-asset://asset/${ASSET_ID.toUpperCase()}`,
      'wc-asset://asset/no-es-un-uuid',
      'no-es-una-url',
    ]) {
      const result = await handleAssetRequest(dependencies, url);

      expect(result.status).toBe(400);
      expect(result.body).not.toContain(assetsDir);
    }
  });

  it('responde 403 al traversal de la base y al mundo que no coincide', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');

    await mkdir(join(assetsDir, 'worlds', WORLD_ID), { recursive: true });

    for (const record of [
      createRecord({ relativePath: `worlds/../../${ASSET_ID}.webp` }),
      createRecord({ relativePath: `worlds/${WORLD_ID}/../../../etc/passwd` }),
      createRecord({ worldId: generator.generate() }),
      // La fila manipulada apunta a la ruta de otro asset.
      createRecord({ id: generator.generate() }),
    ]) {
      const result = await handleAssetRequest(
        { assetsDir, repository: { findById: () => record } },
        `wc-asset://asset/${ASSET_ID}`,
      );

      expect(result.status).toBe(403);
      expect(result.body).not.toContain(assetsDir);
    }
  });

  it('rechaza un enlace simbólico en lugar del archivo', async (context) => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const outside = join(root, 'fuera.webp');

    await writeFile(outside, 'externo', 'utf8');
    await mkdir(join(assetsDir, 'worlds', WORLD_ID), { recursive: true });

    try {
      await symlink(
        outside,
        join(assetsDir, 'worlds', WORLD_ID, `${ASSET_ID}.webp`),
        'file',
      );
    } catch {
      context.skip();
      return;
    }

    const linked = await handleAssetRequest(
      {
        assetsDir,
        repository: { findById: () => createRecord() },
      },
      `wc-asset://asset/${ASSET_ID}`,
    );

    expect(linked.status).toBe(403);
  });

  it('rechaza una junction de directorio que sale de assets/', async (context) => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const outsideWorld = join(root, 'mundo-externo');

    await mkdir(outsideWorld, { recursive: true });
    await writeFile(join(outsideWorld, `${ASSET_ID}.webp`), 'externo', 'utf8');
    await mkdir(join(assetsDir, 'worlds'), { recursive: true });

    try {
      await symlink(
        outsideWorld,
        join(assetsDir, 'worlds', WORLD_ID),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
      return;
    }

    const result = await handleAssetRequest(
      { assetsDir, repository: { findById: () => createRecord() } },
      `wc-asset://asset/${ASSET_ID}`,
    );

    expect(result.status).toBe(403);
    expect(result.body).not.toContain(root);
  });

  it('responde 404 si la fila o el archivo no existen', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');

    const unknown = await handleAssetRequest(
      { assetsDir, repository: { findById: () => null } },
      `wc-asset://asset/${ASSET_ID}`,
    );
    const missingFile = await handleAssetRequest(
      { assetsDir, repository: { findById: () => createRecord() } },
      `wc-asset://asset/${ASSET_ID}`,
    );

    expect(unknown.status).toBe(404);
    expect(missingFile.status).toBe(404);
    expect(unknown.body).not.toContain(ASSET_ID);
  });

  it('responde 413 si la fila o el archivo superan el límite', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');

    await writeAsset(assetsDir, relativePath(), 'contenido-largo');

    const declared = await handleAssetRequest(
      {
        assetsDir,
        repository: { findById: () => createRecord({ size: 1024 }) },
        maxFileBytes: 10,
      },
      `wc-asset://asset/${ASSET_ID}`,
    );
    const actual = await handleAssetRequest(
      {
        assetsDir,
        repository: { findById: () => createRecord({ size: 4 }) },
        maxFileBytes: 4,
      },
      `wc-asset://asset/${ASSET_ID}`,
    );

    expect(declared.status).toBe(413);
    expect(actual.status).toBe(413);
  });

  it('responde 415 con un MIME no admitido y 500 con un fallo interno', async () => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');

    await writeAsset(assetsDir, relativePath(), 'datos');

    const unsupported = await handleAssetRequest(
      {
        assetsDir,
        repository: {
          findById: () => createRecord({ mime: 'text/html' }),
        },
      },
      `wc-asset://asset/${ASSET_ID}`,
    );
    const failure = await handleAssetRequest(
      {
        assetsDir,
        repository: {
          findById: () => {
            throw new Error('fallo de SQLite con ruta C:\\secreto');
          },
        },
      },
      `wc-asset://asset/${ASSET_ID}`,
    );

    expect(unsupported.status).toBe(415);
    expect(failure.status).toBe(500);
    expect(failure.body).not.toContain('secreto');
  });

  it('registra el rechazo con estado y código, sin rutas', async () => {
    const root = await createTemporaryDirectory();
    const { logger, entries } = createLogger();

    await handleAssetRequest(
      {
        assetsDir: join(root, 'assets'),
        repository: { findById: () => null },
        logger,
      },
      `wc-asset://asset/${ASSET_ID}`,
    );

    expect(entries).toEqual([
      {
        event: 'asset.request',
        outcome: 'rejected',
        status: 404,
        code: 'ASSET_NOT_FOUND',
      },
    ]);

    const serialized = JSON.stringify(entries);

    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain(ASSET_ID);
  });

  it('traduce los códigos a estados HTTP estables', () => {
    expect(statusForAssetErrorCode('ASSET_URL_INVALID')).toBe(400);
    expect(statusForAssetErrorCode('ASSET_INPUT_INVALID')).toBe(400);
    expect(statusForAssetErrorCode('ASSET_PATH_INVALID')).toBe(403);
    expect(statusForAssetErrorCode('ASSET_NOT_FOUND')).toBe(404);
    expect(statusForAssetErrorCode('ASSET_TOO_LARGE')).toBe(413);
    expect(statusForAssetErrorCode('ASSET_UNSUPPORTED_MEDIA_TYPE')).toBe(415);
    expect(statusForAssetErrorCode('ASSET_UNSUPPORTED_FORMAT')).toBe(415);
    expect(statusForAssetErrorCode('ASSET_STORAGE_FAILED')).toBe(500);
    expect(statusForAssetErrorCode('ASSET_DATABASE_FAILED')).toBe(500);
  });

  it('convierte la respuesta normalizada en un Response', async () => {
    const response = toAssetResponse({
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: 'No encontrado.',
    } satisfies AssetProtocolResponse);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('No encontrado.');
  });
});
