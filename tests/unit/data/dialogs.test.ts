import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

const { showSaveDialog } = vi.hoisted(() => ({
  showSaveDialog: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\datos\\Documents' },
  dialog: { showSaveDialog },
}));

vi.mock('@/main/window', () => ({
  getMainWindow: () => null,
}));

import {
  buildLibraryExportFileName,
  showLibraryExportDialog,
} from '@/main/data/dialogs';

const NOW = Date.parse('2026-11-26T12:00:00.000Z');

describe('diálogo de la biblioteca', () => {
  it('compone un nombre con fecha y extensión zip', () => {
    expect(buildLibraryExportFileName(NOW)).toBe('world-craft-2026-11-26.zip');
  });

  it('abre el diálogo con filtro zip y añade la extensión', async () => {
    showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: 'C:\\salida\\biblioteca',
    });

    await expect(showLibraryExportDialog({ now: () => NOW })).resolves.toBe(
      'C:\\salida\\biblioteca.zip',
    );
    expect(showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: join('C:\\datos\\Documents', 'world-craft-2026-11-26.zip'),
        filters: [
          {
            name: 'Biblioteca de World Craft',
            extensions: ['zip'],
          },
        ],
      }),
    );
  });

  it('devuelve null si se cancela', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true });

    await expect(
      showLibraryExportDialog({ now: () => NOW }),
    ).resolves.toBeNull();
  });
});
