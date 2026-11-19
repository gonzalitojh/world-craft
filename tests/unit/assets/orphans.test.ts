import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  planOrphanCleanup,
  purgeOrphans,
  toAbsolutePath,
} from '@/main/assets/orphans';
import type { AssetLogEntry } from '@/main/assets/logger';
import type { AssetRecord } from '@/main/assets/store';
import { createUuidv7Generator } from '@/main/db/ids';

const generator = createUuidv7Generator({
  now: () => 1_760_000_000_000,
  random: (size) => Buffer.alloc(size, 0x55),
});

const WORLD_ID = generator.generate();
const OTHER_WORLD_ID = generator.generate();
const ASSET_ID = generator.generate();
const ORPHAN_ID = generator.generate();
const GHOST_ID = generator.generate();
const NOW = 1_760_000_500_000;

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'world-craft-orphans-'));
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

function relativePath(worldId: string, assetId: string, thumb = false): string {
  return `worlds/${worldId}/${assetId}${thumb ? '.thumb.webp' : '.webp'}`;
}

function createRecord(
  id: string,
  worldId: string,
  relative: string,
): AssetRecord {
  return {
    id,
    worldId,
    kind: 'image',
    relativePath: relative,
    mime: 'image/webp',
    size: 4,
    width: 10,
    height: 10,
    alt: null,
    hash: 'b'.repeat(64),
    createdAt: 1_760_000_000_000,
  };
}

async function writeAsset(
  assetsDir: string,
  relative: string,
  contents = 'dato',
): Promise<string> {
  const absolutePath = toAbsolutePath(assetsDir, relative);

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, 'utf8');

  return absolutePath;
}

interface Fixture {
  readonly root: string;
  readonly assetsDir: string;
  readonly orphanBackupsDir: string;
  readonly records: AssetRecord[];
  readonly referencedMain: string;
  readonly referencedThumb: string;
  readonly orphanMain: string;
  readonly orphanThumb: string;
  readonly temporary: string;
}

async function createFixture(): Promise<Fixture> {
  const root = await createTemporaryDirectory();
  const assetsDir = join(root, 'assets');
  const orphanBackupsDir = join(root, 'backups', 'orphans');
  const referencedMain = await writeAsset(
    assetsDir,
    relativePath(WORLD_ID, ASSET_ID),
    'referenciado',
  );
  const referencedThumb = await writeAsset(
    assetsDir,
    relativePath(WORLD_ID, ASSET_ID, true),
    'miniatura',
  );
  const orphanMain = await writeAsset(
    assetsDir,
    relativePath(OTHER_WORLD_ID, ORPHAN_ID),
    'huerfano',
  );
  const orphanThumb = await writeAsset(
    assetsDir,
    relativePath(OTHER_WORLD_ID, ORPHAN_ID, true),
    'huerfano-mini',
  );
  const temporary = await writeAsset(
    assetsDir,
    `.tmp/${ORPHAN_ID}/main.webp`,
    'temporal',
  );

  return {
    root,
    assetsDir,
    orphanBackupsDir,
    records: [
      createRecord(ASSET_ID, WORLD_ID, relativePath(WORLD_ID, ASSET_ID)),
    ],
    referencedMain,
    referencedThumb,
    orphanMain,
    orphanThumb,
    temporary,
  };
}

