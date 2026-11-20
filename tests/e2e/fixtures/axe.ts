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
): Promise<AxeResults> {
  await page.evaluate(axeCore.source);

  return page.evaluate((runOptions) => {
    const runner = (
      window as unknown as {
        readonly axe: {
          run: (context: Document, options: RunOptions) => Promise<AxeResults>;
        };
      }
    ).axe;

    return runner.run(document, runOptions);
  }, options);
}
