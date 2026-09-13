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

## D10 — deshacer revierte solo el último plan aplicado

`deshacer_plan` en `src/mcp/mock.ts` guarda un solo `planAplicado` por cuenta (no una pila de historial): deshacer siempre vuelve a "sin plan", nunca a un plan anterior a ese.
Razón: el flujo del demo (A2UI.md sección 6) solo pide revertir el paso inmediato anterior; una pila de historial es complejidad que nadie usa en 48 h.
Si falta tiempo: no se agrega historial multi-nivel; L2 real puede hacerlo si el caso de uso lo pide después.

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

## D20 — Una sola conexión SSE activa por surfaceId

El hub de `src/agent/stream.ts` cierra en el servidor la conexión SSE anterior de un `surfaceId` cuando llega una nueva, en vez de dejarlas coexistir.
Razón: bug real en vivo — recargas repetidas del navegador dejaban `EventSource` huérfanos sin cerrar; Chrome limita a 6 conexiones concurrentes por origen en HTTP/1.1 (`next start` no sirve HTTP/2), agotando el pool y colgando conexiones nuevas para siempre aunque el servidor respondiera bien (confirmado con curl).
Si falta tiempo: no se resuelve con HTTP/2 (requiere TLS/servidor custom); esta es la solución mínima consistente con "una sesión = una surfaceId" de A2UI.md sección 2.

## D21 — Voz de Pixy con ElevenLabs Text to Speech, bajo demanda

`POST /api/voz` recibe `{ texto }` y devuelve `audio/mpeg` generado con la API de Text to Speech de ElevenLabs (`eleven_flash_v2_5`, `language_code: "es"`), con `ELEVENLABS_API_KEY` solo en el servidor, timeout de 8 s y caché en memoria por texto. Cualquier fallo (key ausente, error del proveedor, timeout) responde `503` sin cuerpo. No se usa ElevenAgents: el agente sigue siendo Gemini (D3); ElevenLabs solo convierte texto en audio.
Razón: la lectura en voz alta es accesibilidad para el perfil `sencillo` (D12) y no puede costar latencia al render ni créditos por pantalla — por eso solo se genera cuando el usuario toca la bocina, nunca automático, y se cachea por texto. `eleven_flash_v2_5` es el único modelo vigente que acepta `language_code` (multilingual_v2 lo rechaza; turbo_v2_5 está deprecado) y el de menor latencia. La voz se elige por `ELEVENLABS_VOICE_ID` (default: premade multilingüe) para poder poner un acento latino de la Voice Library sin tocar código.
Si falta tiempo: se corta la voz completa quitando el botón; el resto del demo no depende de ella (503 = botón vuelve a inactivo y nada más cambia).

## D22 — El estado de voz vive fuera del árbol A2UI

La bocina de `ExplanationCard` y el estado `inactivo | cargando | reproduciendo` viven en `src/ui/voz.ts`, un módulo del shell con `useSyncExternalStore`; `PixyBubble` deriva "hablando" de ahí. No se agregan props al contrato (`docs/A2UI.md` sección 4 queda igual), no se toca el `store` del data model, el `Renderer` ni el router de eventos.
Razón: leer en voz alta es una capacidad del front, no una intención del agente — el JSON del LLM no debe saber que existe. Mantenerlo fuera del store evita que un `updateDataModel` o un `reset()` de `createSurface` pisen el estado de audio, y evita reabrir el contrato por una feature experimental.
Si falta tiempo: no se lleva la voz a otros componentes (StatCard, ScheduleList); solo `ExplanationCard`, que es donde vive el texto que vale la pena escuchar.

## D23 — Lectura continua: el modo vive en el módulo de voz y se dispara al montar la tarjeta

Tocar la bocina de una `ExplanationCard` lee esa tarjeta y enciende `modoContinuo` en `src/ui/voz.ts`; mientras esté encendido, cada `ExplanationCard` que se monta (llegó por `updateComponents`) llama `leerAutomatico` desde su efecto de montaje. Los montajes de un mismo commit de React se agrupan en un lote (microtask): un lote nuevo corta lo que sonaba, se lee su primera tarjeta y las demás esperan turno — un solo audio a la vez. Volver a tocar la bocina apaga el modo y detiene el audio; el botón lo refleja con `aria-pressed` y `aria-label` "Desactivar lectura automática". Un fallo de `/api/voz` no apaga el modo: esa tarjeta no suena y la cola avanza.
Razón: el Renderer no sabe qué tarjeta es "nueva" — el componente que se monta sí, y ahí ya está el texto resuelto. Poner el flag en el módulo de voz (no en el store ni en el árbol) mantiene D22: `reset()` de `createSurface` y `updateDataModel` no lo tocan, y el JSON del agente sigue sin saber que la voz existe. El lote por microtask es lo mínimo para que dos tarjetas del mismo `updateComponents` no se pisen entre sí.
Si falta tiempo: el modo no se persiste entre recargas (sin `localStorage`); se apaga con la página. No se extiende a otros componentes.

