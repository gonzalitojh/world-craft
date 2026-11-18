import { useCallback, useEffect, useRef, useState } from 'react';

import { ToastRegion, type Toast, type ToastTone } from './components';
import { messages } from './messages/es';
import { HomePage } from './pages/home-page';
import { SamplesPage } from './pages/samples-page';
import { AppShell, type AppView } from './shell/app-shell';
import { applyTheme, DEFAULT_THEME, type ThemeMode } from './theme';

/**
 * Raíz del renderer.
 *
 * Mantiene el estado de la vista (`home | samples`) y del tema. No hay router:
 * el shell es una sola ventana con dos vistas conmutables. El tema no se
 * persiste aquí; su almacenamiento en `config.json` llegará con la pantalla de
 * Ajustes, que es la que debe leer y escribir la preferencia antes del primer
 * pintado.
 */
export function App() {
  const { appInfo } = window.worldCraft;
  const [view, setView] = useState<AppView>('home');
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const nextToastId = useRef(0);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  const notify = useCallback((tone: ToastTone, message: string) => {
    nextToastId.current += 1;
    setToasts((current) => [
      ...current,
      { id: `wc-toast-${nextToastId.current}`, tone, message },
    ]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <>
      <AppShell
        view={view}
        onViewChange={setView}
        theme={theme}
        onToggleTheme={toggleTheme}
        version={appInfo.version}
      >
        {view === 'home' ? (
          <HomePage
            onCreateWorld={() => {
              notify('info', messages.home.createSoon);
            }}
          />
        ) : (
          <SamplesPage onNotify={notify} />
        )}
      </AppShell>
      <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
