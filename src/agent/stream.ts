// Hub de suscriptores SSE por surfaceId. Vive en memoria del proceso — ver
// nota de instancia única en ADR D13.

type Enviar = (mensaje: unknown) => void;

const suscriptores = new Map<string, Set<Enviar>>();

export function suscribir(surfaceId: string, enviar: Enviar): () => void {
  let set = suscriptores.get(surfaceId);
  if (!set) {
    set = new Set();
    suscriptores.set(surfaceId, set);
  }
  set.add(enviar);
  return () => {
    set!.delete(enviar);
    if (set!.size === 0) suscriptores.delete(surfaceId);
  };
}

export function emitir(surfaceId: string, mensaje: unknown): void {
  const set = suscriptores.get(surfaceId);
  if (!set) return;
  for (const enviar of set) enviar(mensaje);
}
