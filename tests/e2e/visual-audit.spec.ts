import type { Page } from '@playwright/test';

import { createFormatters } from '../../src/renderer/i18n/formats';
import { es as messages } from '../../src/renderer/messages/es';

import {
  AUDIT_DATA,
  AUDIT_HEIGHTS,
  AUDIT_WIDTHS,
  applyAuditTheme,
  auditFocus,
  auditReducedMotion,
  countDomNodes,
  expectAxeClean,
  expectNoOverflow,
  expectThemeTokens,
  extendAuditEntities,
  flushAuditStore,
  measureContrast,
  measureNavigation,
  measureView,
  openAuditEntities,
  openAuditEntity,
  openAuditHome,
  openAuditSamples,
  openAuditSearch,
  openAuditWorld,
  openAuditWorlds,
  recordAuditRecord,
  recordCheck,
  recordContrast,
  recordFinding,
  recordFocus,
  recordMotion,
  recordPerformance,
  resetAuditStore,
  runAxe,
  seedAuditData,
  setAuditViewport,
  settle,
  startLongTaskProbe,
  stopLongTaskProbe,
  takeAuditScreenshot,
  type AuditRecord,
  type AuditSeed,
  type AuditWidth,
  type ThemeName,
} from './fixtures/audit';
import { expect, test } from './fixtures/electron-app';

/**
 * Auditoría visual, temas y ruido (#133).
 *
 * Matriz 1024×700 / 1280×800 / 1600×900 × Claro/Oscuro sobre las seis pantallas
 * de producto, el banco interno de Muestras y los overlays; más los estados
 * vacíos y de filtro sin resultados. Cada celda deja overflow, tema, axe, ruido
 * y captura en `test-results/e2e/audit/records.json`. `scripts/audit-report.mjs`
 * genera la Parte B del contrato a partir de ese registro.
 *
 * No duplica las regresiones de `design-v2.spec.ts`, `entities.spec.ts`,
 * `search.spec.ts` o `accessibility.spec.ts`: aquí se mide la matriz completa y
 * se registran los valores.
 */

const THEMES: readonly { mode: ThemeName; label: string }[] = [
  { mode: 'light', label: messages.shell.theme.currentLight },
  { mode: 'dark', label: messages.shell.theme.currentDark },
];

const OVERLAY_WIDTHS = [1024, 1280, 1600] as const;

test.beforeAll(async () => {
  await resetAuditStore();
});

test.afterAll(async () => {
  await flushAuditStore();
});

interface CaptureOptions {
  readonly page: Page;
  readonly view: string;
  readonly state: string;
  readonly theme: ThemeName;
  readonly width: AuditWidth;
  readonly notes?: readonly string[];
  readonly selectors?: readonly string[];
  readonly scrollSelector?: string;
}

async function capture({
  page,
  view,
  state,
  theme,
  width,
  notes = [],
  selectors = [],
  scrollSelector,
}: CaptureOptions): Promise<AuditRecord> {
  await settle(page);

  const metrics = await measureView(page, selectors);
  const axe = await runAxe(page);
  const screenshot = await takeAuditScreenshot(
    page,
    view,
    state,
    theme,
    width,
    scrollSelector,
  );

  const record: AuditRecord = {
    id: `${view}-${state}-${theme}-${width}`,
    view,
    state,
    theme,
    width,
    height: AUDIT_HEIGHTS[width],
    themeAttr: metrics.themeAttr,
    tokens: metrics.tokens,
    overflow: metrics.overflow,
    axe,
    noise: metrics.noise,
    screenshot,
    notes,
  };

  await recordAuditRecord(record);

  expect(metrics.themeAttr, `${record.id}: data-theme`).toBe(theme);
  expectThemeTokens(theme, metrics.tokens);
  expect(metrics.tabindexPositive, `${record.id}: tabindex > 0`).toEqual([]);
  expect(metrics.noise, `${record.id}: ruido de caja`).toEqual([]);
  expectNoOverflow(metrics.overflow, record.id);
  expectAxeClean(axe, record.id);

  return record;
}

async function seedAndOpenHome(page: Page): Promise<AuditSeed> {
  const seed = await seedAuditData(page);

  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.home }),
  ).toBeVisible();

  return seed;
}

