import { useI18n } from '../../i18n/provider';
import { getUpdateStatusMessage } from '../../updates/status';
import { useUpdates } from '../../updates/use-updates';
import { Button } from '../button';
import { SettingsSection } from './settings-section';

/**
 * Actualizaciones informativas.
 *
 * Muestra la versión y la última comprobación y abre el diálogo compartido de
 * la barra superior. No ofrece interruptor ni frecuencia de auto-comprobación
 * (D5) y no añade una segunda suscripción.
 */
export function UpdatesSettings() {
  const i18n = useI18n();
  const messages = i18n.messages;
  const { snapshot, openDialog } = useUpdates();
  const lastCheckedAt = snapshot.lastCheckedAt;
  const lastChecked =
    lastCheckedAt !== null && !Number.isNaN(new Date(lastCheckedAt).getTime())
      ? i18n.formats.formatDateTime(lastCheckedAt)
      : null;
  const status = getUpdateStatusMessage(snapshot, i18n);

  return (
    <SettingsSection
      id="actualizaciones"
      title={messages.settings.updates.title}
    >
      <dl className="wc-settings__meta">
        <div className="wc-settings__meta-row">
          <dt className="wc-settings__meta-label">
            {messages.settings.updates.installed}
          </dt>
          <dd className="wc-settings__meta-value">{snapshot.currentVersion}</dd>
        </div>
        <div className="wc-settings__meta-row">
          <dt className="wc-settings__meta-label">
            {messages.settings.updates.lastChecked}
          </dt>
          <dd className="wc-settings__meta-value">
            {lastChecked ?? messages.settings.updates.never}
          </dd>
        </div>
      </dl>

      <div className="wc-settings__row">
        <p className="wc-settings__status-line">{status}</p>
        <Button variant="secondary" onClick={openDialog}>
          {messages.settings.updates.open}
        </Button>
      </div>

      <p className="wc-settings__note">{messages.settings.updates.privacy}</p>
    </SettingsSection>
  );
}
