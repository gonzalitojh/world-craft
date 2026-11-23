import { useEffect, useId, useRef, type ReactNode } from 'react';

import { cx } from '../lib/class-names';
import { useMessages } from '../i18n/provider';
import { IconButton } from './icon-button';

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

export interface DialogProps {
  /** Apertura controlada por el componente padre. */
  readonly open: boolean;
  /** Se llama al cerrar con Escape, con el botón «Cerrar» o con una acción. */
  readonly onClose: () => void;
  readonly title: string;
  readonly children?: ReactNode;
  /** Acciones del pie; los botones se alinean al final. */
  readonly actions?: ReactNode;
  /**
   * Permite cerrar con Escape y con el botón «Cerrar». Con `false`, el cierre
   * se bloquea mientras hay una petición en curso (C2).
   */
  readonly dismissible?: boolean;
  readonly className?: string;
}

/**
 * Diálogo modal sobre el elemento nativo `<dialog>`.
 *
 * `showModal()` aporta la trampa de foco, el velo y el cierre con Escape sin
 * código propio; aquí solo se sincroniza el estado, se etiqueta el diálogo con
 * su título y se devuelve el foco al disparador al cerrar.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  dismissible = true,
  className,
}: DialogProps) {
  const messages = useMessages();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open) {
      if (dialog.open) {
        return;
      }

      const active = document.activeElement;
      previousFocusRef.current = active instanceof HTMLElement ? active : null;
      dialog.showModal();

      // El primer campo marcado toma el foco; si no hay ninguno, se conserva
      // el primer elemento enfocable que elija el navegador.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
      return;
    }

    if (dialog.open) {
      dialog.close();
    }

    const previous = previousFocusRef.current;
    previousFocusRef.current = null;
    previous?.focus();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={cx('wc-dialog', className)}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape se gestiona en `onKeyDown` para que un tooltip o un menú
        // abiertos consuman el primer Escape sin cerrar el diálogo.
        event.preventDefault();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') {
          return;
        }

        if (!dismissible) {
          event.preventDefault();
          return;
        }

        const dialog = dialogRef.current;
        const hasOpenPopover =
          dialog !== null &&
          dialog.querySelector('[role="tooltip"], [role="menu"]') !== null;

        if (hasOpenPopover) {
          return;
        }

        event.preventDefault();
        dialog?.close();
      }}
      onClose={onClose}
    >
      <header className="wc-dialog__header">
        <h2 className="wc-dialog__title" id={titleId}>
          {title}
        </h2>
        <IconButton
          label={messages.components.dialog.close}
          icon={<CloseIcon />}
          size="sm"
          disabled={!dismissible}
          onClick={onClose}
        />
      </header>
      <div className="wc-dialog__body" tabIndex={0}>
        {children}
      </div>
      {actions ? (
        <footer className="wc-dialog__actions">{actions}</footer>
      ) : null}
    </dialog>
  );
}
