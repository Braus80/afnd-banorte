# LOTE V — Slice vertical, puntos 5 a 7 y verificación

Continuación del prompt del Lote V. Los puntos 1 a 4 ya están hechos y
verificados en `lote-v-slice`. Este archivo es la especificación del
front, la primera sesión, el deploy y el criterio de cierre.

Canon: `docs/A2UI.md` (props de componentes, sección 4; eventos,
sección 5; reglas del agente, sección 7). Este archivo no lo contradice;
si algo aquí no cuadra con A2UI.md, manda A2UI.md y se avisa antes de
escribir código.

---

## 5. Front, en `src/ui/`

### `store.ts`

Data model en memoria como objeto anidado. Rutas con barra:
`"/simulacion/pagoMensual"`.

- `get(path)`: devuelve el valor o `undefined`.
- `set(path, value)`: crea los niveles intermedios si no existen.
- `subscribe(path, cb)`: devuelve una función para desuscribirse.
- `applyDataModel(patch)`: recibe el objeto de `updateDataModel`
  (`{ "/ruta": valor, ... }`), hace `set` por cada ruta y notifica
  **solo** a los suscriptores de esas rutas. Nada más se entera.
- `reset()`: vacía todo. Lo llama `createSurface`.

### `resolve.ts`

Cualquier prop puede ser un literal o `{"$": "/ruta"}`.

- `resolveProps(props)` devuelve `{ resolved, refs }`: las props con
  los `$ref` sustituidos por su valor actual, y la lista de rutas
  usadas.
- Un componente se suscribe a `refs` y solo a `refs`. Cuando cambia
  una, vuelve a resolver y re-renderiza él solo.
- Un `$ref` a una ruta que no existe resuelve a `undefined`; el
  componente muestra su estado vacío, no revienta.

### `Renderer.tsx`

Recibe los tres mensajes por SSE (`GET /api/stream`) y los enruta:

- **createSurface**: guarda `surfaceId`, `title` y `profile`. Llama
  `store.reset()` y vacía el árbol. Pone `data-profile="<modo>"` en el
  elemento raíz.
- **updateComponents**: reemplaza el árbol completo con `root`. Cada
  nodo es `{ id, type, ...props }`. `Column` apila hijos en vertical,
  sin props. `type` desconocido: `console.warn("A2UI: type desconocido",
  type)` y no renderiza nada. Nunca `eval`, nunca
  `dangerouslySetInnerHTML`, nunca ejecutar nada que venga en el JSON.
- **updateDataModel**: llama `store.applyDataModel(patch)`. **No** toca
  el árbol. Cada componente tiene un `console.debug("render", id)` en
  su cuerpo para poder demostrar que el slider no remonta nada.

Reconexión SSE: si se cae, reintenta con backoff (1s, 2s, 4s, máx 10s).
Muestra un aviso discreto mientras está desconectado.

### `components/`

Los siete. La tabla de props de `docs/A2UI.md` sección 4 es la única
fuente; no se agregan props sin ADR.

| Componente | Notas de implementación |
|---|---|
| `StatCard` | `format: currency` → `$85,240.00 MN`; `percent` → `68.5 %`. Tonos como clases. |
| `ComparisonTable` | `rows` es `$ref` a array. Fila con `key === selectedKey` resaltada. Filas con `pago_mensual > /presupuesto` atenuadas si `/presupuesto` existe. Badge "Recomendado" si la fila trae `recomendado: true`. Click en fila dispara `action` con `payload: { plan_id }`. |
| `SliderControl` | Debounce 200 ms (o `debounceMs`). Muestra el valor formateado mientras arrastra. Dispara `action` con `payload: { valor }`. |
| `ExplanationCard` | `bullets` máx 4. Sin markdown: texto plano. |
| `ActionConfirmationModal` | Bloquea el fondo. Confirmar dispara `action` con `payload: { confirmado: true }`. Cancelar cierra y dispara `action` con `{ confirmado: false }`. |
| `ScheduleList` | `items` es `$ref` a `[{ fecha, monto, estado }]`. Lista, no tabla. |
| `SuggestionChips` | `items: [{ label, prompt }]`. Click envía `action: "mensaje_libre"` con `payload: { texto: prompt }`. |

