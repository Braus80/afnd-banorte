# BACKLOG.md

| Prioridad | Área | Nota |
|---|---|---|
| Media | agente | El LLM a veces pone montos literales en StatCard y ScheduleList.items inline en vez de $ref. Cosmético post-confirmar. |
| Baja | agente | Turnos vía LLM de 3-10s; la burbuja en "pensando" lo cubre. Sin fix planeado. |
| Baja | mcp | deshacer solo revierte el último plan activo (D10). |
| Baja | mcp | `deshacer_plan` en `tiger.ts` borra la fila de `planes_aplicados` para que la base vuelva al estado inicial exacto (D25): en el demo se ve aparecer y desaparecer. Alternativa de bitácora: `UPDATE ... SET estado = 'cancelado'` y que el agente y los conteos filtren `WHERE estado = 'activo'`; conviene cuando haya historial/analytics. |
