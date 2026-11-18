/**
 * Detección y purga de huérfanos en `assets/`.
 *
 * La planificación es de solo lectura y clasifica sin seguir enlaces
 * simbólicos. La raíz `assets/` debe ser un directorio real dentro de
 * `userData`, y los anclas `assets/worlds` y `assets/.tmp` se inspeccionan con
 * `lstat` y `realpath`: si son enlaces o junctions no se recorren y su
 * contenido externo nunca se lista ni se purga. La purga recalcula el plan,
 * exige un token de confirmación, revalida cada ruta justo antes de copiarla y
 * de borrarla, copia a `backups/orphans/<timestamp>/assets/…`, verifica tamaño
 * y SHA-256, escribe un manifiesto y solo entonces borra. Nunca toca un archivo
 * referenciado, una entrada inesperada ni un enlace.
 *
 * Una purga puede interrumpirse a mitad del borrado (fallo del disco, proceso
 * externo que cambia una carpeta). La copia ya está verificada y su manifiesto
 * indica `recovery: restore-files-from-this-backup`: los archivos se restauran
 * desde ahí sin depender de la purga. Queda una carrera residual que no se
 * puede cerrar del todo sin handles de directorio y borrado relativo al handle:
 * entre la revalidación y el `rm` un proceso externo podría sustituir el padre.
 * Se acota con dos revalidaciones y con lecturas `O_NOFOLLOW` donde el sistema
 * lo permite.
 */