async function openAuditHistory(page: Page): Promise<void> {
  await page.locator('[data-section="history"] .wc-disclosure__toggle').click();
  await expect(page.locator('#wc-entity-section-history')).toHaveAttribute(
    'data-open',
    'true',
  );
  await expect(page.locator('.wc-history__retention')).toBeVisible();
}

async function moveAuditEntityToTrash(
  page: Page,
  worldId: string,
  entityId: string,
): Promise<void> {
  const removed = await page.evaluate(
    async ({ worldId: targetWorldId, entityId: targetEntityId }) => {
      const result = await window.worldCraft.entities.remove({
        worldId: targetWorldId,
        id: targetEntityId,
      });

      return result.ok && result.data.deleted;
    },
    { worldId, entityId },
  );

  expect(removed, 'la ficha de auditoría se mueve a la papelera').toBe(true);
}

async function openAuditTrash(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.trash })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.trash }),
  ).toBeVisible();
}

async function restoreAuditEntity(page: Page, name: string): Promise<void> {
  await page
    .getByRole('button', { name: messages.trash.row.restoreNamed(name) })
    .click();
  await expect(page.getByText(messages.trash.row.restored(name))).toBeVisible();

  const closeButtons = page.getByRole('button', { name: /^Cerrar aviso/ });

  while ((await closeButtons.count()) > 0) {
    await closeButtons.first().click();
  }
}

const formatters = createFormatters('es');
const MINUTE = 60_000;

/**
 * Recalcula las fechas del DOM con el mismo `Intl` del renderer.
 *
 * Las tarjetas de mundo usan `formatRelativeTime`; la actividad usa
 * `formatDateTime`. Se tolera un desfase de hasta dos minutos para no fallar
 * cuando la ejecución cruza un límite de unidad.
 */
async function assertTimeElements(page: Page, label: string): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  const times = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLTimeElement>('time')].map((time) => ({
      className: time.className,
      dateTime: time.getAttribute('datetime'),
      title: time.getAttribute('title'),
      text: time.textContent?.trim() ?? '',
    })),
  );

  expect(times.length, `${label}: no hay elementos <time>`).toBeGreaterThan(0);

  for (const time of times) {
    expect(time.dateTime, `${label}: <time> sin dateTime`).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );

    const dateTime = time.dateTime ?? '';

    if (time.className.includes('wc-world-card__time')) {
      expect(time.title, `${label}: tarjeta sin title`).toBeTruthy();

      const prefix = messages.worlds.card.relativeUpdated('');
      const relative = time.text.startsWith(prefix)
        ? time.text.slice(prefix.length).trim()
        : '';
      const variants = new Set(
        [-2, -1, 0, 1, 2].map((offset) =>
          formatters.formatRelativeTime(dateTime, now + offset * MINUTE),
        ),
      );

      expect(
        variants.has(relative),
        `${label}: «${time.text}» no coincide con Intl.RelativeTimeFormat`,
      ).toBe(true);
    }

    if (time.className.includes('wc-activity__time')) {
      expect(
        time.text,
        `${label}: actividad no coincide con Intl.DateTimeFormat`,
      ).toBe(formatters.formatDateTime(dateTime));
    }
  }
}

async function recordBaseFindings(): Promise<void> {
  await recordFinding({
    id: 'F1',
    severity: 'major',
    screen: 'O3 · gestor de tipos',
    selector: '.wc-toast-region / App.tsx; entity-type-manager.tsx',
    evidence:
      'El aviso de borrado bloqueado queda bajo la top layer del showModal(); no es visible. Corregido en #133 con un role="alert" dentro de la confirmación.',
    decision:
      'C10: mensaje inline dentro de .wc-inline-confirm; «Eliminar» oculto y «Cancelar» disponible.',
    childIssue: '#144',
  });
  await recordFinding({
    id: 'F2',
    severity: 'minor',
    screen: 'P3 · Mundo',
    selector: '.wc-world-modules__button / world-module-nav.tsx',
    evidence:
      '«Resumen» es un botón enfocable sin acción y con cursor: pointer (T6). No es un enlace muerto ni un fallo axe.',
    decision:
      'No se corrige en #133. Candidato a #93 / issue hija de teclado: texto no interactivo con aria-current o cursor: default.',
    childIssue: '#93',
  });
}

