import { Schema } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';

import {
  buildMentionContent,
  mentionHref,
} from '@/renderer/components/editor/mention-content';
import { ENTITY_LINK_PREFIX } from '@/shared/contracts/entities';
import {
  extractEntityDescriptionText,
  validateEntityDescription,
} from '@/shared/entities/description';

const ENTITY_ID = '01900000-0000-7000-8000-000000000003';

// Esquema mínimo equivalente al del editor: párrafos y texto con la marca de
// enlace interno. Evita depender del DOM para probar la construcción del nodo.
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    text: { group: 'inline' },
  },
  marks: {
    link: { attrs: { href: {} }, inclusive: false },
  },
});

describe('contenido de una mención', () => {
  it.each(['<b>Ruido</b>', '<script>alert(1)</script>', 'Sal & "marea"'])(
    'guarda el nombre %s como texto y genera un enlace interno',
    (name) => {
      const nodes = buildMentionContent(schema, { id: ENTITY_ID, name });
      const document = {
        type: 'doc' as const,
        content: [{ type: 'paragraph', content: nodes }],
      };
      const result = validateEntityDescription(document);

      expect(result.ok).toBe(true);
      expect(nodes[0]).toEqual({
        type: 'text',
        text: name,
        marks: [
          {
            type: 'link',
            attrs: { href: `${ENTITY_LINK_PREFIX}${ENTITY_ID}` },
          },
        ],
      });
      expect(nodes[1]).toEqual({ type: 'text', text: ' ' });
      expect(JSON.stringify(nodes)).not.toContain('<a ');
      expect(result.ok && result.text).toContain(name);
    },
  );

  it('omite el espacio final cuando se pide y mantiene el href corto', () => {
    const nodes = buildMentionContent(
      schema,
      { id: ENTITY_ID, name: 'Puerto Sal' },
      { trailingSpace: false },
    );

    expect(nodes).toHaveLength(1);
    expect(mentionHref(ENTITY_ID)).toBe(
      'wc-entity://01900000-0000-7000-8000-000000000003',
    );
    expect(mentionHref(ENTITY_ID).length).toBeLessThanOrEqual(80);
  });

  it('produce un documento con texto plano legible y validable', () => {
    const nodes = buildMentionContent(schema, {
      id: ENTITY_ID,
      name: 'Puerto Sal',
    });
    const document = {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Nació en ' }, ...nodes],
        },
      ],
    };
    const result = validateEntityDescription(document);

    expect(result.ok).toBe(true);

    if (result.ok && result.document !== null) {
      expect(extractEntityDescriptionText(result.document)).toBe(
        'Nació en Puerto Sal',
      );
    }
  });
});
