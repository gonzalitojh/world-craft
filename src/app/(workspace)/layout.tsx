import type { ReactNode } from 'react';

import { WorkspaceShell } from '@/components/shell/workspace-shell';

/**
 * Rutas del espacio de trabajo.
 *
 * Hoy solo alberga la página viva del sistema de diseño; cuando lleguen los
 * mundos, compartirán este rail y esta topbar.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