for (const theme of THEMES) {
  test(`matriz visual de pantallas, Muestras y overlays · ${theme.label}`, async ({
    electronApp,
    page,
  }) => {
    test.setTimeout(30 * 60_000);

    const seed = await seedAndOpenHome(page);

    await applyAuditTheme(page, theme.mode);

    for (const width of AUDIT_WIDTHS) {
      await setAuditViewport(electronApp, page, width);

      await openAuditHome(page);
      await capture({
        page,
        view: 'home',
        state: 'ready',
        theme: theme.mode,
        width,
      });

      if (width === 1280) {
        await capture({
          page,
          view: 'home',
          state: 'activity',
          theme: theme.mode,
          width,
          notes: ['Captura desplazada a la actividad para evidenciar C2.'],
          scrollSelector: '.wc-home-activity',
        });
        await page.evaluate(() => {
          const main = document.getElementById('wc-main');

          if (main !== null) {
            main.scrollTop = 0;
          }
        });
      }

      await openAuditWorlds(page);
      await capture({
        page,
        view: 'worlds',
        state: 'ready',
        theme: theme.mode,
        width,
      });

      await openAuditWorld(page, seed.primaryWorldName);
      await capture({
        page,
        view: 'world',
        state: 'ready',
        theme: theme.mode,
        width,
      });

      await openAuditEntities(page);
      await capture({
        page,
        view: 'entities',
        state: 'ready',
        theme: theme.mode,
        width,
      });

      await openAuditHome(page);
      await openAuditWorld(page, seed.primaryWorldName);
      await openAuditEntities(page);
      await openAuditEntity(page, seed.longEntityName);
      await capture({
        page,
        view: 'entity',
        state: 'ready',
        theme: theme.mode,
        width,
      });

      await openAuditHistory(page);
      await capture({
        page,
        view: 'entity',
        state: 'history',
        theme: theme.mode,
        width,
      });

      await openAuditSearch(page, AUDIT_DATA.searchQuery);
      await expect(page.locator('.wc-search-hit').first()).toBeVisible();
      await capture({
        page,
        view: 'search',
        state: 'results',
        theme: theme.mode,
        width,
      });

      await openAuditSamples(page);
      await capture({
        page,
        view: 'samples',
        state: 'ready',
        theme: theme.mode,
        width,
      });

      await moveAuditEntityToTrash(
        page,
        seed.primaryWorldId,
        seed.longEntityId,
      );
      await openAuditTrash(page);
      await expect(
        page
          .locator('[data-trash-kind="entity"]')
          .filter({ hasText: seed.longEntityName }),
      ).toBeVisible();
      await capture({
        page,
        view: 'trash',
        state: 'list',
        theme: theme.mode,
        width,
      });
      await restoreAuditEntity(page, seed.longEntityName);

      await openAuditHome(page);
    }

    for (const width of OVERLAY_WIDTHS) {
      await setAuditViewport(electronApp, page, width);
      await openAuditHome(page);

      await page.keyboard.press('Control+k');
      await expect(
        page.getByRole('dialog', { name: messages.palette.title }),
      ).toBeVisible();
      await capture({
        page,
        view: 'palette',
        state: 'open',
        theme: theme.mode,
        width,
      });
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('dialog', { name: messages.palette.title }),
      ).toHaveCount(0);

      await page
        .getByRole('button', { name: messages.worlds.actions.create })
        .click();
      await expect(
        page.getByRole('dialog', {
          name: messages.worlds.form.createTitle,
        }),
      ).toBeVisible();
      await capture({
        page,
        view: 'world-dialog',
        state: 'open',
        theme: theme.mode,
        width,
      });
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('dialog', {
          name: messages.worlds.form.createTitle,
        }),
      ).toHaveCount(0);

      await openAuditWorlds(page);

      const worldActions = page
        .getByRole('button', {
          name: messages.worlds.card.actionsNamed(seed.primaryWorldName),
        })
        .first();

      await worldActions.click();
      await page
        .getByRole('menuitem', { name: messages.worlds.card.edit })
        .click();
      await expect(
        page.getByRole('dialog', {
          name: messages.worlds.form.editTitle(seed.primaryWorldName),
        }),
      ).toBeVisible();
      await expect(
        page
          .getByRole('dialog', {
            name: messages.worlds.form.editTitle(seed.primaryWorldName),
          })
          .getByRole('combobox', {
            name: messages.worlds.form.descriptionLabel,
          }),
      ).toBeVisible();
      await capture({
        page,
        view: 'world-dialog',
        state: 'edit',
        theme: theme.mode,
        width,
      });
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('dialog', {
          name: messages.worlds.form.editTitle(seed.primaryWorldName),
        }),
      ).toHaveCount(0);

      await worldActions.click();
      await expect(page.getByRole('menu')).toBeVisible();
      await capture({
        page,
        view: 'menu',
        state: 'open',
        theme: theme.mode,
        width,
      });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).toHaveCount(0);

      const themeToggle = page.getByRole('button', {
        name: messages.shell.theme.switchLabel(theme.label),
      });

      await themeToggle.hover();
      await expect(page.getByRole('tooltip')).toBeVisible();
      await capture({
        page,
        view: 'tooltip',
        state: 'open',
        theme: theme.mode,
        width,
      });
      await page.keyboard.press('Escape');
      await page.mouse.move(0, 0);
      await expect(page.getByRole('tooltip')).toHaveCount(0);

      await openAuditWorld(page, seed.primaryWorldName);
      await openAuditEntities(page);

      const favorite = page.locator('.wc-entity-card__favorite').first();

      await favorite.click();
      await expect(page.locator('.wc-toast').first()).toBeVisible();
      await capture({
        page,
        view: 'toast',
        state: 'open',
        theme: theme.mode,
        width,
      });
      await page
        .getByRole('button', { name: /^Cerrar aviso/ })
        .first()
        .click();

      await openAuditHome(page);
      await openAuditWorld(page, seed.primaryWorldName);
      await openAuditEntities(page);
      await openAuditEntity(page, seed.longEntityName);
      await page
        .getByRole('button', {
          name: messages.entities.detail.edit,
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('button', {
          name: messages.entities.detail.done,
          exact: true,
        }),
      ).toBeVisible();
      await capture({
        page,
        view: 'editor',
        state: 'editing',
        theme: theme.mode,
        width,
      });
      await page
        .getByRole('button', {
          name: messages.entities.detail.done,
          exact: true,
        })
        .click();

      await page
        .getByRole('button', { name: messages.entities.detail.back })
        .click();
      await expect(
        page.getByRole('heading', {
          level: 2,
          name: messages.entities.list.title,
        }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: messages.entities.list.menuLabel })
        .click();
      await page
        .getByRole('menuitem', { name: messages.entities.list.manageTypes })
        .click();
      await expect(
        page.getByRole('dialog', {
          name: messages.entities.types.title,
        }),
      ).toBeVisible();
      await capture({
        page,
        view: 'type-manager',
        state: 'open',
        theme: theme.mode,
        width,
      });

      await page
        .getByRole('button', {
          name: messages.entities.types.removeNamed(seed.customTypeName),
        })
        .click();
      await page
        .getByRole('button', {
          name: messages.entities.types.removeSubmit,
        })
        .click();
      await expect(
        page
          .getByRole('dialog', { name: messages.entities.types.title })
          .getByRole('alert'),
      ).toHaveText(messages.entities.types.removeBlocked);
      await capture({
        page,
        view: 'type-manager',
        state: 'delete-blocked',
        theme: theme.mode,
        width,
      });
      await page
        .getByRole('button', { name: messages.entities.types.cancel })
        .click();

      await page
        .getByRole('button', {
          name: messages.entities.types.editNamed(seed.customTypeName),
        })
        .click();
      await expect(
        page.getByRole('dialog').locator('.wc-field-group'),
      ).toBeVisible();
      await capture({
        page,
        view: 'type-manager',
        state: 'edit-form',
        theme: theme.mode,
        width,
        notes: ['Grupo de campos visible para evidenciar C6.'],
        scrollSelector: '.wc-field-group',
      });
      await page
        .getByRole('dialog')
        .getByRole('button', { name: messages.entities.types.cancel })
        .click();

      await page
        .getByRole('dialog')
        .getByRole('button', { name: messages.entities.types.close })
        .last()
        .click();

      await openAuditHome(page);
    }

    await setAuditViewport(electronApp, page, 1024);
    await openAuditHome(page);
    await page.getByRole('button', { name: messages.shell.collapse }).click();
    await expect(
      page.getByRole('button', { name: messages.shell.expand }),
    ).toHaveAttribute('aria-expanded', 'false');
    await capture({
      page,
      view: 'rail-collapsed',
      state: 'ready',
      theme: theme.mode,
      width: 1024,
    });
    await page.getByRole('button', { name: messages.shell.expand }).click();
  });
}

