import { describe, expect, it, vi } from 'vitest';

import { supportsWebGl2 } from '@/renderer/maps-spike/webgl';

describe('sonda WebGL2 del laboratorio', () => {
  it('devuelve true con un contexto y lo libera', () => {
    const loseContext = vi.fn();
    const getExtension = vi.fn(() => ({ loseContext }));
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ getExtension } as unknown as WebGL2RenderingContext);

    expect(supportsWebGl2()).toBe(true);
    expect(getContext).toHaveBeenCalledWith('webgl2');
    expect(getExtension).toHaveBeenCalledWith('WEBGL_lose_context');
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('devuelve false sin contexto o si getContext lanza', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(supportsWebGl2()).toBe(false);

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => {
        throw new Error('sin gpu');
      },
    );
    expect(supportsWebGl2()).toBe(false);
  });
});
