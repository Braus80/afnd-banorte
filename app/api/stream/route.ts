import { NextRequest } from "next/server";
import { sesionParaSurface, iniciarSesionSiEsNueva } from "@/src/agent/router";
import { suscribir } from "@/src/agent/stream";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const surfaceId = req.nextUrl.searchParams.get("surfaceId") ?? "main";
  const sesion = sesionParaSurface(surfaceId);
  const encoder = new TextEncoder();

  let cerrar: () => void = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const enviar = (mensaje: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(mensaje)}\n\n`));
      };
      cerrar = suscribir(surfaceId, enviar);

      // Primera sesión: dispara la bienvenida de Pixi. Se hace después de
      // suscribir para no perder los mensajes que emita.
      iniciarSesionSiEsNueva(sesion).catch((e) => {
        console.error("error iniciando sesión:", e);
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ mensaje: String(e) })}\n\n`)
        );
      });
    },
    cancel() {
      cerrar();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
