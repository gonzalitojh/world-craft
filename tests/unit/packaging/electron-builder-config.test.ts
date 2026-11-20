import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface BuilderConfig {
  readonly appId: string;
  readonly productName: string;
  readonly files: readonly string[];
  readonly asar: boolean;
  readonly asarUnpack: readonly string[];
  readonly npmRebuild: boolean;
  readonly nodeGypRebuild: boolean;
  readonly buildDependenciesFromSource: boolean;
  readonly directories: {
    readonly output: string;
    readonly buildResources: string;
  };
  readonly extraFiles: readonly {
    readonly from: string;
    readonly to: string;
  }[];
  readonly publish: readonly {
    readonly provider: string;
    readonly owner: string;
    readonly repo: string;
    readonly token?: string;
  }[];
  readonly win: {
    readonly target: readonly {
      readonly target: string;
      readonly arch?: readonly string[];
    }[];
    readonly icon: string;
    readonly executableName: string;
    readonly requestedExecutionLevel: string;
    readonly signExecutable: boolean;
    readonly verifyUpdateCodeSignature: boolean;
    readonly forceCodeSigning: boolean;
  };
  readonly nsis: {
    readonly oneClick: boolean;
    readonly perMachine: boolean;
    readonly allowElevation: boolean;
    readonly allowToChangeInstallationDirectory: boolean;
    readonly createDesktopShortcut: boolean;
    readonly createStartMenuShortcut: boolean;
    readonly runAfterFinish: boolean;
    readonly deleteAppDataOnUninstall: boolean;
    readonly installerLanguages: readonly string[];
    readonly artifactName: string;
    readonly include: string;
  };
  readonly afterPack: unknown;
}

const require = createRequire(import.meta.url);
const config = require(
  join(process.cwd(), 'electron-builder.config.cjs'),
) as BuilderConfig;

