import axeCore from 'axe-core';
import type { AxeResults, RunOptions } from 'axe-core';
import type { Page } from '@playwright/test';

/**
 * Ejecuta axe-core dentro de la ventana de Electron.
 *
 * `@axe-core/playwright` crea una pestaña en blanco para terminar el análisis,
 * y el contexto de Electron no admite `browserContext.newPage()`
 * (`Target.createTarget: Not supported`). Por eso se inyecta el propio
 * axe-core con `page.evaluate`, que no está sujeto a la CSP, y se llama a
 * `axe.run` sobre el documento actual. Sin iframes remotos que analizar: la
 * ventana de la aplicación no carga contenido externo (ADR 0004).
 */
export async function analyzeWithAxe(
  page: Page,
  options: RunOptions = {},
  context?: string,
): Promise<AxeResults> {
  await page.evaluate(axeCore.source);

  return page.evaluate(
    ({ runOptions, selector }) => {
      const runner = (
        window as unknown as {
          readonly axe: {
            run: (
              context: Document | Element,
              options: RunOptions,
            ) => Promise<AxeResults>;
          };
        }
      ).axe;
      const target =
        selector === undefined ? document : document.querySelector(selector);

      if (target === null) {
        throw new Error(`No existe el contexto de axe: ${selector}`);
      }

      return runner.run(target, runOptions);
    },
    { runOptions: options, selector: context },
  );
}
