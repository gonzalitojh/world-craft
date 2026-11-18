import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { messages } from './messages/es';
import './styles/base.css';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('No se encontró el contenedor #root del renderer.');
}

document.title = messages.app.title;

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
