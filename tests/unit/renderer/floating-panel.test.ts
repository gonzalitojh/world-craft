import { describe, expect, it } from 'vitest';

import { placeFloatingPanel } from '@/renderer/lib/floating-panel';

const cursor = {
  top: 200,
  left: 300,
  right: 302,
  bottom: 218,
};
const viewport = { width: 1024, height: 700 };

describe('colocación de paneles flotantes', () => {
  it('coloca debajo del cursor con 4 px de separación', () => {
    const position = placeFloatingPanel({
      anchor: cursor,
      panel: { width: 352, height: 200 },
      viewport,
    });

    expect(position.placement).toBe('below');
    expect(position.top).toBe(222);
    expect(position.left).toBe(300);
    expect(position.maxHeight).toBe(200);
  });

  it('limita el borde izquierdo y el derecho con 24 px de margen', () => {
    const left = placeFloatingPanel({
      anchor: { ...cursor, left: 4, right: 6 },
      panel: { width: 352, height: 120 },
      viewport,
    });
    const right = placeFloatingPanel({
      anchor: { ...cursor, left: 1000, right: 1002 },
      panel: { width: 352, height: 120 },
      viewport,
    });

    expect(left.left).toBe(24);
    expect(right.left).toBe(1024 - 24 - 352);
  });

  it('voltea encima del cursor si no cabe debajo', () => {
    const position = placeFloatingPanel({
      anchor: { top: 600, left: 300, right: 302, bottom: 618 },
      panel: { width: 352, height: 200 },
      viewport,
    });

    expect(position.placement).toBe('above');
    expect(position.top).toBe(600 - 4 - 200);
    expect(position.maxHeight).toBe(200);
  });

  it('recorta la altura al lado con más espacio cuando no cabe en ninguno', () => {
    const position = placeFloatingPanel({
      anchor: { top: 340, left: 300, right: 302, bottom: 358 },
      panel: { width: 352, height: 900 },
      viewport,
    });

    expect(position.placement).toBe('below');
    expect(position.maxHeight).toBe(700 - 24 - 358 - 4);
  });

  it('respeta la ventana mínima de 1024×700 con un nombre largo', () => {
    const position = placeFloatingPanel({
      anchor: { top: 80, left: 512, right: 514, bottom: 98 },
      panel: { width: 800, height: 48 },
      viewport,
    });

    expect(position.left).toBeGreaterThanOrEqual(24);
    expect(position.left + 800).toBeLessThanOrEqual(1024 - 24);
    expect(position.top + position.maxHeight).toBeLessThanOrEqual(700 - 24);
  });

  it('nunca devuelve altura negativa', () => {
    const position = placeFloatingPanel({
      anchor: { top: 690, left: 100, right: 102, bottom: 698 },
      panel: { width: 352, height: 400 },
      viewport,
    });

    expect(position.maxHeight).toBeGreaterThanOrEqual(0);
  });
});
