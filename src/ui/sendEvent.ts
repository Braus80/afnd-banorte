import type { EventoFront } from "@/src/lib/a2ui";

// El front no distingue camino directo de vía-agente: manda el mismo
// evento siempre — LOTE-V.md sección 5.
export async function sendEvent(evento: EventoFront): Promise<void> {
  await fetch("/api/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(evento),
  });
}
