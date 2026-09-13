// Memoria de conversación por sesión (D13): un Map en memoria del proceso,
// clave surfaceId ("una sesión = una surfaceId", A2UI.md sección 2). Se
// pierde en cada restart — se reemplaza por Tiger Data cuando exista L2.

import type { ChatMessage } from "@/src/lib/llm";
import type { ComponentNode } from "@/src/lib/a2ui";
import type { Perfil } from "@/src/mcp/mock";

export interface SessionState {
  surfaceId: string;
  usuarioId: string;
  perfil: Perfil | null;
  dataModel: Record<string, unknown>;
  historial: ChatMessage[];
  // Último createSurface que llegó al front (perfil). El router omite los
  // repetidos con el mismo perfil: cada createSurface reinicia el store del
  // navegador y borraría /simulacion/* — fix P0 de selección de plan.
  perfilEmitido?: Perfil | null;
  // Último árbol (updateComponents) que llegó al front. Con él se rehidrata
  // una conexión nueva sobre una sesión que ya existe (recarga de página):
  // el usuario vuelve a la pantalla en la que estaba, no a la bienvenida (D28).
  ultimoRoot?: ComponentNode;
  // true mientras correrTurnoAgente espera al LLM: una conexión nueva en ese
  // lapso no recibe ultimoRoot (podría reexponer un modal ya accionado).
  turnoEnCurso?: boolean;
}

const sesiones = new Map<string, SessionState>();

export function obtenerOCrearSesion(surfaceId: string, usuarioId: string): SessionState {
  let sesion = sesiones.get(surfaceId);
  if (!sesion) {
    sesion = { surfaceId, usuarioId, perfil: null, dataModel: {}, historial: [] };
    sesiones.set(surfaceId, sesion);
  }
  return sesion;
}

export function actualizarDataModel(sesion: SessionState, parcial: Record<string, unknown>): void {
  Object.assign(sesion.dataModel, parcial);
}
