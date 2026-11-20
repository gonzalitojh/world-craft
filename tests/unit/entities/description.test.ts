import { describe, expect, it } from 'vitest';

import {
  extractEntityDescriptionText,
  validateEntityDescription,
} from '@/shared/entities/description';
import type { EntityRichTextDocument } from '@/shared/contracts/entities';

const paragraph = (text: string): EntityRichTextDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('descripción enriquecida de una ficha', () => {
  it('acepta un documento válido y calcula el texto plano', () => {
    const document: EntityRichTextDocument = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Origen' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Nació en ' },
            {
              type: 'text',
              text: 'Puerto Sal',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'wc-entity://01900000-0000-7000-8000-000000000001',
                    target: null,
                    rel: null,
                    class: null,
                  },
                },
              ],
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Cartógrafa' }],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = validateEntityDescription(document);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.document).not.toBeNull();
    expect(result.text).toBe('Origen\nNació en Puerto Sal\n• Cartógrafa');
    expect(result.json).toContain('wc-entity://');
    expect(result.json).not.toContain('"target"');
    expect(extractEntityDescriptionText(document)).toBe(result.text);
  });

  it('normaliza una descripción vacía a null', () => {
    expect(
      validateEntityDescription({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      }),
    ).toEqual({ ok: true, document: null, text: null, json: null });

    expect(validateEntityDescription(null)).toEqual({
      ok: true,
      document: null,
      text: null,
      json: null,
    });
  });

  it('rechaza nodos, atributos y enlaces fuera de la lista cerrada', () => {
    const invalid: unknown[] = [
      {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 6 },
            content: [{ type: 'text', text: 'No' }],
          },
        ],
      },
      {
        type: 'doc',
        content: [
          { type: 'codeBlock', content: [{ type: 'text', text: 'x' }] },
        ],
      },
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Externo',
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
      },
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Atributo extra',
                marks: [{ type: 'bold', attrs: { color: 'red' } }],
              },
            ],
          },
        ],
      },
      { type: 'doc', content: 'no es una lista' },
      '<p>HTML</p>',
    ];

    for (const value of invalid) {
      expect(validateEntityDescription(value)).toEqual({
        ok: false,
        error: { code: 'invalid-description' },
      });
    }
  });

  it('rechaza un texto plano por encima del límite', () => {
    const result = validateEntityDescription(paragraph('a'.repeat(50_001)));

    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid-description' },
    });
  });
});