import {
  constants,
  lstatSync,
  readdirSync,
  rmdirSync,
  type Dirent,
} from 'node:fs';
import {
  copyFile,
  mkdir,
  open,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { isUuidV7 } from '../db/ids';
import {
  ASSET_CONTAINER_DIR,
  ASSET_TEMP_DIR_NAME,
  ORPHAN_BACKUP_FORMAT_VERSION,
  ORPHAN_BACKUP_MANIFEST_FILE,
  ORPHAN_BACKUP_REASON,
  ORPHAN_BACKUP_RECOVERY,
  PURGE_ORPHANS_CONFIRMATION,
} from './constants';
import { AssetError, toAssetError } from './errors';
import { sha256 } from './image';
import type { AssetLogger } from './logger';
import { withAssetLock } from './mutex';
import {
  assertAssetRoot,
  assertDirectoryInside,
  assertFileInside,
  inspectDirectoryInside,
  parseRelativeAssetPath,
  toThumbnailRelativePath,
  type AssetDirectoryState,
} from './paths';
import type { AssetRecord, AssetRepository } from './store';

/** Clasificación de lo que hay en disco frente a lo que referencia la base. */
export interface OrphanPlan {
  /** Archivos `.webp` principales sin fila en la base. */
  readonly unreferencedFiles: readonly string[];
  /** Miniaturas cuyo archivo principal no está referenciado. */
  readonly orphanThumbnails: readonly string[];
  /** Filas cuya ruta no existe o no es un archivo regular. */
  readonly missingFiles: readonly string[];
  /** Restos de importaciones en `assets/.tmp/`. */
  readonly temporaryFiles: readonly string[];
  /** Entradas fuera de la lista blanca: no se tocan. */
  readonly unexpectedEntries: readonly string[];
  /** Enlaces simbólicos o junctions: no se siguen ni se borran. */
  readonly suspiciousLinks: readonly string[];
}

/**
 * Entrada de la planificación.
 *
 * Es una operación de solo lectura: no valida la raíz `assets/` contra
 * `userData` ni escribe. `purgeOrphans` y la composición hacen esa validación
 * antes de copiar o borrar.
 */
export interface OrphanPlanInput {
  readonly assetsDir: string;
  readonly records: readonly AssetRecord[];
  /**
   * Logger opcional. Solo recibe contadores y códigos: las rutas corruptas de
   * la base se cuentan, nunca se escriben.
   */
  readonly logger?: AssetLogger;
}

/** Copia verificable de los huérfanos purgados. */
export interface OrphanBackupManifest {
  readonly formatVersion: number;
  readonly reason: string;
  readonly createdAt: string;
  /** Pista estable para recuperar una purga interrumpida. */
  readonly recovery: string;
  readonly files: readonly OrphanBackupFile[];
}

/** Archivo incluido en el manifiesto. */
export interface OrphanBackupFile {
  readonly path: string;
  readonly size: number;
  readonly sha256: string;
}

/** Dependencias de la purga. */
export interface PurgeOrphansDependencies {
  /** Carpeta `userData`: la raíz de assets debe quedar dentro. */
  readonly userDataDir: string;
  readonly assetsDir: string;
  readonly orphanBackupsDir: string;
  readonly repository: Pick<AssetRepository, 'listAll'>;
  readonly now?: () => number;
  readonly logger?: AssetLogger;
  /**
   * Copia de archivos inyectable. La purga siempre verifica tamaño y SHA-256
   * después de copiar; las pruebas la sustituyen para demostrar que una copia
   * corrupta aborta sin tocar los originales.
   */
  readonly copyFile?: (source: string, destination: string) => Promise<void>;
  /** Borrado inyectable; las pruebas lo usan para simular un fallo del disco. */
  readonly removeFile?: (path: string) => Promise<void>;
}

/** Opciones de la purga; el token es obligatorio. */
export interface PurgeOrphansOptions {
  readonly confirmation: string;
}

/** Resultado de la purga. */
export interface PurgeOrphansResult {
  readonly plan: OrphanPlan;
  readonly purged: readonly string[];
  /** Carpeta de la copia; `null` si no había nada que purgar. */
  readonly backupDirectory: string | null;
}

/**
 * Clasifica el contenido de `assets/` sin escribir nada.
 *
 * Las miniaturas se emparejan con su archivo principal referenciado, así que
 * una miniatura correcta nunca aparece como huérfana. Los anclas `worlds` y
 * `.tmp` que sean enlaces, junctions o hayan cambiado su destino real se
 * clasifican y **no se recorren**. Las rutas corruptas de la base se cuentan
 * en el logger (sin rutas) además de aparecer en `missingFiles`.
 */
export function planOrphanCleanup(input: OrphanPlanInput): OrphanPlan {
  const unreferencedFiles: string[] = [];
  const orphanThumbnails: string[] = [];
  const missingFiles: string[] = [];
  const temporaryFiles: string[] = [];
  const unexpectedEntries: string[] = [];
  const suspiciousLinks: string[] = [];
  let invalidPaths = 0;

  const referenced = new Set<string>();
  const expectedThumbnails = new Set<string>();

  for (const record of input.records) {
    try {
      const parsed = parseRelativeAssetPath(record.relativePath);

      if (parsed.variant === 'asset') {
        referenced.add(record.relativePath);
        expectedThumbnails.add(toThumbnailRelativePath(record.relativePath));
      } else {
        expectedThumbnails.add(record.relativePath);
      }
    } catch {
      // Una ruta corrupta en la base no puede validarse: se trata como
      // ausente y nunca se borra nada por ella. Se contabiliza más abajo.
    }
  }

  const worldsDir = join(input.assetsDir, ASSET_CONTAINER_DIR);
  const temporaryDir = join(input.assetsDir, ASSET_TEMP_DIR_NAME);
  const worldsState = inspectDirectoryInside(input.assetsDir, worldsDir);
  const temporaryState = inspectDirectoryInside(input.assetsDir, temporaryDir);

  // Un ancla enlazada se clasifica pero no se recorre: el contenido externo
  // no se lista y la purga no puede tocarlo.
  classifyAnchor(
    worldsState,
    ASSET_CONTAINER_DIR,
    unexpectedEntries,
    suspiciousLinks,
  );
  classifyAnchor(
    temporaryState,
    ASSET_TEMP_DIR_NAME,
    unexpectedEntries,
    suspiciousLinks,
  );

  for (const entry of readDirectory(input.assetsDir)) {
    const relativePath = entry.name;

    if (
      relativePath !== ASSET_CONTAINER_DIR &&
      relativePath !== ASSET_TEMP_DIR_NAME
    ) {
      classifyTopLevelEntry(
        entry,
        relativePath,
        unexpectedEntries,
        suspiciousLinks,
      );
    }
  }

  if (worldsState.state === 'directory') {
    for (const worldEntry of readDirectory(worldsDir)) {
      const worldRelativePath = `${ASSET_CONTAINER_DIR}/${worldEntry.name}`;

      if (worldEntry.isSymbolicLink()) {
        suspiciousLinks.push(worldRelativePath);
        continue;
      }

      if (!worldEntry.isDirectory() || !isUuidV7(worldEntry.name)) {
        unexpectedEntries.push(worldRelativePath);
        continue;
      }

      for (const fileEntry of readDirectory(join(worldsDir, worldEntry.name))) {
        const fileRelativePath = `${worldRelativePath}/${fileEntry.name}`;

        if (fileEntry.isSymbolicLink()) {
          suspiciousLinks.push(fileRelativePath);
          continue;
        }

        if (!fileEntry.isFile()) {
          unexpectedEntries.push(fileRelativePath);
          continue;
        }

        let variant: 'asset' | 'thumb';

        try {
          variant = parseRelativeAssetPath(fileRelativePath).variant;
        } catch {
          unexpectedEntries.push(fileRelativePath);
          continue;
        }

        if (variant === 'thumb') {
          if (!expectedThumbnails.has(fileRelativePath)) {
            orphanThumbnails.push(fileRelativePath);
          }
        } else if (!referenced.has(fileRelativePath)) {
          unreferencedFiles.push(fileRelativePath);
        }
      }
    }
  }

  if (temporaryState.state === 'directory') {
    collectTemporaryEntries(
      temporaryDir,
      ASSET_TEMP_DIR_NAME,
      temporaryFiles,
      unexpectedEntries,
      suspiciousLinks,
    );
  }

  for (const record of input.records) {
    let parsed;

    try {
      parsed = parseRelativeAssetPath(record.relativePath);
    } catch {
      invalidPaths += 1;
      missingFiles.push(record.relativePath);
      continue;
    }

    if (parsed.worldId !== record.worldId) {
      invalidPaths += 1;
      missingFiles.push(record.relativePath);
      continue;
    }

    const absolutePath = toAbsolutePath(input.assetsDir, record.relativePath);

    try {
      const stats = lstatSync(absolutePath);

      if (stats.isSymbolicLink()) {
        suspiciousLinks.push(record.relativePath);
      } else if (!stats.isFile()) {
        missingFiles.push(record.relativePath);
      }
    } catch {
      missingFiles.push(record.relativePath);
    }
  }

  if (invalidPaths > 0) {
    // Solo se registra el contador: la ruta corrupta nunca llega al log.
    input.logger?.log({
      event: 'asset.paths',
      outcome: 'invalid',
      count: invalidPaths,
    });
  }

  return {
    unreferencedFiles: sortUnique(unreferencedFiles),
    orphanThumbnails: sortUnique(orphanThumbnails),
    missingFiles: sortUnique(missingFiles),
    temporaryFiles: sortUnique(temporaryFiles),
    unexpectedEntries: sortUnique(unexpectedEntries),
    suspiciousLinks: sortUnique(suspiciousLinks),
  };
}

/**
 * Purga los huérfanos con copia verificable previa.
 *
 * El token debe ser exactamente `purge-orphans`. La operación se serializa con
 * la importación (mismo mutex del proceso) y recalcula el plan ya dentro del
 * turno, así que no puede borrar algo que se acaba de importar. Si un ancla es
 * un enlace, si la copia o su verificación fallan o si el borrado falla, se
 * aborta con un código estable: la copia ya contiene todo lo purgable, de modo
 * que una interrupción es recuperable.
 */
export function purgeOrphans(
  deps: PurgeOrphansDependencies,
  options: PurgeOrphansOptions,
): Promise<PurgeOrphansResult> {
  return withAssetLock(() => purgeOrphansLocked(deps, options));
}

async function purgeOrphansLocked(
  deps: PurgeOrphansDependencies,
  options: PurgeOrphansOptions,
): Promise<PurgeOrphansResult> {
  if (options.confirmation !== PURGE_ORPHANS_CONFIRMATION) {
    throw new AssetError('ASSET_PURGE_CONFIRMATION_REQUIRED');
  }

  try {
    assertAssetRoot(deps.userDataDir, deps.assetsDir);
    assertPurgeAnchors(deps.assetsDir);
  } catch (error) {
    const assetError = toAssetError(error, 'ASSET_PATH_INVALID');

    deps.logger?.log({
      event: 'asset.orphans',
      outcome: 'aborted',
      code: assetError.code,
    });

    throw assetError;
  }

  const plan = planOrphanCleanup({
    assetsDir: deps.assetsDir,
    records: deps.repository.listAll(),
    ...(deps.logger === undefined ? {} : { logger: deps.logger }),
  });
  const purgeable = sortUnique([
    ...plan.unreferencedFiles,
    ...plan.orphanThumbnails,
    ...plan.temporaryFiles,
  ]);

  if (purgeable.length === 0) {
    return { plan, purged: [], backupDirectory: null };
  }

  const now = deps.now ?? Date.now;
  const backupDirectory = join(deps.orphanBackupsDir, formatTimestamp(now()));

  try {
    // Revalidación justo antes de copiar: cada padre debe seguir siendo un
    // directorio real dentro de `assets/` y el archivo, un archivo regular.
    for (const relativePath of purgeable) {
      assertPurgeablePath(deps.assetsDir, relativePath);
    }

    const files = await copyAndVerify(
      deps.assetsDir,
      backupDirectory,
      purgeable,
      deps.copyFile ?? copyFile,
    );

    await writeManifest(backupDirectory, now(), files);
  } catch (error) {
    const assetError = toAssetError(error, 'ASSET_ORPHAN_BACKUP_FAILED');

    deps.logger?.log({
      event: 'asset.orphans',
      outcome: 'aborted',
      code: assetError.code,
    });

    throw assetError;
  }

  try {
    // Segunda revalidación inmediatamente antes del borrado. No elimina del
    // todo la carrera con un proceso externo (haría falta un handle abierto y
    // borrado relativo), pero la acota a la ventana entre esta comprobación y
    // el `rm`, y cualquier fallo aborta con la copia ya verificada.
    for (const relativePath of purgeable) {
      assertPurgeablePath(deps.assetsDir, relativePath);
    }

    const removeFile =
      deps.removeFile ?? ((file: string) => rm(file, { force: true }));

    for (const relativePath of purgeable) {
      await removeFile(toAbsolutePath(deps.assetsDir, relativePath));
    }

    removeEmptyDirectories(deps.assetsDir, purgeable);
  } catch (error) {
    // La copia y el manifiesto ya están verificados: aunque quede un borrado
    // parcial, todo lo purgable se puede restaurar desde `backups/orphans/`
    // siguiendo el campo `recovery` del manifiesto.
    const assetError = toAssetError(error, 'ASSET_STORAGE_FAILED');

    deps.logger?.log({
      event: 'asset.orphans',
      outcome: 'aborted',
      code: assetError.code,
    });

    throw assetError;
  }

  deps.logger?.log({
    event: 'asset.orphans',
    outcome: 'purged',
    files: purgeable.length,
  });

  return { plan, purged: purgeable, backupDirectory };
}

/**
 * Revalida un archivo purgable y todos sus directorios padre.
 *
 * Usa `lstat` sin seguir enlaces y compara la ruta real con la esperada, así que
 * detecta que un padre se haya convertido en junction después de planificar.
 */
function assertPurgeablePath(assetsDir: string, relativePath: string): void {
  const segments = relativePath.split('/');

  if (
    segments.length < 2 ||
    segments.some((segment) => segment.length === 0) ||
    relativePath.includes('\\') ||
    relativePath.includes('\0')
  ) {
    throw new AssetError('ASSET_PATH_INVALID');
  }

  let current = assetsDir;

  for (const segment of segments.slice(0, -1)) {
    current = join(current, segment);
    assertDirectoryInside(assetsDir, current);
  }

  assertFileInside(
    assetsDir,
    toAbsolutePath(assetsDir, relativePath),
    relativePath,
  );
}

/**
 * Comprueba que los anclas de la purga no son enlaces antes de copiar o borrar.
 *
 * Se llama dentro del mutex, después de recalcular el plan, para cerrar la
 * ventana entre la planificación y el borrado. Un ancla ausente es válida: no
 * hay contenido que purgar a través de ella.
 */
function assertPurgeAnchors(assetsDir: string): void {
  for (const name of [ASSET_CONTAINER_DIR, ASSET_TEMP_DIR_NAME]) {
    const state = inspectDirectoryInside(assetsDir, join(assetsDir, name));

    if (state.state !== 'directory' && state.state !== 'missing') {
      throw new AssetError('ASSET_PATH_INVALID');
    }
  }
}

/** Calcula la ruta absoluta de una ruta relativa ya validada. */
export function toAbsolutePath(
  assetsDir: string,
  relativePath: string,
): string {
  return join(assetsDir, ...relativePath.split('/'));
}

async function copyAndVerify(
  assetsDir: string,
  backupDirectory: string,
  purgeable: readonly string[],
  copy: (source: string, destination: string) => Promise<void>,
): Promise<OrphanBackupFile[]> {
  const files: OrphanBackupFile[] = [];

  for (const relativePath of purgeable) {
    const source = toAbsolutePath(assetsDir, relativePath);
    const destination = join(
      backupDirectory,
      'assets',
      ...relativePath.split('/'),
    );

    await mkdir(dirname(destination), { recursive: true });
    await copy(source, destination);

    // La lectura de verificación no sigue enlaces donde el sistema lo permite:
    // si el archivo original se convirtió en un enlace entre la copia y esta
    // lectura, la comprobación falla y no se borra nada.
    const original = await readFileNoFollow(source);
    const copied = await readFile(destination);

    if (
      copied.byteLength !== original.byteLength ||
      sha256(copied) !== sha256(original)
    ) {
      throw new AssetError('ASSET_ORPHAN_BACKUP_FAILED');
    }

    files.push({
      path: relativePath,
      size: original.byteLength,
      sha256: sha256(original),
    });
  }

  return files;
}

/**
 * Lee un archivo sin seguir un enlace final cuando el sistema lo permite.
 *
 * En Windows `O_NOFOLLOW` puede valer 0; en ese caso la protección efectiva es
 * el `lstat` previo y la comparación de hashes con la copia.
 */
async function readFileNoFollow(file: string): Promise<Buffer> {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);

  try {
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function writeManifest(
  backupDirectory: string,
  timestamp: number,
  files: readonly OrphanBackupFile[],
): Promise<void> {
  const manifest: OrphanBackupManifest = {
    formatVersion: ORPHAN_BACKUP_FORMAT_VERSION,
    reason: ORPHAN_BACKUP_REASON,
    createdAt: new Date(timestamp).toISOString(),
    recovery: ORPHAN_BACKUP_RECOVERY,
    files,
  };
  const file = join(backupDirectory, ORPHAN_BACKUP_MANIFEST_FILE);

  await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  // Se relee para comprobar que el manifiesto es JSON válido antes de borrar.
  const written = JSON.parse(await readFile(file, 'utf8')) as unknown;

  if (
    typeof written !== 'object' ||
    written === null ||
    !Array.isArray((written as { files?: unknown }).files) ||
    (written as { files: unknown[] }).files.length !== files.length
  ) {
    throw new AssetError('ASSET_ORPHAN_BACKUP_FAILED');
  }
}

function removeEmptyDirectories(
  assetsDir: string,
  purgeable: readonly string[],
): void {
  const directories = new Set<string>();

  for (const relativePath of purgeable) {
    const segments = relativePath.split('/');

    // `.tmp/<assetId>` y `worlds/<worldId>` quedan vacíos tras la purga.
    if (segments.length >= 2) {
      directories.add(segments.slice(0, 2).join('/'));
    }
  }

  for (const relativePath of directories) {
    try {
      rmdirSync(toAbsolutePath(assetsDir, relativePath));
    } catch {
      // Sigue teniendo contenido: se conserva.
    }
  }
}

function classifyTopLevelEntry(
  entry: Dirent,
  relativePath: string,
  unexpectedEntries: string[],
  suspiciousLinks: string[],
): void {
  if (entry.isSymbolicLink()) {
    suspiciousLinks.push(relativePath);
    return;
  }

  unexpectedEntries.push(relativePath);
}

/**
 * Clasifica el estado de un ancla (`worlds`, `.tmp`).
 *
 * Un enlace o una ruta real distinta se marca como sospechosa; un archivo con
 * ese nombre es una entrada inesperada. El contenido no se recorre.
 */
function classifyAnchor(
  state: AssetDirectoryState,
  relativePath: string,
  unexpectedEntries: string[],
  suspiciousLinks: string[],
): void {
  if (state.state === 'directory' || state.state === 'missing') {
    return;
  }

  if (state.state === 'link' || state.state === 'escapes') {
    suspiciousLinks.push(relativePath);
  } else {
    unexpectedEntries.push(relativePath);
  }
}

function collectTemporaryEntries(
  directory: string,
  relativePrefix: string,
  temporaryFiles: string[],
  unexpectedEntries: string[],
  suspiciousLinks: string[],
): void {
  for (const entry of readDirectory(directory)) {
    const relativePath = `${relativePrefix}/${entry.name}`;

    if (entry.isSymbolicLink()) {
      suspiciousLinks.push(relativePath);
      continue;
    }

    if (entry.isDirectory()) {
      collectTemporaryEntries(
        join(directory, entry.name),
        relativePath,
        temporaryFiles,
        unexpectedEntries,
        suspiciousLinks,
      );
      continue;
    }

    if (entry.isFile()) {
      temporaryFiles.push(relativePath);
      continue;
    }

    unexpectedEntries.push(relativePath);
  }
}

function readDirectory(directory: string): Dirent[] {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch {
    // Una carpeta ausente o ilegible no aporta entradas.
    return [];
  }
}

function sortUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp)
    .toISOString()
    .replaceAll(':', '-')
    .replaceAll('.', '-');
}
