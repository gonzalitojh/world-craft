/**
 * Checksums de las migraciones.
 *
 * El SQL se normaliza a LF antes de calcular SHA-256 para que un cambio de
 * finales de línea (Windows/Unix) no invalide una migración ya aplicada. Solo
 * cambia el checksum si cambia el contenido real.
 */
import { createHash } from 'node:crypto';

/** Normaliza BOM y finales de línea a LF. */
export function normalizeSql(sql: string): string {
  return sql.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

/** Calcula el SHA-256 hexadecimal del SQL normalizado. */
export function computeSqlChecksum(sql: string): string {
  return createHash('sha256').update(normalizeSql(sql), 'utf8').digest('hex');
}
