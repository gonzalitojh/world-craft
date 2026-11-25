/**
 * Acumulador de avisos de saneado.
 *
 * Los avisos se agregan por código para que el resultado no dependa del número
 * de filas y nunca transporte IDs, nombres ni contenido. El orden de salida es
 * el de la lista cerrada de códigos.
 */
import {
  TRANSFER_WARNING_CODES,
  type TransferWarning,
  type TransferWarningCode,
} from '../../../shared/contracts/transfer';

/** Contador de avisos por código. */
export class TransferWarningCollector {
  private readonly counts = new Map<TransferWarningCode, number>();

  /** Suma uno o varios avisos de un código. */
  add(code: TransferWarningCode, count = 1): void {
    if (count <= 0) {
      return;
    }

    this.counts.set(code, (this.counts.get(code) ?? 0) + count);
  }

  /** Incorpora otro acumulador. */
  merge(other: TransferWarningCollector): void {
    for (const [code, count] of other.counts) {
      this.add(code, count);
    }
  }

  /** Número total de avisos. */
  get total(): number {
    let total = 0;

    for (const count of this.counts.values()) {
      total += count;
    }

    return total;
  }

  /** Lista ordenada y agregada, lista para el manifiesto o el resultado. */
  toList(): readonly TransferWarning[] {
    return TRANSFER_WARNING_CODES.flatMap((code) => {
      const count = this.counts.get(code);

      return count === undefined ? [] : [{ code, count }];
    });
  }
}
