# BACKLOG.md

| Prioridad | Área | Nota |
|---|---|---|
| Media | agente | El LLM a veces pone montos literales en StatCard y ScheduleList.items inline en vez de $ref. Cosmético post-confirmar. |
| Baja | agente | Turnos vía LLM de 3-10s; la burbuja en "pensando" lo cubre. Sin fix planeado. |
| Baja | mcp | deshacer solo revierte el último plan activo (D10). |
| Baja | mcp | `deshacer_plan` en `tiger.ts` borra la fila de `planes_aplicados` para que la base vuelva al estado inicial exacto (D25): en el demo se ve aparecer y desaparecer. Alternativa de bitácora: `UPDATE ... SET estado = 'cancelado'` y que el agente y los conteos filtren `WHERE estado = 'activo'`; conviene cuando haya historial/analytics. |
| Media | agente | Selección de plan por texto ("quiero el plan A"): la tool `seleccionar_plan` corre y llena `/simulacion/selectedKey` y las cifras, pero el LLM no abre el `ActionConfirmationModal` en ese mismo turno pese a la instrucción del prompt; lo abre al siguiente mensaje o chip, ya lleno. Fix propuesto: que el router emita el modal él mismo tras la tool (`updateComponents` con summary por `$ref` a las rutas fijas), sin depender del LLM. |
| Media | front | Clic en fila de ComparisonTable no dispara `seleccionar_plan` en Chrome de escritorio (macOS). En Chrome headless sí funciona (verificado commit 22b40df). Consola limpia. Sospecha: manejador de eventos de puntero o CSS que intercepta el clic. Workaround funcional: selección por texto o chips. |
