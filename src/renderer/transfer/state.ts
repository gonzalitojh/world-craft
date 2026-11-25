/**
 * Máquina de estados del diálogo de exportación e importación.
 *
 * Es un módulo puro, sin React: el hook traduce los eventos del coordinador a
 * acciones y las pruebas pueden ejercitar todas las transiciones sin DOM.
 */
import type {
  TransferErrorCode,
  TransferExportResult,
  TransferImportResult,
  TransferOperation,
  TransferPhase,
  TransferProgressEvent,
  TransferUnit,
  TransferWarning,
} from '../../shared/contracts/transfer';

/** Código de fallo que puede mostrar el diálogo. */
export type TransferFailureCode = TransferErrorCode | 'TRANSPORT' | 'UNKNOWN';

/** Estado del diálogo de transferencia. */
export type TransferDialogState =
  | { readonly status: 'closed' }
  | {
      readonly status: 'running';
      readonly operation: TransferOperation;
      readonly operationId: string;
      readonly worldName: string | null;
      readonly phase: TransferPhase;
      readonly completed: number;
      readonly total: number | null;
      readonly unit: TransferUnit;
      readonly cancelable: boolean;
      readonly cancelError: boolean;
    }
  | {
      readonly status: 'cancelling';
      readonly operation: TransferOperation;
      readonly operationId: string;
      readonly worldName: string | null;
      readonly phase: TransferPhase;
      readonly completed: number;
      readonly total: number | null;
      readonly unit: TransferUnit;
    }
  | { readonly status: 'exported'; readonly result: TransferExportResult }
  | { readonly status: 'imported'; readonly result: TransferImportResult }
  | {
      readonly status: 'failed';
      readonly operation: TransferOperation;
      readonly worldName: string | null;
      readonly code: TransferFailureCode;
      readonly retrying: boolean;
    };

/** Acciones que produce el hook. */
export type TransferDialogAction =
  | { readonly type: 'reset' }
  | {
      readonly type: 'event';
      readonly event: TransferProgressEvent;
      readonly worldName: string | null;
    }
  | { readonly type: 'cancelRequested' }
  | { readonly type: 'cancelRejected'; readonly error: boolean }
  | { readonly type: 'exportCompleted'; readonly result: TransferExportResult }
  | { readonly type: 'importCompleted'; readonly result: TransferImportResult }
  | {
      readonly type: 'failed';
      readonly operation: TransferOperation;
      readonly worldName: string | null;
      readonly code: TransferFailureCode;
    }
  | { readonly type: 'retryStarted' }
  | { readonly type: 'retryCancelled' }
  | { readonly type: 'cancelled' }
  | { readonly type: 'close' };

/** Estado inicial. */
export const INITIAL_TRANSFER_DIALOG_STATE: TransferDialogState = {
  status: 'closed',
};

/** Indica si el diálogo está en un estado terminal. */
export function isTerminal(state: TransferDialogState): boolean {
  return (
    state.status === 'closed' ||
    state.status === 'exported' ||
    state.status === 'imported' ||
    state.status === 'failed'
  );
}

/** Indica si el resultado tiene avisos que merezcan una insignia distinta. */
export function hasTransferWarnings(
  result: TransferExportResult | TransferImportResult,
): boolean {
  return (
    result.warnings.some((warning: TransferWarning) => warning.count > 0) ||
    ('slugAdjusted' in result && result.slugAdjusted)
  );
}

/**
 * Indica si un fallo tiene sentido reintentarlo.
 *
 * Un formato incompatible, un origen desaparecido o una función no disponible
 * no cambian por reintentar. El resto (transporte, espacio, permisos, busy,
 * errores internos) sí puede resolverse.
 */
export function isTransferRetryable(code: TransferFailureCode): boolean {
  switch (code) {
    case 'TRANSFER_SOURCE_NOT_FOUND':
    case 'TRANSFER_FORMAT_UNSUPPORTED':
    case 'TRANSFER_CANCELLED':
    case 'TRANSFER_UNAVAILABLE':
      return false;
    default:
      return true;
  }
}

function runningFromEvent(
  event: TransferProgressEvent,
  worldName: string | null,
): TransferDialogState {
  return {
    status: 'running',
    operation: event.operation,
    operationId: event.operationId,
    worldName,
    phase: event.phase,
    completed: event.completed,
    total: event.total,
    unit: event.unit,
    cancelable: event.cancelable,
    cancelError: false,
  };
}

/** Reduce una acción al siguiente estado. */
export function transferDialogReducer(
  state: TransferDialogState,
  action: TransferDialogAction,
): TransferDialogState {
  switch (action.type) {
    case 'reset':
      return INITIAL_TRANSFER_DIALOG_STATE;

    case 'event': {
      if (state.status === 'closed') {
        return runningFromEvent(action.event, action.worldName);
      }

      if (state.status === 'failed' && state.retrying) {
        if (state.operation !== action.event.operation) {
          return state;
        }

        return runningFromEvent(action.event, state.worldName);
      }

      if (state.status !== 'running' && state.status !== 'cancelling') {
        return state;
      }

      if (
        state.operation !== action.event.operation ||
        state.operationId !== action.event.operationId
      ) {
        return state;
      }

      if (state.status === 'cancelling') {
        return {
          ...state,
          phase: action.event.phase,
          completed: action.event.completed,
          total: action.event.total,
          unit: action.event.unit,
        };
      }

      return {
        ...state,
        phase: action.event.phase,
        completed: action.event.completed,
        total: action.event.total,
        unit: action.event.unit,
        cancelable: state.cancelable && action.event.cancelable,
      };
    }

    case 'cancelRequested':
      if (state.status !== 'running' || !state.cancelable) {
        return state;
      }

      return {
        status: 'cancelling',
        operation: state.operation,
        operationId: state.operationId,
        worldName: state.worldName,
        phase: state.phase,
        completed: state.completed,
        total: state.total,
        unit: state.unit,
      };

    case 'cancelRejected':
      if (state.status !== 'cancelling') {
        return state;
      }

      return {
        status: 'running',
        operation: state.operation,
        operationId: state.operationId,
        worldName: state.worldName,
        phase: state.phase,
        completed: state.completed,
        total: state.total,
        unit: state.unit,
        // Un fallo de transporte no cierra la puerta a reintentar; solo el
        // rechazo del coordinador indica que la fase ya no es cancelable.
        cancelable: action.error,
        cancelError: action.error,
      };

    case 'exportCompleted':
      return { status: 'exported', result: action.result };

    case 'importCompleted':
      return { status: 'imported', result: action.result };

    case 'failed':
      return {
        status: 'failed',
        operation: action.operation,
        worldName: action.worldName,
        code: action.code,
        retrying: false,
      };

    case 'retryStarted':
      return state.status === 'failed' && !state.retrying
        ? { ...state, retrying: true }
        : state;

    case 'retryCancelled':
      return state.status === 'failed' ? { ...state, retrying: false } : state;

    case 'cancelled':
    case 'close':
      return INITIAL_TRANSFER_DIALOG_STATE;

    default:
      return state;
  }
}
