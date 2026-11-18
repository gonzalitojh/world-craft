/**
 * Mensajes visibles del proceso principal.
 *
 * Todo el texto de interfaz nativa del proceso principal pasa por aquí para
 * que esté centralizado, tipado y preparado para añadir más idiomas sin tocar
 * la lógica de los diálogos (ADR 0009).
 */
import type { DatabaseErrorCode } from '../db/errors';

export interface MainMessages {
  readonly safeMode: {
    readonly buttons: {
      readonly openBackups: string;
      readonly continueInSafeMode: string;
      readonly exit: string;
    };
    readonly title: (appName: string) => string;
    readonly message: string;
    readonly detail: Record<DatabaseErrorCode, string>;
    readonly codeLabel: string;
    readonly openFolderError: {
      readonly title: (appName: string) => string;
      readonly detail: string;
    };
    readonly fallback: {
      readonly title: (appName: string) => string;
      readonly detail: string;
    };
  };
}

export const messages: MainMessages = {
  safeMode: {
    buttons: {
      openBackups: 'Abrir carpeta de copias',
      continueInSafeMode: 'Continuar en modo seguro',
      exit: 'Salir',
    },
    title: (appName) => `${appName} ha arrancado en modo seguro`,
    message: 'La aplicación no puede acceder a sus datos en este momento.',
    detail: {
      DB_OPEN_FAILED:
        'No se pudo abrir el archivo de datos. Comprueba que la carpeta de datos existe y que tienes permisos para leerla y escribir en ella.',
      DB_INTEGRITY_FAILED:
        'El archivo de datos no supera la comprobación de integridad. No se ha modificado.',
      DB_VERSION_AHEAD:
        'Los datos pertenecen a una versión más reciente de World Craft. Actualiza la aplicación antes de continuar.',
      DB_MIGRATION_CHECKSUM_MISMATCH:
        'Una migración ya aplicada no coincide con la versión instalada. No se ha modificado la base.',
      DB_BACKUP_FAILED:
        'No se pudo crear una copia de seguridad antes de actualizar los datos. Para protegerlos, no se ha migrado nada.',
      DB_MIGRATION_FAILED:
        'No se pudieron aplicar los cambios de estructura. No se ha modificado la base.',
    },
    codeLabel: 'Código',
    openFolderError: {
      title: (appName) => `${appName}: no se pudo abrir la carpeta`,
      detail:
        'No se pudo abrir la carpeta de copias. Puedes continuar en modo seguro o salir.',
    },
    fallback: {
      title: (appName) => `${appName}: Modo seguro`,
      detail:
        'No se pudo abrir la carpeta de copias o mostrar el aviso. La aplicación se cerrará para proteger tus datos.',
    },
  },
};
