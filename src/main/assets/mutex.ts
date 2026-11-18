/**
 * Cerrojo de las operaciones de assets.
 *
 * La importación y la purga comparten una única cola en el proceso principal:
 * una purga no puede planificar mientras una importación está publicando
 * archivos y aún no ha insertado su fila, ni una importación puede publicar
 * mientras la purga está copiando y borrando. Al serializarlas, el plan de la
 * purga siempre se calcula con el estado definitivo de la base.
 *
 * No sustituye a la validación de rutas: el cerrojo evita carreras dentro de la
 * aplicación, no ataques externos al sistema de archivos.
 */

let queue: Promise<unknown> = Promise.resolve();

/** Ejecuta `task` en exclusiva, en orden de llegada. */
export function withAssetLock<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);

  // La cola avanza aunque la tarea falle: un error nunca bloquea las siguientes.
  queue = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}
