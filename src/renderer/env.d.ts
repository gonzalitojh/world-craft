import type { WorldCraftApi } from '../shared/contracts/world-craft-api';

declare global {
  interface Window {
    /** API mínima publicada por el preload (ADR 0004). */
    readonly worldCraft: WorldCraftApi;
  }
}

export {};
