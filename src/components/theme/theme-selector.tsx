'use client';

import { useId } from 'react';

import { isThemePreference, type ThemePreference } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { t, type MessageKey } from '@/messages';

import { useTheme } from './theme-provider';

/**
 * Opciones del selector, con su texto centralizado. El valor es la preferencia
 * que se guarda y el orden va de la más automática a la más explícita.
 */
const THEME_OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  labelKey: MessageKey;
}> = [
  { value: 'system', labelKey: 'theme.system' },
  { value: 'light', labelKey: 'theme.light' },
  { value: 'dark', labelKey: 'theme.dark' },
];

type ThemeSelectorProps = {
  /** Clases extra para integrarlo en el shell. */
  className?: string;
};

/**
 * Selector de tema con `<select>` nativo.
 *
 * Se usa un control nativo a propósito: es accesible por teclado y lectores de
 * pantalla sin código extra, funciona en móvil con el selector del sistema y no
 * necesita dependencias. La etiqueta es visible y está asociada con `htmlFor`.
 */
export function ThemeSelector({ className }: ThemeSelectorProps) {
  const { preference, setPreference } = useTheme();
  const selectId = useId();

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      {/*
        La etiqueta se oculta a la vista por debajo de `sm` para que la topbar
        quepa a 360 px sin scroll horizontal; sigue asociada al control por
        `htmlFor`, así que el nombre accesible no cambia.
      */}
      <label
        htmlFor={selectId}
        className="sr-only text-sm text-muted-foreground sm:not-sr-only"
      >
        {t('theme.label')}
      </label>
      <select
        id={selectId}
        value={preference}
        onChange={(event) => {
          const next = event.currentTarget.value;

          if (isThemePreference(next)) {
            setPreference(next);
          }
        }}
        className="h-11 min-w-0 rounded-md border border-border bg-surface-raised px-2 text-sm text-foreground sm:h-9"
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
