import { describe, expect, it } from 'vitest';

import {
  APP_ID,
  APP_NAME,
  APP_VERSION,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  WINDOW_WIDTHS,
} from '@/shared/app-info';

describe('app-info', () => {
  it('define la identidad de la aplicación', () => {
    expect(APP_NAME).toBe('World Craft');
    expect(APP_ID).toBe('com.gonzalitojh.worldcraft');
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('respeta la ventana mínima de escritorio', () => {
    expect(MIN_WINDOW_WIDTH).toBe(1024);
    expect(MIN_WINDOW_HEIGHT).toBe(700);
    expect(WINDOW_WIDTHS).toEqual([1024, 1280, 1600]);
  });
});