## D24 — Segunda intención (gastos) con el mismo catálogo: una tool nueva y guía en el prompt, sin componentes ni caminos directos nuevos

"¿En qué se me va el dinero?" se resuelve con la tool `obtener_movimientos(usuario_id)` en `src/mcp/mock.ts` (movimientos del último mes agrupados por categoría, total desc, más `total_mes`) y una sección del system prompt que guía la composición con los siete componentes existentes: `ExplanationCard` (patrón), `StatCard` (total del mes), `ComparisonTable` reutilizada como desglose por categoría con `action: null`, `ScheduleList` con los últimos movimientos de la categoría mayor y `SuggestionChips` ("¿Cómo reduzco esto?", "Ver otra categoría", "Volver a mi deuda"). La composición final la decide el LLM. Todo va vía agente (`mensaje_libre`), sin nuevo camino directo en el router (D8). El mock replica literalmente las filas de Sofía de `db/seed.sql` y documenta el SQL equivalente para `tiger.ts`.
Razón: el criterio de adaptabilidad del demo (A2UI.md sección 6, paso 6) es "misma biblioteca, intención distinta, composición distinta" — agregar un componente de gastos lo contradiría. `ComparisonTable` con `action: null` ya está previsto en el contrato (sección 4: `action: string | null`), así que no hay cambio de contrato. Sin camino directo porque aquí sí hay decisión que tomar (qué categoría destacar, qué decir); D8 reserva lo directo para interacciones sin decisión. El perfil `sencillo` no requiere código: el renderer ya aplica tokens por `data-profile`; lo único que depende del agente es emitir dos columnas en vez de tres, y eso va en el prompt.
Si falta tiempo: la vista se simplifica a `ExplanationCard` + `StatCard` + `SuggestionChips` (se caen tabla y lista); la tool y el prompt quedan iguales.

## D25 — Tools contra Tiger Cloud en `src/mcp/tiger.ts`, mismas firmas que el mock, solo detrás de `tools.ts`

`src/mcp/tiger.ts` implementa con `pg.Pool` (leyendo `DATABASE_URL`, nunca la cadena en código) las mismas firmas de `src/mcp/mock.ts` — ese archivo sigue siendo el contrato y `tiger.ts` importa sus tipos para no divergir. `aplicar_plan` y `deshacer_plan` corren en transacción (`BEGIN`/`COMMIT`/`ROLLBACK` sobre un `client` del pool) con `FOR UPDATE` sobre la cuenta. `aplicar_plan` inserta en `planes_aplicados`, pone la tarjeta en `reestructurado` y su `saldo_actual` en el total a pagar bajo el plan (capital tras descuento + interés total); si ya había plan activo, lo revierte primero. `deshacer_plan` restaura `saldo_inicial` y `activo` y **borra** la fila: el criterio es que la base vuelva al estado inicial exacto, por encima del comentario "bitácora" de `db/esquema.sql` (si se prefiere bitácora: `UPDATE ... estado = 'cancelado'` y contar `WHERE estado = 'activo'`). `simular_planes` es la matemática del mock copiada tal cual; el descuento (`descuento_principal_porcentaje`) se resta del principal antes de amortizar en `aplicar_plan`. Si `DATABASE_URL` no está, el módulo lanza al cargar con mensaje claro; `connectionTimeoutMillis: 5000` evita colgarse si la base no responde. Solo cambia el import de `src/agent/tools.ts`; `router.ts` sigue en el mock para el camino directo (D8).
Razón: reemplazar el mock sin tocar agente ni router era la promesa de D1/D13 ("misma firma, cambia el import"); la transacción evita medio plan aplicado si falla el `UPDATE` de la cuenta; borrar en deshacer hace idempotente el ensayo del demo (aplicar/deshacer N veces deja la base igual).
Limitación conocida: el slider (`simular` directo en `router.ts`) sigue actualizando la memoria del mock, no la de `tiger.ts`; `aplicar_plan` usa el plazo de la última `simular_planes` que el agente llamó vía tools, y si no hubo, el `plazo_meses` del plan en `planes_credito`. Cambiar también el import del router (una línea) cierra esa brecha.
Si falta tiempo: se abandona la rama y el demo queda con mocks; `DATABASE_URL` sin definir en build también rompe `next build` (el módulo lanza al cargar y Next lo importa al recolectar rutas), así que la variable debe existir en build y run en DigitalOcean.

