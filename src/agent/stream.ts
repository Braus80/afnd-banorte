// Hub de suscriptores SSE por surfaceId. Vive en memoria del proceso — ver
// nota de instancia única en ADR D13.
//
// D20: una sola conexión activa por surfaceId (A2UI.md sección 2: "una
// sesión = una surfaceId"). Si llega una conexión nueva para el mismo
// surfaceId, se cierra la vieja en el servidor en vez de dejarla huérfana.
// Bug real encontrado en vivo: recargas repetidas del navegador dejaban
// EventSource viejos sin cerrar del lado del servidor; Chrome límita a 6
// conexiones concurrentes por origen en HTTP/1.1 y ese pool se agotaba,
// dejando conexiones nuevas colgadas para siempre ("Cargando..." infinito)
// aunque curl contra el mismo endpoint funcionara perfecto.

type Enviar = (mensaje: unknown) => void;

interface Conexion {
  enviar: Enviar;
  cerrar: () => void;
}

const conexiones = new Map<string, Conexion>();

export function suscribir(surfaceId: string, enviar: Enviar, cerrar: () => void): () => void {
  const anterior = conexiones.get(surfaceId);
  if (anterior) {
    console.warn(`A2UI: nueva conexión SSE para ${surfaceId}, cerrando la anterior`);
    anterior.cerrar();
  }
  conexiones.set(surfaceId, { enviar, cerrar });
  return () => {
    if (conexiones.get(surfaceId)?.enviar === enviar) {
      conexiones.delete(surfaceId);
    }
  };
}

export function emitir(surfaceId: string, mensaje: unknown): void {
  conexiones.get(surfaceId)?.enviar(mensaje);
}
