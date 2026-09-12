// Enrutador de eventos (A2UI.md sección 5): simular/seleccionar_plan van
// directo (tool + updateDataModel, sin LLM); confirmar_plan/deshacer/
// mensaje_libre/chips van vía agente.

import { chat } from "@/src/lib/llm";
import { TOOL_DECLARATIONS, ejecutarTool } from "@/src/agent/tools";
import { SYSTEM_PROMPT } from "@/src/agent/systemPrompt";
import { obtenerOCrearSesion, actualizarDataModel, type SessionState } from "@/src/agent/session";
import { emitir } from "@/src/agent/stream";
import { simular_planes, obtener_diagnostico, obtenerCatalogoPlanes, obtenerUsuarioId } from "@/src/mcp/mock";
import { esMensajeA2UIValido, type A2UIMessage, type EventoFront } from "@/src/lib/a2ui";
import type { Perfil } from "@/src/mcp/mock";

const ACCIONES_DIRECTAS = new Set(["simular", "seleccionar_plan"]);
const MAX_TURNOS_TOOL_CALLING = 5;

export function sesionParaSurface(surfaceId: string): SessionState {
  return obtenerOCrearSesion(surfaceId, obtenerUsuarioId());
}

export async function iniciarSesionSiEsNueva(sesion: SessionState): Promise<void> {
  if (sesion.perfil !== null || sesion.historial.length > 0) return;
  sesion.historial.push({
    role: "user",
    text: "Inicia la sesión: preséntate como Pixi con una bienvenida cálida y ofrece elegir el perfil de accesibilidad.",
  });
  await correrTurnoAgente(sesion);
}

export async function manejarEvento(evento: EventoFront): Promise<void> {
  const sesion = sesionParaSurface(evento.surfaceId);
  if (ACCIONES_DIRECTAS.has(evento.action)) {
    await manejarDirecto(sesion, evento);
  } else {
    await manejarViaAgente(sesion, evento);
  }
}

async function manejarDirecto(sesion: SessionState, evento: EventoFront): Promise<void> {
  if (evento.action === "simular") {
    const plazoMeses = Number(evento.payload.valor ?? evento.payload.plazoMeses ?? evento.payload.plazo);
    const { saldo } = await obtener_diagnostico();
    const planes = obtenerCatalogoPlanes().map((p) => ({ id: p.id, plazoMeses }));
    const resultado = await simular_planes(saldo, planes);
    const parcial = { "/simulacion/plazo": plazoMeses, "/simulacion/planes": resultado };
    actualizarDataModel(sesion, parcial);
    emitir(sesion.surfaceId, { version: "0.1", surfaceId: sesion.surfaceId, updateDataModel: parcial });
    return;
  }

  if (evento.action === "seleccionar_plan") {
    const planId = String(evento.payload.planId ?? evento.payload.plan_id);
    const parcial = { "/simulacion/selectedKey": planId };
    actualizarDataModel(sesion, parcial);
    emitir(sesion.surfaceId, { version: "0.1", surfaceId: sesion.surfaceId, updateDataModel: parcial });
    return;
  }

  console.warn(`acción directa desconocida, se ignora: ${evento.action}`);
}

async function manejarViaAgente(sesion: SessionState, evento: EventoFront): Promise<void> {
  const texto = construirTextoDesdeEvento(sesion, evento);
  sesion.historial.push({ role: "user", text: texto });
  await correrTurnoAgente(sesion);
}

function construirTextoDesdeEvento(sesion: SessionState, evento: EventoFront): string {
  const estado = `Estado actual del data model: ${JSON.stringify(sesion.dataModel)}.`;
  if (evento.action === "mensaje_libre") {
    return `${String(evento.payload.texto ?? "")}\n\n(${estado})`;
  }
  if (evento.action === "confirmar_plan") {
    const confirmado = Boolean(evento.payload.confirmado);
    return confirmado
      ? `El usuario confirmó aplicar el plan seleccionado. ${estado} Acción: confirmar_plan, payload.confirmado=true.`
      : `El usuario canceló el modal de confirmación, no aplicar nada. ${estado} Acción: confirmar_plan, payload.confirmado=false.`;
  }
  if (evento.action === "deshacer") {
    return `El usuario pidió deshacer el último plan aplicado. ${estado} Acción: deshacer.`;
  }
  return `Acción: ${evento.action}. Payload: ${JSON.stringify(evento.payload)}. ${estado}`;
}

async function correrTurnoAgente(sesion: SessionState): Promise<void> {
  for (let i = 0; i < MAX_TURNOS_TOOL_CALLING; i++) {
    const respuesta = await chat(sesion.historial, TOOL_DECLARATIONS, SYSTEM_PROMPT);

    if (respuesta.toolCalls.length > 0) {
      for (const llamada of respuesta.toolCalls) {
        sesion.historial.push({ role: "model", toolCall: llamada });
        const resultado = await ejecutarTool(llamada.name, llamada.args);
        sesion.historial.push({ role: "user", toolResult: { name: llamada.name, result: resultado } });
        if (llamada.name === "guardar_perfil") {
          sesion.perfil = llamada.args.perfil as Perfil;
        }
      }
      continue;
    }

    if (respuesta.text) {
      sesion.historial.push({ role: "model", text: respuesta.text });
      procesarSalidaAgente(sesion, respuesta.text);
    }
    return;
  }
  throw new Error("el agente no resolvió dentro del máximo de turnos de tool-calling");
}

function procesarSalidaAgente(sesion: SessionState, textoJson: string): void {
  let parseado: unknown;
  try {
    const limpio = textoJson.trim().replace(/^```json\s*|```\s*$/g, "");
    parseado = JSON.parse(limpio);
  } catch (e) {
    console.error("salida del agente no es JSON válido, se ignora:", textoJson, e);
    return;
  }

  const mensajes = Array.isArray(parseado) ? parseado : [parseado];
  for (const m of mensajes) {
    if (!esMensajeA2UIValido(m)) {
      console.warn("tipo de mensaje A2UI desconocido, se ignora:", m);
      continue;
    }
    const mensaje = m as A2UIMessage;
    if ("updateDataModel" in mensaje) {
      actualizarDataModel(sesion, mensaje.updateDataModel);
    }
    emitir(sesion.surfaceId, mensaje);
  }
}
