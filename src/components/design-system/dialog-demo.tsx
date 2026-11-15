'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { t } from '@/messages';

/**
 * Isla interactiva del diálogo.
 *
 * Vive en un componente cliente propio para que la página de muestra pueda ser
 * un Server Component: `Dialog` necesita estado y no se puede serializar desde
 * el servidor.
 */
export function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          {t('design.components.dialog.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={t('design.components.dialog.heading')}
        description={t('design.components.dialog.body')}
      >
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('common.cancel')}</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>{t('design.components.dialog.confirm')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
