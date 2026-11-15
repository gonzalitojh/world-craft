import { expect, test, type Page } from '@playwright/test';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { ResolvedTheme } from '../../src/lib/theme';
import { es } from '../../src/messages/es';

/**
 * Capturas de referencia del sistema de diseño (issue #8, fase 4).
 *
 * Regenerar las cuatro imágenes:
 *
 * ```bash
 * corepack pnpm design:captures
 * ```
 *
 * El script ejecuta solo el proyecto `captures` de `playwright.config.ts`, que
 * a su vez levanta el servidor de desarrollo con el `webServer` de siempre. La
 * suite funcional (`pnpm test:e2e`) no puede escribir PNG por accidente: el
 * proyecto `chromium` ignora este archivo con `testIgnore` y el script se
 * limita al proyecto `chromium` con `--project`.
 *
 * Reglas para que las capturas sean estables entre ejecuciones y máquinas:
 *
 * 1. Viewport fijo (1280×800 y 360×800) y `deviceScaleFactor: 1`.
 * 2. `reducedMotion: 'reduce'`: el sistema no declara animaciones, y aun así se
 *    espera a que no quede ninguna en curso antes de disparar.
 * 3. Tema decidido por `localStorage` (`wc-theme`) inyectado antes del primer
 *    pintado, no por la preferencia del sistema operativo de quien captura.
 * 4. Se espera a que las fuentes estén cargadas (`document.fonts.ready`) y a
 *    que la isla de tema esté hidratada: el `<select>` de tema pinta «Sistema»
 *    en el HTML del servidor y el valor guardado después, y una captura a
 *    mitad de hidratación no sería reproducible.
 * 5. Nada de fechas, horas, números aleatorios ni scroll: la página se captura
 *    en su posición inicial. Contenido sintético del catálogo, sin datos
 *    reales.
 *
 * Las imágenes viven en `docs/diseno/capturas/` y se comparan entre versiones:
 * un cambio de tokens, tipografía o shell debería notarse ahí.
 */

/** Ruta de salida, relativa a la raíz del repositorio. */
const CAPTURES_DIR = path.resolve(process.cwd(), 'docs', 'diseno', 'capturas');

/** Tamaños de referencia: escritorio y móvil, en píxeles CSS. */
const VIEWPORTS = [
  { name: '1280', width: 1280, height: 800 },
  { name: '360', width: 360, height: 800 },
] as const;

/** Los dos temas del sistema, con el nombre que llevan en el archivo. */
const THEMES: readonly ResolvedTheme[] = ['light', 'dark'];

/**
 * Límites de tamaño del PNG. No son una regla de negocio: detectan el fallo
 * silencioso de una captura en blanco (unos pocos cientos de bytes) o de una
 * imagen disparatada por una densidad de pantalla mal fijada.
 */
const MIN_BYTES = 20_000;
const MAX_BYTES = 2_000_000;

/** Firma de un PNG válido: `\x89PNG\r\n\x1a\n`. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a]);

/**
 * Deja la página en un estado del que se pueda tomar una foto reproducible.
 *
 * El orden importa: primero el tema (ya resuelto por el script de arranque),
 * después las fuentes, después la hidratación y por último las animaciones.
 */
async function settle(page: Page, theme: ResolvedTheme): Promise<void> {
  // Tema resuelto antes del primer pintado por el script de arranque.
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme-preference',
    theme,
  );

  // Fuentes: `next/font` las sirve desde el propio dominio con `display:
  // swap`, así que hasta que `fonts.ready` no resuelve el texto puede cambiar
  // de métrica.
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  expect(
    await page.evaluate(() => document.fonts.status),
    'las fuentes deben estar cargadas antes de capturar',
  ).toBe('loaded');

  // Hidratación: los dos selectores de tema (topbar y espécimen) arrancan en
  // «Sistema» en el HTML del servidor y pasan al valor guardado al montar.
  // Se busca por rol y no por etiqueta: la sección del espécimen se llama
  // igual («Tema») y `getByLabel` la incluiría.
  const themeSelects = page.getByRole('combobox', {
    name: es.theme.label,
    exact: true,
  });
  const selectCount = await themeSelects.count();

  expect(
    selectCount,
    'debe haber al menos un selector de tema',
  ).toBeGreaterThan(0);

  for (let index = 0; index < selectCount; index += 1) {
    await expect(themeSelects.nth(index)).toHaveValue(theme);
  }

  // El indicador de desarrollo de Next (`<nextjs-portal>` con la burbuja «N»)
  // no es parte del producto: se oculta para que la captura documente el shell
  // y no la herramienta. En producción el nodo no existe y la regla es inerte.
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  });

  // Sin animaciones en curso: con movimiento reducido no debería quedar
  // ninguna, y si alguna se cuela (una transición de un componente) se espera
  // aquí en lugar de capturarla a medias.
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .every((animation) => animation.playState !== 'running'),
    undefined,
    { timeout: 10_000 },
  );
}

type Capture = {
  theme: ResolvedTheme;
  width: number;
  height: number;
  fileName: string;
};

const CAPTURES: readonly Capture[] = VIEWPORTS.flatMap((viewport) =>
  THEMES.map((theme) => ({
    theme,
    width: viewport.width,
    height: viewport.height,
    fileName: `design-system-${viewport.name}-${theme}.png`,
  })),
);

for (const capture of CAPTURES) {
  test(`captura ${capture.fileName}`, async ({ page }) => {
    await page.setViewportSize({
      width: capture.width,
      height: capture.height,
    });
    // Tema explícito en `localStorage` antes de que cargue cualquier script de
    // la página. También se emula la preferencia del sistema para que una
    // captura clara no dependa de un portátil en modo oscuro.
    await page.emulateMedia({
      colorScheme: capture.theme,
      reducedMotion: 'reduce',
    });
    await page.addInitScript((theme) => {
      window.localStorage.setItem('wc-theme', theme);
    }, capture.theme);

    await page.goto('/design-system');

    await settle(page, capture.theme);

    // Ni scroll horizontal (regla del proyecto) ni contenido fuera del ancho:
    // el viewport es justo el que se quiere documentar.
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    }));

    expect(
      metrics.scrollWidth,
      'la página no debe desbordar a lo ancho',
    ).toBeLessThanOrEqual(metrics.innerWidth);
    expect(metrics.scrollX).toBe(0);
    expect(metrics.scrollY).toBe(0);

    await mkdir(CAPTURES_DIR, { recursive: true });

    const file = path.join(CAPTURES_DIR, capture.fileName);

    await page.screenshot({
      path: file,
      // Solo el viewport: la imagen documenta la primera pantalla del shell y
      // no crece con la página viva.
      fullPage: false,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });

    // El archivo existe, es un PNG y su tamaño es razonable.
    const info = await stat(file);

    expect(info.size).toBeGreaterThan(MIN_BYTES);
    expect(info.size).toBeLessThan(MAX_BYTES);

    const bytes = await readFile(file);

    expect(bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)).toBe(
      true,
    );
  });
}
