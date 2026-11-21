import type { ElectronApplication, Page } from '@playwright/test';

import { es as messages } from '../../src/renderer/messages/es';

import { expect, test } from './fixtures/electron-app';

/**
 * Regresiones de la revisión UI de #125.
 *
 * Comprueba en la ventana real los defectos que jsdom no puede medir: ancho de
 * tooltip, colisión del menú y del tooltip con el borde, foco computado,
 * objetivos de clic, hover y recorte dentro del diálogo. Se ejecuta en los dos
 * temas y a 1024 px, el ancho mínimo admitido.
 */
const THEMES = [
  { mode: 'light', label: messages.shell.theme.currentLight },
  { mode: 'dark', label: messages.shell.theme.currentDark },
] as const;

async function openSamples(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: messages.shell.navigationLabel })
    .getByRole('button', { name: messages.shell.views.samples })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: messages.shell.views.samples }),
  ).toBeVisible();
}

async function applyTheme(
  page: Page,
  mode: (typeof THEMES)[number]['mode'],
): Promise<void> {
  if (mode === 'dark') {
    await page
      .getByRole('button', {
        name: messages.shell.theme.switchLabel(
          messages.shell.theme.currentLight,
        ),
      })
      .click();
  }

  await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
}

async function setViewportWidth(
  electronApp: ElectronApplication,
  page: Page,
  width: number,
): Promise<void> {
  await electronApp.evaluate(
    ({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height);
    },
    { width, height: 800 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      }),
  );
}

async function pageWidth(page: Page): Promise<{
  clientWidth: number;
  scrollWidth: number;
}> {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
}

