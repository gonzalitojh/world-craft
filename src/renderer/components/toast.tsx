import { useMessages } from '../i18n/provider';
import { Button } from './button';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  readonly id: string;
  readonly tone: ToastTone;
  readonly message: string;
}

export interface ToastRegionProps {
  readonly toasts: readonly Toast[];
  readonly onDismiss: (id: string) => void;
  readonly label?: string;
}

/**
 * Región de avisos con `aria-live` y cierre manual.
 *
 * No hay temporizadores: un aviso desaparece cuando el usuario lo cierra, de
 * modo que nadie pierde un mensaje por leerlo despacio. El tono se anuncia con
 * una etiqueta oculta («Información», «Éxito», «Error») además del color del
 * borde.
 */
export function ToastRegion({ toasts, onDismiss, label }: ToastRegionProps) {
  const messages = useMessages();
  const regionLabel = label ?? messages.components.toast.regionLabel;

  return (
    <div
      className="wc-toast-region"
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-label={regionLabel}
    >
      <ul className="wc-toast-list">
        {toasts.map((toast) => (
          <li key={toast.id} className={`wc-toast wc-toast--${toast.tone}`}>
            <span className="wc-toast__message">
              <span className="wc-visually-hidden">
                {messages.components.toast.tones[toast.tone]}:{' '}
              </span>
              {toast.message}
            </span>
            <Button
              className="wc-toast__close"
              variant="ghost"
              size="sm"
              aria-label={messages.components.toast.dismissTone(
                messages.components.toast.tones[toast.tone],
              )}
              onClick={() => {
                onDismiss(toast.id);
              }}
            >
              {messages.components.toast.dismiss}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
