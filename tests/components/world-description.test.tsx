import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WorldDescriptionField } from '@/renderer/components/worlds/world-description-editor';
import { WorldDescriptionView } from '@/renderer/components/worlds/world-description-view';
import { I18nProvider } from '@/renderer/i18n/provider';
import { es as messages } from '@/renderer/messages/es';
import type { EntitySummary } from '@/shared/contracts/entities';
import type { EntityRichTextDocument } from '@/shared/contracts/entities';
import { plainTextToRichTextDocument } from '@/shared/entities/description';

const noop = (): void => {};

const entityId = '01900000-0000-7000-8000-000000000001';
const candidate = {
  id: entityId,
  name: 'Aria',
  typeName: 'Personaje',
  aliases: [],
} as unknown as EntitySummary;

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider locale="es">{ui}</I18nProvider>);
}

function editorContent(): HTMLElement {
  const content = document.querySelector<HTMLElement>('.wc-editor__content');

  if (content === null) {
    throw new Error('No se montó el editor.');
  }

  return content;
}

describe('campo de descripción del mundo', () => {
  it('en creación usa tres controles, rol de texto, contador y ayuda propia', () => {
    renderWithI18n(
      <WorldDescriptionField
        mode="create"
        document={null}
        candidates={[]}
        candidatesState="ready"
        pending={false}
        onChange={noop}
      />,
    );

    expect(
      screen.getByRole('toolbar', { name: messages.entities.editor.label }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: messages.entities.editor.bold }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: messages.entities.editor.italic }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: messages.entities.editor.link }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: messages.entities.editor.mention }),
    ).toBeNull();
    expect(editorContent()).toHaveAttribute('role', 'textbox');
    expect(editorContent()).toHaveAttribute('aria-multiline', 'true');
    expect(screen.getByText('0 / 4.000 caracteres')).toBeInTheDocument();
    expect(
      screen.getByText(messages.worlds.form.descriptionHintCreate),
    ).toBeInTheDocument();
  });

  it('en edición con candidatas listas usa combobox y cinco controles', () => {
    renderWithI18n(
      <WorldDescriptionField
        mode="edit"
        document={null}
        candidates={[candidate]}
        candidatesState="ready"
        pending={false}
        onChange={noop}
      />,
    );

    expect(editorContent()).toHaveAttribute('role', 'combobox');
    expect(
      screen.getByRole('button', { name: messages.entities.editor.link }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: messages.entities.editor.mention }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.worlds.form.descriptionHint),
    ).toBeInTheDocument();
  });

  it('deshabilita enlace y mención mientras cargan las candidatas', () => {
    renderWithI18n(
      <WorldDescriptionField
        mode="edit"
        document={null}
        candidates={[]}
        candidatesState="loading"
        pending={false}
        onChange={noop}
      />,
    );

    expect(editorContent()).toHaveAttribute('role', 'textbox');
    expect(
      screen.getByRole('button', { name: messages.entities.editor.link }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: messages.entities.editor.mention }),
    ).toBeDisabled();
    expect(
      screen.getByText(messages.worlds.form.mentionsLoading),
    ).toBeInTheDocument();
  });

  it('muestra el contador excedido y el error sobre el texto plano', () => {
    renderWithI18n(
      <WorldDescriptionField
        mode="create"
        document={plainTextToRichTextDocument('a'.repeat(4_001))}
        candidates={[]}
        candidatesState="ready"
        pending={false}
        onChange={noop}
      />,
    );

    expect(
      screen.getByText('4.001 / 4.000 caracteres · máximo superado'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.worlds.form.descriptionTooLong('4.000')),
    ).toBeInTheDocument();
    expect(editorContent()).toHaveAttribute('aria-invalid', 'true');
  });

  it('muestra el error de candidatas con reintento', () => {
    const onRetry = vi.fn();

    renderWithI18n(
      <WorldDescriptionField
        mode="edit"
        document={null}
        candidates={[]}
        candidatesState="error"
        pending={false}
        onChange={noop}
        onRetryCandidates={onRetry}
      />,
    );

    expect(
      screen.getByText(messages.worlds.form.mentionsError),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: messages.worlds.form.mentionsRetry }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('marca aria-disabled mientras guarda y lo retira al terminar', () => {
    const field = (pending: boolean): ReactElement => (
      <WorldDescriptionField
        mode="edit"
        document={null}
        candidates={[]}
        candidatesState="ready"
        pending={pending}
        onChange={noop}
      />
    );
    const { rerender } = renderWithI18n(field(false));

    expect(editorContent()).not.toHaveAttribute('aria-disabled');
    expect(document.querySelector('.wc-editor')).toHaveAttribute(
      'data-disabled',
      'false',
    );

    rerender(<I18nProvider locale="es">{field(true)}</I18nProvider>);

    expect(editorContent()).toHaveAttribute('aria-disabled', 'true');
    expect(editorContent()).toHaveAttribute('contenteditable', 'false');
    expect(document.querySelector('.wc-editor')).toHaveAttribute(
      'data-disabled',
      'true',
    );

    rerender(<I18nProvider locale="es">{field(false)}</I18nProvider>);

    expect(editorContent()).not.toHaveAttribute('aria-disabled');
    expect(editorContent()).toHaveAttribute('contenteditable', 'true');
  });

  it('sanea el HTML pegado y descarta script, imagen y enlace externo', async () => {
    const onChange = vi.fn();

    renderWithI18n(
      <WorldDescriptionField
        mode="create"
        document={null}
        candidates={[]}
        candidatesState="ready"
        pending={false}
        onChange={onChange}
      />,
    );

    const content = editorContent();
    const html = [
      '<p>Hola <strong>mundo</strong>.</p>',
      '<script>alert(1)</script>',
      '<img src="x" onerror="alert(1)">',
      '<p><a href="https://example.com">externo</a></p>',
    ].join('');

    fireEvent.paste(content, {
      clipboardData: {
        types: ['text/html'],
        getData: (type: string) => (type === 'text/html' ? html : ''),
      },
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });

    const document = onChange.mock.calls.at(-1)?.[0] as EntityRichTextDocument;
    const serialized = JSON.stringify(document);

    expect(serialized).toContain('Hola');
    expect(serialized).toContain('mundo');
    expect(serialized).toContain('externo');
    expect(serialized).not.toContain('<script');
    expect(serialized).not.toContain('alert');
    expect(serialized).not.toContain('image');
    expect(serialized).not.toContain('onerror');
    expect(serialized).not.toContain('https://example.com');
  });
});

describe('lectura de la descripción del mundo', () => {
  it('pinta el documento sin barra y navega por los enlaces', () => {
    const onOpenEntity = vi.fn();
    const document = {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Visita a ' },
            {
              type: 'text',
              text: 'Aria',
              marks: [
                { type: 'link', attrs: { href: `wc-entity://${entityId}` } },
              ],
            },
            { type: 'text', text: '.' },
          ],
        },
      ],
    };

    renderWithI18n(
      <WorldDescriptionView document={document} onOpenEntity={onOpenEntity} />,
    );

    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(editorContent()).not.toHaveAttribute('role');
    expect(editorContent()).not.toHaveAttribute('tabindex');

    fireEvent.click(screen.getByRole('link', { name: 'Aria' }));

    expect(onOpenEntity).toHaveBeenCalledWith(entityId);
  });

  it('muestra el vacío sin montar editor ni metadatos', () => {
    renderWithI18n(
      <WorldDescriptionView document={null} onOpenEntity={noop} />,
    );

    expect(screen.getByText(messages.worlds.detail.noDescription)).toHaveClass(
      'wc-world-description--empty',
    );
    expect(document.querySelector('.ProseMirror')).toBeNull();
  });
});
