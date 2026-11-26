import { describe, expect, it } from 'vitest';

import {
  extractEntityDescriptionText,
  plainTextToRichTextDocument,
  stripRichTextLinks,
} from '@/shared/entities/description';
import {
  parseWorldDescription,
  validateWorldDescription,
} from '@/shared/worlds/description';
import type { EntityRichTextDocument } from '@/shared/contracts/entities';

const worldId = '01900000-0000-7000-8000-000000000001';

const linkedDocument: EntityRichTextDocument = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Conoce a ' },
        {
          type: 'text',
          text: 'Aria',
          marks: [{ type: 'link', attrs: { href: `wc-entity://${worldId}` } }],
        },
        { type: 'text', text: ' desde siempre.' },
      ],
    },
  ],
};

describe('texto plano a documento', () => {
  it('normaliza CRLF, CR, tabuladores, espacios y líneas vacías', () => {
    const document = plainTextToRichTextDocument(
      '  Primera\tlínea  \r\n\r\nSegunda   línea\rTercera  ',
    );

    expect(document).not.toBeNull();
    expect(extractEntityDescriptionText(document as EntityRichTextDocument)).toBe(
      'Primera línea\nSegunda línea\nTercera',
    );
  });

  it('devuelve null cuando no queda texto visible', () => {
    expect(plainTextToRichTextDocument('  \r\n\t\n ')).toBeNull();
  });

  it('agrupa más de 2.000 líneas con hardBreak dentro del máximo de bloques', () => {
    const lines = Array.from({ length: 2_001 }, () => 'a');
    const document = plainTextToRichTextDocument(lines.join('\n'));

    expect(document).not.toBeNull();
    expect(document?.content?.length).toBeLessThanOrEqual(2_000);
    expect(document?.content).toHaveLength(1_001);
    expect(document?.content?.[0]).toMatchObject({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'a' },
        { type: 'hardBreak' },
        { type: 'text', text: 'a' },
      ],
    });
  });
});

describe('quitar enlaces internos', () => {
  it('conserva el texto y el resto de marcas', () => {
    const stripped = stripRichTextLinks({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Aria',
              marks: [
                { type: 'bold' },
                { type: 'link', attrs: { href: `wc-entity://${worldId}` } },
              ],
            },
            { type: 'text', text: ' y el faro.' },
          ],
        },
      ],
    });

    expect(stripped?.content?.[0]).toEqual({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Aria', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' y el faro.' },
      ],
    });
  });

  it('devuelve null si el documento queda sin bloques', () => {
    expect(stripRichTextLinks({ type: 'doc', content: [] })).toBeNull();
  });
});

describe('validación de la descripción del mundo', () => {
  it('acepta un documento válido y calcula el texto', () => {
    const result = validateWorldDescription(linkedDocument);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.text : '').toBe(
      'Conoce a Aria desde siempre.',
    );
    expect(result.ok ? result.json : '').toContain('"type":"doc"');
  });

  it('normaliza null y documentos sin texto a null', () => {
    expect(validateWorldDescription(null)).toMatchObject({
      ok: true,
      document: null,
      text: null,
      json: null,
    });
    expect(
      validateWorldDescription({ type: 'doc', content: [{ type: 'paragraph' }] }),
    ).toMatchObject({ ok: true, document: null, text: null, json: null });
  });

  it('rechaza nodos, protocolos y textos fuera de rango', () => {
    expect(
      validateWorldDescription({
        type: 'doc',
        content: [{ type: 'image', attrs: { src: 'x' } }],
      }).ok,
    ).toBe(false);
    expect(
      validateWorldDescription({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Enlace',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'https://example.com' },
                  },
                ],
              },
            ],
          },
        ],
      }).ok,
    ).toBe(false);
    expect(
      validateWorldDescription(plainTextToRichTextDocument('a'.repeat(4_001)))
        .ok,
    ).toBe(false);
  });

  it('distingue vacío de JSON ilegible', () => {
    expect(parseWorldDescription(null)).toEqual({ ok: true, document: null });
    expect(parseWorldDescription('')).toEqual({ ok: true, document: null });
    expect(parseWorldDescription('{')).toEqual({ ok: false });
    expect(parseWorldDescription(JSON.stringify(linkedDocument))).toMatchObject({
      ok: true,
    });
  });
});
