/**
 * Lógica pura del aviso de modo seguro.
 *
 * No importa Electron: recibe los puertos de diálogo, apertura de carpetas y
 * recuperación. Así se puede probar el bucle, las decisiones, la elección de
 * copia, la confirmación y el respaldo de error sin cargar el runtime de
 * escritorio.
 */
import type {
  RestorableBackup,
  RestoreErrorCode,
  RestoreResult,
} from './backup/restore';
import type { DatabaseErrorCode } from './db/errors';
import { formatBackupDate, messages } from './messages/es';

/** Decisión del usuario tras el aviso de modo seguro. */
export type SafeModeDecision = 'continue' | 'exit';

/** Opciones mínimas que necesita el puerto de diálogo. */
export interface SafeModeMessageBoxOptions {
  readonly type: 'error' | 'question' | 'warning';
  readonly title: string;
  readonly message: string;
  readonly detail: string;
  readonly buttons: string[];
  readonly defaultId: number;
  readonly cancelId: number;
  readonly noLink: boolean;
}

/**
 * Puertos de recuperación que aporta la composición Electron.
 *
 * La lógica pura decide cuándo buscar, elegir, confirmar y restaurar; la
 * composición valida la carpeta elegida y ejecuta el reemplazo.
 */
export interface SafeModeRecoveryPorts {
  findLatestBackup(): Promise<RestorableBackup | null>;
  chooseBackupDirectory(): Promise<string | null>;
  inspectBackup(directory: string): Promise<RestorableBackup | null>;
  restoreBackup(directory: string): Promise<RestoreResult>;
  relaunch(): void;
}

/** Puertos que aporta la composición Electron. */
export interface SafeModePromptPorts {
  showMessageBox(
    options: SafeModeMessageBoxOptions,
  ): Promise<{ readonly response: number }>;
  openPath(path: string): Promise<string>;
  showErrorBox(title: string, content: string): void;
  isDirectory(path: string): boolean;
}

export interface SafeModePromptOptions {
  readonly code: DatabaseErrorCode;
  readonly appName: string;
  readonly backupsDirectory: string | null;
  readonly userDataDirectory: string;
  /** `null` cuando las rutas de datos no se pudieron resolver. */
  readonly recovery: SafeModeRecoveryPorts | null;
}

type SafeModeAction = 'openBackups' | 'restore' | 'continue' | 'exit';

/**
 * Muestra el aviso en bucle hasta que el usuario decide continuar o salir.
 *
 * Abrir la carpeta no cierra el modo seguro: el aviso vuelve a aparecer. La
 * restauración tampoco cierra el bucle: si falla o se cancela, se vuelve al
 * aviso. Solo un reinicio tras restaurar termina el proceso.
 */
export async function createSafeModePrompt(
  ports: SafeModePromptPorts,
  options: SafeModePromptOptions,
): Promise<SafeModeDecision> {
  const safeMode = messages.safeMode;
  const actions: SafeModeAction[] = ['openBackups'];

  if (options.recovery !== null) {
    actions.push('restore');
  }

  actions.push('continue', 'exit');

  const messageBoxOptions: SafeModeMessageBoxOptions = {
    type: 'error',
    title: safeMode.title(options.appName),
    message: safeMode.message,
    detail: `${safeMode.detail[options.code]}\n\n${safeMode.codeLabel}: ${options.code}`,
    buttons: actions.map((action) => buttonFor(action)),
    defaultId: 0,
    cancelId: actions.length - 1,
    noLink: true,
  };

  for (;;) {
    let response: number;

    try {
      ({ response } = await ports.showMessageBox(messageBoxOptions));
    } catch {
      showFallbackError(ports, options.appName, 'fallback');

      return 'exit';
    }

    const action = actions[response] ?? 'exit';

    if (action === 'continue') {
      return 'continue';
    }

    if (action === 'exit') {
      return 'exit';
    }

    if (action === 'openBackups') {
      if (!(await openBackupsDirectory(ports, options))) {
        return 'exit';
      }

      continue;
    }

    const restoreOutcome = await runRestoreFlow(
      ports,
      options.recovery,
      options.appName,
    );

    if (restoreOutcome === 'relaunch') {
      return 'exit';
    }
  }
}

function buttonFor(action: SafeModeAction): string {
  const buttons = messages.safeMode.buttons;

  switch (action) {
    case 'openBackups':
      return buttons.openBackups;
    case 'restore':
      return buttons.restoreBackup;
    case 'continue':
      return buttons.continueInSafeMode;
    case 'exit':
      return buttons.exit;
  }
}

