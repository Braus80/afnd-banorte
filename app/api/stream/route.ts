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

  let cerrar: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval> | null = null;

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
      // Se suscribe ANTES de iniciar sesión para no perder mensajes que el
      // agente produzca durante ese arranque.
      cerrar = suscribir(surfaceId, enviar);

      iniciarSesionSiEsNueva(sesion).catch((e) => {
        console.error("error iniciando sesión:", e);
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ mensaje: String(e) })}\n\n`)
        );
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      cerrar();
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
