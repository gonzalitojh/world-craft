import type { ToastTone } from '../toast';
import { useMessages } from '../../i18n/provider';
import { useDataSettings } from '../../settings/use-data-settings';
import { DataDanger } from './data-danger';
import { DataExport } from './data-export';
import { DataFolders } from './data-folders';
import { DataOrphans } from './data-orphans';
import { DataSummary } from './data-summary';
import { DataUsage } from './data-usage';
import { SettingsSection } from './settings-section';

export interface DataSettingsProps {
  readonly onNotify?: ((tone: ToastTone, message: string) => void) | undefined;
}

/** Sección editorial de Datos y copias. */
export function DataSettings({ onNotify }: DataSettingsProps) {
  const messages = useMessages();
  const data = useDataSettings(onNotify === undefined ? {} : { onNotify });
  const worldCount =
    data.summary.status === 'ready'
      ? data.summary.data.worlds.active + data.summary.data.worlds.archived
      : null;
  const unavailable =
    data.summary.status === 'unavailable' ||
    data.usage.status === 'unavailable' ||
    data.orphans.status === 'unavailable';

  return (
    <SettingsSection
      id="datos"
      title={messages.settings.data.title}
      lead={messages.settings.data.lead}
    >
      <div className="wc-settings__data">
        <DataSummary state={data.summary} onRetry={data.reloadSummary} />
        <DataFolders folders={data.folders} onOpen={data.openFolder} />
        <DataUsage state={data.usage} onRecalculate={data.reloadUsage} />
        <DataExport
          state={data.exportState}
          busy={data.busy}
          unavailable={unavailable}
          worldCount={worldCount}
          onExport={() => {
            void data.exportAll();
          }}
          onDismiss={data.dismissExport}
        />
        <DataOrphans
          state={data.orphans}
          busy={data.busy}
          unavailable={unavailable}
          quarantine={
            data.summary.status === 'ready'
              ? data.summary.data.quarantine
              : null
          }
          onAnalyze={() => {
            void data.analyzeOrphans();
          }}
          onPurge={data.purgeOrphans}
        />
        <DataDanger
          state={data.deleteState}
          busy={data.busy}
          unavailable={unavailable}
          onOpen={data.openDeleteDialog}
          onClose={data.closeDeleteDialog}
          onConfirm={(keepBackups) => {
            void data.confirmDelete(keepBackups);
          }}
        />
      </div>
    </SettingsSection>
  );
}