test('estados vacíos y filtros sin resultados', async ({
  electronApp,
  page,
}) => {
  test.setTimeout(15 * 60_000);

  for (const theme of THEMES) {
    await applyAuditTheme(page, theme.mode);

    for (const width of OVERLAY_WIDTHS) {
      await setAuditViewport(electronApp, page, width);

      // Cada anchura empieza en Inicio: la app no debe heredar la vista de la
      // iteración anterior (Mundos comparte el texto del estado vacío).
      await openAuditHome(page);
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: messages.shell.views.home,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', {
          level: 2,
          name: messages.home.emptyTitle,
        }),
      ).toBeVisible();
      await capture({
        page,
        view: 'home',
        state: 'empty',
        theme: theme.mode,
        width,
      });

      await openAuditWorlds(page);
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: messages.shell.views.worlds,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', {
          name: messages.worlds.list.emptyTitle,
        }),
      ).toBeVisible();
      await capture({
        page,
        view: 'worlds',
        state: 'empty',
        theme: theme.mode,
        width,
      });
    }

    await openAuditHome(page);
  }

  const seed = await seedAndOpenHome(page);

  for (const theme of THEMES) {
    await applyAuditTheme(page, theme.mode);

    for (const width of OVERLAY_WIDTHS) {
      await setAuditViewport(electronApp, page, width);

      await openAuditWorld(page, seed.primaryWorldName);
      await openAuditEntities(page);
      await page
        .getByRole('searchbox', { name: messages.entities.list.searchLabel })
        .fill(AUDIT_DATA.impossibleQuery);
      await expect(
        page.getByRole('heading', {
          name: messages.entities.list.emptyFilterTitle,
        }),
      ).toBeVisible();
      await capture({
        page,
        view: 'entities',
        state: 'filter-empty',
        theme: theme.mode,
        width,
      });

      await openAuditSearch(page, AUDIT_DATA.impossibleQuery);
      await expect(
        page.getByRole('heading', { name: messages.search.emptyTitle }),
      ).toBeVisible();
      await capture({
        page,
        view: 'search',
        state: 'no-results',
        theme: theme.mode,
        width,
      });

      await openAuditHome(page);
    }
  }
});

