// Memoria de conversación por sesión (D13): un Map en memoria del proceso,
// clave surfaceId ("una sesión = una surfaceId", A2UI.md sección 2). Se
// pierde en cada restart — se reemplaza por Tiger Data cuando exista L2.

import type { ChatMessage } from "@/src/lib/llm";
import type { Perfil } from "@/src/mcp/mock";

export interface SessionState {
  surfaceId: string;
  usuarioId: string;
  perfil: Perfil | null;
  dataModel: Record<string, unknown>;
  historial: ChatMessage[];
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
