import { describe, expect, it, vi } from 'vitest';

import type { Session, WebContents } from 'electron';

import {
  isLoopbackUrl,
  isRemoteRequest,
  resolveRendererTarget,
} from '@/main/security/guards';
import { registerNavigationGuards } from '@/main/security/navigation';
import { registerSessionGuards } from '@/main/security/session';

type PreventableEvent = { preventDefault: () => void };
type Listener = (event: PreventableEvent) => void;
type WindowOpenHandler = (details: { url: string }) => unknown;

function createFakeWebContents(): {
  contents: WebContents;
  listeners: Map<string, Listener>;
  getWindowOpenHandler: () => WindowOpenHandler | undefined;
} {
  const listeners = new Map<string, Listener>();
  let windowOpenHandler: WindowOpenHandler | undefined;

  const contents = {
    on: (event: string, listener: Listener) => {
      listeners.set(event, listener);
    },
    setWindowOpenHandler: (handler: WindowOpenHandler) => {
      windowOpenHandler = handler;
    },
  } as unknown as WebContents;

  return {
    contents,
    listeners,
    getWindowOpenHandler: () => windowOpenHandler,
  };
}

type PermissionRequestHandler = (
  contents: unknown,
  permission: string,
  callback: (granted: boolean) => void,
) => void;
type PermissionCheckHandler = () => boolean;
type BeforeRequestHandler = (
  details: { url: string },
  callback: (response: { cancel?: boolean }) => void,
) => void;

function createFakeSession(): {
  session: Session;
  getPermissionRequest: () => PermissionRequestHandler | undefined;
  getPermissionCheck: () => PermissionCheckHandler | undefined;
  getRequestFilter: () => { urls: string[] } | undefined;
  getBeforeRequest: () => BeforeRequestHandler | undefined;
  getWillDownload: () => Listener | undefined;
} {
  let permissionRequest: PermissionRequestHandler | undefined;
  let permissionCheck: PermissionCheckHandler | undefined;
  let requestFilter: { urls: string[] } | undefined;
  let beforeRequest: BeforeRequestHandler | undefined;
  let willDownload: Listener | undefined;

  const session = {
    on: (event: string, listener: Listener) => {
      if (event === 'will-download') {
        willDownload = listener;
      }
    },
    setPermissionRequestHandler: (handler: PermissionRequestHandler) => {
      permissionRequest = handler;
    },
    setPermissionCheckHandler: (handler: PermissionCheckHandler) => {
      permissionCheck = handler;
    },
    webRequest: {
      onBeforeRequest: (
        filter: { urls: string[] },
        handler: BeforeRequestHandler,
      ) => {
        requestFilter = filter;
        beforeRequest = handler;
      },
    },
  } as unknown as Session;

  return {
    session,
    getPermissionRequest: () => permissionRequest,
    getPermissionCheck: () => permissionCheck,
    getRequestFilter: () => requestFilter,
    getBeforeRequest: () => beforeRequest,
    getWillDownload: () => willDownload,
  };
}

describe('guards de red', () => {
  it('reconoce loopback en IPv4, localhost e IPv6', () => {
    expect(isLoopbackUrl('http://localhost:5173')).toBe(true);
    expect(isLoopbackUrl('http://127.0.0.1:5173/')).toBe(true);
    expect(isLoopbackUrl('http://[::1]:5173/')).toBe(true);
    expect(isLoopbackUrl('https://localhost')).toBe(true);
  });

  it('rechaza orígenes remotos y esquemas que no son HTTP(S)', () => {
    expect(isLoopbackUrl('https://example.com')).toBe(false);
    expect(isLoopbackUrl('ws://localhost:5173')).toBe(false);
    expect(isLoopbackUrl('file:///C:/datos/index.html')).toBe(false);
    expect(isLoopbackUrl('wc-asset://mundo/a.png')).toBe(false);
    expect(isLoopbackUrl('no es una url')).toBe(false);
  });

  it('cancela toda petición HTTP(S) y WebSocket en producción', () => {
    expect(
      isRemoteRequest('http://localhost:5173', { development: false }),
    ).toBe(true);
    expect(
      isRemoteRequest('https://example.com/a.png', { development: false }),
    ).toBe(true);
    expect(isRemoteRequest('ws://localhost:5173', { development: false })).toBe(
      true,
    );
    expect(
      isRemoteRequest('wss://example.com/socket', { development: false }),
    ).toBe(true);
  });

  it('en desarrollo solo permite loopback', () => {
    expect(
      isRemoteRequest('http://localhost:5173', { development: true }),
    ).toBe(false);
    expect(
      isRemoteRequest('http://127.0.0.1:5173', { development: true }),
    ).toBe(false);
    expect(isRemoteRequest('ws://localhost:5173', { development: true })).toBe(
      false,
    );
    expect(isRemoteRequest('ws://127.0.0.1:5173', { development: true })).toBe(
      false,
    );
    expect(
      isRemoteRequest('https://example.com/a.png', { development: true }),
    ).toBe(true);
    expect(
      isRemoteRequest('wss://example.com/socket', { development: true }),
    ).toBe(true);
  });

  it('no interfiere con esquemas locales de la aplicación', () => {
    expect(
      isRemoteRequest('wc-asset://mundo/a.png', { development: false }),
    ).toBe(false);
    expect(
      isRemoteRequest('file:///C:/datos/index.html', { development: false }),
    ).toBe(false);
  });
});

