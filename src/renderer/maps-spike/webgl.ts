/**
 * Sonda WebGL2 del laboratorio de mapas (#80).
 *
 * Se mantiene fuera del hook y sin MapLibre para poder probarla en jsdom con
 * un doble de `getContext`. Crea un lienzo desechable y libera el contexto:
 * MapLibre 6 exige WebGL2 y no debe montarse si la sesión no lo ofrece.
 */
export function supportsWebGl2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');

    if (context === null) {
      return false;
    }

    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