describe('configuración de electron-builder', () => {
  it('identifica la aplicación y publica la salida en release/', () => {
    expect(config.appId).toBe('com.gonzalitojh.worldcraft');
    expect(config.productName).toBe('World Craft');
    expect(config.directories).toEqual({
      output: 'release',
      buildResources: 'resources',
    });
  });

  it('empaqueta solo el build y el manifiesto', () => {
    expect(config.files).toEqual(['out/**/*', 'package.json']);
    expect(config.files.some((pattern) => pattern.includes('src'))).toBe(false);
    expect(config.asar).toBe(true);
    expect(config.asarUnpack).toEqual([
      '**/node_modules/better-sqlite3/**',
      '**/node_modules/sharp/**',
      '**/node_modules/@img/**',
      '**/*.node',
    ]);
  });

  it('no recompila módulos nativos durante el empaquetado', () => {
    expect(config.npmRebuild).toBe(false);
    expect(config.nodeGypRebuild).toBe(false);
    expect(config.buildDependenciesFromSource).toBe(false);
    expect('allowMissingDependencies' in config).toBe(false);
  });

  it('copia licencias y avisos junto al ejecutable', () => {
    expect(config.extraFiles).toEqual([
      { from: 'LICENSE', to: 'LICENSE' },
      { from: 'THIRD-PARTY-NOTICES.md', to: 'THIRD-PARTY-NOTICES.md' },
      { from: 'resources/licenses', to: 'licenses' },
    ]);
  });

  it('deja el instalador sin firma y sin exigir publisherName', () => {
    expect(config.win.signExecutable).toBe(false);
    expect(config.win.verifyUpdateCodeSignature).toBe(false);
    expect(config.win.forceCodeSigning).toBe(false);
    expect('sign' in config.win).toBe(false);
    expect('signAndEditExecutable' in config.win).toBe(false);
    expect('updateManifest' in config).toBe(false);
    expect(config.win.requestedExecutionLevel).toBe('asInvoker');
    expect(config.win.executableName).toBe('World Craft');
    expect(config.win.icon).toBe('icon.ico');
  });

  it('configura NSIS por usuario sin administrador y conserva userData', () => {
    expect(config.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }]);
    expect(config.nsis).toMatchObject({
      oneClick: false,
      perMachine: false,
      allowElevation: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: false,
      createStartMenuShortcut: true,
      runAfterFinish: true,
      deleteAppDataOnUninstall: false,
      installerLanguages: ['es_ES'],
      artifactName: 'world-craft-${version}-setup.${ext}',
      include: 'installer.nsh',
    });
  });

  it('publica en GitHub sin token y sin firmar', () => {
    expect(config.publish).toEqual([
      {
        provider: 'github',
        owner: 'gonzalitojh',
        repo: 'world-craft',
      },
    ]);
    expect(JSON.stringify(config)).not.toContain('token');
    expect(JSON.stringify(config)).not.toContain('password');
  });

  it('genera app-update.yml también en la build desempaquetada', async () => {
    expect(typeof config.afterPack).toBe('function');

    const directory = await mkdtemp(join(tmpdir(), 'world-craft-after-pack-'));

    try {
      const appOutDir = join(directory, 'win-out');
      const resourcesDir = join(appOutDir, 'resources');
      await mkdir(resourcesDir, { recursive: true });

      const afterPack = config.afterPack as (context: {
        readonly electronPlatformName: string;
        readonly appOutDir: string;
        readonly packager: {
          readonly appInfo: { readonly updaterCacheDirName: string };
        };
      }) => Promise<void>;

      await afterPack({
        electronPlatformName: 'win32',
        appOutDir,
        packager: {
          appInfo: { updaterCacheDirName: 'world-craft-updater' },
        },
      });

      const contents = await readFile(
        join(resourcesDir, 'app-update.yml'),
        'utf8',
      );

      expect(contents).toBe(
        'owner: gonzalitojh\nrepo: world-craft\nprovider: github\nupdaterCacheDirName: world-craft-updater\n',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('poda los binarios nativos que no son de Windows x64', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'world-craft-prune-'));
    const appOutDir = join(directory, 'win-out');
    const unpackedModules = join(
      appOutDir,
      'resources',
      'app.asar.unpacked',
      'node_modules',
    );

    try {
      await mkdir(join(unpackedModules, '@img', 'sharp-win32-arm64'), {
        recursive: true,
      });
      await mkdir(join(unpackedModules, '@img', 'sharp-win32-x64'), {
        recursive: true,
      });
      await mkdir(join(unpackedModules, 'better-sqlite3', 'prebuilds'), {
        recursive: true,
      });
      await writeFile(
        join(unpackedModules, '@img', 'sharp-win32-arm64', 'arm64.node'),
        'x',
      );
      await writeFile(
        join(unpackedModules, '@img', 'sharp-win32-x64', 'x64.node'),
        'x',
      );

      for (const name of [
        'win32-x64.node',
        'win32-arm64.node',
        'linux-x64.node',
      ]) {
        await writeFile(
          join(unpackedModules, 'better-sqlite3', 'prebuilds', name),
          'x',
        );
      }

      const afterPack = config.afterPack as (context: {
        readonly electronPlatformName: string;
        readonly arch: number;
        readonly appOutDir: string;
        readonly packager: {
          readonly appInfo: { readonly updaterCacheDirName: string };
        };
      }) => Promise<void>;

      await afterPack({
        electronPlatformName: 'win32',
        arch: 1,
        appOutDir,
        packager: {
          appInfo: { updaterCacheDirName: 'world-craft-updater' },
        },
      });

      expect(await readdir(join(unpackedModules, '@img'))).toEqual([
        'sharp-win32-x64',
      ]);
      expect(
        await readdir(join(unpackedModules, 'better-sqlite3', 'prebuilds')),
      ).toEqual(['win32-x64.node']);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('incluye las macros NSIS de instalación por usuario y aviso de datos', async () => {
    const installer = await readFile(
      join(process.cwd(), 'resources', 'installer.nsh'),
      'utf8',
    );

    expect(installer).toContain('!macro customInstallMode');
    expect(installer).toContain('StrCpy $isForceCurrentInstall "1"');
    expect(installer).toContain('!macro customUnInstall');
    expect(installer).not.toContain('!macro customUnInstallSection');
    expect(installer).toContain('IfSilent');
    expect(installer).toContain('$APPDATA\\World Craft');
  });
});