describe('resolveRendererTarget', () => {
  const indexFile = 'C:\\app\\out\\renderer\\index.html';

  it('acepta el servidor de desarrollo solo si es loopback', () => {
    expect(
      resolveRendererTarget({
        rendererUrl: 'http://localhost:5173',
        indexFile,
        isPackaged: false,
      }),
    ).toEqual({ kind: 'url', url: 'http://localhost:5173' });
  });

  it('ignora una URL remota y carga el HTML empaquetado', () => {
    expect(
      resolveRendererTarget({
        rendererUrl: 'https://example.com/renderer',
        indexFile,
        isPackaged: false,
      }),
    ).toEqual({ kind: 'file', filePath: indexFile });
  });

  it('carga el HTML empaquetado cuando no hay servidor de desarrollo', () => {
    expect(
      resolveRendererTarget({
        rendererUrl: undefined,
        indexFile,
        isPackaged: false,
      }),
    ).toEqual({ kind: 'file', filePath: indexFile });
  });

  it('en la versión empaquetada ignora incluso una URL de loopback', () => {
    expect(
      resolveRendererTarget({
        rendererUrl: 'http://localhost:5173',
        indexFile,
        isPackaged: true,
      }),
    ).toEqual({ kind: 'file', filePath: indexFile });
  });
});

describe('navigation guards', () => {
  it('bloquea navegación, redirecciones y webviews', () => {
    const { contents, listeners } = createFakeWebContents();

    registerNavigationGuards(contents, { openExternal: async () => {} });

    for (const eventName of [
      'will-navigate',
      'will-redirect',
      'will-frame-navigate',
      'will-attach-webview',
    ]) {
      let prevented = false;
      const listener = listeners.get(eventName);

      expect(listener, `falta el listener ${eventName}`).toBeDefined();
      listener?.({ preventDefault: () => (prevented = true) });
      expect(prevented, `${eventName} no se bloqueó`).toBe(true);
    }
  });

  it('deniega la apertura de ventanas nuevas', () => {
    const { contents, getWindowOpenHandler } = createFakeWebContents();

    registerNavigationGuards(contents, { openExternal: async () => {} });

    expect(getWindowOpenHandler()?.({ url: 'https://example.com' })).toEqual({
      action: 'deny',
    });
  });

  it('abre en el navegador solo los enlaces https válidos', () => {
    const openExternal = vi.fn(async () => {});
    const { contents, getWindowOpenHandler } = createFakeWebContents();

    registerNavigationGuards(contents, { openExternal });

    const handler = getWindowOpenHandler();

    expect(handler?.({ url: 'https://example.com/docs?page=1' })).toEqual({
      action: 'deny',
    });
    expect(openExternal).toHaveBeenCalledWith(
      'https://example.com/docs?page=1',
    );

    for (const url of [
      'http://example.com',
      'javascript:alert(1)',
      'file:///C:/Windows/System32/calc.exe',
      'mailto:hola@example.com',
      'https://localhost/',
      'https://127.0.0.1/',
    ]) {
      expect(handler?.({ url }), url).toEqual({ action: 'deny' });
    }

    expect(openExternal).toHaveBeenCalledTimes(1);
  });

  it('no propaga los fallos al abrir el enlace externo', async () => {
    const { contents, getWindowOpenHandler } = createFakeWebContents();

    registerNavigationGuards(contents, {
      openExternal: () => Promise.reject(new Error('sin navegador')),
    });

    expect(() =>
      getWindowOpenHandler()?.({ url: 'https://example.com' }),
    ).not.toThrow();

    // Deja que el rechazo capturado se resuelva para que Vitest no lo marque
    // como unhandled rejection.
    await Promise.resolve();
  });
});

describe('session guards', () => {
  it('deniega cualquier permiso del navegador', () => {
    const { session, getPermissionCheck, getPermissionRequest } =
      createFakeSession();

    registerSessionGuards(session, { development: true });

    expect(getPermissionCheck()?.()).toBe(false);

    let granted: boolean | null = null;
    getPermissionRequest()?.(undefined, 'camera', (value) => {
      granted = value;
    });

    expect(granted).toBe(false);
  });

  it('solo deja pasar loopback en desarrollo', () => {
    const { session, getRequestFilter, getBeforeRequest } = createFakeSession();

    registerSessionGuards(session, { development: true });
    expect(getRequestFilter()).toEqual({
      urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'],
    });

    const request = (url: string) => {
      let response: { cancel?: boolean } | undefined;
      getBeforeRequest()?.({ url }, (value) => {
        response = value;
      });
      return response;
    };

    expect(request('http://localhost:5173')).toEqual({ cancel: false });
    expect(request('ws://localhost:5173')).toEqual({ cancel: false });
    expect(request('https://example.com/a.png')).toEqual({ cancel: true });
    expect(request('wss://example.com/socket')).toEqual({ cancel: true });
  });

  it('cancela también loopback cuando no está en desarrollo', () => {
    const { session, getBeforeRequest } = createFakeSession();

    registerSessionGuards(session, { development: false });

    let response: { cancel?: boolean } | undefined;
    getBeforeRequest()?.({ url: 'http://localhost:5173' }, (value) => {
      response = value;
    });

    expect(response).toEqual({ cancel: true });
  });

  it('cancela cualquier descarga iniciada desde el renderer', () => {
    const { session, getWillDownload } = createFakeSession();

    registerSessionGuards(session, { development: true });

    let prevented = false;
    getWillDownload()?.({
      preventDefault: () => {
        prevented = true;
      },
    });

    expect(prevented).toBe(true);
  });
});
