// Enrutador de eventos (A2UI.md sección 5): simular/seleccionar_plan van
// directo (tool + updateDataModel, sin LLM); confirmar_plan/deshacer/
// mensaje_libre/chips van vía agente.

import { chat, CuotaAgotadaError } from "@/src/lib/llm";
import { TOOL_DECLARATIONS, ejecutarTool } from "@/src/agent/tools";
import { SYSTEM_PROMPT } from "@/src/agent/systemPrompt";
import { obtenerOCrearSesion, actualizarDataModel, type SessionState } from "@/src/agent/session";
import { emitir } from "@/src/agent/stream";
import { simular_planes, obtener_diagnostico, obtenerCatalogoPlanes, obtenerUsuarioId } from "@/src/mcp/tiger";
import type { PlanSimulado } from "@/src/mcp/tiger";
import { esMensajeA2UIValido, type A2UIMessage, type ComponentNode, type EventoFront } from "@/src/lib/a2ui";
import type { Perfil } from "@/src/mcp/mock";

const ACCIONES_DIRECTAS = new Set(["simular", "seleccionar_plan"]);
const ACCIONES_VIA_AGENTE = new Set(["confirmar_plan", "deshacer", "mensaje_libre"]);
const ACCIONES_CONOCIDAS = new Set([...ACCIONES_DIRECTAS, ...ACCIONES_VIA_AGENTE]);
const MAX_TURNOS_TOOL_CALLING = 5;
const PLAZO_DEFAULT = 12;
// Rutas fijas de la simulación (A2UI.md sección 3, ejemplo de updateDataModel).
// La tabla de planes lee /simulacion/planes y /simulacion/selectedKey; el
// modal de confirmación lee /simulacion/plazo, /simulacion/pagoMensual e
// /simulacion/interesTotal. El camino directo y la tool seleccionar_plan
// escriben exactamente aquí — fix P0 de selección de plan.
const RUTA_PLANES = "/simulacion/planes";
const RUTA_SELECCION = "/simulacion/selectedKey";

export function sesionParaSurface(surfaceId: string): SessionState {
  return obtenerOCrearSesion(surfaceId, obtenerUsuarioId());
}

export async function iniciarSesionSiEsNueva(sesion: SessionState): Promise<void> {
  if (sesion.perfil !== null || sesion.historial.length > 0) return;
  sesion.historial.push({
    role: "user",
    text: "Inicia la sesión: preséntate como Pixy con una bienvenida cálida y ofrece elegir el perfil de accesibilidad.",
  });
  await correrTurnoAgente(sesion);
}

export async function manejarEvento(evento: EventoFront): Promise<void> {
  const sesion = sesionParaSurface(evento.surfaceId);

  if (!ACCIONES_CONOCIDAS.has(evento.action)) {
    // Red debajo del fix de prompt que fija los 5 nombres de action: si el
    // LLM igual inventó uno, no se enruta a ciegas — se le devuelve como
    // corrección para que se autocorrija en el siguiente turno.
    console.warn(`action desconocido del front, se devuelve al LLM: ${evento.action}`);
    sesion.historial.push({
      role: "user",
      text: `action desconocido: ${evento.action}. Usa solo: simular, seleccionar_plan, confirmar_plan, deshacer, mensaje_libre.`,
    });
    await correrTurnoAgente(sesion);
    return;
  }

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
    const parcial: Record<string, unknown> = { "/simulacion/plazo": plazoMeses, [RUTA_PLANES]: resultado };
    // Si ya hay un plan elegido, sus cifras se mueven con el slider para que
    // el modal no muestre números de otro plazo.
    const seleccionado = resultado.find((p) => p.id === sesion.dataModel[RUTA_SELECCION]);
    if (seleccionado) Object.assign(parcial, cifrasDePlan(seleccionado));
    actualizarDataModel(sesion, parcial);
    emitir(sesion.surfaceId, { version: "0.1", surfaceId: sesion.surfaceId, updateDataModel: parcial });
    return;
  }

  if (evento.action === "seleccionar_plan") {
    const planId = String(evento.payload.planId ?? evento.payload.plan_id);
    await seleccionarPlan(sesion, planId);
    return;
  }

  console.warn(`acción directa desconocida, se ignora: ${evento.action}`);
}

function cifrasDePlan(plan: PlanSimulado): Record<string, unknown> {
  return {
    "/simulacion/plazo": plan.plazo_meses,
    "/simulacion/pagoMensual": plan.pago_mensual,
    "/simulacion/interesTotal": plan.interes_total,
    "/simulacion/tasa": plan.tasa,
  };
}