for (const theme of THEMES) {
  test(`tooltip, menú y foco no desbordan a 1024 en tema ${theme.label}`, async ({
    electronApp,
    page,
  }) => {
    await setViewportWidth(electronApp, page, 1024);
    await openSamples(page);
    await applyTheme(page, theme.mode);

    // B1/I4: tooltip largo junto al borde derecho, con ancho de contenido y
    // como máximo dos líneas, sin incrementar el ancho del documento.
    const tooltipTrigger = page
      .locator('.wc-samples__edge--tooltip')
      .getByRole('button');

    await tooltipTrigger.scrollIntoViewIfNeeded();
    await tooltipTrigger.hover();

    const tooltip = page.getByRole('tooltip');

    await expect(tooltip).toBeVisible();

    const tooltipMetrics = await tooltip.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);

      return {
        width: rect.width,
        height: rect.height,
        right: rect.right,
        lineHeight: Number.parseFloat(style.lineHeight),
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    expect(tooltipMetrics.width).toBeLessThanOrEqual(18 * 16 + 1);
    expect(tooltipMetrics.height).toBeLessThanOrEqual(
      tooltipMetrics.lineHeight * 2 + 12,
    );
    expect(tooltipMetrics.right).toBeLessThanOrEqual(
      tooltipMetrics.clientWidth + 1,
    );
    expect(tooltipMetrics.scrollWidth).toBeLessThanOrEqual(
      tooltipMetrics.clientWidth,
    );

    // I4/4: en la mitad inferior el tooltip se coloca arriba del disparador.
    await page.evaluate(() => {
      document
        .querySelector('.wc-samples__edge--tooltip')
        ?.scrollIntoView({ block: 'end' });
    });
    await tooltipTrigger.hover();

    const verticalPlacement = await page.evaluate(() => {
      const trigger = document
        .querySelector('.wc-samples__edge--tooltip')
        ?.querySelector('button');
      const bubble = document.querySelector('[role="tooltip"]');

      if (!trigger || !bubble) {
        return null;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();

      return {
        triggerCenter: triggerRect.top + triggerRect.height / 2,
        triggerTop: triggerRect.top,
        bubbleBottom: bubbleRect.bottom,
        viewportHeight: document.documentElement.clientHeight,
      };
    });

    expect(verticalPlacement).not.toBeNull();

    if (verticalPlacement !== null) {
      expect(verticalPlacement.triggerCenter).toBeGreaterThan(
        verticalPlacement.viewportHeight / 2,
      );
      expect(verticalPlacement.bubbleBottom).toBeLessThanOrEqual(
        verticalPlacement.triggerTop + 1,
      );
    }

    // B4: menú pegado al borde derecho; abierto no añade scroll horizontal.
    const menuTrigger = page
      .locator('.wc-samples__edge--menu')
      .getByRole('button');

    await menuTrigger.click();

    const menu = page.getByRole('menu');

    await expect(menu).toBeVisible();

    const menuMetrics = await menu.evaluate((element) => {
      const rect = element.getBoundingClientRect();

      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    expect(menuMetrics.left).toBeGreaterThanOrEqual(0);
    expect(menuMetrics.right).toBeLessThanOrEqual(menuMetrics.clientWidth + 1);
    expect(menuMetrics.top).toBeGreaterThanOrEqual(0);
    expect(menuMetrics.bottom).toBeLessThanOrEqual(
      menuMetrics.clientHeight + 1,
    );
    expect(menuMetrics.scrollWidth).toBeLessThanOrEqual(
      menuMetrics.clientWidth,
    );

    await page.keyboard.press('Escape');

    await expect(page.getByRole('menu')).toHaveCount(0);

    // B2: las marcas son gráficas y las etiquetas van fuera, en --fg.
    const marks = await page.evaluate(() => {
      const groups = Array.from(
        document.querySelectorAll<HTMLElement>('.wc-type-mark-group'),
      );
      const bodyColor = getComputedStyle(document.body).color;

      return {
        count: groups.length,
        bodyColor,
        entries: groups.map((group) => {
          const mark = group.querySelector('.wc-type-mark');
          const label = group.querySelector<HTMLElement>('.wc-type-mark-label');
          const rect = group.getBoundingClientRect();
          const labelStyle = label ? getComputedStyle(label) : null;

          return {
            markText: mark?.textContent?.trim() ?? '',
            markHidden: mark?.getAttribute('aria-hidden'),
            labelText: label?.textContent?.trim() ?? '',
            labelColor: labelStyle?.color ?? '',
            left: rect.left,
            right: rect.right,
            top: rect.top,
          };
        }),
      };
    });

    expect(marks.count).toBe(4);

    for (const entry of marks.entries) {
      expect(entry.markText).toBe('');
      expect(entry.markHidden).toBe('true');
      expect(entry.labelText.length).toBeGreaterThan(0);
      expect(entry.labelColor).toBe(marks.bodyColor);
      expect(entry.left).toBeGreaterThanOrEqual(0);
      expect(entry.right).toBeLessThanOrEqual(1024);
    }

    const rows = new Map<number, typeof marks.entries>();

    for (const entry of marks.entries) {
      const row = Math.round(entry.top);
      rows.set(row, [...(rows.get(row) ?? []), entry]);
    }

    for (const row of rows.values()) {
      const ordered = [...row].sort(
        (first, second) => first.left - second.left,
      );

      for (let index = 1; index < ordered.length; index += 1) {
        expect(
          ordered[index]?.left ?? 0,
          'mark groups overlap',
        ).toBeGreaterThanOrEqual((ordered[index - 1]?.right ?? 0) - 1);
      }
    }

    // B3/I3: foco visible de la casilla inválida y objetivo de 28 px.
    await page.locator('.wc-checkbox__input').first().focus();
    await page.keyboard.press('Tab');

    const checkbox = await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>(
        '.wc-checkbox--invalid input',
      );
      const label = document.querySelector<HTMLElement>(
        '.wc-checkbox--invalid .wc-checkbox__label',
      );
      const row = document.querySelector<HTMLElement>(
        '.wc-checkbox--invalid .wc-checkbox__row',
      );
      const probe = document.createElement('span');
      probe.style.color = 'var(--focus)';
      document.body.append(probe);
      const focusColor = getComputedStyle(probe).color;
      probe.remove();

      if (input === null || label === null || row === null) {
        return null;
      }

      const style = getComputedStyle(input);

      return {
        active: document.activeElement === input,
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        outlineOffset: style.outlineOffset,
        outlineColor: style.outlineColor,
        focusColor,
        labelHeight: label.getBoundingClientRect().height,
        rowHeight: row.getBoundingClientRect().height,
      };
    });

    expect(checkbox).not.toBeNull();
    expect(checkbox?.active).toBe(true);
    expect(checkbox?.outlineStyle).toBe('solid');
    expect(checkbox?.outlineWidth).toBe('2px');
    expect(checkbox?.outlineOffset).toBe('2px');
    expect(checkbox?.outlineColor).toBe(checkbox?.focusColor);
    expect(checkbox?.labelHeight).toBeGreaterThanOrEqual(28);
    expect(checkbox?.rowHeight).toBeGreaterThanOrEqual(28);

    // I1: el hover usa un paso de superficie perceptible.
    const hover = await page.evaluate(() => {
      const sunken = document.querySelector('.wc-swatch__chip--sunken');

      return sunken ? getComputedStyle(sunken).backgroundColor : '';
    });
    const secondary = page.locator('.wc-page .wc-button--secondary').first();

    await secondary.hover();
    await expect
      .poll(() =>
        secondary.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      )
      .toBe(hover);

    const iconButton = page.locator('.wc-icon-button--secondary').first();

    await iconButton.hover();
    await expect
      .poll(() =>
        iconButton.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      )
      .toBe(hover);

    await menuTrigger.click();
    const menuItem = page.getByRole('menuitem').first();

    await menuItem.hover();
    await expect
      .poll(() =>
        menuItem.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      )
      .toBe(hover);

    await page.keyboard.press('PageDown');

    await expect(page.getByRole('menu')).toHaveCount(0);

    // 3: menú largo con scroll interno; la rueda dentro de la lista no lo cierra.
    const longTrigger = page
      .locator('.wc-samples__edge--long')
      .getByRole('button');

    await longTrigger.click();

    const longMenu = page.getByRole('menu');

    await expect(longMenu).toBeVisible();

    const longMetrics = await longMenu.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      viewportHeight: document.documentElement.clientHeight,
    }));

    expect(longMetrics.height).toBeLessThanOrEqual(
      longMetrics.viewportHeight - 48 + 1,
    );
    expect(longMetrics.scrollHeight).toBeGreaterThan(longMetrics.clientHeight);

    await longMenu.hover();
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(100);
    await expect(longMenu).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('menu')).toHaveCount(0);

    expect((await pageWidth(page)).scrollWidth).toBeLessThanOrEqual(
      (await pageWidth(page)).clientWidth,
    );
  });
}