for (const theme of THEMES) {
  test(`contraste computado y foco · ${theme.label}`, async ({
    electronApp,
    page,
  }) => {
    test.setTimeout(10 * 60_000);

    const seed = await seedAndOpenHome(page);

    await applyAuditTheme(page, theme.mode);
    await setAuditViewport(electronApp, page, 1280);

    const contrasts = await measureContrast(page, theme.mode);

    await recordContrast(contrasts);

    for (const entry of contrasts) {
      expect(
        entry.ratio,
        `${entry.id}: ${entry.pair} (${entry.ratio}:1 < ${entry.minimum}:1)`,
      ).toBeGreaterThanOrEqual(entry.minimum);
    }

    await openAuditHome(page);
    const home = await auditFocus(page);
    await recordFocus(`${theme.mode}-home`, home);
    expect(
      home.minControl ?? 0,
      `objetivo mínimo en Inicio (${home.minControlLabel ?? 'sin control'})`,
    ).toBeGreaterThanOrEqual(28);
    if (home.minPrimary !== null) {
      expect(
        home.minPrimary,
        `primario de 32 px en Inicio (${home.minPrimaryLabel ?? 'sin primario'})`,
      ).toBeGreaterThanOrEqual(32);
    }

    await openAuditWorlds(page);
    const worlds = await auditFocus(page);
    await recordFocus(`${theme.mode}-worlds`, worlds);

    await openAuditWorld(page, seed.primaryWorldName);
    const world = await auditFocus(page);
    await recordFocus(`${theme.mode}-world`, world);

    await openAuditEntities(page);
    const entities = await auditFocus(page);
    await recordFocus(`${theme.mode}-entities`, entities);

    await openAuditHome(page);
    await openAuditWorld(page, seed.primaryWorldName);
    await openAuditEntities(page);
    await openAuditEntity(page, seed.longEntityName);
    const entity = await auditFocus(page);
    await recordFocus(`${theme.mode}-entity`, entity);

    await openAuditSearch(page, AUDIT_DATA.searchQuery);
    const search = await auditFocus(page);
    await recordFocus(`${theme.mode}-search`, search);

    for (const result of [home, worlds, world, entities, entity, search]) {
      expect(result.failures, 'anillo de foco').toEqual([]);
      expect(result.orderFailures, 'orden de tabulación').toEqual([]);
      expect(result.stops, 'paradas de tabulación').toBe(result.expectedStops);
      expect(
        result.minControl ?? 0,
        `objetivo mínimo (${result.minControlLabel ?? 'sin control'})`,
      ).toBeGreaterThanOrEqual(28);

      if (result.minPrimary !== null) {
        expect(
          result.minPrimary,
          `primario de 32 px (${result.minPrimaryLabel ?? 'sin primario'})`,
        ).toBeGreaterThanOrEqual(32);
      }
    }
  });
}

