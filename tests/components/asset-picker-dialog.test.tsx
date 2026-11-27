import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AssetPickerDialog } from '@/renderer/components/assets/asset-picker-dialog';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import type { AssetSummary } from '@/shared/contracts/assets';

const ASSET_A = '01900000-0000-7000-8000-000000000001';
const ASSET_B = '01900000-0000-7000-8000-000000000002';

function makeAsset(id: string): AssetSummary {
  return {
    id,
    worldId: '01900000-0000-7000-8000-000000000099',
    width: 320,
    height: 320,
    alt: null,
    createdAt: 1_760_000_000_000,
  };
}

const assets = [makeAsset(ASSET_A), makeAsset(ASSET_B)];
const noop = (): void => {};

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

function renderPicker(
  overrides: Partial<Parameters<typeof AssetPickerDialog>[0]> = {},
) {
  return render(
    <I18nProvider locale="es">
      <AssetPickerDialog
        open
        assets={assets}
        state="ready"
        selectedAssetId={null}
        onSelect={noop}
        onClose={noop}
        {...overrides}
      />
    </I18nProvider>,
  );
}

describe('selector compartido de portada', () => {
  it('muestra ocho esqueletos con aria-busy y anuncia la carga', () => {
    renderPicker({ state: 'loading', assets: [] });

    expect(
      screen.getByText(messages.components.assetPicker.loading),
    ).toHaveClass('wc-visually-hidden');
    expect(
      document.querySelectorAll('.wc-image-picker__skeleton'),
    ).toHaveLength(8);
    expect(document.querySelector('.wc-image-picker__state')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('no roba el foco al terminar la carga si el usuario ya se movió', () => {
    const { rerender } = renderPicker({ state: 'loading', assets: [] });
    const close = screen.getAllByRole('button', {
      name: messages.components.dialog.close,
    })[0];

    if (close === undefined) {
      throw new Error('Se esperaba el botón de cerrar.');
    }

    close.focus();

    rerender(
      <I18nProvider locale="es">
        <AssetPickerDialog
          open
          assets={assets}
          state="ready"
          selectedAssetId={null}
          onSelect={noop}
          onClose={noop}
        />
      </I18nProvider>,
    );

    expect(close).toHaveFocus();
  });

  it('muestra el error con reintento', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    renderPicker({ state: 'error', assets: [], onRetry });

    expect(screen.getByRole('alert')).toHaveTextContent(
      messages.components.assetPicker.loadError,
    );

    await user.click(
      screen.getByRole('button', {
        name: messages.components.assetPicker.retry,
      }),
    );

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ofrece añadir imagen cuando el mundo no tiene ninguna', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();

    renderPicker({ assets: [], onImport });

    expect(
      screen.getByText(messages.components.assetPicker.empty),
    ).toBeInTheDocument();

    const add = screen.getByRole('button', {
      name: messages.components.assetPicker.addImage,
    });

    await user.click(add);
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('marca la portada con aria-pressed y la insignia con check', () => {
    renderPicker({ selectedAssetId: ASSET_A });

    const first = screen.getByRole('button', {
      name: messages.components.assetPicker.option(1),
    });
    const second = screen.getByRole('button', {
      name: messages.components.assetPicker.option(2),
    });

    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAttribute('aria-pressed', 'false');
    expect(first.querySelector('.wc-image-picker__badge')).toHaveTextContent(
      messages.components.assetPicker.selected,
    );
    expect(first.querySelector('.wc-image-picker__badge svg')).not.toBeNull();
    expect(second.querySelector('.wc-image-picker__badge')).toBeNull();

    expect(first.querySelector('img')).toHaveAttribute(
      'src',
      `wc-asset://thumb/${ASSET_A}`,
    );
  });

  it('elige una imagen y quita la portada solo si el poseedor lo permite', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClear = vi.fn();

    renderPicker({ selectedAssetId: ASSET_A, onSelect, onClear });

    await user.click(
      screen.getByRole('button', {
        name: messages.components.assetPicker.option(2),
      }),
    );
    expect(onSelect).toHaveBeenCalledWith(ASSET_B);

    await user.click(
      screen.getByRole('button', {
        name: messages.components.assetPicker.clear,
      }),
    );
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('no ofrece quitar la portada si no hay portada o no hay onClear', () => {
    const { rerender } = renderPicker({ selectedAssetId: ASSET_A });

    expect(
      screen.queryByRole('button', {
        name: messages.components.assetPicker.clear,
      }),
    ).toBeNull();

    rerender(
      <I18nProvider locale="es">
        <AssetPickerDialog
          open
          assets={assets}
          state="ready"
          selectedAssetId={ASSET_A}
          onSelect={noop}
          onClear={noop}
          onClose={noop}
        />
      </I18nProvider>,
    );

    expect(
      screen.getByRole('button', {
        name: messages.components.assetPicker.clear,
      }),
    ).toBeInTheDocument();
  });

  it('bloquea miniaturas y Escape mientras importa', () => {
    const onClose = vi.fn();

    renderPicker({ importing: true, onImport: noop, onClose });

    for (const item of screen.getAllByRole('button', {
      name: /Usar la imagen/,
    })) {
      expect(item).toBeDisabled();
    }

    expect(
      screen.getByRole('button', {
        name: messages.components.assetPicker.importing,
      }),
    ).toBeDisabled();
    expect(
      screen
        .getAllByRole('button', {
          name: messages.components.assetPicker.close,
        })
        .at(-1),
    ).toBeDisabled();

    const dialog = document.querySelector('dialog');

    if (dialog === null) {
      throw new Error('Se esperaba el diálogo del selector.');
    }

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cierra con Escape consumiendo la capa', () => {
    const onClose = vi.fn();

    renderPicker({ selectedAssetId: ASSET_A, onClose });

    const dialog = document.querySelector('dialog');

    if (dialog === null) {
      throw new Error('Se esperaba el diálogo del selector.');
    }

    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });

    dialog.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);

    // En jsdom el cierre nativo no emite `close`; en Electron sí lo hace y el
    // diálogo llama a `onClose`.
    fireEvent(dialog, new Event('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mueve el foco a la imagen recién importada', () => {
    renderPicker({ selectedAssetId: ASSET_A, focusAssetId: ASSET_B });

    expect(
      screen.getByRole('button', {
        name: messages.components.assetPicker.option(2),
      }),
    ).toHaveFocus();
  });
});