for (const width of [1280, 1600] as const) {
  test(`tooltip y menú abiertos no desbordan a ${width} px`, async ({
    electronApp,
    page,
  }) => {
    await setViewportWidth(electronApp, page, width);
    await openSamples(page);

    const tooltipTrigger = page
      .locator('.wc-samples__edge--tooltip')
      .getByRole('button');

    await tooltipTrigger.scrollIntoViewIfNeeded();
    await tooltipTrigger.hover();

    const tooltip = page.getByRole('tooltip');

    await expect(tooltip).toBeVisible();

    const tooltipBox = await tooltip.evaluate((element) => {
      const rect = element.getBoundingClientRect();

      return {
        right: rect.right,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    expect(tooltipBox.right).toBeLessThanOrEqual(tooltipBox.clientWidth + 1);
    expect(tooltipBox.scrollWidth).toBeLessThanOrEqual(tooltipBox.clientWidth);

    const menuTrigger = page
      .locator('.wc-samples__edge--menu')
      .getByRole('button');

    await menuTrigger.click();

    const menu = page.getByRole('menu');

    await expect(menu).toBeVisible();

    const menuBox = await menu.evaluate((element) => {
      const rect = element.getBoundingClientRect();

      return {
        left: rect.left,
        right: rect.right,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    expect(menuBox.left).toBeGreaterThanOrEqual(0);
    expect(menuBox.right).toBeLessThanOrEqual(menuBox.clientWidth + 1);
    expect(menuBox.scrollWidth).toBeLessThanOrEqual(menuBox.clientWidth);

    await page.keyboard.press('Escape');
  });
}

test('tooltip y menú dentro del diálogo no quedan recortados', async ({
  electronApp,
  page,
}) => {
  await setViewportWidth(electronApp, page, 1024);
  await openSamples(page);

  await page
    .getByRole('button', { name: messages.samples.dialog.open })
    .click();

  const dialog = page.getByRole('dialog', {
    name: messages.samples.dialog.title,
  });

  await expect(dialog).toBeVisible();

  const dialogButton = dialog.getByRole('button', {
    name: messages.samples.dialog.iconLabel,
  });

  await dialogButton.focus();

  const tooltip = page.getByRole('tooltip');

  await expect(tooltip).toBeVisible();

  const tooltipBox = await tooltip.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });

  expect(tooltipBox.left).toBeGreaterThanOrEqual(0);
  expect(tooltipBox.right).toBeLessThanOrEqual(tooltipBox.clientWidth + 1);
  expect(tooltipBox.top).toBeGreaterThanOrEqual(0);
  expect(tooltipBox.bottom).toBeLessThanOrEqual(tooltipBox.clientHeight + 1);
  expect(tooltipBox.scrollWidth).toBeLessThanOrEqual(tooltipBox.clientWidth);

  // El primer Escape cierra solo el tooltip; el diálogo sigue abierto.
  await page.keyboard.press('Escape');

  await expect(tooltip).toHaveCount(0);
  await expect(dialog).toBeVisible();

  await dialog
    .getByRole('button', { name: messages.samples.dialog.menuLabel })
    .click();

  const menu = page.getByRole('menu');

  await expect(menu).toBeVisible();

  const menuBox = await menu.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });

  expect(menuBox.left).toBeGreaterThanOrEqual(0);
  expect(menuBox.right).toBeLessThanOrEqual(menuBox.clientWidth + 1);
  expect(menuBox.top).toBeGreaterThanOrEqual(0);
  expect(menuBox.bottom).toBeLessThanOrEqual(menuBox.clientHeight + 1);
  expect(menuBox.scrollWidth).toBeLessThanOrEqual(menuBox.clientWidth);

  const dialogBox = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return { left: rect.left, right: rect.right };
  });

  expect(menuBox.left).toBeGreaterThanOrEqual(dialogBox.left - 1);
  expect(menuBox.right).toBeLessThanOrEqual(dialogBox.right + 1);

  await page.keyboard.press('Escape');

  await expect(menu).toHaveCount(0);
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(dialog).not.toBeVisible();
});
