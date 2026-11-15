'use client';

import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { useMemo } from 'react';

import { cn } from '@/lib/utils';
import { t } from '@/messages';

import type { CommandPaletteItem } from './command';

/**
 * Contenido de la paleta de comandos (`cmdk`).
 *
 * Vive en su propio módulo porque `command.tsx` lo carga con `next/dynamic` y
 * `ssr: false` la primera vez que se abre la paleta: así `cmdk` no entra en el
 * bundle inicial ni en el HTML del servidor.
 *
 * Teclado: `cmdk` mueve la selección con las flechas, Inicio/Fin y trata Enter
 * sobre el elemento activo. Escape y la devolución del foco los pone el
 * diálogo de Radix que lo envuelve.
 */
export type CommandPaletteProps = {
  items: readonly CommandPaletteItem[];
  onClose: () => void;
  className?: string;
};

/** Agrupa por `group` conservando el orden de llegada de los grupos. */
function groupItems(
  items: readonly CommandPaletteItem[],
): Array<[string, CommandPaletteItem[]]> {
  const groups = new Map<string, CommandPaletteItem[]>();
  const fallback = t('command.groupDefault');

  for (const item of items) {
    const key = item.group ?? fallback;
    const bucket = groups.get(key);

    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return [...groups.entries()];
}

export function CommandPalette({
  items,
  onClose,
  className,
}: CommandPaletteProps) {
  const groups = useMemo(() => groupItems(items), [items]);

  return (
    <Command
      label={t('command.title')}
      className={cn('flex min-w-0 flex-col', className)}
    >
      {/*
        El foco del buscador se pinta en la fila completa (`has-[:focus-visible]`)
        y no en el `<input>`: el campo se autofoca al abrir y, sin esta señal, no
        habría ningún indicador visible de dónde está el foco del teclado.
        Los campos de texto siempre coinciden con `:focus-visible` al enfocarse.
      */}
      <div className="flex min-w-0 items-center gap-2 border-b border-border px-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-focus">
        <Search
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <Command.Input
          autoFocus
          placeholder={t('command.placeholder')}
          className="h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      <p className="px-3 pb-1 pt-2 text-xs text-muted-foreground">
        {t('command.description')}
      </p>
      <Command.List
        label={t('command.title')}
        className="max-h-[min(60dvh,22rem)] min-w-0 overflow-y-auto p-2"
      >
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
          {t('command.empty')}
        </Command.Empty>
        {groups.map(([group, entries]) => (
          <Command.Group
            key={group}
            heading={group}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {entries.map((item) => (
              <Command.Item
                key={item.id}
                value={item.label}
                onSelect={() => {
                  onClose();
                  item.onSelect();
                }}
                className="flex min-h-11 min-w-0 cursor-pointer items-center rounded-md px-3 text-sm text-foreground data-[selected=true]:bg-accent-muted data-[selected=true]:text-accent"
              >
                <span className="min-w-0">{item.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command>
  );
}