Toda interacción llama `sendEvent({ surfaceId, componentId, action,
payload, ts })`, que hace `POST /api/event`. El front **no** distingue
camino directo de camino LLM: manda el mismo evento siempre.

### Entrada de texto

Campo fijo en la parte inferior. Enter envía `action: "mensaje_libre"`
con `payload: { texto }`. Se vacía al enviar. Mientras el agente
responde, se deshabilita y muestra "Pixy está pensando…".

### Perfil y tokens

`data-profile` en el raíz cambia los tokens de Tailwind:

| Token | normal | sencillo | detallado |
|---|---|---|---|
| Escala tipográfica | 1.0 | 1.4 | 0.95 |
| Alto mínimo de botón | 44px | 56px | 40px |
| Componentes por fila | hasta 3 | 1 | hasta 4 |
| Contraste | estándar | alto (texto casi negro, bordes visibles) | estándar |
| Sombras | mínimas | ninguna, bordes en su lugar | mínimas |

### Identidad visual

Encabezado rojo sólido con saludo ("Buen día, Sofía"). Fondo gris
claro. Tarjetas blancas redondeadas (radio 12px) con sombra mínima.
Etiquetas de sección en gris. Montos alineados a la derecha con "MN".
Números enmascarados con puntos (`•••• 4321`). Botón primario gris
oscuro de ancho completo. Chips como iconos circulares con etiqueta
debajo. Tipografía Montserrat (Google Fonts). **Sin logo ni nombre de
Banorte en ningún componente** — regla sustituida por ADR D26: el logo
oficial va en el header (solo ahí); los componentes siguen sin marca.

---

## 6. Primera sesión (Pixy)

Si la sesión no tiene perfil, el agente emite:

1. `createSurface` con `profile: { modo: "normal", escala: 1, contraste: "estandar" }`.
2. `updateComponents` con:
   - `ExplanationCard` de bienvenida, firmada como Pixy, tono cálido,
     que explica en dos frases qué puede hacer.
   - `SuggestionChips` con tres opciones: "Letras grandes y sencillo",
     "Normal", "Detallado". Cada `prompt` es literal, p. ej.
     `"Quiero ver la información en modo sencillo"`.

Elegir una llama `guardar_perfil(usuario_id, perfil)` y el agente
re-emite `createSurface` con el `profile` correspondiente, seguido de
la bienvenida real: `ExplanationCard` corta + `SuggestionChips` con
2–3 sugerencias de qué preguntar ("No me alcanza para pagar mi
tarjeta", "¿Cuánto debo?", "¿Y si pago más al mes?").

Después de **cada** pantalla generada, el agente añade al final un
`SuggestionChips` con 2–3 siguientes pasos razonables. Si falta
tiempo, esto es lo primero que se corta: se quedan solo los de la
bienvenida.

---

## 7. Deploy

Desde `main`, con estas variables de entorno en la plataforma:

- `GEMINI_API_KEY`
- `LLM_PROVIDER=gemini`

En local, las mismas en `.env.local`, que está en `.gitignore`. La key
**nunca** va en un commit.

---

## Verificación de cierre (contra el dominio desplegado, no localhost)

a) `curl -sI https://<dominio> | head -1` → `200`.

b) `curl -N https://<dominio>/api/stream` durante 5 s → al menos un
   JSON válido de `createSurface`. Pegar la salida literal.

c) En navegador, sesión nueva:
   1. Elegir "Letras grandes y sencillo".
   2. Escribir "no me alcanza para pagar mi tarjeta".
   3. Mover el slider.
   4. Elegir un plan.
   5. Confirmar.
   6. Ver `ScheduleList`.
   Pegar los JSON A2UI emitidos en cada paso y el log de `render` que
   demuestra que el paso 3 solo re-renderiza `ComparisonTable`, no el
   árbol.

d) Sesión nueva, elegir "Normal", misma frase: captura visiblemente
   distinta a la de c).

ADR por decisión, mismo commit. Commit por ruta explícita.
Merge a `main` al cerrar. STOP.
