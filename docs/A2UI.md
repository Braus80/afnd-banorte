# Contrato A2UI — reestructuración de deuda

Este archivo es el contrato entre los lotes 1 (front/renderer), 3 (agente) y
4 (transporte). No se cambia sin ADR. Si algo aquí no alcanza para lo que
necesitas, escribe el ADR antes de tocarlo.

Subconjunto propio inspirado en A2UI v0.9. Se conservan los tres tipos de
mensaje y la separación entre estructura y datos; el catálogo y el renderer
son nuestros.

---

## 1. Principios

1. **El agente no manda código, manda intención.** Solo puede pedir
   componentes que existan en este catálogo. Un componente desconocido se
   ignora y se registra en consola; el renderer nunca ejecuta nada que venga
   en el JSON.
2. **Estructura y datos van por separado.** `updateComponents` define qué se
   ve; `updateDataModel` cambia los números. Mover el slider solo produce
   `updateDataModel`: no se vuelve a describir la pantalla.
3. **Los componentes leen datos por ruta, no por valor.** Un componente dice
   `"value": {"$": "/diagnostico/saldo"}`, no `"value": 18400`. Así un solo
   `updateDataModel` refresca todo lo que dependa de ese dato.
4. **Todo `action` viaja al backend.** El backend decide si lo resuelve
   directo (rápido) o si se lo pasa al LLM (lento). Ver sección 5.

---

## 2. Transporte

- Agente → front: SSE en `GET /api/stream`. Cada evento es un JSON de los de
  la sección 3.
- Front → agente: `POST /api/event` con el cuerpo de la sección 5.
- Una sesión = una `surfaceId`. No hay multi-surface en el MVP.

---

## 3. Los tres mensajes

Todo mensaje lleva `version` y `surfaceId`.

### createSurface

Abre la pantalla. Se manda una vez por sesión.

```json
{
  "version": "0.1",
  "createSurface": {
    "surfaceId": "main",
    "title": "Tu situación de crédito",
    "profile": "normal"
  }
}
```

`profile` (ver ADR D12). Tres valores cerrados, ninguno más sin ADR. No hay
componentes distintos por perfil: el catálogo es el mismo, el renderer
aplica tokens visuales sobre él.

| valor | qué aplica el renderer |
|---|---|
| `sencillo` | escala tipográfica mayor, botones más altos, contraste alto, máximo de componentes visibles por pantalla (el resto se difiere a otra `updateComponents`) |
| `normal` | tokens por defecto — es el valor si `profile` no viene |
| `detallado` | escala tipográfica menor, densidad mayor, sin tope de componentes por pantalla |

Se fija una vez al abrir la superficie (primera sesión) y persiste: toda
`createSurface` posterior de ese usuario lo hereda desde `usuarios.perfil`.
No cambia a mitad de sesión sin una `createSurface` nueva.

### updateComponents

Reemplaza el árbol de componentes de la superficie. El agente lo emite cuando
cambia la *intención*, no cuando cambia un número.

```json
{
  "version": "0.1",
  "surfaceId": "main",
  "updateComponents": {
    "root": {
      "id": "col-1",
      "type": "Column",
      "children": [ ... ]
    }
  }
}
```

`Column` es el único contenedor del MVP: apila hijos en vertical. No tiene
props.

### updateDataModel

Cambia valores sin redibujar la estructura. Parcial: solo las rutas que
manda.

```json
{
  "version": "0.1",
  "surfaceId": "main",
  "updateDataModel": {
    "/simulacion/pagoMensual": 1842.50,
    "/simulacion/interesTotal": 3920.00,
    "/simulacion/plazo": 18
  }
}
```

---

## 4. Catálogo de componentes

Siete (ADR D12 agregó `SuggestionChips`). No se agregan más sin ADR.

Todo componente tiene `id` (único en la superficie) y `type`. Cualquier prop
puede ser un literal o una referencia `{"$": "/ruta/al/dato"}`.

### StatCard
Un número con su etiqueta. Para el diagnóstico.

| prop | tipo | notas |
|---|---|---|
| `label` | string | "Saldo actual" |
| `value` | number \| string | acepta `$ref` |
| `format` | `"currency"` \| `"percent"` \| `"plain"` | default `plain` |
| `tone` | `"neutral"` \| `"warn"` \| `"good"` | color, default `neutral` |

### ComparisonTable
Compara planes. Cada fila es seleccionable si se define `action`.

| prop | tipo | notas |
|---|---|---|
| `columns` | `[{key, label, format}]` | |
| `rows` | `$ref` a un array | ruta del data model |
| `selectedKey` | string \| `$ref` | fila resaltada |
| `action` | string \| null | se dispara al elegir fila |

### SliderControl
Ajuste continuo. **También es el componente de fallback**: cuando al agente
le falta un dato (ingreso mensual, cuánto puede pagar), lo pide con un slider
en vez de inventar un componente de input nuevo.

