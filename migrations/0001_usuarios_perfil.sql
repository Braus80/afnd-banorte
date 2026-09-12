-- Lote 5 / ADR D12 — perfil de accesibilidad.
-- NO APLICADA. Depende de la tabla `usuarios` que Lote 2 (Tiger Data) aún
-- no crea en este repo. Aplicar solo después de que exista `usuarios` y
-- contra la base real (Tiger Data), nunca a mano en producción sin revisar.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS perfil JSONB;

-- Valor esperado en `perfil`, validado por la app, no por constraint:
--   { "modo": "sencillo" | "normal" | "detallado" }
