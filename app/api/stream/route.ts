import { NextRequest } from "next/server";
import { sesionParaSurface, iniciarSesionSiEsNueva } from "@/src/agent/router";
import { suscribir } from "@/src/agent/stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 15_000;

export async function GET(req: NextRequest) {
  const surfaceId = req.nextUrl.searchParams.get("surfaceId") ?? "main";
  const sesion = sesionParaSurface(surfaceId);
  const encoder = new TextEncoder();

  let desuscribir: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let cerrada = false;

  const stream = new ReadableStream({
    start(controller) {
      // Primer byte YA, antes de cualquier await: si el cliente/proxy no ve
      // nada de inmediato, no sabe que la conexión está viva.
      controller.enqueue(encoder.encode(`: conectado\n\n`));

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, HEARTBEAT_MS);

      const enviar = (mensaje: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(mensaje)}\n\n`));
      };
      // cerrarConexion: la llama el hub si llega una conexión nueva para
      // este mismo surfaceId (D20) — termina esta respuesta del lado del
      // servidor para que el navegador libere el slot de conexión.
      const cerrarConexion = () => {
        if (cerrada) return;
        cerrada = true;
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // ya cerrado por el cliente, no pasa nada
        }
      };
      // Se suscribe ANTES de iniciar sesión para no perder mensajes que el
      // agente produzca durante ese arranque.
      desuscribir = suscribir(surfaceId, enviar, cerrarConexion);

      iniciarSesionSiEsNueva(sesion).catch((e) => {
        console.error("error iniciando sesión:", e);
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ mensaje: String(e) })}\n\n`)
        );
      });
    },
    cancel() {
      cerrada = true;
      if (heartbeat) clearInterval(heartbeat);
      desuscribir();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