function expectedTimestamp(): string {
  return new Date(NOW).toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function sha256(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}

describe('planificación de huérfanos', () => {
  it('clasifica sin listar los referenciados ni sus miniaturas', async () => {
    const fixture = await createFixture();
    const plan = planOrphanCleanup({
      assetsDir: fixture.assetsDir,
      records: fixture.records,
    });

    expect(plan.unreferencedFiles).toEqual([
      relativePath(OTHER_WORLD_ID, ORPHAN_ID),
    ]);
    expect(plan.orphanThumbnails).toEqual([
      relativePath(OTHER_WORLD_ID, ORPHAN_ID, true),
    ]);
    expect(plan.temporaryFiles).toEqual([`.tmp/${ORPHAN_ID}/main.webp`]);
    expect(plan.missingFiles).toEqual([]);
    expect(plan.unexpectedEntries).toEqual([]);
    expect(plan.suspiciousLinks).toEqual([]);
  });

  it('marca como ausentes las filas sin archivo y las rutas corruptas', async () => {
    const fixture = await createFixture();
    const plan = planOrphanCleanup({
      assetsDir: fixture.assetsDir,
      records: [
        ...fixture.records,
        createRecord(GHOST_ID, WORLD_ID, relativePath(WORLD_ID, GHOST_ID)),
        createRecord(ORPHAN_ID, WORLD_ID, `worlds/../${ORPHAN_ID}.webp`),
      ],
    });

    expect(plan.missingFiles).toEqual([
      `worlds/../${ORPHAN_ID}.webp`,
      relativePath(WORLD_ID, GHOST_ID),
    ]);
  });

  it('separa entradas inesperadas de los archivos purgables', async () => {
    const fixture = await createFixture();

    await writeAsset(
      fixture.assetsDir,
      `worlds/${WORLD_ID}/notas.txt`,
      'texto',
    );
    await writeAsset(fixture.assetsDir, 'suelto.bin', 'texto');
    await writeAsset(
      fixture.assetsDir,
      `worlds/no-es-un-uuid/${ORPHAN_ID}.webp`,
      'texto',
    );

    const plan = planOrphanCleanup({
      assetsDir: fixture.assetsDir,
      records: fixture.records,
    });

    expect(plan.unexpectedEntries).toEqual([
      'suelto.bin',
      `worlds/${WORLD_ID}/notas.txt`,
      'worlds/no-es-un-uuid',
    ]);
    expect(plan.unreferencedFiles).toEqual([
      relativePath(OTHER_WORLD_ID, ORPHAN_ID),
    ]);
  });

  it('no sigue enlaces simbólicos ni junctions', async (context) => {
    const fixture = await createFixture();
    const outside = join(fixture.root, 'fuera.webp');

    await writeFile(outside, 'externo', 'utf8');

    try {
      await symlink(outside, join(fixture.assetsDir, 'enlace.webp'), 'file');
    } catch {
      context.skip();
      return;
    }

    const plan = planOrphanCleanup({
      assetsDir: fixture.assetsDir,
      records: fixture.records,
    });

    expect(plan.suspiciousLinks).toContain('enlace.webp');
    expect(plan.unreferencedFiles).not.toContain('enlace.webp');
  });
});

describe('purga de huérfanos', () => {
  it('exige el token exacto de confirmación y no borra nada', async () => {
    const fixture = await createFixture();
    const repository = {
      listAll: () => fixture.records,
    };

    for (const confirmation of ['', 'PURGE-ORPHANS', 'purge', 'sí']) {
      await expect(
        purgeOrphans(
          {
            userDataDir: fixture.root,
            assetsDir: fixture.assetsDir,
            orphanBackupsDir: fixture.orphanBackupsDir,
            repository,
          },
          { confirmation },
        ),
      ).rejects.toMatchObject({ code: 'ASSET_PURGE_CONFIRMATION_REQUIRED' });
    }

    expect(await readFile(fixture.orphanMain, 'utf8')).toBe('huerfano');
    expect(await readFile(fixture.referencedMain, 'utf8')).toBe('referenciado');
  });

  it('copia con manifiesto y checksums y solo después borra huérfanos', async () => {
    const fixture = await createFixture();
    const repository = { listAll: () => fixture.records };

    const result = await purgeOrphans(
      {
        userDataDir: fixture.root,
        assetsDir: fixture.assetsDir,
        orphanBackupsDir: fixture.orphanBackupsDir,
        repository,
        now: () => NOW,
      },
      { confirmation: 'purge-orphans' },
    );

    expect(result.purged).toEqual([
      `.tmp/${ORPHAN_ID}/main.webp`,
      relativePath(OTHER_WORLD_ID, ORPHAN_ID, true),
      relativePath(OTHER_WORLD_ID, ORPHAN_ID),
    ]);
    expect(result.backupDirectory).toBe(
      join(fixture.orphanBackupsDir, expectedTimestamp()),
    );

    // Los referenciados siguen intactos.
    expect(await readFile(fixture.referencedMain, 'utf8')).toBe('referenciado');
    expect(await readFile(fixture.referencedThumb, 'utf8')).toBe('miniatura');

    // Los huérfanos desaparecen.
    await expect(readFile(fixture.orphanMain)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(readFile(fixture.orphanThumb)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(readFile(fixture.temporary)).rejects.toMatchObject({
      code: 'ENOENT',
    });

    // La copia existe con el contenido y el manifiesto verificable.
    const backupMain = join(
      result.backupDirectory as string,
      'assets',
      ...relativePath(OTHER_WORLD_ID, ORPHAN_ID).split('/'),
    );

    expect(await readFile(backupMain, 'utf8')).toBe('huerfano');

    const manifest = JSON.parse(
      await readFile(
        join(result.backupDirectory as string, 'manifest.json'),
        'utf8',
      ),
    ) as {
      formatVersion: number;
      reason: string;
      createdAt: string;
      recovery: string;
      files: { path: string; size: number; sha256: string }[];
    };

    expect(manifest.formatVersion).toBe(1);
    expect(manifest.reason).toBe('orphan-purge');
    expect(manifest.createdAt).toBe(new Date(NOW).toISOString());
    expect(manifest.recovery).toBe('restore-files-from-this-backup');
    expect(manifest.files).toHaveLength(3);
    expect(manifest.files).toEqual(
      expect.arrayContaining([
        {
          path: relativePath(OTHER_WORLD_ID, ORPHAN_ID),
          size: Buffer.byteLength('huerfano'),
          sha256: sha256('huerfano'),
        },
      ]),
    );
  });

  it('aborta sin borrar nada si la copia no supera la verificación', async () => {
    const fixture = await createFixture();
    const repository = { listAll: () => fixture.records };
    const entries: AssetLogEntry[] = [];

    await expect(
      purgeOrphans(
        {
          userDataDir: fixture.root,
          assetsDir: fixture.assetsDir,
          orphanBackupsDir: fixture.orphanBackupsDir,
          repository,
          now: () => NOW,
          logger: {
            log(entry) {
              entries.push(entry);
            },
          },
          copyFile: async (_source, destination) => {
            await writeFile(destination, 'contenido corrupto', 'utf8');
          },
        },
        { confirmation: 'purge-orphans' },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_ORPHAN_BACKUP_FAILED' });

    expect(entries).toEqual([
      {
        event: 'asset.orphans',
        outcome: 'aborted',
        code: 'ASSET_ORPHAN_BACKUP_FAILED',
      },
    ]);
    expect(await readFile(fixture.orphanMain, 'utf8')).toBe('huerfano');
    expect(await readFile(fixture.orphanThumb, 'utf8')).toBe('huerfano-mini');
    expect(await readFile(fixture.temporary, 'utf8')).toBe('temporal');
  });

  it('es idempotente y no crea copia cuando no hay huérfanos', async () => {
    const fixture = await createFixture();
    const repository = { listAll: () => fixture.records };

    const first = await purgeOrphans(
      {
        userDataDir: fixture.root,
        assetsDir: fixture.assetsDir,
        orphanBackupsDir: fixture.orphanBackupsDir,
        repository,
        now: () => NOW,
      },
      { confirmation: 'purge-orphans' },
    );

    expect(first.purged.length).toBeGreaterThan(0);

    const second = await purgeOrphans(
      {
        userDataDir: fixture.root,
        assetsDir: fixture.assetsDir,
        orphanBackupsDir: fixture.orphanBackupsDir,
        repository,
        now: () => NOW + 1000,
      },
      { confirmation: 'purge-orphans' },
    );

    expect(second.purged).toEqual([]);
    expect(second.backupDirectory).toBeNull();
    expect(await readdir(fixture.orphanBackupsDir)).toHaveLength(1);
  });

  it('nunca purga entradas inesperadas ni enlaces', async (context) => {
    const fixture = await createFixture();
    const repository = { listAll: () => fixture.records };
    const notes = await writeAsset(
      fixture.assetsDir,
      `worlds/${WORLD_ID}/notas.txt`,
      'no borrar',
    );
    const outside = join(fixture.root, 'fuera.webp');

    await writeFile(outside, 'externo', 'utf8');

    try {
      await symlink(outside, join(fixture.assetsDir, 'enlace.webp'), 'file');
    } catch {
      context.skip();
      return;
    }

    await purgeOrphans(
      {
        userDataDir: fixture.root,
        assetsDir: fixture.assetsDir,
        orphanBackupsDir: fixture.orphanBackupsDir,
        repository,
        now: () => NOW,
      },
      { confirmation: 'purge-orphans' },
    );

    expect(await readFile(notes, 'utf8')).toBe('no borrar');
    expect(await readFile(outside, 'utf8')).toBe('externo');
  });
});

describe('anclas de assets enlazadas', () => {
  async function createAnchoredFixture(): Promise<{
    readonly root: string;
    readonly assetsDir: string;
    readonly orphanBackupsDir: string;
  }> {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const orphanBackupsDir = join(root, 'backups', 'orphans');

    await mkdir(assetsDir, { recursive: true });

    return { root, assetsDir, orphanBackupsDir };
  }

  it('no recorre worlds/ si es una junction y no purga fuera de assets/', async (context) => {
    const { root, assetsDir, orphanBackupsDir } = await createAnchoredFixture();
    const outsideWorlds = join(root, 'mundo-externo');
    const externalFile = join(outsideWorlds, WORLD_ID, `${ORPHAN_ID}.webp`);

    await mkdir(join(outsideWorlds, WORLD_ID), { recursive: true });
    await writeFile(externalFile, 'externo', 'utf8');

    try {
      await symlink(
        outsideWorlds,
        join(assetsDir, 'worlds'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
      return;
    }

    const plan = planOrphanCleanup({ assetsDir, records: [] });

    expect(plan.unreferencedFiles).toEqual([]);
    expect(plan.orphanThumbnails).toEqual([]);
    expect(plan.suspiciousLinks).toContain('worlds');

    await expect(
      purgeOrphans(
        {
          userDataDir: root,
          assetsDir,
          orphanBackupsDir,
          repository: { listAll: () => [] },
          now: () => NOW,
        },
        { confirmation: 'purge-orphans' },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });

    expect(await readFile(externalFile, 'utf8')).toBe('externo');
    await expect(readdir(orphanBackupsDir)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('no recorre .tmp si es una junction y no purga fuera de assets/', async (context) => {
    const { root, assetsDir, orphanBackupsDir } = await createAnchoredFixture();
    const outsideTemporary = join(root, 'temporal-externo');
    const externalFile = join(outsideTemporary, ORPHAN_ID, 'main.webp');

    await mkdir(join(assetsDir, 'worlds'), { recursive: true });
    await mkdir(join(outsideTemporary, ORPHAN_ID), { recursive: true });
    await writeFile(externalFile, 'externo', 'utf8');

    try {
      await symlink(
        outsideTemporary,
        join(assetsDir, '.tmp'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
      return;
    }

    const plan = planOrphanCleanup({ assetsDir, records: [] });

    expect(plan.temporaryFiles).toEqual([]);
    expect(plan.suspiciousLinks).toContain('.tmp');

    await expect(
      purgeOrphans(
        {
          userDataDir: root,
          assetsDir,
          orphanBackupsDir,
          repository: { listAll: () => [] },
          now: () => NOW,
        },
        { confirmation: 'purge-orphans' },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });

    expect(await readFile(externalFile, 'utf8')).toBe('externo');
    await expect(readdir(orphanBackupsDir)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('clasifica un archivo que ocupa el nombre de un ancla sin recorrerlo', async () => {
    const { assetsDir } = await createAnchoredFixture();

    await writeFile(join(assetsDir, 'worlds'), 'no es una carpeta', 'utf8');

    const plan = planOrphanCleanup({ assetsDir, records: [] });

    expect(plan.unexpectedEntries).toContain('worlds');
    expect(plan.unreferencedFiles).toEqual([]);
  });
});

describe('registro de rutas corruptas', () => {
  it('cuenta las rutas inválidas sin escribirlas en el log', async () => {
    const fixture = await createFixture();
    const entries: AssetLogEntry[] = [];

    planOrphanCleanup({
      assetsDir: fixture.assetsDir,
      records: [
        ...fixture.records,
        createRecord(ORPHAN_ID, WORLD_ID, `worlds/../${ORPHAN_ID}.webp`),
        createRecord(
          GHOST_ID,
          generator.generate(),
          relativePath(WORLD_ID, GHOST_ID),
        ),
      ],
      logger: {
        log(entry) {
          entries.push(entry);
        },
      },
    });

    expect(entries).toEqual([
      { event: 'asset.paths', outcome: 'invalid', count: 2 },
    ]);
    expect(JSON.stringify(entries)).not.toContain(fixture.root);
  });
});

describe('raíz de assets enlazada', () => {
  it('no purga si assets/ es una junction fuera de userData', async (context) => {
    const root = await createTemporaryDirectory();
    const assetsDir = join(root, 'assets');
    const outside = join(root, 'datos-externos');

    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, 'suelto.webp'), 'externo', 'utf8');

    try {
      await symlink(
        outside,
        assetsDir,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      context.skip();
      return;
    }

    await expect(
      purgeOrphans(
        {
          userDataDir: root,
          assetsDir,
          orphanBackupsDir: join(root, 'backups', 'orphans'),
          repository: { listAll: () => [] },
          now: () => NOW,
        },
        { confirmation: 'purge-orphans' },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });

    expect(await readFile(join(outside, 'suelto.webp'), 'utf8')).toBe(
      'externo',
    );
  });
});

describe('revalidación antes de borrar', () => {
  it('detecta un padre convertido en junction entre la copia y el borrado', async () => {
    const fixture = await createFixture();
    const repository = { listAll: () => fixture.records };
    const worldDirectory = join(fixture.assetsDir, 'worlds', OTHER_WORLD_ID);
    const external = join(fixture.root, 'mundo-externo');
    let swapped = false;

    await expect(
      purgeOrphans(
        {
          userDataDir: fixture.root,
          assetsDir: fixture.assetsDir,
          orphanBackupsDir: fixture.orphanBackupsDir,
          repository,
          now: () => NOW,
          copyFile: async (source, destination) => {
            await copyFile(source, destination);

            if (!swapped) {
              swapped = true;
              // Se mueve el directorio real y se deja una junction en su
              // lugar, como haría un proceso externo entre plan y borrado.
              await rename(worldDirectory, external);

              try {
                await symlink(
                  external,
                  worldDirectory,
                  process.platform === 'win32' ? 'junction' : 'dir',
                );
              } catch {
                // Si no se puede crear el enlace, el padre ausente también se
                // detecta en la revalidación.
              }
            }
          },
        },
        { confirmation: 'purge-orphans' },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });

    expect(swapped).toBe(true);
    expect(await readFile(join(external, `${ORPHAN_ID}.webp`), 'utf8')).toBe(
      'huerfano',
    );
    expect(
      await readFile(join(external, `${ORPHAN_ID}.thumb.webp`), 'utf8'),
    ).toBe('huerfano-mini');
  });
});

describe('recuperación de una purga interrumpida', () => {
  it('deja la copia completa y documenta la recuperación si el borrado falla', async () => {
    const fixture = await createFixture();
    const repository = { listAll: () => fixture.records };
    const entries: AssetLogEntry[] = [];

    await expect(
      purgeOrphans(
        {
          userDataDir: fixture.root,
          assetsDir: fixture.assetsDir,
          orphanBackupsDir: fixture.orphanBackupsDir,
          repository,
          now: () => NOW,
          logger: {
            log(entry) {
              entries.push(entry);
            },
          },
          removeFile: async () => {
            throw new Error('EBUSY');
          },
        },
        { confirmation: 'purge-orphans' },
      ),
    ).rejects.toMatchObject({ code: 'ASSET_STORAGE_FAILED' });

    expect(entries).toContainEqual({
      event: 'asset.orphans',
      outcome: 'aborted',
      code: 'ASSET_STORAGE_FAILED',
    });

    // Nada se borró.
    expect(await readFile(fixture.orphanMain, 'utf8')).toBe('huerfano');
    expect(await readFile(fixture.orphanThumb, 'utf8')).toBe('huerfano-mini');
    expect(await readFile(fixture.temporary, 'utf8')).toBe('temporal');

    const manifest = JSON.parse(
      await readFile(
        join(fixture.orphanBackupsDir, expectedTimestamp(), 'manifest.json'),
        'utf8',
      ),
    ) as { recovery: string; files: unknown[] };

    expect(manifest.recovery).toBe('restore-files-from-this-backup');
    expect(manifest.files).toHaveLength(3);
  });
});
