'use client';

import { useI18n } from '@/components/i18n/locale-provider';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
  type DrawerSide,
} from '@/components/ui/drawer';
import type { MessageKey } from '@/messages/translator';

/** Un disparador por cada borde del panel. */
const SIDES: ReadonlyArray<{ side: DrawerSide; labelKey: MessageKey }> = [
  { side: 'left', labelKey: 'design.components.drawer.left' },
  { side: 'right', labelKey: 'design.components.drawer.right' },
  { side: 'bottom', labelKey: 'design.components.drawer.bottom' },
];

/** Isla interactiva del panel lateral: los tres lados del componente. */
export function DrawerDemo() {
  const { t } = useI18n();

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      {SIDES.map(({ side, labelKey }) => (
        <Drawer key={side}>
          <DrawerTrigger asChild>
            <Button variant="outline">{t(labelKey)}</Button>
          </DrawerTrigger>
          <DrawerContent
            side={side}
            title={t('design.components.drawer.heading')}
            description={t('design.components.drawer.body')}
          >
            <DrawerClose asChild>
              <Button variant="outline" className="self-start">
                {t('common.close')}
              </Button>
            </DrawerClose>
          </DrawerContent>
        </Drawer>
      ))}
    </div>
  );
}
