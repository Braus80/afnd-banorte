# DECISIONS.md — ADRs

Formato: regla, razón, qué se corta si falta tiempo.

## D1 — Stack

TypeScript de punta a punta, Next.js (App Router), agente y servidor MCP viven como rutas API dentro de la misma app.
Razón: un solo repo, un solo deploy, un solo lenguaje — menos superficie de fallo en 48 h.
Si falta tiempo: no se separa nunca en microservicios; se corta antes cualquier feature nueva.

## D2 — Deploy

DigitalOcean App Platform, deploy automático desde `main` vía integración con GitHub.
Razón: buildpack detecta Next.js sin Dockerfile, y el equipo ya no depende de logins individuales por push.
Si falta tiempo: se corta cualquier configuración de dominio propio; queda la URL `*.ondigitalocean.app`.

## D3 — LLM

Gemini Flash detrás de un único módulo `llm.ts` con interfaz fija, seleccionable por variable de entorno (`LLM_PROVIDER`).
Razón: Flash es rápido y barato para demo en vivo; el módulo aislado permite cambiar de proveedor sin tocar el resto del agente.
Si falta tiempo: se corta soporte multi-proveedor real; queda solo Gemini implementado, el resto son stubs.

## D4 — A2UI propio

Subconjunto propio de A2UI (tres mensajes, seis componentes) definido en `docs/A2UI.md`, con renderer propio en el front — no se usa librería A2UI de terceros.
Razón: controlar el catálogo exacto que necesita el demo sin arrastrar una spec completa que no se va a implementar en 48 h.
Si falta tiempo: se corta a los dos componentes del camino feliz (`ScheduleList` y `ExplanationCard` son los primeros en caer).

## D5 — Caso de uso

Reestructuración de deuda de tarjeta de crédito: diagnóstico, simulación de planes, selección, confirmación y calendario de pagos.
Razón: caso concreto y acotado que cubre lectura y escritura de datos, con un flujo de decisión visualizable en UI generativa.
Si falta tiempo: se corta el flujo de "deshacer" y la segunda intención (bloquear tarjeta); el camino feliz de un solo plan queda intacto.

## D6 — Dueño de cada lote

Lote 0 (repo/infra), Lote 1 (front/renderer), Lote 2 (datos/MCP), Lote 3 (agente/LLM) — un dueño por lote, definido por el equipo antes de arrancar Lote 1.
Razón: paralelizar 48 h entre 4 personas sin bloqueos cruzados; `docs/A2UI.md` es el contrato que permite que L1 y L3 avancen sin coordinarse en vivo.
Si falta tiempo: se corta la rotación de dueños; quien abrió el lote lo cierra.

## D7 — Tiger Data en vez de SQLite

Persistencia en Tiger Data (plan gratuito) en vez de SQLite.
Razón: DigitalOcean App Platform tiene filesystem efímero por deploy — SQLite local se borra en cada redeploy.
Si falta tiempo: se corta cualquier feature de historial/analytics; solo se persiste el estado mínimo para `aplicar_plan`.

## D8 — Eventos directos sin LLM

Los eventos `simular` y `seleccionar_plan` llaman la tool MCP directo y responden con `updateDataModel`; no pasan por el LLM.
Razón: latencia de milisegundos en la interacción más frecuente del demo (mover el slider) — pasar por el LLM ahí se siente lento y es innecesario porque no hay decisión que tomar.
Si falta tiempo: se corta cualquier otro atajo directo nuevo; esta distinción de dos caminos no se toca porque es la que hace sentir rápido al demo.

## D12 — Perfil de accesibilidad

`profile` es un campo de `createSurface` con tres valores cerrados (`sencillo`, `normal`, `detallado`); el renderer aplica escala, contraste y densidad — no hay componentes distintos por perfil.
Razón: mismo catálogo de siete componentes para los tres perfiles evita triplicar lógica de agente y de renderer en 48 h; la diferencia es visual, no estructural.
Si falta tiempo: se corta `SuggestionChips` después de cada pantalla (quedan solo en la bienvenida) y el modo `detallado` (quedan `sencillo` y `normal`).

