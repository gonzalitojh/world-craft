/**
 * Mensajes visibles del proceso principal.
 *
 * Todo el texto de interfaz nativa del proceso principal pasa por aquí para
 * que esté centralizado, tipado y preparado para añadir más idiomas sin tocar
 * la lógica de los diálogos (ADR 0009).
 */
import type { DatabaseErrorCode } from '../db/errors';
import { DEFAULT_LOCALE, toIntlLocale } from '../../shared/contracts/locale';

export interface MainMessages {
  readonly assetsPicker: {
    readonly title: string;
    readonly filterName: string;
  };
  readonly transfer: {
    readonly exportDialogTitle: string;
    readonly exportFilterName: string;
    readonly importDialogTitle: string;
    readonly importFilterName: string;
    readonly importAllFilesFilterName: string;
  };
  readonly data: {
    readonly exportDialogTitle: string;
    readonly exportFilterName: string;
  };
  readonly safeMode: {
    readonly buttons: {
      readonly openBackups: string;
      readonly restoreBackup: string;
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
    readonly restore: {
      readonly title: string;
      readonly message: string;
      readonly detail: string;
      readonly chooseTitle: string;
      readonly buttons: {
        readonly latest: string;
        readonly choose: string;
        readonly cancel: string;
      };
      readonly noBackups: {
        readonly title: (appName: string) => string;
        readonly detail: string;
      };
      readonly selectionInvalid: {
        readonly title: (appName: string) => string;
        readonly detail: string;
      };
      readonly confirm: {
        readonly title: (appName: string) => string;
        readonly message: (createdAt: string, schemaVersion: number) => string;
        readonly detail: string;
        readonly buttons: {
          readonly restore: string;
          readonly cancel: string;
        };
      };
      readonly failed: {
        readonly title: (appName: string) => string;
        readonly detail: Record<
          | 'DB_RESTORE_INVALID'
          | 'DB_RESTORE_FAILED'
          | 'DB_RESTORE_ROLLBACK_FAILED',
          string
        >;
      };
    };
  };
}

// El MVP está en español; cuando exista el locale del perfil esta fecha usará
// el mismo formateador centralizado que el resto de la interfaz.
const backupDateFormatter = new Intl.DateTimeFormat(
  toIntlLocale(DEFAULT_LOCALE),
  {
    dateStyle: 'long',
    timeStyle: 'short',
  },
);

/** Formatea la fecha de una copia con el locale del MVP. */
export function formatBackupDate(createdAt: string): string {
  return backupDateFormatter.format(new Date(createdAt));
}

export const messages: MainMessages = {
  assetsPicker: {
    title: 'Elegir imágenes',
    filterName: 'Imágenes',
  },
  transfer: {
    exportDialogTitle: 'Exportar mundo',
    exportFilterName: 'Mundo de World Craft',
    importDialogTitle: 'Importar mundo',
    importFilterName: 'Mundo de World Craft',
    importAllFilesFilterName: 'Todos los archivos',
  },
  data: {
    exportDialogTitle: 'Exportar todos los datos',
    exportFilterName: 'Biblioteca de World Craft',
  },
  safeMode: {
    buttons: {
      openBackups: 'Abrir carpeta de copias',
      restoreBackup: 'Restaurar copia…',
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
      DB_RESTORE_INVALID:
        'La copia elegida no supera la verificación. No se ha modificado la base de datos.',
      DB_RESTORE_FAILED:
        'No se pudo restaurar la copia. La aplicación intentó devolver los datos a su estado anterior.',
      DB_RESTORE_INTERRUPTED:
        'Hay una restauración en curso o una anterior se interrumpió antes de terminar. No se ha abierto ni creado la base de datos. Restaura una copia para recuperar los datos o revisa la carpeta de copias.',
      DB_RESTORE_ROLLBACK_FAILED:
        'La restauración falló y no se pudo devolver la base anterior a su sitio. No se ha borrado nada; revisa la carpeta de copias antes de continuar.',
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
    restore: {
      title: 'Restaurar una copia de seguridad',
      message: 'Elige la copia que quieres restaurar.',
      detail:
        'La copia se verificará antes de reemplazar los datos actuales. Los assets (imágenes y archivos) no se sustituyen.',
      chooseTitle: 'Elegir carpeta de copia',
      buttons: {
        latest: 'Usar la copia más reciente',
        choose: 'Elegir una carpeta…',
        cancel: 'Cancelar',
      },
      noBackups: {
        title: (appName) => `${appName}: no hay copias válidas`,
        detail:
          'No se encontró ninguna copia que supere la verificación. Puedes abrir la carpeta de copias, continuar en modo seguro o salir.',
      },
      selectionInvalid: {
        title: (appName) => `${appName}: copia no válida`,
        detail:
          'La carpeta elegida no está dentro de la carpeta de copias o no contiene una copia verificable.',
      },
      confirm: {
        title: (appName) => `${appName}: confirmar restauración`,
        message: (createdAt, schemaVersion) =>
          `Se restaurará la copia del ${createdAt} (versión de esquema ${schemaVersion}).`,
        detail:
          'Se guardará una copia recuperable de los datos actuales antes de reemplazarlos. Los assets no se sustituyen. La aplicación se reiniciará al terminar.',
        buttons: {
          restore: 'Restaurar',
          cancel: 'Cancelar',
        },
      },
      failed: {
        title: (appName) => `${appName}: no se pudo restaurar`,
        detail: {
          DB_RESTORE_INVALID:
            'La copia no supera la verificación. No se ha modificado nada.',
          DB_RESTORE_FAILED:
            'No se pudo completar la restauración. La aplicación intentó dejar los datos como estaban; revisa la carpeta de copias antes de continuar.',
          DB_RESTORE_ROLLBACK_FAILED:
            'No se pudo revertir la restauración y la base anterior no volvió a su sitio. No se ha borrado nada; revisa la carpeta de copias antes de continuar.',
        },
      },
    },
  },
};
