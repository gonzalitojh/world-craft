/**
 * Entorno común de las pruebas unitarias.
 *
 * jsdom no implementa varias APIs del navegador que usan los componentes
 * interactivos (tema, overlays, mapas). Se instalan aquí, solo si faltan o si
 * jsdom las deja como «no implementado», para que cada test no repita el mismo
 * andamiaje.
 *
 * El archivo se carga también en los tests de entorno `node` (el defecto), así
 * que todo va guardado por `typeof window`.
 */

/** `MediaQueryList` de juguete: `matches` siempre falso salvo que un test lo cambie. */
class MockMediaQueryList extends EventTarget {
  readonly media: string;

  matches = false;

  onchange: ((event: MediaQueryListEvent) => void) | null = null;

  constructor(media: string) {
    super();
    this.media = media;
  }

  addListener(listener: EventListener): void {
    this.addEventListener('change', listener);
  }

  removeListener(listener: EventListener): void {
    this.removeEventListener('change', listener);
  }
}

/** `ResizeObserver` mínimo: los componentes solo lo instancian y lo cierran. */
class MockResizeObserver {
  observe(): void {
    // Sin layout real no hay nada que observar.
  }

  unobserve(): void {
    // Sin layout real no hay nada que dejar de observar.
  }

  disconnect(): void {
    // Sin layout real no hay nada que desconectar.
  }
}

/** `Storage` en memoria para cuando jsdom bloquea `localStorage`. */
class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.entries.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, String(value));
  }
}

function installMatchMedia(): void {
  window.matchMedia = (query: string): MediaQueryList =>
    new MockMediaQueryList(query) as unknown as MediaQueryList;
}

/**
 * `localStorage` puede lanzar al acceder si el documento tiene origen opaco.
 * Si funciona se respeta el de jsdom; si no, se sustituye por memoria.
 */
function installStorage(key: 'localStorage' | 'sessionStorage'): void {
  try {
    window[key].setItem('wc:probe', '1');
    window[key].removeItem('wc:probe');
  } catch {
    Object.defineProperty(window, key, {
      configurable: true,
      value: new MemoryStorage(),
    });
  }
}

function installPointerEvent(): void {
  if (typeof window.PointerEvent === 'function') {
    return;
  }

  window.PointerEvent = class MockPointerEvent extends MouseEvent {
    readonly pointerId = 1;

    readonly pointerType = 'mouse';
  } as unknown as typeof PointerEvent;
}

function installScrollTo(): void {
  // jsdom no implementa el desplazamiento: sin esto, `scrollTo` lanza.
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  Element.prototype.scrollIntoView = (() => {
    // Igual que arriba: se evita el «not implemented» de jsdom.
  }) as typeof Element.prototype.scrollIntoView;
}

if (typeof window !== 'undefined') {
  installMatchMedia();
  installStorage('localStorage');
  installStorage('sessionStorage');
  installPointerEvent();
  installScrollTo();

  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver;
  }
}
