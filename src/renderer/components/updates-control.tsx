import { useMessages } from '../i18n/provider';
import { useUpdates } from '../updates/use-updates';
import { IconButton } from './icon-button';

function UpdatesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 4v10" />
      <path d="m7.5 9.5 4.5 4.5 4.5-4.5" />
      <path d="M5 18.5h14" />
    </svg>
  );
}

/**
 * Control de actualizaciones de la barra superior.
 *
 * En v2 es un icono discreto: el nombre accesible y el tooltip cambian cuando
 * hay una versión disponible y un punto de acento lo señala visualmente. El
 * estado y el diálogo viven en `UpdatesProvider`, compartidos con Ajustes, para
 * no duplicar suscripciones. No comprueba automáticamente: la primera
 * comprobación ocurre solo si el usuario la pide.
 */
export function UpdatesControl() {
  const messages = useMessages();
  const { snapshot, open, openDialog } = useUpdates();
  const hasUpdate =
    snapshot.phase === 'available' || snapshot.phase === 'downloaded';
  const announcement =
    hasUpdate && snapshot.availableVersion !== null
      ? messages.updates.openWithUpdate(snapshot.availableVersion)
      : null;
  const label = announcement ?? messages.updates.open;

  return (
    <>
      <IconButton
        label={label}
        tooltip={label}
        icon={
          <span className="wc-updates__icon">
            <UpdatesIcon />
            {hasUpdate ? (
              <span className="wc-updates__dot" aria-hidden="true" />
            ) : null}
          </span>
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openDialog}
      />
      <span className="wc-visually-hidden" aria-live="polite">
        {announcement ?? ''}
      </span>
    </>
  );
}
