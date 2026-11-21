import type { AxeResults, RunOptions } from 'axe-core';

import { es as messages } from '../../src/renderer/messages/es';

import { analyzeWithAxe } from './fixtures/axe';
import { expect, test } from './fixtures/electron-app';

/**
 * Auditoría de accesibilidad del shell y del banco de muestras con axe.
 *
 * El criterio de la issue es que axe no reporte errores **críticos** en
 * Claro y Oscuro. Los niveles `serious` se anotan en el informe cuando
 * aparecen, pero la auditoría visual completa de pantallas es #133.
 */
const THEMES = [
  { mode: 'light', label: messages.shell.theme.currentLight },
  { mode: 'dark', label: messages.shell.theme.currentDark },
] as const;

const currentThemeToggleName = messages.shell.theme.switchLabel(
  messages.shell.theme.currentLight,
);

const AXE_OPTIONS: RunOptions = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  },
};

function expectNoCriticalViolations(results: AxeResults, label: string): void {
  // Guarda de motor: si la inyección de axe se rompiera, el análisis podría
  // devolver una lista vacía y pasar en silencio.
  expect(results.testEngine.name).toBe('axe-core');
  expect(
    results.passes.length +
      results.violations.length +
      results.incomplete.length,
  ).toBeGreaterThan(0);

  const critical = results.violations.filter(
    (violation) => violation.impact === 'critical',
  );
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious',
  );

  expect(
    critical.map((violation) => ({
      id: violation.id,
      help: violation.help,
      nodes: violation.nodes.length,
    })),
    `${label}: ${critical.length} violaciones críticas de axe`,
  ).toEqual([]);

  // Deja rastro de los avisos graves sin convertirlos en puerta de esta
  // issue: se revisan en la auditoría completa.
  test.info().annotations.push({
    type: 'axe-serious',
    description:
      serious.length === 0
        ? 'Sin violaciones graves.'
        : serious
            .map((violation) => `${violation.id}: ${violation.help}`)
            .join(' | '),
  });
}

for (const theme of THEMES) {
  test(`axe no reporta errores críticos en el shell con tema ${theme.label}`, async ({
    page,
  }) => {
    const html = page.locator('html');
    const toggle = page.getByRole('button', { name: currentThemeToggleName });

    if (theme.mode === 'dark') {
      await toggle.click();
    }

    await expect(html).toHaveAttribute('data-theme', theme.mode);

    const results = await analyzeWithAxe(page, AXE_OPTIONS);

    expectNoCriticalViolations(results, `shell ${theme.label}`);
  });
}

for (const theme of THEMES) {
  test(`axe no reporta errores críticos en Muestras con tema ${theme.label}`, async ({
    page,
  }) => {
    const navigation = page.getByRole('navigation', {
      name: messages.shell.navigationLabel,
    });

    await navigation
      .getByRole('button', { name: messages.shell.views.samples })
      .click();

    if (theme.mode === 'dark') {
      await page.getByRole('button', { name: currentThemeToggleName }).click();
    }

    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      theme.mode,
    );
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: messages.shell.views.samples,
      }),
    ).toBeVisible();

    const results = await analyzeWithAxe(page, AXE_OPTIONS);

    expectNoCriticalViolations(results, `muestras ${theme.label}`);
  });
}

test('axe detecta una violación crítica conocida', async ({ page }) => {
  // Prueba negativa del arnés: sin `<alt>`, la regla `image-alt` es crítica.
  // Demuestra que la aserción anterior no es vacía.
  await page.evaluate(() => {
    const image = document.createElement('img');
    image.id = 'wc-axe-probe';
    image.src =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    document.body.append(image);
  });

  const results = await analyzeWithAxe(page, {
    runOnly: { type: 'rule', values: ['image-alt'] },
  });

  const critical = results.violations.filter(
    (violation) => violation.impact === 'critical',
  );

  expect(critical.map((violation) => violation.id)).toContain('image-alt');
});
