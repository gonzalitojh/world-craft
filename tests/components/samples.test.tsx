import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../src/renderer/i18n/provider';
import { es as messages } from '../../src/renderer/messages/es';
import { SamplesPage } from '../../src/renderer/pages/samples-page';

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});

function renderSamples() {
  const onNotify = vi.fn();
  const view = render(
    <I18nProvider locale="es">
      <SamplesPage onNotify={onNotify} />
    </I18nProvider>,
  );

  return { onNotify, container: view.container };
}

describe('SamplesPage', () => {
  it('monta el banco v2 con todas las secciones y controles', () => {
    renderSamples();

    for (const title of [
      messages.samples.palette.title,
      messages.samples.typography.title,
      messages.samples.buttons.title,
      messages.samples.iconButtons.title,
      messages.samples.menu.sectionTitle,
      messages.samples.fields.title,
      messages.samples.badges.title,
      messages.samples.card.sectionTitle,
      messages.samples.tabs.sectionTitle,
      messages.samples.dialog.sectionTitle,
      messages.samples.tooltip.sectionTitle,
      messages.samples.toasts.title,
      messages.samples.panel.title,
      messages.samples.skeleton.title,
      messages.samples.empty.sectionTitle,
      messages.samples.typeMarks.title,
      messages.samples.longContent.title,
    ]) {
      expect(
        screen.getByRole('heading', { level: 2, name: title }),
        title,
      ).toBeInTheDocument();
    }

    expect(
      screen.getByRole('checkbox', {
        name: messages.samples.fields.checkboxLabel,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('group', {
        name: messages.samples.fields.radioLegend,
      }),
    ).toHaveLength(2);
    expect(
      screen.getByRole('region', { name: messages.samples.panel.panelTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText(messages.samples.typography.chars)).toBeVisible();
    expect(
      document.querySelector('[aria-busy="true"]'),
    ).not.toBeNull();
  });

  it('abre el menú de acciones y publica el aviso de la acción elegida', async () => {
    const user = userEvent.setup();
    const { onNotify } = renderSamples();

    await user.click(
      screen.getByRole('button', { name: messages.samples.menu.trigger }),
    );

    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(
      screen.getByRole('menuitem', { name: messages.samples.menu.edit }),
    );

    expect(onNotify).toHaveBeenCalledWith(
      'info',
      messages.samples.menu.editNotice,
    );
  });

  it('mantiene el banco navegable con contenido largo y tipos persistidos', () => {
    renderSamples();

    expect(messages.samples.longContent.name.length).toBeGreaterThanOrEqual(
      200,
    );
    expect(
      screen.getByText(messages.samples.longContent.heading),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.samples.longContent.name),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.samples.typeMarks.moss),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.samples.typeMarks.prussian),
    ).toBeInTheDocument();
  });

  it('separa la marca gráfica del tipo de su etiqueta legible', () => {
    const { container } = renderSamples();
    const marks = container.querySelectorAll('.wc-type-mark');
    const labels = container.querySelectorAll('.wc-type-mark-label');

    expect(marks).toHaveLength(4);
    expect(labels).toHaveLength(4);

    for (const mark of marks) {
      expect(mark).toHaveAttribute('aria-hidden', 'true');
      expect(mark.textContent?.trim()).toBe('');
    }

    expect(Array.from(labels).map((label) => label.textContent)).toEqual([
      messages.samples.typeMarks.moss,
      messages.samples.typeMarks.ochre,
      messages.samples.typeMarks.danger,
      messages.samples.typeMarks.prussian,
    ]);
  });

  it('muestra tarjetas con y sin tono y controles dentro del diálogo', async () => {
    const user = userEvent.setup();

    renderSamples();

    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(
      screen.getByRole('article', { name: messages.samples.card.plainTitle }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: messages.samples.dialog.open }),
    );

    const dialog = screen.getByRole('dialog', {
      name: messages.samples.dialog.title,
    });

    expect(
      within(dialog).getByRole('button', {
        name: messages.samples.dialog.iconLabel,
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', {
        name: messages.samples.dialog.menuLabel,
      }),
    ).toBeInTheDocument();
  });
});
