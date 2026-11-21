import { useMessages } from '../i18n/provider';
import { IconButton } from './icon-button';

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

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      focusable="false"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

function ToneIcon({ tone }: { readonly tone: ToastTone }) {
  if (tone === 'success') {
    return (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        <circle cx="10" cy="10" r="7" />
        <path d="M6.6 10.2l2.2 2.2 4.6-4.6" />
      </svg>
    );
  }

  if (tone === 'error') {
    return (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        <circle cx="10" cy="10" r="7" />
        <path d="M10 6.2v4.6" />
        <circle cx="10" cy="13.8" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <circle cx="10" cy="10" r="7" />
      <path d="M10 9v4.2" />
      <circle cx="10" cy="6.4" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Región de avisos con `aria-live` y cierre manual.
 *
 * No hay temporizadores: un aviso desaparece cuando el usuario lo cierra, de
 * modo que nadie pierde un mensaje por leerlo despacio. El tono se anuncia con
 * una etiqueta oculta («Información», «Éxito», «Error») y un icono decorativo;
 * el color nunca es el único indicador.
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
            <span className="wc-toast__icon" aria-hidden="true">
              <ToneIcon tone={toast.tone} />
            </span>
            <span className="wc-toast__message">
              <span className="wc-visually-hidden">
                {messages.components.toast.tones[toast.tone]}:{' '}
              </span>
              {toast.message}
            </span>
            <IconButton
              className="wc-toast__close"
              label={messages.components.toast.dismissTone(
                messages.components.toast.tones[toast.tone],
              )}
              icon={<CloseIcon />}
              size="sm"
              onClick={() => {
                onDismiss(toast.id);
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
