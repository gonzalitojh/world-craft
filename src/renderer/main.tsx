import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { I18nProvider } from './i18n/provider';
import { DEFAULT_LOCALE, getCatalog } from './messages';
import { applyTheme, DEFAULT_THEME } from './theme';
import './styles/tokens/palette.css';
import './styles/tokens/semantic.css';
import './styles/tokens/scales.css';
import './styles/base.css';
import './styles/components.css';
import './styles/relations.css';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('No se encontró el contenedor #root del renderer.');
}

// El tema se fija antes del primer render para que los tokens semánticos ya
// estén resueltos; `App` lo mantiene sincronizado en cada cambio.
applyTheme(DEFAULT_THEME);
document.title = getCatalog(DEFAULT_LOCALE).app.title;

createRoot(container).render(
  <StrictMode>
    <I18nProvider locale={DEFAULT_LOCALE}>
      <App />
    </I18nProvider>
  </StrictMode>,
);
