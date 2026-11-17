'use client';

import { useI18n } from '@/components/i18n/locale-provider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Isla interactiva de las pestañas.
 *
 * Tres vistas hermanas con su panel asociado; el teclado (flechas, Inicio y
 * Fin) lo aporta el primitivo de Radix.
 */
export function TabsDemo() {
  const { messages, t } = useI18n();
  const tabs = messages.design.components.tabs;

  return (
    <Tabs defaultValue="fichas" className="w-full min-w-0">
      <TabsList aria-label={t('design.components.tabs.title')}>
        <TabsTrigger value="fichas">{tabs.first}</TabsTrigger>
        <TabsTrigger value="relaciones">{tabs.second}</TabsTrigger>
        <TabsTrigger value="mapas">{tabs.third}</TabsTrigger>
      </TabsList>
      <TabsContent value="fichas">
        <p className="max-w-(--prose-max) min-w-0">{tabs.firstBody}</p>
      </TabsContent>
      <TabsContent value="relaciones">
        <p className="max-w-(--prose-max) min-w-0">{tabs.secondBody}</p>
      </TabsContent>
      <TabsContent value="mapas">
        <p className="max-w-(--prose-max) min-w-0">{tabs.thirdBody}</p>
      </TabsContent>
    </Tabs>
  );
}
