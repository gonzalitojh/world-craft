import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

const { showSaveDialog, showOpenDialog } = vi.hoisted(() => ({
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\datos\\Documents' },
  dialog: { showSaveDialog, showOpenDialog },
}));

vi.mock('@/main/window', () => ({
  getMainWindow: () => null,
}));

import {
  buildExportFileName,
  ensureZipExtension,
  sanitizeWindowsFileName,
  showExportDialog,
  showImportDialog,
} from '@/main/transfer/dialogs';

describe('diálogos y nombres de exportación', () => {
  it('sanea caracteres prohibidos, puntos y espacios finales', () => {
    expect(sanitizeWindowsFileName('Crónica: mareas?')).toBe(
      'Crónica- mareas-',
    );
    expect(sanitizeWindowsFileName('mundo.   ')).toBe('mundo');
    expect(sanitizeWindowsFileName('  mundo  ')).toBe('mundo');
    expect(sanitizeWindowsFileName('a/b\\c')).toBe('a-b-c');
    expect(sanitizeWindowsFileName('   ')).toBe('mundo');
  });

  it('evita nombres reservados de Windows', () => {
    for (const reserved of ['CON', 'prn', 'AUX', 'NUL', 'COM1', 'LPT9']) {
      const safe = sanitizeWindowsFileName(reserved);

      expect(safe.startsWith('_')).toBe(true);
      expect(safe.toLowerCase()).toBe(`_${reserved.toLowerCase()}`);
    }
  });

  it('compone el nombre por defecto con .zip y sin doble extensión', () => {
    expect(
      buildExportFileName({ name: 'Crónica de las Mareas', slug: 'x' }),
    ).toBe('Crónica de las Mareas.zip');
    expect(buildExportFileName({ name: 'mundo.zip', slug: 'x' })).toBe(
      'mundo.zip',
    );
    expect(buildExportFileName({ name: '   ', slug: 'mundo' })).toBe(
      'mundo.zip',
    );
    expect(buildExportFileName({ name: 'CON', slug: 'x' })).toBe('_CON.zip');
    expect(ensureZipExtension('C:\\salida\\mundo')).toBe(
      'C:\\salida\\mundo.zip',
    );
    expect(ensureZipExtension('C:\\salida\\mundo.ZIP')).toBe(
      'C:\\salida\\mundo.ZIP',
    );
  });

  it('abre el diálogo de guardado con filtro .zip y devuelve el destino', async () => {
    showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: 'C:\\salida\\mundo',
    });

    await expect(
      showExportDialog({ name: 'Crónica de las Mareas', slug: 'cronica' }),
    ).resolves.toBe('C:\\salida\\mundo.zip');

    expect(showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: join('C:\\datos\\Documents', 'Crónica de las Mareas.zip'),
        filters: [
          {
            name: 'Mundo de World Craft',
            extensions: ['zip'],
          },
        ],
      }),
    );
  });

  it('devuelve null si se cancela el guardado', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true });

    await expect(
      showExportDialog({ name: 'Mundo', slug: 'mundo' }),
    ).resolves.toBeNull();
  });

  it('abre el diálogo de importación con filtro y una sola selección', async () => {
    showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['C:\\entrada\\mundo.zip'],
    });

    await expect(showImportDialog()).resolves.toBe('C:\\entrada\\mundo.zip');

    expect(showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: ['openFile'],
        filters: expect.arrayContaining([
          { name: 'Mundo de World Craft', extensions: ['zip'] },
          { name: 'Todos los archivos', extensions: ['*'] },
        ]),
      }),
    );
  });

  it('devuelve null si se cancela la importación', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

    await expect(showImportDialog()).resolves.toBeNull();
  });
});
