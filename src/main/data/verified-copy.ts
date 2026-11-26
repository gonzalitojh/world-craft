/**
 * Copia verificable del árbol de assets para la copia `pre-delete`.
 *
 * Recorre el origen con `lstat`/`opendir`, sin seguir enlaces ni junctions.
 * Solo admite archivos regulares y directorios reales; cualquier otro tipo
 * aborta la copia. El manifiesto guarda rutas relativas, tamaño y SHA-256, y la
 * copia se vuelve a leer y hashear antes de devolverla.
 */
import {
  copyFile,
  lstat,
  mkdir,
  opendir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';

import { DATA_PRE_DELETE_ASSETS_FORMAT } from '../../shared/contracts/data';
import { assertFileInside } from '../assets/paths';
import { computeFileSha256 } from '../backup/verify';
import { isWindowsReservedName } from '../transfer/format/paths';
import { DataError } from './errors';

export const ASSETS_COPY_FORMAT_ID = DATA_PRE_DELETE_ASSETS_FORMAT.id;
export const ASSETS_COPY_FORMAT_VERSION = DATA_PRE_DELETE_ASSETS_FORMAT.version;
export const ASSETS_COPY_MANIFEST_FILE = 'assets-manifest.json';

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

const MANIFEST_PATH_MAX_LENGTH = 1_024;

/**
 * Solo admite rutas relativas con segmentos seguros dentro de `assets/`.
 *
 * Rechaza rutas absolutas, unidades de Windows, `\`, `:`, NUL, barras
 * iniciales o finales, segmentos `.`/`..` y nombres reservados. No exige la
 * gramática UUID canónica porque la copia previa debe poder conservar archivos
 * auxiliares del árbol de assets; la contención real se verifica después con
 * `assertFileInside`.
 */
function isSafeManifestPath(value: string): boolean {
  if (
    value.length === 0 ||
    value.length > MANIFEST_PATH_MAX_LENGTH ||
    value.includes('\0') ||
    value.includes('\\') ||
    value.includes(':') ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    isAbsolute(value)
  ) {
    return false;
  }

  const segments = value.split('/');

  return segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== '.' &&
      segment !== '..' &&
      !isWindowsReservedName(segment),
  );
}

function assertSafeManifestPath(value: string): void {
  if (!isSafeManifestPath(value)) {
    throw new DataError('DATA_DELETE_COPY_FAILED');
  }
}

const assetFileSchema = z
  .strictObject({
    path: z
      .string()
      .min(1)
      .max(MANIFEST_PATH_MAX_LENGTH)
      .refine(isSafeManifestPath, {
        message: 'Ruta de asset no permitida.',
      }),
    size: z.number().int().min(0),
    sha256: sha256Schema,
  })
  .strict();

/** Esquema estricto de `assets-manifest.json`. */
export const assetsCopyManifestSchema = z
  .strictObject({
    formatId: z.literal(ASSETS_COPY_FORMAT_ID),
    version: z.literal(ASSETS_COPY_FORMAT_VERSION),
    count: z.number().int().min(0),
    bytes: z.number().int().min(0),
    files: z.array(assetFileSchema),
  })
  .strict()
  .superRefine((manifest, context) => {
    if (manifest.files.length !== manifest.count) {
      context.addIssue({
        code: 'custom',
        message: 'El recuento de assets no coincide.',
        path: ['count'],
      });
    }

    const total = manifest.files.reduce((sum, file) => sum + file.size, 0);

    if (total !== manifest.bytes) {
      context.addIssue({
        code: 'custom',
        message: 'Los bytes de assets no coinciden.',
        path: ['bytes'],
      });
    }

    const paths = new Set<string>();

    for (const file of manifest.files) {
      const key = file.path.toLowerCase();

      if (paths.has(key)) {
        context.addIssue({
          code: 'custom',
          message: 'El manifiesto repite un archivo.',
          path: ['files'],
        });
      }

      paths.add(key);
    }
  });

