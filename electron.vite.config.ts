/**
 * Configuración de electron-vite.
 *
 * - `main` y `preload` se compilan a CommonJS (`.cjs`) porque `package.json`
 *   declara `"type": "module"` y el preload debe seguir funcionando con el
 *   sandbox activado.
 * - `renderer` es ESM y usa React.
 * - La CSP de producción se inyecta como `<meta>` en el `<head>` antes de los
 *   scripts generados.
 */
import { cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

import { buildContentSecurityPolicy } from './src/main/security/content-security-policy';

const fromRoot = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url));

const createCommonjsOutput = () => ({
  entryFileNames: '[name].cjs',
  chunkFileNames: '[name]-[hash].cjs',
});

/**
 * Copia las migraciones versionadas junto al bundle de `main` (`out/main/drizzle`).
 *
 * El runner las lee desde `__dirname/drizzle` tanto en desarrollo como en la
 * versión instalada; #68 se encarga de desempaquetar los módulos nativos del
 * asar.
 */
function copyDrizzleMigrationsPlugin(): Plugin {
  return {
    name: 'world-craft:copy-drizzle-migrations',
    async writeBundle() {
      const source = fromRoot('./drizzle');
      const target = fromRoot('./out/main/drizzle');

      await rm(target, { recursive: true, force: true });
      await cp(source, target, { recursive: true });
    },
  };
}

function contentSecurityPolicyPlugin(development: boolean): Plugin {
  const policy = buildContentSecurityPolicy({ development });

  return {
    name: 'world-craft:content-security-policy',
    transformIndexHtml: {
      // En build, `pre` inyecta la meta antes de las etiquetas del bundle. En
      // desarrollo, Vite añade `/@vite/client` y React Refresh con
      // `head-prepend` después de los hooks `pre`, así que se usa `post` para
      // que la CSP quede la primera del `<head>`.
      order: development ? 'post' : 'pre',
      handler: () => [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: policy,
          },
          injectTo: 'head-prepend',
        },
      ],
    },
  };
}

export default defineConfig(({ command }) => {
  const development = command === 'serve';

  return {
    main: {
      plugins: [copyDrizzleMigrationsPlugin()],
      build: {
        lib: {
          entry: fromRoot('./src/main/index.ts'),
          formats: ['cjs'],
        },
        rolldownOptions: {
          // El módulo nativo y el ORM no se empaquetan: se cargan desde
          // `node_modules` en desarrollo y desde el paquete en la versión
          // instalada. #68 desempaqueta better-sqlite3 del asar.
          external: ['better-sqlite3', /^drizzle-orm(\/.*)?$/],
          output: createCommonjsOutput(),
        },
      },
    },
    preload: {
      build: {
        lib: {
          entry: fromRoot('./src/preload/index.ts'),
          formats: ['cjs'],
        },
        rolldownOptions: { output: createCommonjsOutput() },
      },
    },
    renderer: {
      plugins: [react(), contentSecurityPolicyPlugin(development)],
      build: {
        // electron-vite desactiva la minificación por defecto en los tres
        // procesos. El renderer es el único código que se distribuye al
        // usuario, así que se minifica solo en build.
        minify: true,
        rolldownOptions: {
          input: fromRoot('./src/renderer/index.html'),
        },
      },
    },
  };
});
