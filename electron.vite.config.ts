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
      build: {
        lib: {
          entry: fromRoot('./src/main/index.ts'),
          formats: ['cjs'],
        },
        rolldownOptions: { output: createCommonjsOutput() },
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
