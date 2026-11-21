import { expect, type Page } from '@playwright/test';

import { es as messages } from '../../../src/renderer/messages/es';
import { INTERNAL_SAMPLES_HASH } from '../../../src/renderer/shell/internal-views';

/**
 * Abre el banco interno de Muestras por su hash.
 *
 * Desde #126 Muestras no tiene entrada en el rail ni en la paleta: solo se
 * llega por `#/internal/samples`. El helper centraliza ese acceso para que las
 * pruebas E2E de diseño y accesibilidad no dependan de la navegación de
 * producto.
 */
export async function openSamples(page: Page): Promise<void> {
  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, INTERNAL_SAMPLES_HASH);

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: messages.shell.views.samples,
    }),
  ).toBeVisible();
}
