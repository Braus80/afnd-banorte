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
