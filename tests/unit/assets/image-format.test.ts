import { describe, expect, it } from 'vitest';

import { detectImageFormat } from '@/main/assets/image';

function bytes(...values: number[]): Buffer {
  return Buffer.from(values);
}

function ascii(text: string): number[] {
  return [...text].map((character) => character.charCodeAt(0));
}

describe('detección de formato por contenido', () => {
  it('reconoce PNG, JPEG, WebP, GIF y AVIF por su firma', () => {
    expect(
      detectImageFormat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe('png');
    expect(detectImageFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(
      detectImageFormat(
        bytes(...ascii('RIFF'), 0x24, 0x00, 0x00, 0x00, ...ascii('WEBP')),
      ),
    ).toBe('webp');
    expect(detectImageFormat(bytes(...ascii('GIF87a'), 0x01))).toBe('gif');
    expect(detectImageFormat(bytes(...ascii('GIF89a'), 0x01))).toBe('gif');
    expect(
      detectImageFormat(
        bytes(0x00, 0x00, 0x00, 0x1c, ...ascii('ftyp'), ...ascii('avif')),
      ),
    ).toBe('avif');
    expect(
      detectImageFormat(
        bytes(0x00, 0x00, 0x00, 0x1c, ...ascii('ftyp'), ...ascii('avis')),
      ),
    ).toBe('avif');
  });

  it('rechaza SVG, BMP, TIFF y contenido arbitrario', () => {
    const svg = Buffer.from(
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>',
      'utf8',
    );

    expect(detectImageFormat(svg)).toBeNull();
    expect(detectImageFormat(Buffer.from('<svg></svg>', 'utf8'))).toBeNull();
    expect(detectImageFormat(bytes(...ascii('BM'), 0x00, 0x00))).toBeNull();
    expect(detectImageFormat(bytes(...ascii('II*\0')))).toBeNull();
    expect(
      detectImageFormat(Buffer.from('esto no es una imagen', 'utf8')),
    ).toBeNull();
    expect(detectImageFormat(Buffer.alloc(0))).toBeNull();
  });

  it('rechaza firmas truncadas que no se pueden validar', () => {
    // PNG con solo los cuatro primeros bytes.
    expect(detectImageFormat(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
    // JPEG con dos bytes.
    expect(detectImageFormat(bytes(0xff, 0xd8))).toBeNull();
    // GIF truncado.
    expect(detectImageFormat(bytes(...ascii('GIF8')))).toBeNull();
    // RIFF sin marca WEBP.
    expect(
      detectImageFormat(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE'))),
    ).toBeNull();
    // ftyp de un vídeo.
    expect(
      detectImageFormat(
        bytes(0x00, 0x00, 0x00, 0x1c, ...ascii('ftyp'), ...ascii('isom')),
      ),
    ).toBeNull();
  });
});