## D13 — Estado en memoria de un solo proceso

Sesión (`src/agent/session.ts`) y hub de SSE (`src/agent/stream.ts`) viven en `Map` de memoria del proceso Node, no en Tiger Data.
Razón: no bloquear el slice vertical en L2; funciona porque DigitalOcean App Platform corre una sola instancia persistente (no serverless por request) — D2.
Si falta tiempo: no se migra a Tiger Data en este lote; se acepta que un restart/redeploy borra toda sesión activa.

## D14 — Salida del LLM es un array JSON de mensajes A2UI

El agente responde con un array JSON de uno o más mensajes A2UI en un mismo turno (p.ej. `createSurface` + `updateComponents` juntos al abrir sesión), no un mensaje por turno.
Razón: A2UI.md no especifica el empaquetado de turno-a-mensajes y el flujo (sección 6, paso 1) necesita emitir dos mensajes en la misma respuesta.
Si falta tiempo: no se cambia; es la única forma sin tocar el contrato de que createSurface y la bienvenida salgan juntos.

## D15 — Gemini sin SDK

`src/lib/llm.ts` llama la API de Gemini con `fetch` directo, sin `@google/generative-ai` ni otro SDK.
Razón: una dependencia menos que pueda romper el build en 48 h (D1); la superficie usada (generateContent + function calling) es pequeña y estable.
Si falta tiempo: se corta soporte a features avanzadas de Gemini (streaming de respuesta, multimodal); el tool-calling básico ya cubre el demo.

## D16 — Nombres de campo de `simular_planes` y `recomendado`

Cada plan de `simular_planes` trae `{ id, tasa, plazo_meses, pago_mensual, interes_total, recomendado }` en snake_case; `recomendado: true` se calcula en la tool (menor `interes_total`), no en el front ni en el agente.
Razón: docs/LOTE-V.md sección 5 exige esos nombres literales para el badge "Recomendado" y la atenuación de filas contra `/presupuesto`; calcularlo una sola vez en la tool evita que agente y front diverjan en el criterio.
Si falta tiempo: no se toca; L2 real debe respetar esta misma forma de salida al reemplazar el mock.

## D17 — Tokens de perfil con CSS puro, sin Tailwind

`src/ui/a2ui.css` implementa la tabla de tokens de LOTE-V.md sección 5 con variables CSS y selectores `[data-profile]`, sin instalar Tailwind.
Razón: el efecto visual es idéntico con una décima parte del setup; D1 ya prioriza minimizar dependencias, y el catálogo de tokens es fijo y chico (5 filas × 3 perfiles).
Si falta tiempo: no se migra a Tailwind en este hackathon; si un lote futuro lo necesita para algo más grande, es su propio ADR.

## D18 — El agente se llama Pixy

El agente se llama "Pixy" (con y), no "Pixi" — renombrado en systemPrompt.ts, router.ts y copy visible del front.

## D19 — Default de GEMINI_MODEL: gemini-3.5-flash-lite

Default de \`GEMINI_MODEL\` es \`gemini-3.5-flash-lite\` (consultado en vivo vía GET /v1beta/models: el más reciente de la familia flash-lite sin "preview" ni "exp" — se descartan \`gemini-flash-lite-latest\` por ser alias flotante y \`gemini-3.1-flash-lite-image\` por ser variante de imagen).
Razón: cuota diaria del nivel gratuito es ~1,000 RPD en Flash-Lite contra 20 RPD en los modelos preview/experimentales que se probaron antes — la demo no puede depender de una cuota que se agota en la primera ronda de pruebas.
Si falta tiempo: no se reevalúa el modelo salvo que Google lo descontinúe; cambiar de modelo es una sola variable de entorno.