## D26 — Logo de Banorte en el header

`public/logo-banorte.svg` (el logo oficial recoloreado a blanco) va en el header rojo, a la izquierda del saludo, a 26 px de alto (30 px en sencillo). Sustituye la regla de LOTE-V.md sección 5 "sin logo ni nombre de Banorte en ningún componente": el logo vive solo en el header, que es shell; los siete componentes del catálogo siguen sin marca.
Razón: es el reto oficial de Banorte y el logo en el demo es apropiado; la regla original protegía de que la marca se colara dentro de componentes generados por el LLM, y eso se mantiene.
Si falta tiempo: se deja el `<img>` tal cual; no se agrega favicon ni variantes.

## D27 — Glassmorfismo por tokens, con excepción total en el perfil sencillo

Tarjetas (`.a2ui-card`: ExplanationCard, StatCard, tablas, listas, modal), iconos de chips y barra de entrada usan `--card-bg` y `--card-blur`, que en normal/detallado resuelven a `--glass-bg` (blanco 0.70), `--glass-blur` (12 px) y borde `--glass-border` (blanco 0.55), con manchas difusas rojo/gris fijas detrás del contenido para que el vidrio se note; el header rojo queda sólido. El vidrio se activa solo dentro de `@supports (backdrop-filter)`; sin soporte la tarjeta cae a blanco 0.92, nunca a transparente. En `data-profile="sencillo"` no hay vidrio ni manchas: blanco sólido, borde de 2 px y contraste como hoy. `prefers-reduced-transparency: reduce` apaga el vidrio en cualquier perfil. `--label` pasa de #8a8a8a a #6e6e6e (4.9:1 sobre blanco) para que las etiquetas cumplan AA sobre el vidrio.
Razón: la identidad visual gana profundidad sin tocar layout ni componentes (D17: todo por variables CSS); la accesibilidad es el corazón del caso y el perfil sencillo no puede perder contraste por estética.
Si falta tiempo: el vidrio se limita al header y las tarjetas principales; chips y barra de entrada vuelven a `var(--card)`.

## D28 — Bienvenida determinista al conectar y rehidratación en cualquier reconexión

Al registrarse una conexión SSE para un `surfaceId` sin sesión previa, el router emite al instante la bienvenida fija de `src/agent/bienvenida.ts` (`createSurface` normal + `ExplanationCard` de Pixy + los tres chips de perfil, el "Paso 1" que ya exigía el prompt) y la siembra en el historial como turno del modelo. Si la sesión ya existe (recarga a mitad del flujo, reconexión D20), no hay bienvenida: se re-emite `createSurface` con el perfil vigente, el data model completo y el último `updateComponents` que se guardó en `sesion.ultimoRoot`. Todas las emisiones del router pasan por `emitirEnSesion`, que es quien recuerda ese árbol.
Razón: la bienvenida era contenido fijo generado por el LLM (2-25 s de "Cargando…" al abrir) y una recarga con sesión viva no recibía nada hasta el siguiente mensaje. La decisión es síncrona antes del primer `await`, así dos conexiones simultáneas sobre una sesión nueva no duplican nada. El agente, las tools y el manejo del primer mensaje no cambian: solo cambia quién dice la primera frase.
Detalles que salieron de la revisión: el historial se siembra con JSON **con sangría** (el modelo imita el estilo de sus turnos previos y el JSON compacto le hace desbalancear llaves, 4/4 turnos en vivo); mientras un turno del agente está en vuelo (`sesion.turnoEnCurso`) la rehidratación no reenvía `ultimoRoot`, para no reexponer un modal ya accionado; los avisos transitorios (`emitirDescanso`, `emitirTrabado`) se emiten sin recordarse, así una recarga vuelve a la última pantalla real; y el Renderer trata un `createSurface` con el mismo perfil y árbol ya montado como rehidratación (no desmonta ni vacía el store), de modo que una reconexión SSE (D20) no destella "Cargando…" ni reinicia la lectura en voz.
Si falta tiempo: no se persiste `ultimoRoot` fuera de memoria (D13); un restart del proceso sigue empezando de cero.