export type AssetsCopyManifest = z.infer<typeof assetsCopyManifestSchema>;

export interface CopyAssetsTreeOptions {
  readonly sourceAssetsDir: string;
  readonly targetAssetsDir: string;
  readonly manifestFile: string;
}

export interface VerifiedAssetsCopy {
  readonly manifest: AssetsCopyManifest;
  readonly assetsDir: string;
  readonly manifestFile: string;
}

interface PendingDirectory {
  readonly absolute: string;
  readonly relative: string;
}

interface CopiedAssetFile {
  readonly path: string;
  readonly size: number;
  readonly sha256: string;
}

/**
 * Copia el árbol, escribe el manifiesto y verifica la copia.
 *
 * Si el origen no existe se genera una copia vacía válida. Cualquier enlace,
 * entrada especial o fallo de copia aborta y deja limpio el destino.
 */
export async function copyAndVerifyAssetsTree(
  options: CopyAssetsTreeOptions,
): Promise<VerifiedAssetsCopy> {
  try {
    await rm(options.targetAssetsDir, { recursive: true, force: true });
    await rm(options.manifestFile, { force: true });
    await mkdir(options.targetAssetsDir, { recursive: true });

    const sourceStats = await lstatOrMissing(options.sourceAssetsDir);

    if (sourceStats !== null && sourceStats.isSymbolicLink()) {
      throw new DataError('DATA_DELETE_COPY_FAILED');
    }

    const files: CopiedAssetFile[] = [];

    if (sourceStats !== null && sourceStats.isDirectory()) {
      await copyDirectory(
        {
          absolute: options.sourceAssetsDir,
          relative: '',
        },
        options.targetAssetsDir,
        files,
      );
    } else if (sourceStats !== null) {
      throw new DataError('DATA_DELETE_COPY_FAILED');
    }

    const manifest: AssetsCopyManifest = {
      formatId: ASSETS_COPY_FORMAT_ID,
      version: ASSETS_COPY_FORMAT_VERSION,
      count: files.length,
      bytes: files.reduce((sum, file) => sum + file.size, 0),
      files: files.sort((left, right) => left.path.localeCompare(right.path)),
    };

    await writeFile(
      options.manifestFile,
      `${JSON.stringify(manifest, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );

    await verifyAssetsCopy({
      assetsDir: options.targetAssetsDir,
      manifestFile: options.manifestFile,
    });

    return {
      manifest,
      assetsDir: options.targetAssetsDir,
      manifestFile: options.manifestFile,
    };
  } catch (error) {
    await rm(options.targetAssetsDir, {
      recursive: true,
      force: true,
    }).catch(() => undefined);
    await rm(options.manifestFile, { force: true }).catch(() => undefined);

    if (error instanceof DataError) {
      throw error;
    }

    throw new DataError('DATA_DELETE_COPY_FAILED', { cause: error });
  }
}

/**
 * Relee el manifiesto y comprueba que la copia contiene exactamente sus
 * archivos, con el tamaño y SHA-256 declarados.
 */
export async function verifyAssetsCopy(options: {
  readonly assetsDir: string;
  readonly manifestFile: string;
}): Promise<AssetsCopyManifest> {
  let manifest: AssetsCopyManifest;

  try {
    const raw = await readFile(options.manifestFile, 'utf8');
    manifest = parseAssetsCopyManifest(JSON.parse(raw) as unknown);
  } catch (error) {
    if (error instanceof DataError) {
      throw error;
    }

    throw new DataError('DATA_DELETE_COPY_FAILED', { cause: error });
  }

  const actual = await listRegularFiles(options.assetsDir);

  if (actual.length !== manifest.files.length) {
    throw new DataError('DATA_DELETE_COPY_FAILED');
  }

  for (let index = 0; index < manifest.files.length; index += 1) {
    const expected = manifest.files[index];
    const found = actual[index];

    if (expected === undefined || found !== expected.path) {
      throw new DataError('DATA_DELETE_COPY_FAILED');
    }

    assertSafeManifestPath(expected.path);

    const file = resolve(options.assetsDir, ...expected.path.split('/'));

    try {
      assertFileInside(options.assetsDir, file, expected.path);
    } catch {
      throw new DataError('DATA_DELETE_COPY_FAILED');
    }

    const stats = await stat(file).catch(() => null);

    if (stats === null || !stats.isFile() || stats.size !== expected.size) {
      throw new DataError('DATA_DELETE_COPY_FAILED');
    }

    if ((await computeFileSha256(file)) !== expected.sha256) {
      throw new DataError('DATA_DELETE_COPY_FAILED');
    }
  }

  return manifest;
}

/** Valida un manifiesto de assets ya deserializado. */
export function parseAssetsCopyManifest(value: unknown): AssetsCopyManifest {
  const parsed = assetsCopyManifestSchema.safeParse(value);

  if (!parsed.success) {
    throw new DataError('DATA_DELETE_COPY_FAILED', { cause: parsed.error });
  }

  return parsed.data;
}

async function copyDirectory(
  directory: PendingDirectory,
  targetRoot: string,
  files: CopiedAssetFile[],
): Promise<void> {
  const entries = [];
  const handle = await opendir(directory.absolute);

  for await (const entry of handle) {
    entries.push(entry);
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    assertSafeName(entry.name);

    const relative =
      directory.relative.length === 0
        ? entry.name
        : `${directory.relative}/${entry.name}`;
    const absolute = join(directory.absolute, entry.name);

    if (entry.isSymbolicLink()) {
      throw new DataError('DATA_DELETE_COPY_FAILED');
    }

    const target = join(targetRoot, ...relative.split('/'));

    if (entry.isDirectory()) {
      await mkdir(target, { recursive: true });
      await copyDirectory({ absolute, relative }, targetRoot, files);
      continue;
    }

    if (!entry.isFile()) {
      throw new DataError('DATA_DELETE_COPY_FAILED');
    }

    const sourceStats = await lstat(absolute);

    if (sourceStats.isSymbolicLink() || !sourceStats.isFile()) {
      throw new DataError('DATA_DELETE_COPY_FAILED');
    }

    await copyFile(absolute, target);

    const copiedStats = await stat(target);
    files.push({
      path: relative,
      size: copiedStats.size,
      sha256: await computeFileSha256(target),
    });
  }
}

async function listRegularFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const pending: PendingDirectory[] = [{ absolute: root, relative: '' }];

  while (pending.length > 0) {
    const directory = pending.pop();

    if (directory === undefined) {
      break;
    }

    const stats = await lstat(directory.absolute).catch(() => null);

    if (stats === null) {
      continue;
    }

    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new DataError('DATA_DELETE_COPY_FAILED');
    }

    const handle = await opendir(directory.absolute);

    for await (const entry of handle) {
      assertSafeName(entry.name);

      const relative =
        directory.relative.length === 0
          ? entry.name
          : `${directory.relative}/${entry.name}`;
      const absolute = join(directory.absolute, entry.name);

      if (entry.isSymbolicLink()) {
        throw new DataError('DATA_DELETE_COPY_FAILED');
      }

      if (entry.isDirectory()) {
        pending.push({ absolute, relative });
        continue;
      }

      if (!entry.isFile()) {
        throw new DataError('DATA_DELETE_COPY_FAILED');
      }

      files.push(relative);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

async function lstatOrMissing(
  target: string,
): Promise<Awaited<ReturnType<typeof lstat>> | null> {
  try {
    return await lstat(target);
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
        (error as NodeJS.ErrnoException).code === 'ENOTDIR')
    ) {
      return null;
    }

    throw error;
  }
}

function assertSafeName(name: string): void {
  if (
    name.length === 0 ||
    name === '.' ||
    name === '..' ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('\0')
  ) {
    throw new DataError('DATA_DELETE_COPY_FAILED');
  }
}