/** Abre la carpeta de copias y devuelve si el aviso puede continuar. */
async function openBackupsDirectory(
  ports: SafeModePromptPorts,
  options: SafeModePromptOptions,
): Promise<boolean> {
  try {
    const directory =
      options.backupsDirectory !== null &&
      ports.isDirectory(options.backupsDirectory)
        ? options.backupsDirectory
        : options.userDataDirectory;
    const error = await ports.openPath(directory);

    if (error.length > 0) {
      throw new Error();
    }

    return true;
  } catch {
    return showFallbackError(ports, options.appName, 'openFolderError');
  }
}

/**
 * Ofrece restaurar la copia más reciente o una carpeta elegida, confirma y
 * ejecuta la restauración.
 *
 * Devuelve `relaunch` solo si la restauración terminó y la aplicación se va a
 * reiniciar; cualquier otro desenlace vuelve al aviso principal.
 */
async function runRestoreFlow(
  ports: SafeModePromptPorts,
  recovery: SafeModeRecoveryPorts | null,
  appName: string,
): Promise<'continue' | 'relaunch'> {
  if (recovery === null) {
    return 'continue';
  }

  const restore = messages.safeMode.restore;
  let choice: number;

  try {
    ({ response: choice } = await ports.showMessageBox({
      type: 'question',
      title: restore.title,
      message: restore.message,
      detail: restore.detail,
      buttons: [
        restore.buttons.latest,
        restore.buttons.choose,
        restore.buttons.cancel,
      ],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    }));
  } catch {
    showFallbackError(ports, appName, 'fallback');

    return 'continue';
  }

  let backup: RestorableBackup | null;

  if (choice === 0) {
    try {
      backup = await recovery.findLatestBackup();
    } catch {
      backup = null;
    }

    if (backup === null) {
      showRestoreNotice(ports, appName, 'noBackups');

      return 'continue';
    }
  } else if (choice === 1) {
    let directory: string | null;

    try {
      directory = await recovery.chooseBackupDirectory();
    } catch {
      showRestoreNotice(ports, appName, 'selectionInvalid');

      return 'continue';
    }

    if (directory === null) {
      return 'continue';
    }

    try {
      backup = await recovery.inspectBackup(directory);
    } catch {
      backup = null;
    }

    if (backup === null) {
      showRestoreNotice(ports, appName, 'selectionInvalid');

      return 'continue';
    }
  } else {
    return 'continue';
  }

  let confirmed: number;

  try {
    ({ response: confirmed } = await ports.showMessageBox({
      type: 'warning',
      title: restore.confirm.title(appName),
      message: restore.confirm.message(
        formatBackupDate(backup.manifest.createdAt),
        backup.manifest.schemaVersion,
      ),
      detail: restore.confirm.detail,
      buttons: [
        restore.confirm.buttons.restore,
        restore.confirm.buttons.cancel,
      ],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    }));
  } catch {
    showFallbackError(ports, appName, 'fallback');

    return 'continue';
  }

  if (confirmed !== 0) {
    return 'continue';
  }

  let result: RestoreResult;

  try {
    result = await recovery.restoreBackup(backup.directory);
  } catch {
    result = { ok: false, code: 'DB_RESTORE_FAILED', reason: 'io' };
  }

  if (result.ok) {
    recovery.relaunch();

    return 'relaunch';
  }

  showRestoreFailure(ports, appName, result.code);

  return 'continue';
}

function showRestoreNotice(
  ports: SafeModePromptPorts,
  appName: string,
  kind: 'noBackups' | 'selectionInvalid',
): void {
  const notice = messages.safeMode.restore[kind];

  try {
    ports.showErrorBox(notice.title(appName), notice.detail);
  } catch {
    // Si el aviso de error falla, el bucle principal sigue siendo seguro.
  }
}

function showRestoreFailure(
  ports: SafeModePromptPorts,
  appName: string,
  code: RestoreErrorCode,
): void {
  const restore = messages.safeMode.restore;
  const safeMode = messages.safeMode;

  try {
    ports.showErrorBox(
      restore.failed.title(appName),
      `${restore.failed.detail[code]}\n\n${safeMode.codeLabel}: ${code}`,
    );
  } catch {
    // El fallo del aviso no debe dejar la aplicación bloqueada.
  }
}

/**
 * Muestra el error de respaldo y devuelve si se pudo mostrar.
 *
 * Si el propio respaldo falla, el llamador debe salir para no dejar la app
 * bloqueada sin interfaz.
 */
function showFallbackError(
  ports: Pick<SafeModePromptPorts, 'showErrorBox'>,
  appName: string,
  kind: 'fallback' | 'openFolderError',
): boolean {
  const message = messages.safeMode[kind];

  try {
    ports.showErrorBox(message.title(appName), message.detail);

    return true;
  } catch {
    return false;
  }
}
