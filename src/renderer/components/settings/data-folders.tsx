import type { DataFolder } from '../../../shared/contracts/data';
import { useMessages } from '../../i18n/provider';
import { dataErrorMessage } from '../../settings/data-errors';
import type { FolderState } from '../../settings/use-data-settings';
import { Button } from '../button';

export interface DataFoldersProps {
  readonly folders: Readonly<Record<DataFolder, FolderState>>;
  readonly onOpen: (folder: DataFolder) => void;
}

interface FolderRow {
  readonly folder: DataFolder;
  readonly path: string;
  readonly label: string;
  readonly contents: string;
  readonly action: string;
}

/**
 * Carpetas de datos con su ruta relativa y acciones nominativas.
 *
 * Las rutas mostradas son solo el nombre del enum dentro de `userData`; nunca
 * se renderiza una ruta absoluta. Importaciones y exportaciones quedan en la
 * misma tabla bajo un grupo «Temporales» no plegable: el contrato de Ajustes
 * solo permite plegar Atajos y Uso de disco.
 */
export function DataFolders({ folders, onOpen }: DataFoldersProps) {
  const messages = useMessages();
  const copy = messages.settings.data.folders;
  const rows: readonly FolderRow[] = [
    {
      folder: 'data',
      path: 'data',
      label: copy.data.label,
      contents: copy.data.contents,
      action: copy.open.data,
    },
    {
      folder: 'assets',
      path: 'assets',
      label: copy.assets.label,
      contents: copy.assets.contents,
      action: copy.open.assets,
    },
    {
      folder: 'backups',
      path: 'backups',
      label: copy.backups.label,
      contents: copy.backups.contents,
      action: copy.open.backups,
    },
    {
      folder: 'logs',
      path: 'logs',
      label: copy.logs.label,
      contents: copy.logs.contents,
      action: copy.open.logs,
    },
  ];
  const temporaryRows: readonly FolderRow[] = [
    {
      folder: 'imports',
      path: 'imports',
      label: copy.imports.label,
      contents: copy.imports.contents,
      action: copy.open.imports,
    },
    {
      folder: 'exports',
      path: 'exports',
      label: copy.exports.label,
      contents: copy.exports.contents,
      action: copy.open.exports,
    },
  ];

  const renderRow = (row: FolderRow) => {
    const state = folders[row.folder];
    const opening = state.status === 'opening';

    return (
      <tr key={row.folder}>
        <th scope="row">
          {row.label}
          <span className="wc-settings__path">{row.path}</span>
        </th>
        <td>{row.contents}</td>
        <td>
          <Button
            variant="secondary"
            size="sm"
            loading={opening}
            disabled={opening}
            onClick={() => {
              onOpen(row.folder);
            }}
          >
            {row.action}
          </Button>
          {state.status === 'error' ? (
            <p className="wc-settings__inline-error" role="alert">
              {dataErrorMessage(messages, state.code)}
            </p>
          ) : null}
        </td>
      </tr>
    );
  };

  return (
    <div className="wc-settings__subsection">
      <h3 className="wc-settings__subheading">{copy.title}</h3>
      <p className="wc-settings__note">{copy.lead}</p>
      <div className="wc-settings__table-wrap">
        <table className="wc-settings__table">
          <caption className="wc-visually-hidden">{copy.caption}</caption>
          <thead>
            <tr>
              <th scope="col">{copy.columns.folder}</th>
              <th scope="col">{copy.columns.contents}</th>
              <th scope="col">{copy.columns.action}</th>
            </tr>
          </thead>
          <tbody>{rows.map(renderRow)}</tbody>
          <tbody>
            <tr className="wc-settings__table-group">
              <th scope="rowgroup" colSpan={3}>
                {copy.tempTitle}
              </th>
            </tr>
            {temporaryRows.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
