'use client';

import { Command as CommandIcon } from 'lucide-react';

import { useI18n } from '@/components/i18n/locale-provider';
import { useCommandPalette } from '@/components/shell/command-palette';
import { Button } from '@/components/ui/button';

/**
 * Botón de la página que abre **la misma** paleta del shell.
 *
 * No monta un diálogo propio: usa el proveedor global (`CommandPaletteProvider`
 * en el layout raíz), así que comparte atajo, contenido y devolución del foco
 * con el botón de la topbar.
 */
export function CommandLauncher({ label }: { label?: string } = {}) {
  const { t } = useI18n();
  const { open } = useCommandPalette();

  return (
    <Button
      variant="outline"
      onClick={(event) => {
        open(event.currentTarget);
      }}
    >
      <CommandIcon aria-hidden="true" />
      {label ?? t('design.commandLabel')}
    </Button>
  );
}
