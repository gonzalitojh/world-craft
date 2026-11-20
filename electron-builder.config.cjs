/**
 * Configuración de electron-builder para World Craft.
 *
 * Se mantiene en CommonJS para que electron-builder la cargue sin un loader de
 * TypeScript y para poder leer `package.json` con `require`.
 *
 * Decisiones (ADR 0003, ADR 0013 y ADR 0015):
 * - Target NSIS por usuario en LOCALAPPDATA, sin administrador.
 * - Instalador sin firma: no se configura certificado ni firma forzada.
 * - `userData` queda fuera de la carpeta de instalación; el desinstalador no
 *   borra datos (`deleteAppDataOnUninstall: false`).
 * - `electron-updater` usa GitHub Releases; `--publish never` evita publicar
 *   desde local o CI.
 *
 * La firma se desactiva explícitamente con `win.signExecutable: false` en
 * electron-builder 26; así una variable de entorno con certificado no firma el
 * artefacto por accidente. `verifyUpdateCodeSignature: false` evita exigir
 * `publisherName` al escribir `app-update.yml` sin firma. La firma de
 * manifiestos Ed25519 llega con electron-builder 27 y se decidirá en M5.
 */
const { existsSync, readdirSync, rmSync } = require('node:fs');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const pkg = require('./package.json');

/** Valor de `builder-util.Arch.x64`; el target del producto es Windows x64. */
const X64_ARCH = 1;

/**
 * Escribe `app-update.yml` también en las builds `--dir`.
 *
 * electron-builder solo lo genera cuando el target es NSIS. La carpeta
 * desempaquetada se usa para verificar el paquete y para pruebas locales, así
 * que necesita el mismo manifiesto que la instalación real. En una build NSIS
 * el archivo ya existe y este hook no lo toca.
 */
async function writeAppUpdateConfig(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const resourcesDir = join(context.appOutDir, 'resources');
  const appUpdateFile = join(resourcesDir, 'app-update.yml');

  if (existsSync(appUpdateFile)) {
    return;
  }

  const cacheDirName = context.packager.appInfo.updaterCacheDirName;

  await writeFile(
    appUpdateFile,
    `owner: gonzalitojh\nrepo: world-craft\nprovider: github\nupdaterCacheDirName: ${cacheDirName}\n`,
    'utf8',
  );
}

/**
 * Elimina del paquete los binarios nativos que no son de Windows x64.
 *
 * `supportedArchitectures` instala sharp para win32-x64 y para la arquitectura
 * del equipo (ARM64 en desarrollo), y better-sqlite3 publica todos sus
 * prebuilds. El producto solo se distribuye para Windows x64, así que se
 * conservan el binario x64 de sharp y `win32-x64.node` de better-sqlite3, y se
 * eliminan el resto para no engordar el instalador ni distribuir código ajeno
 * a la plataforma. En una build que no sea x64 no se poda nada.
 */
function pruneNonX64NativeModules(context) {
  if (context.electronPlatformName !== 'win32' || context.arch !== X64_ARCH) {
    return;
  }

  const unpackedModules = join(
    context.appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
  );

  if (!existsSync(unpackedModules)) {
    return;
  }

  for (const directory of ['sharp-win32-arm64', 'sharp-win32-ia32']) {
    rmSync(join(unpackedModules, '@img', directory), {
      recursive: true,
      force: true,
    });
  }

  const prebuilds = join(unpackedModules, 'better-sqlite3', 'prebuilds');

  if (existsSync(prebuilds)) {
    for (const entry of readdirSync(prebuilds)) {
      if (entry !== 'win32-x64.node') {
        rmSync(join(prebuilds, entry), { recursive: true, force: true });
      }
    }
  }
}

async function afterPack(context) {
  await writeAppUpdateConfig(context);
  pruneNonX64NativeModules(context);
}

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.gonzalitojh.worldcraft',
  productName: 'World Craft',
  copyright: `Copyright © 2026 ${pkg.author}`,

  afterPack,

  directories: {
    output: 'release',
    buildResources: 'resources',
  },

  // Solo viaja el resultado compilado y el manifiesto; el código fuente y las
  // herramientas de desarrollo no entran en el paquete.
  files: ['out/**/*', 'package.json'],

  extraFiles: [
    { from: 'LICENSE', to: 'LICENSE' },
    { from: 'THIRD-PARTY-NOTICES.md', to: 'THIRD-PARTY-NOTICES.md' },
    { from: 'resources/licenses', to: 'licenses' },
  ],

  asar: true,
  // Los módulos nativos no pueden cargarse desde dentro del asar.
  asarUnpack: [
    '**/node_modules/better-sqlite3/**',
    '**/node_modules/sharp/**',
    '**/node_modules/@img/**',
    '**/*.node',
  ],

  // Los binarios incluidos ya son Node-API y están probados con verify:native;
  // no se recompilan ni se construyen desde fuentes durante el empaquetado.
  npmRebuild: false,
  nodeGypRebuild: false,
  buildDependenciesFromSource: false,

  // Sin token: la publicación real la hará el flujo de release con
  // GITHUB_TOKEN. En local y CI siempre se pasa `--publish never`.
  publish: [
    {
      provider: 'github',
      owner: 'gonzalitojh',
      repo: 'world-craft',
    },
  ],

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'icon.ico',
    executableName: 'World Craft',
    requestedExecutionLevel: 'asInvoker',
    // La build se distribuye sin firma. Al no verificar la firma del update,
    // app-update.yml no exige publisherName.
    signExecutable: false,
    verifyUpdateCodeSignature: false,
    forceCodeSigning: false,
  },

  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: false,
    createStartMenuShortcut: true,
    runAfterFinish: true,
    // Nunca se toca la carpeta de datos del usuario al desinstalar.
    deleteAppDataOnUninstall: false,
    installerLanguages: ['es_ES'],
    displayLanguageSelector: false,
    installerIcon: 'icon.ico',
    uninstallerIcon: 'icon.ico',
    installerHeaderIcon: 'icon.ico',
    uninstallDisplayName: 'World Craft ${version}',
    packElevateHelper: false,
    artifactName: 'world-craft-${version}-setup.${ext}',
    include: 'installer.nsh',
  },
};
