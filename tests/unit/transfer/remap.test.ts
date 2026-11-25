import { describe, expect, it } from 'vitest';

import { ENTITY_LINK_PREFIX } from '@/shared/contracts/entities';
import {
  remapDescriptionLinks,
  remapGallery,
  remapOptionalAssetId,
  remapReferenceAttributes,
} from '@/main/transfer/format/remap';
import { TransferWarningCollector } from '@/main/transfer/format/warnings';

const OLD_A = '018f1000-0000-7000-8000-000000000401';
const OLD_B = '018f1000-0000-7000-8000-000000000402';
const NEW_A = '018f1000-0000-7000-8000-000000000501';
const OLD_ASSET = '018f1000-0000-7000-8000-000000000601';
const NEW_ASSET = '018f1000-0000-7000-8000-000000000701';

describe('remapeo de referencias', () => {
  it('reescribe enlaces internos y elimina los rotos', () => {
    const warnings = new TransferWarningCollector();
    const document = {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'A',
              marks: [
                {
                  type: 'link',
                  attrs: { href: `${ENTITY_LINK_PREFIX}${OLD_A}` },
                },
              ],
            },
            { type: 'text', text: ' y ' },
            {
              type: 'text',
              text: 'B',
              marks: [
                {
                  type: 'link',
                  attrs: { href: `${ENTITY_LINK_PREFIX}${OLD_B}` },
                },
              ],
            },
            {
              type: 'text',
              text: '!',
              marks: [{ type: 'bold' }],
            },
          ],
        },
      ],
    };
    const result = remapDescriptionLinks(
      document,
      new Map([[OLD_A, NEW_A]]),
      warnings,
    );
    const paragraph = result.document.content?.[0];

    expect(paragraph?.content?.[0]?.marks?.[0]?.attrs?.href).toBe(
      `${ENTITY_LINK_PREFIX}${NEW_A}`,
    );
    expect(paragraph?.content?.[3]?.marks).toEqual([{ type: 'bold' }]);
    expect(warnings.toList()).toEqual([
      { code: 'broken-entity-link', count: 1 },
    ]);
  });

  it('remapea atributos de referencia y descarta los ausentes', () => {
    const warnings = new TransferWarningCollector();
    const result = remapReferenceAttributes(
      { leader: OLD_A, age: 30, broken: OLD_B },
      [
        {
          key: 'leader',
          label: 'Líder',
          type: 'reference',
          required: false,
        },
        {
          key: 'broken',
          label: 'Roto',
          type: 'reference',
          required: false,
        },
        { key: 'age', label: 'Edad', type: 'number', required: false },
      ],
      new Map([[OLD_A, NEW_A]]),
      warnings,
    );

    expect(result.attributes).toEqual({ leader: NEW_A, age: 30 });
    expect(warnings.toList()).toEqual([
      { code: 'broken-reference-attribute', count: 1 },
    ]);
  });

  it('remapea la galería y la imagen principal', () => {
    const warnings = new TransferWarningCollector();
    const gallery = remapGallery(
      [{ assetId: OLD_ASSET }, { assetId: OLD_B }],
      new Map([[OLD_ASSET, NEW_ASSET]]),
      warnings,
    );

    expect(gallery).toEqual([NEW_ASSET]);
    expect(warnings.total).toBe(1);

    expect(
      remapOptionalAssetId(
        OLD_ASSET,
        new Map([[OLD_ASSET, NEW_ASSET]]),
        warnings,
        'missing-entity-image',
      ),
    ).toBe(NEW_ASSET);
    expect(
      remapOptionalAssetId(
        OLD_B,
        new Map([[OLD_ASSET, NEW_ASSET]]),
        warnings,
        'missing-entity-image',
      ),
    ).toBeNull();
    expect(warnings.toList()).toEqual([
      { code: 'broken-gallery-asset', count: 1 },
      { code: 'missing-entity-image', count: 1 },
    ]);
  });

  it('agrega avisos y los ordena por la lista cerrada', () => {
    const warnings = new TransferWarningCollector();

    warnings.add('missing-tag');
    warnings.add('broken-entity-link', 2);
    warnings.add('missing-tag');
    warnings.add('broken-entity-link', 0);

    expect(warnings.total).toBe(4);
    expect(warnings.toList()).toEqual([
      { code: 'broken-entity-link', count: 2 },
      { code: 'missing-tag', count: 2 },
    ]);
  });
});