| prop | tipo | notas |
|---|---|---|
| `label` | string | |
| `min`, `max`, `step` | number | |
| `value` | number \| `$ref` | |
| `format` | igual que StatCard | |
| `action` | string | obligatorio |
| `debounceMs` | number | default 200 |

### ExplanationCard
Por qué el agente recomienda lo que recomienda. Texto plano, sin markdown.

| prop | tipo | notas |
|---|---|---|
| `title` | string | |
| `body` | string \| `$ref` | máx. ~400 caracteres |
| `bullets` | `[string]` \| `$ref` | opcional, máx. 4 |

### ActionConfirmationModal
Último paso antes de escribir en la base. Modal, bloquea el fondo.

| prop | tipo | notas |
|---|---|---|
| `title` | string | |
| `summary` | `[{label, value, format}]` | lo que se va a aplicar |
| `confirmLabel` | string | "Aplicar plan" |
| `cancelLabel` | string | "Cancelar" |
| `action` | string | se dispara al confirmar |

### ScheduleList
Calendario de pagos resultante. Lista, no tabla: se lee en móvil.

| prop | tipo | notas |
|---|---|---|
| `items` | `$ref` a `[{fecha, monto, estado}]` | |
| `emptyLabel` | string | |

### SuggestionChips
Atajos de intención. Al tocar un chip se manda `prompt` como si el usuario lo
hubiera escrito — siempre vía agente, nunca camino directo (ver sección 5).

| prop | tipo | notas |
|---|---|---|
| `items` | `[{label, prompt}]` \| `$ref` | `label` se muestra, `prompt` es lo que se envía |

---

## 5. El evento de vuelta

Cualquier interacción produce el mismo cuerpo:

```json
{
  "surfaceId": "main",
  "componentId": "slider-plazo",
  "action": "simular",
  "payload": { "plazo": 18 },
  "ts": 1757600000000
}
```

`action` es una cadena que el backend enruta. Dos caminos, y esta distinción
es la que hace que el demo se sienta rápido:

| Camino | Cuándo | Qué hace el backend |
|---|---|---|
| **Directo** | `simular`, `seleccionar_plan` | Llama la tool MCP y responde con `updateDataModel`. No pasa por el LLM. Latencia de milisegundos. |
| **Vía agente** | `confirmar_plan`, `deshacer`, texto libre del usuario, `SuggestionChips` | Se inyecta como turno nuevo en la conversación. El LLM decide y puede emitir `updateComponents`. |

El front no sabe cuál es cuál. Solo manda el evento.

Evento de un `SuggestionChips` tocado — `action` fijo `"mensaje_libre"`,
`payload.texto` es el `prompt` del chip:

```json
{
  "surfaceId": "main",
  "componentId": "chips-onboarding",
  "action": "mensaje_libre",
  "payload": { "texto": "quiero el modo sencillo" },
  "ts": 1757600000000
}
```

---

## 6. Flujo completo del demo

1. Usuario escribe su necesidad → LLM llama `obtener_diagnostico` →
   `createSurface` + `updateComponents` con `StatCard` ×3 y un
   `ExplanationCard`.
2. Falta saber cuánto puede pagar al mes → `updateComponents` agrega un
   `SliderControl` con `action: "simular"`. **Este es el fallback.**
3. El usuario mueve el slider → evento `simular` → camino directo →
   `updateDataModel`. La `ComparisonTable` se actualiza sin parpadeo.
4. Elige una fila → `seleccionar_plan` → directo → `updateDataModel` mueve
   `selectedKey` y recalcula.
5. Botón confirmar → `ActionConfirmationModal` → `confirmar_plan` → vía
   agente → tool `aplicar_plan` escribe en Tiger Data →
   `updateComponents` con `ScheduleList` y un `StatCard` de confirmación.
6. Segunda intención en la misma sesión ("¿y si bloqueo la tarjeta?") →
   `updateComponents` con una composición distinta del mismo catálogo. Esto
   es lo que demuestra adaptabilidad.
7. `deshacer` revierte el paso 5 y vuelve al comparador.

---

## 7. Reglas para el prompt del agente

Se copian tal cual al system prompt de L3:

- Emite únicamente JSON de los tres tipos de arriba, sin texto alrededor.
- Solo los siete `type` del catálogo. Nada inventado.
- Si te falta un dato para decidir, no lo supongas: emite un `SliderControl`
  que lo pida.
- No emitas `updateComponents` si solo cambiaron números: usa
  `updateDataModel`.
- Toda pantalla que recomiende algo lleva un `ExplanationCard`.
- Nunca pongas un valor de dinero literal en un componente: siempre `$ref`
  al data model, que se llena con la respuesta de la tool.

---

## 8. Lo que no está en el MVP

Va a `docs/BACKLOG.md`, no a código: múltiples superficies, componentes
anidados más allá de `Column`, validación de formularios, animaciones de
transición, tema claro/oscuro, streaming parcial de componentes.
