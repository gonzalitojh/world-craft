import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface SettingsAnnouncerValue {
  readonly announce: (message: string) => void;
}

const SettingsAnnouncerContext = createContext<SettingsAnnouncerValue>({
  announce: () => undefined,
});

export interface SettingsAnnouncerProviderProps {
  readonly children: ReactNode;
}

/**
 * Región viva única de la página de Ajustes para mensajes sin foco.
 *
 * Los estados que ya reciben foco (progreso y resultados) no se envían aquí:
 * el lector de pantalla los anuncia al enfocarlos. Este anunciador queda
 * reservado a mensajes informativos sin foco, como «Restablecer apariencia».
 * Los errores conservan `role="alert"` y tampoco se duplican aquí.
 */
export function SettingsAnnouncerProvider({
  children,
}: SettingsAnnouncerProviderProps) {
  const [entry, setEntry] = useState<{
    readonly text: string;
    readonly seq: number;
  }>({ text: '', seq: 0 });
  const announce = useCallback((message: string): void => {
    const text = message.trim();

    if (text.length === 0) {
      return;
    }

    setEntry((current) => ({ text, seq: current.seq + 1 }));
  }, []);
  const value = useMemo(() => ({ announce }), [announce]);

  return (
    <SettingsAnnouncerContext.Provider value={value}>
      {children}
      <div
        className="wc-visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-settings-announcer
      >
        {entry.text.length === 0 ? null : (
          <span key={entry.seq}>{entry.text}</span>
        )}
      </div>
    </SettingsAnnouncerContext.Provider>
  );
}

/** Devuelve el anunciador de Ajustes; fuera del proveedor es un no-op. */
export function useAnnounce(): (message: string) => void {
  return useContext(SettingsAnnouncerContext).announce;
}