test('movimiento reducido y navegación de producto', async ({
  electronApp,
  page,
}) => {
  test.setTimeout(10 * 60_000);

  const seed = await seedAndOpenHome(page);

  await applyAuditTheme(page, 'light');
  await setAuditViewport(electronApp, page, 1024);
  await openAuditHome(page);

  const motion = await auditReducedMotion(page);

  await recordMotion(motion);
  await recordCheck(
    'movimiento',
    `Transiciones ≤ 0,02 ms; rail plegado a ${motion.railCollapsedWidth} px en ${motion.railCollapseDuration} ms; sin bucles.`,
  );
  await openAuditHome(page);
  await assertTimeElements(page, 'Inicio');

  const navigation = await page.evaluate(() => {
    const navigation = document.querySelector<HTMLElement>('#wc-navigation');
    const railText =
      document.querySelector('.wc-shell__rail')?.textContent ?? '';
    const topbarText = document.querySelector('.wc-topbar')?.textContent ?? '';
    const version = /\bv\d+\.\d+\.\d+\b/;

    return {
      navItems: [
        ...(navigation?.querySelectorAll<HTMLElement>(
          '.wc-nav-item__label, .wc-nav-item[aria-label]',
        ) ?? []),
      ].map(
        (element) =>
          element.textContent?.trim() ||
          element.getAttribute('aria-label') ||
          '',
      ),
      hasSamples: `${railText} ${topbarText}`.includes('Muestras'),
      hasVersion: version.test(railText) || version.test(topbarText),
      links: [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].map(
        (anchor) => anchor.getAttribute('href') ?? '',
      ),
    };
  });

  expect(navigation.navItems).toEqual([
    messages.shell.views.home,
    messages.shell.views.worlds,
    messages.shell.views.trash,
  ]);
  expect(navigation.hasSamples, 'Muestras fuera de producto').toBe(false);
  expect(navigation.hasVersion, 'sin lema ni versión en el rail').toBe(false);
  expect(
    navigation.links.every(
      (href) => href === '#wc-main' || href.startsWith('#/internal/'),
    ),
  ).toBe(true);

  await openAuditWorlds(page);
  await assertTimeElements(page, 'Mundos');

  await page.keyboard.press('Control+k');
  const paletteText = await page
    .getByRole('dialog', { name: messages.palette.title })
    .textContent();
  expect(paletteText ?? '').not.toContain('Muestras');
  await page.keyboard.press('Escape');

  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.worlds })
    .click();
  await openAuditWorld(page, seed.primaryWorldName);

  const modules = await page.evaluate(() => {
    const planned = [
      ...document.querySelectorAll<HTMLElement>(
        '.wc-world-modules__item--planned',
      ),
    ];

    return {
      count: planned.length,
      focusable: planned.some((item) =>
        item.matches('button, a, [tabindex], [href]'),
      ),
      labels: planned.map((item) => item.textContent?.trim() ?? ''),
    };
  });

  expect(modules.count).toBeGreaterThanOrEqual(3);
  expect(modules.focusable, 'módulos previstos enfocables').toBe(false);

  await recordCheck(
    'navegacion.rail',
    'Rail solo Inicio y Mundos; sin lema, versión ni campana.',
  );
  await recordCheck('navegacion.paleta', 'Paleta de comandos sin «Muestras».');
  await recordCheck(
    'navegacion.enlaces',
    'En producto solo el enlace de salto y los enlaces internos del editor.',
  );
  await recordCheck(
    'navegacion.previstos',
    'Mapas, Manuscrito y Grafo no son botones ni enlaces y no son enfocables.',
  );
  await recordCheck(
    'textos.fechas',
    'Inicio: tarjetas relativas recalculadas con Intl.RelativeTimeFormat (±2 minutos) y actividad con Intl.DateTimeFormat; Mundos: tarjetas relativas recalculadas. Todas las <time> llevan dateTime ISO y las tarjetas, title.',
  );
  await recordCheck(
    'textos.catalogo',
    'Textos desde el catálogo; tests de i18n y no-hardcoded en verde.',
  );
  await recordCheck(
    'textos.observaciones',
    'T1 y T3–T6 menores y diferidas; T2 no se toca (§7.4).',
  );

  await recordBaseFindings();
});

