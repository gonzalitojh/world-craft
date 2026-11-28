import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from './fixtures/electron-app';

/**
 * Contrato real del canal de exportación del spike (#80).
 *
 * Comprueba que un `Uint8Array` cruza el context bridge conservando su tipo,
 * que el proceso principal valida y escribe en `userData/data/spike-maps` y
 * que el renderer solo recibe el nombre relativo y el tamaño. La carpeta vive
 * en el `userData` temporal del fixture y se borra al terminar.
 */
test('guarda una exportación del laboratorio sin exponer rutas', async ({
  page,
  userDataDir,
}) => {
  const content = '{"spike":true}';
  const result = await page.evaluate(async (payload) => {
    const response = await window.worldCraft.mapsSpike.saveExport({
      kind: 'json',
      content: new TextEncoder().encode(payload),
    });

    return response;
  }, content);

  expect(result.ok).toBe(true);

  if (!result.ok) {
    return;
  }

  expect(result.data.fileName).toMatch(/^wc-m2-01-json-[0-9a-f]{8}\.json$/);
  expect(result.data.bytes).toBe(new TextEncoder().encode(content).byteLength);
  expect(JSON.stringify(result)).not.toContain(userDataDir);

  const file = join(userDataDir, 'data', 'spike-maps', result.data.fileName);

  expect(await readFile(file, 'utf8')).toBe(content);
});
