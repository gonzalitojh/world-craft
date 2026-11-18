/**
 * Escritura de logs JSONL con rotación.
 *
 * El diagnóstico local usa una línea JSON por evento. La rotación es
 * best-effort: en Windows `rename` no sobrescribe, así que se elimina antes el
 * archivo `.1`. Cualquier fallo de disco se ignora para que el diagnóstico
 * nunca tumbe la operación que lo estaba registrando.
 */
import { appendFileSync, renameSync, rmSync, statSync } from 'node:fs';

/**
 * Añade `record` como una línea JSON a `file`.
 *
 * Si el archivo supera `maxBytes`, se rota a `<file>.1` antes de escribir. No
 * lanza: sin archivo previo, sin permisos o con el `.1` bloqueado simplemente
 * se sigue intentando escribir en el archivo actual.
 */
export function appendJsonLine(
  file: string,
  maxBytes: number,
  record: unknown,
): void {
  try {
    rotateIfNeeded(file, maxBytes);
    appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
  } catch {
    // El diagnóstico nunca debe tumbar la operación registrada.
  }
}

function rotateIfNeeded(file: string, maxBytes: number): void {
  try {
    if (statSync(file).size <= maxBytes) {
      return;
    }

    const rotatedFile = `${file}.1`;
    rmSync(rotatedFile, { force: true });
    renameSync(file, rotatedFile);
  } catch {
    // Sin archivo previo, sin permisos o con el `.1` bloqueado: no se rota.
  }
}
