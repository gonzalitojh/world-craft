'use client';

import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { t } from '@/messages';

/**
 * Isla interactiva del globo de ayuda.
 *
 * El disparador es un botón de icono con `aria-label` propio: el globo aparece
 * al enfocar o al pasar el ratón, pero nunca es la única etiqueta.
 */
export function TooltipDemo() {
  const label = t('design.components.tooltip.trigger');

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" aria-label={label}>
            <Search aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('design.components.tooltip.helper')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
