// Tipos del contrato en docs/A2UI.md. No se cambian sin ADR — ver ese archivo.

export type Profile = "sencillo" | "normal" | "detallado";

export interface ComponentNode {
  id: string;
  type: string;
  [prop: string]: unknown;
}

export interface CreateSurfaceMessage {
  version: string;
  createSurface: { surfaceId: string; title: string; profile?: Profile };
}

export interface UpdateComponentsMessage {
  version: string;
  surfaceId: string;
  updateComponents: { root: ComponentNode };
}

export interface UpdateDataModelMessage {
  version: string;
  surfaceId: string;
  updateDataModel: Record<string, unknown>;
}

export type A2UIMessage =
  | CreateSurfaceMessage
  | UpdateComponentsMessage
  | UpdateDataModelMessage;

export function esMensajeA2UIValido(m: unknown): m is A2UIMessage {
  if (typeof m !== "object" || m === null) return false;
  return "createSurface" in m || "updateComponents" in m || "updateDataModel" in m;
}

// Cuerpo de POST /api/event — sección 5 del contrato.
export interface EventoFront {
  surfaceId: string;
  componentId: string;
  action: string;
  payload: Record<string, unknown>;
  ts: number;
}