function planesEnSesion(sesion: SessionState): PlanSimulado[] | null {
  const v = sesion.dataModel[RUTA_PLANES];
  return Array.isArray(v) ? (v as PlanSimulado[]) : null;
}

// Selección de plan — la usan el camino directo (clic en la fila) y la tool
// seleccionar_plan (elección por texto). Escribe selectedKey y las cifras
// del plan en las rutas fijas y las emite; si aún no hay simulación en la
// sesión, simula al plazo vigente (o al default) y publica también las filas.
async function seleccionarPlan(sesion: SessionState, planId: string): Promise<Record<string, unknown>> {
  let planes = planesEnSesion(sesion);
  let plan = planes?.find((p) => p.id === planId);
  const parcial: Record<string, unknown> = {};
  if (!plan) {
    const plazo = Number(sesion.dataModel["/simulacion/plazo"]) || PLAZO_DEFAULT;
    const { saldo } = await obtener_diagnostico();
    planes = await simular_planes(
      saldo,
      obtenerCatalogoPlanes().map((p) => ({ id: p.id, plazoMeses: plazo }))
    );
    plan = planes.find((p) => p.id === planId);
    if (!plan) throw new Error(`plan desconocido: ${planId}`);
    parcial[RUTA_PLANES] = planes;
  }
  parcial[RUTA_SELECCION] = planId;
  Object.assign(parcial, cifrasDePlan(plan));
  actualizarDataModel(sesion, parcial);
  emitir(sesion.surfaceId, { version: "0.1", surfaceId: sesion.surfaceId, updateDataModel: parcial });
  return parcial;
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
    let respuesta;
    try {
      respuesta = await chat(sesion.historial, TOOL_DECLARATIONS, SYSTEM_PROMPT);
    } catch (e) {
      if (e instanceof CuotaAgotadaError) {
        console.error("cuota de Gemini agotada, no se reintenta:", e.message);
        emitirDescanso(sesion);
        return;
      }
      throw e;
    }

    if (respuesta.toolCalls.length > 0) {
      for (const llamada of respuesta.toolCalls) {
        sesion.historial.push({ role: "model", toolCall: llamada });
        // seleccionar_plan necesita la sesión (data model), así que se
        // resuelve aquí y no en ejecutarTool: mismo efecto que el clic.
        const resultado =
          llamada.name === "seleccionar_plan"
            ? await seleccionarPlanDesdeAgente(sesion, String(llamada.args.plan_id ?? llamada.args.planId))
            : await ejecutarTool(llamada.name, llamada.args);
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

async function seleccionarPlanDesdeAgente(sesion: SessionState, planId: string): Promise<unknown> {
  const parcial = await seleccionarPlan(sesion, planId);
  return {
    ok: true,
    selectedKey: planId,
    plazo_meses: parcial["/simulacion/plazo"],
    pago_mensual: parcial["/simulacion/pagoMensual"],
    interes_total: parcial["/simulacion/interesTotal"],
    tasa: parcial["/simulacion/tasa"],
    nota:
      "El data model ya tiene /simulacion/selectedKey, /simulacion/plazo, /simulacion/pagoMensual e /simulacion/interesTotal. " +
      "Responde AHORA, en este mismo turno, con updateComponents que incluya el ActionConfirmationModal (summary con $ref a esas cuatro rutas, action confirmar_plan) — el usuario ya eligió el plan.",
  };
}

function emitirDescanso(sesion: SessionState): void {
  emitir(sesion.surfaceId, {
    version: "0.1",
    surfaceId: sesion.surfaceId,
    updateComponents: {
      root: {
        id: "card-cuota-agotada",
        type: "ExplanationCard",
        title: "Un momento",
        body: "Pixy está descansando un momento, intenta en unos segundos.",
      },
    },
  });
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
  let aliasPlanes: string | null = null; // ruta que el LLM usó para las filas si no fue la fija
  for (const bruto of mensajes) {
    const m = normalizarMensaje(bruto, sesion.surfaceId);
    if (!esMensajeA2UIValido(m)) {
      console.warn("tipo de mensaje A2UI desconocido, se ignora:", m);
      continue;
    }
    const mensaje = m as A2UIMessage;
    if ("createSurface" in mensaje) {
      // A2UI.md sección 3: createSurface va una vez por sesión y solo se
      // repite si cambia el perfil. El front hace store.reset() con cada uno,
      // así que uno repetido borraría la simulación del navegador y el modal
      // saldría con "—". Repetido con el mismo perfil: se omite. Legítimo
      // (perfil nuevo): pasa y enseguida se rehidrata el store con el data
      // model que el servidor sí conserva.
      const perfilNuevo = (mensaje.createSurface.profile ?? "normal") as Perfil;
      if (sesion.perfilEmitido !== undefined && sesion.perfilEmitido === perfilNuevo) {
        console.warn("A2UI: createSurface repetido con el mismo perfil, se omite para no reiniciar el store del front");
        continue;
      }
      sesion.perfilEmitido = perfilNuevo;
      emitir(sesion.surfaceId, mensaje);
      if (Object.keys(sesion.dataModel).length > 0) {
        emitir(sesion.surfaceId, { version: "0.1", surfaceId: sesion.surfaceId, updateDataModel: { ...sesion.dataModel } });
      }
      continue;
    }
    if ("updateComponents" in mensaje) {
      aliasPlanes = normalizarTablaDePlanes(mensaje.updateComponents.root) ?? aliasPlanes;
    }
    if ("updateDataModel" in mensaje) {
      if (aliasPlanes && aliasPlanes in mensaje.updateDataModel && !(RUTA_PLANES in mensaje.updateDataModel)) {
        console.warn(`A2UI: el LLM publicó las filas en ${aliasPlanes}, se copian a ${RUTA_PLANES}`);
        mensaje.updateDataModel[RUTA_PLANES] = mensaje.updateDataModel[aliasPlanes];
      }
      actualizarDataModel(sesion, mensaje.updateDataModel);
    }
    emitir(sesion.surfaceId, mensaje);
  }
}

// Defensa contra deriva del LLM en la tabla de planes: el camino directo
// (D8) escribe SIEMPRE en /simulacion/planes y /simulacion/selectedKey, así
// que la tabla con action "seleccionar_plan" debe leer de ahí con $ref — un
// selectedKey literal nunca se resalta al hacer clic, y unas filas en otra
// ruta no se mueven con el slider. Devuelve la ruta alterna de filas que
// usó el LLM (para copiar sus datos) o null.
function normalizarTablaDePlanes(nodo: ComponentNode): string | null {
  let alias: string | null = null;
  const visitar = (n: ComponentNode) => {
    if (n.type === "ComparisonTable" && n.action === "seleccionar_plan") {
      const rows = n.rows as { $?: string } | undefined;
      if (rows && typeof rows === "object" && typeof rows.$ === "string" && rows.$ !== RUTA_PLANES) {
        console.warn(`A2UI: tabla de planes leía ${rows.$}, se apunta a ${RUTA_PLANES}`);
        alias = rows.$;
        n.rows = { $: RUTA_PLANES };
      }
      const sel = n.selectedKey as { $?: string } | string | null | undefined;
      const esRefCorrecta = typeof sel === "object" && sel !== null && sel.$ === RUTA_SELECCION;
      if (!esRefCorrecta) {
        if (typeof sel === "string") console.warn(`A2UI: selectedKey literal "${sel}" en tabla de planes, se cambia a $ref`);
        n.selectedKey = { $: RUTA_SELECCION };
      }
    }
    for (const hijo of (n.children as ComponentNode[] | undefined) ?? []) visitar(hijo);
  };
  visitar(nodo);
  return alias;
}

// Defensa contra deriva del LLM: a veces devuelve la forma plana
// { type: "createSurface", ... } en vez de la anidada del contrato
// ({ createSurface: {...} }). Se normaliza en vez de descartar en
// silencio — el contrato real sigue siendo docs/A2UI.md, esto es
// tolerancia de parseo, no un tipo de mensaje nuevo.
function normalizarMensaje(bruto: unknown, surfaceIdSesion: string): unknown {
  if (typeof bruto !== "object" || bruto === null) return bruto;
  const obj = bruto as Record<string, unknown>;
  if (typeof obj.type !== "string") return bruto;

  const { type, version, surfaceId, ...resto } = obj;
  const v = typeof version === "string" ? version : "0.1";
  const sid = typeof surfaceId === "string" ? surfaceId : surfaceIdSesion;

  if (type === "createSurface") {
    console.warn("A2UI: normalizando createSurface plano del LLM a forma anidada");
    return { version: v, createSurface: { surfaceId: sid, ...resto } };
  }
  if (type === "updateComponents") {
    console.warn("A2UI: normalizando updateComponents plano del LLM a forma anidada");
    const root =
      resto.root ?? (Array.isArray(resto.components) ? { id: "root", type: "Column", children: resto.components } : undefined);
    return { version: v, surfaceId: sid, updateComponents: { root } };
  }
  if (type === "updateDataModel") {
    console.warn("A2UI: normalizando updateDataModel plano del LLM a forma anidada");
    const { patch, ...datos } = resto;
    return { version: v, surfaceId: sid, updateDataModel: (patch as Record<string, unknown>) ?? datos };
  }
  return bruto;
}