test('rendimiento con contenido largo', async ({ electronApp, page }) => {
  test.setTimeout(20 * 60_000);

  const seed = await seedAndOpenHome(page);

  await applyAuditTheme(page, 'light');
  await setAuditViewport(electronApp, page, 1280);

  const measure = async (
    view: string,
    action: () => Promise<void>,
    readySelector: string,
    threshold: string,
  ): Promise<void> => {
    await startLongTaskProbe(page);
    const mountMs = await measureNavigation(page, action, readySelector);
    const longTasks = await stopLongTaskProbe(page);
    const domNodes = await countDomNodes(page);
    const longTaskMaxMs = longTasks.length === 0 ? 0 : Math.max(...longTasks);
    const longestBlockMs = longTaskMaxMs;
    const mountLimitMs =
      view === 'entities-200' || view === 'entity-50k' ? 2_000 : 1_000;
    const overBudget =
      longTaskMaxMs > 1_000 ||
      longestBlockMs > 2_000 ||
      mountMs > mountLimitMs ||
      (view === 'home' && domNodes > 1_500) ||
      (view === 'worlds' && domNodes > 3_000) ||
      (view === 'world' && domNodes > 3_000) ||
      (view === 'entities-200' && domNodes > 12_000) ||
      (view === 'entity-50k' && domNodes > 10_000) ||
      (view === 'search-30' && domNodes > 6_000);

    await recordPerformance({
      view,
      width: 1280,
      theme: 'light',
      domNodes,
      mountMs,
      longTaskMaxMs,
      longestBlockMs,
      threshold,
      result: overBudget ? 'over-budget' : 'ok',
    });

    if (longTaskMaxMs > 1_000 || longestBlockMs > 2_000) {
      throw new Error(
        `${view}: bloqueo de ${longestBlockMs} ms (long task ${longTaskMaxMs} ms)`,
      );
    }
  };

  await openAuditHome(page);
  await measure(
    'home',
    async () => {
      await openAuditHome(page);
      await expect(
        page.getByRole('heading', {
          level: 2,
          name: messages.home.recentTitle,
        }),
      ).toBeVisible();
    },
    '.wc-world-card',
    '1.500 nodos / 1.000 ms / 500 ms / 2 s',
  );

  await measure(
    'worlds',
    async () => {
      await openAuditWorlds(page);
      await expect(page.locator('.wc-world-card')).toHaveCount(12);
    },
    '.wc-world-grid',
    '3.000 nodos / 1.000 ms / 500 ms / 2 s',
  );

  await measure(
    'world',
    async () => {
      await openAuditWorld(page, seed.primaryWorldName);
    },
    '.wc-world-header',
    '3.000 nodos / 1.000 ms / 500 ms / 2 s',
  );

  await extendAuditEntities(page, seed.primaryWorldId, 140);
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.home }),
  ).toBeVisible();
  await setAuditViewport(electronApp, page, 1280);

  await measure(
    'entities-200',
    async () => {
      await openAuditWorld(page, seed.primaryWorldName);
      await openAuditEntities(page);
      await expect(page.locator('.wc-entity-card')).toHaveCount(200);
    },
    '.wc-entity-grid',
    '12.000 nodos / 2.000 ms / 500 ms (bloqueo > 1.000) / 2 s',
  );

  await measure(
    'entity-50k',
    async () => {
      await openAuditHome(page);
      await openAuditWorld(page, seed.primaryWorldName);
      await openAuditEntities(page);
      await openAuditEntity(page, seed.extremeEntityName);
    },
    '.wc-entity-doc',
    '10.000 nodos / 2.000 ms / 500 ms (bloqueo > 1.000) / 2 s',
  );

  await measure(
    'search-30',
    async () => {
      await openAuditSearch(page, AUDIT_DATA.searchQuery);
      await expect(page.locator('.wc-search-hit').first()).toBeVisible();
    },
    '.wc-search-results',
    '6.000 nodos / 1.000 ms / 500 ms / 2 s',
  );
});
