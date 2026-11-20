import { describe, expect, it, vi } from 'vitest';

import {
  acquireSingleInstance,
  type SingleInstanceApp,
} from '@/main/single-instance';

function createApp(acquired: boolean) {
  let secondInstance: (() => void) | null = null;
  const app: SingleInstanceApp = {
    requestSingleInstanceLock: vi.fn(() => acquired),
    on: vi.fn((_event, listener) => {
      secondInstance = listener;
    }),
  };

  return {
    app,
    emitSecondInstance: () => secondInstance?.(),
  };
}

describe('instancia única', () => {
  it('adquiere el lock y enfoca la ventana al abrir una segunda instancia', () => {
    const fake = createApp(true);
    const focusMainWindow = vi.fn();

    expect(acquireSingleInstance(fake.app, { focusMainWindow })).toBe(true);
    expect(fake.app.requestSingleInstanceLock).toHaveBeenCalledTimes(1);
    expect(fake.app.on).toHaveBeenCalledWith(
      'second-instance',
      expect.any(Function),
    );

    fake.emitSecondInstance();
    expect(focusMainWindow).toHaveBeenCalledTimes(1);
  });

  it('sin lock no registra el foco ni permite inicializar', () => {
    const fake = createApp(false);
    const focusMainWindow = vi.fn();

    expect(acquireSingleInstance(fake.app, { focusMainWindow })).toBe(false);
    expect(fake.app.on).not.toHaveBeenCalled();

    fake.emitSecondInstance();
    expect(focusMainWindow).not.toHaveBeenCalled();
  });
});
