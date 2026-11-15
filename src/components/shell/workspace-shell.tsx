import type { ReactNode } from 'react';

import { AppRail } from '@/components/shell/app-rail';
import { BottomBar } from '@/components/shell/bottom-bar';
import { Topbar } from '@/components/shell/topbar';

/**
 * Shell del espacio de trabajo.
 *
 * Rejilla de dos columnas desde `md`: el rail (ancho por token) y el
 * contenido. La topbar va fuera de la rejilla para ocupar el ancho completo y
 * quedarse pegada arriba al hacer scroll.
 *
 * Orden del documento = orden del teclado: topbar, rail y contenido. Así el
 * enlace de salto lleva al contenido sin atravesar antes la navegación
 * lateral, y quien navega con teclado entiende la estructura.
 *
 * El `main` reserva en móvil el alto de la barra inferior más el área segura
 * del dispositivo (`--bottombar-height` + `env(safe-area-inset-bottom)`), de
 * modo que el último elemento de la página siempre queda por encima de la
 * barra y se puede alcanzar.
 */
type WorkspaceShellProps = {
  children: ReactNode;
};

export function WorkspaceShell({ children }: WorkspaceShellProps) {
  return (
    <>
      <Topbar variant="workspace" />
      <div className="min-w-0 md:grid md:min-h-[calc(100dvh-var(--topbar-height))] md:grid-cols-[auto_minmax(0,1fr)]">
        <AppRail />
        <main
          id="contenido"
          tabIndex={-1}
          className="min-w-0 flex-1 pb-[calc(var(--bottombar-height)+env(safe-area-inset-bottom))] md:pb-0"
        >
          {children}
        </main>
      </div>
      <BottomBar />
    </>
  );
}
