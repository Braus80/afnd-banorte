// Bienvenida determinista (D28). Es el "Paso 1" del onboarding que describe
// el system prompt (docs/LOTE-V.md sección 6): antes la generaba el LLM al
// abrir el stream y el usuario veía "Cargando…" varios segundos. Como el
// contenido es fijo, se emite al instante sin LLM y se siembra en el
// historial como si el agente lo hubiera dicho, para que el siguiente turno
// ("hola", o elegir un perfil) siga teniendo contexto y no re-salude de cero.

import type { A2UIMessage } from "@/src/lib/a2ui";

export const TITULO_SURFACE = "Tu situación de crédito";

export const PROMPT_INICIO_SESION =
  "Inicia la sesión: preséntate como Pixy con una bienvenida cálida y ofrece elegir el perfil de accesibilidad.";

export function mensajesBienvenida(surfaceId: string): A2UIMessage[] {
  return [
    {
      version: "0.1",
      createSurface: { surfaceId, title: TITULO_SURFACE, profile: "normal" },
    },
    {
      version: "0.1",
      surfaceId,
      updateComponents: {
        root: {
          id: "col-bienvenida",
          type: "Column",
          children: [
            {
              id: "card-bienvenida",
              type: "ExplanationCard",
              title: "¡Hola! Soy Pixy",
              body:
                "Estoy aquí para ayudarte con tu tarjeta de crédito: revisamos tu deuda, comparamos planes de pago a tu medida y aplicamos el que mejor te acomode. Para empezar, dime cómo prefieres ver la información.",
            },
            {
              id: "chips-perfil",
              type: "SuggestionChips",
              items: [
                { label: "Letras grandes y sencillo", prompt: "Quiero ver la información en modo sencillo" },
                { label: "Normal", prompt: "Quiero ver la información en modo normal" },
                { label: "Detallado", prompt: "Quiero ver la información en modo detallado" },
              ],
            },
          ],
        },
      },
    },
  ];
}
