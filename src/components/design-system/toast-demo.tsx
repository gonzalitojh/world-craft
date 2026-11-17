'use client';

import { useI18n } from '@/components/i18n/locale-provider';
import { Button } from '@/components/ui/button';
import { useToast, type ToastVariant } from '@/components/ui/toast';
import type { MessageKey } from '@/messages/translator';

/**
 * Isla interactiva de los avisos.
 *
 * Cuatro disparadores, uno por variante. El aviso se anuncia en la región viva
 * del proveedor (`ToastProvider`, en el layout raíz) y se cierra con su botón o
 * esperando su duración; el error no se cierra solo.
 */
const VARIANTS: ReadonlyArray<{
  variant: ToastVariant;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  buttonVariant: 'default' | 'outline' | 'destructive';
}> = [
  {
    variant: 'info',
    titleKey: 'design.components.toast.info',
    bodyKey: 'design.components.toast.infoBody',
    buttonVariant: 'outline',
  },
  {
    variant: 'success',
    titleKey: 'design.components.toast.success',
    bodyKey: 'design.components.toast.successBody',
    buttonVariant: 'outline',
  },
  {
    variant: 'warning',
    titleKey: 'design.components.toast.warning',
    bodyKey: 'design.components.toast.warningBody',
    buttonVariant: 'outline',
  },
  {
    variant: 'error',
    titleKey: 'design.components.toast.error',
    bodyKey: 'design.components.toast.errorBody',
    buttonVariant: 'destructive',
  },
];

export function ToastDemo() {
  const { toast } = useToast();
  const { messages, t } = useI18n();
  const labels = messages.design.components.toast;

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      {VARIANTS.map(({ variant, titleKey, bodyKey, buttonVariant }) => (
        <Button
          key={variant}
          variant={buttonVariant}
          onClick={() => {
            toast({ title: t(titleKey), description: t(bodyKey), variant });
          }}
        >
          {labels[variant]}
        </Button>
      ))}
    </div>
  );
}
