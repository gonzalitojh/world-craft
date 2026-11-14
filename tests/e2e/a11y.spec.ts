import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = [
  { path: '/', name: 'portada' },
  { path: '/login', name: 'login' },
  { path: '/health', name: 'estado' },
  { path: '/esta-ruta-no-existe', name: '404' },
];

for (const route of routes) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`sin errores críticos ni graves en ${route.name} (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(route.path);

      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter(
        (violation) =>
          violation.impact === 'critical' || violation.impact === 'serious',
      );

      expect(
        blocking.map(
          (violation) =>
            `${violation.id} (${violation.impact}): ${violation.help}`,
        ),
      ).toEqual([]);
    });
  }
}
