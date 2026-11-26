import { useState } from 'react';

import { useMessages } from '../../i18n/provider';
import { DisclosureSection } from '../disclosure-section';

/**
 * Atajos de consulta en una sección plegable.
 *
 * No son editables ni se prometen atajos que no existan: la tabla es de solo
 * lectura y la nota remite a los atajos propios del editor.
 */
export function ShortcutsSettings() {
  const messages = useMessages();
  const [open, setOpen] = useState(false);

  return (
    <DisclosureSection
      id="wc-settings-shortcuts"
      title={messages.settings.shortcuts.title}
      meta={messages.settings.shortcuts.meta}
      open={open}
      onToggle={setOpen}
      headingLevel={2}
    >
      <div className="wc-settings__table-wrap">
        <table className="wc-settings__table">
          <caption className="wc-visually-hidden">
            {messages.settings.shortcuts.caption}
          </caption>
          <thead>
            <tr>
              <th scope="col">{messages.settings.shortcuts.columns.action}</th>
              <th scope="col">
                {messages.settings.shortcuts.columns.shortcut}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{messages.settings.shortcuts.rows.palette}</th>
              <td>
                <kbd className="wc-settings__kbd">
                  {messages.settings.shortcuts.paletteKeys}
                </kbd>
              </td>
            </tr>
            <tr>
              <th scope="row">{messages.settings.shortcuts.rows.close}</th>
              <td>
                <kbd className="wc-settings__kbd">
                  {messages.settings.shortcuts.closeKeys}
                </kbd>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="wc-settings__note">
        {messages.settings.shortcuts.editorNote}
      </p>
    </DisclosureSection>
  );
}
