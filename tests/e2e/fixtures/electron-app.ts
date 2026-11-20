import { access, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  _electron as electron,
  expect,
  test as base,
  type ElectronApplication,
  type Page,
} from '@playwright/test';

/**
 * Fixtures de las pruebas E2E de escritorio.
 *
 * Cada prueba recibe su propia carpeta temporal en `os.tmpdir()` y la pasa a
 * Electron con `--user-data-dir`. El fixture comprueba que
 * `app.getPath('userData')` cae exactamente en esa carpeta, de modo que un
 * fallo de aislamiento detiene la prueba antes de tocar datos del usuario. Al
 * terminar se cierra la aplicación y se borra la carpeta.
 *
 * No se lee ni se escribe `%APPDATA%`: las bases, los assets y las copias de la
 * aplicación real quedan fuera del alcance del E2E.
 */

// Sin separador final: en Windows un `\` al final del argumento escaparía la
// comilla y Electron recibiría una ruta inválida.
const REPOSITORY_ROOT = dirname(
  fileURLToPath(new URL('../../../package.json', import.meta.url)),
);
const MAIN_ENTRY = join(REPOSITORY_ROOT, 'out', 'main', 'index.cjs');
const RENDERER_ENTRY = join(REPOSITORY_ROOT, 'out', 'renderer', 'index.html');

export interface ElectronFixtures {
  /** Carpeta temporal que Electron usa como `userData`. */
  readonly userDataDir: string;
  /** Proceso principal de Electron. */
  readonly electronApp: ElectronApplication;
  /** Primera ventana de la aplicación ya cargada. */
  readonly page: Page;
}

/** Falla con una instrucción clara si no hay build que abrir. */
async function ensureBuild(): Promise<void> {
  try {
    await access(MAIN_ENTRY);
    await access(RENDERER_ENTRY);
  } catch {
    throw new Error(
      'Falta el build de escritorio. Ejecuta `pnpm build` o `pnpm test:e2e`.',
    );
  }
}

export const test = base.extend<ElectronFixtures>({
  userDataDir: async (
    // eslint-disable-next-line no-empty-pattern -- fixture sin dependencias
    {},
    use,
  ) => {
    await ensureBuild();

    const directory = await mkdtemp(join(tmpdir(), 'world-craft-e2e-'));

    await use(directory);

    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  },
  electronApp: async ({ userDataDir }, use) => {
    // Segunda barrera además de `--user-data-dir`: si el switch regresara,
    // Chromium y Electron no deben encontrar %APPDATA% ni %LOCALAPPDATA% del
    // usuario. Ambas rutas viven dentro del temporal y se borran con él.
    const appDataDir = join(userDataDir, 'appdata');
    const localAppDataDir = join(userDataDir, 'localappdata');
    await mkdir(appDataDir, { recursive: true });
    await mkdir(localAppDataDir, { recursive: true });

    const application = await electron.launch({
      args: [REPOSITORY_ROOT, `--user-data-dir=${userDataDir}`],
      cwd: REPOSITORY_ROOT,
      env: {
        ...process.env,
        APPDATA: appDataDir,
        LOCALAPPDATA: localAppDataDir,
      },
    });

    try {
      // Comprobación lo antes posible: si `--user-data-dir` dejara de
      // aplicarse, la aplicación ya habría abierto/creado su userData real.
      // Por eso el fixture falla aquí, antes de pedir la ventana.
      const actualUserData = await application.evaluate(({ app }) =>
        app.getPath('userData'),
      );

      if (resolve(actualUserData) !== resolve(userDataDir)) {
        throw new Error(
          `El E2E no está aislado: userData ${actualUserData} no es ${userDataDir}.`,
        );
      }
    } catch (error) {
      await application.close();
      throw error;
    }

    await use(application);

    await application.close();
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();

    await page.waitForLoadState('domcontentloaded');

    await use(page);
  },
});

export { expect };
