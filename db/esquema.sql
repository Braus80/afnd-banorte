-- =============================================================================
-- ESQUEMA UNIFICADO — AFND Banorte26
-- Une el canon de reestructuración de deuda con las tablas de banca personal.
-- Destino: Tiger Cloud (PostgreSQL). No aplicar en local: el deploy no puede
-- conectarse al localhost de nadie.
--
-- Cambios respecto a lo que circuló:
--   - Una sola tabla usuarios (unión de campos útiles).
--   - Sin usuario_login ni contrasena: el demo no tiene login, el usuario_id
--     va fijo, y contraseñas en texto plano en un repo público de un reto
--     bancario es lo primero que señala un jurado.
--   - Sin la tabla accesibilidad: dislexia, problemas visuales y dificultad
--     auditiva son diagnósticos médicos. Lo que la UI necesita son las
--     preferencias, no la condición.
--   - Sin rfc: ninguna tool lo usa y acababa dentro del prompt del LLM.
--   - perfil JSONB integrado aquí (reemplaza migrations/0001).
-- =============================================================================

-- =========================================================
-- 1. USUARIOS  (compartida por ambos dominios)
-- =========================================================
CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    email           VARCHAR(100) UNIQUE NOT NULL,
    telefono        VARCHAR(15),
    edad            INTEGER CHECK (edad BETWEEN 18 AND 120),
    ciudad          VARCHAR(80),
    perfil          JSONB,          -- perfil de Pixy: modo + banderas
    fecha_registro  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- 2. PREFERENCIAS  (las banderas que consume Pixy)
-- =========================================================
CREATE TABLE preferencias (
    id                SERIAL PRIMARY KEY,
    usuario_id        INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    texto_grande      BOOLEAN NOT NULL DEFAULT FALSE,
    alto_contraste    BOOLEAN NOT NULL DEFAULT FALSE,
    alertas_visuales  BOOLEAN NOT NULL DEFAULT FALSE,
    navegacion_simple BOOLEAN NOT NULL DEFAULT FALSE,
    lector_pantalla   BOOLEAN NOT NULL DEFAULT FALSE,
    no_usar_color     BOOLEAN NOT NULL DEFAULT FALSE
);

-- =========================================================
-- 3. CUENTAS  (tarjeta de crédito — camino principal del demo)
-- =========================================================
CREATE TABLE cuentas (
    id                  SERIAL PRIMARY KEY,
    usuario_id          INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ultimos_4           VARCHAR(4) NOT NULL,
    banco               VARCHAR(50) NOT NULL,
    saldo_actual        NUMERIC(12,2) NOT NULL CHECK (saldo_actual >= 0),
    limite_credito      NUMERIC(12,2) NOT NULL CHECK (limite_credito > 0),
    pago_minimo         NUMERIC(12,2) NOT NULL CHECK (pago_minimo >= 0),
    tasa_interes_anual  NUMERIC(5,2)  NOT NULL CHECK (tasa_interes_anual >= 0),
    estado              VARCHAR(20)   NOT NULL DEFAULT 'activo'
                        CHECK (estado IN ('activo','reestructurado','bloqueado')),
    fecha_corte         INTEGER NOT NULL CHECK (fecha_corte BETWEEN 1 AND 31),
    fecha_vencimiento   DATE NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- 4. BANCA PERSONAL  (resumen para la segunda intención)
-- =========================================================
CREATE TABLE banca_personal (
    id                SERIAL PRIMARY KEY,
    usuario_id        INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    saldo_disponible  NUMERIC(12,2) NOT NULL CHECK (saldo_disponible >= 0),
    ingreso_mensual   NUMERIC(12,2) NOT NULL CHECK (ingreso_mensual >= 0),
    gasto_mensual     NUMERIC(12,2) NOT NULL CHECK (gasto_mensual >= 0),
    ahorro_mensual    NUMERIC(12,2) NOT NULL CHECK (ahorro_mensual >= 0)
);

-- =========================================================
-- 5. CATEGORÍAS DE GASTO
-- =========================================================
CREATE TABLE categorias_gasto (
    id      SERIAL PRIMARY KEY,
    nombre  VARCHAR(50) UNIQUE NOT NULL
);

-- =========================================================
-- 6. MOVIMIENTOS  (alimenta "¿en qué se me va el dinero?")
-- =========================================================
CREATE TABLE movimientos (
    id            SERIAL PRIMARY KEY,
    usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    categoria_id  INTEGER REFERENCES categorias_gasto(id),
    tipo          VARCHAR(15) NOT NULL CHECK (tipo IN ('Ingreso','Gasto','Transferencia')),
    concepto      VARCHAR(120) NOT NULL,
    monto         NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    fecha         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado        VARCHAR(15) NOT NULL DEFAULT 'Completado'
                  CHECK (estado IN ('Completado','Pendiente','Rechazado'))
);

CREATE INDEX idx_movimientos_usuario_fecha ON movimientos (usuario_id, fecha DESC);

-- =========================================================
-- 7. PLANES DE CRÉDITO  (catálogo del banco)
-- =========================================================
CREATE TABLE planes_credito (
    id                              SERIAL PRIMARY KEY,
    nombre                          VARCHAR(100) NOT NULL,
    descripcion                     TEXT NOT NULL,
    tasa_interes_anual              NUMERIC(5,2) NOT NULL CHECK (tasa_interes_anual >= 0),
    plazo_meses                     INTEGER NOT NULL CHECK (plazo_meses > 0),
    descuento_principal_porcentaje  NUMERIC(5,2) NOT NULL DEFAULT 0.00
                                    CHECK (descuento_principal_porcentaje BETWEEN 0 AND 100),
    activo                          BOOLEAN NOT NULL DEFAULT TRUE
);

-- =========================================================
-- 8. PLANES APLICADOS  (bitácora: nunca se borra un registro)
-- =========================================================
CREATE TABLE planes_aplicados (
    id                    SERIAL PRIMARY KEY,
    usuario_id            INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    cuenta_id             INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
    plan_credito_id       INTEGER NOT NULL REFERENCES planes_credito(id),
    saldo_inicial         NUMERIC(12,2) NOT NULL CHECK (saldo_inicial >= 0),
    descuento_aplicado    NUMERIC(12,2) NOT NULL CHECK (descuento_aplicado >= 0),
    monto_reestructurado  NUMERIC(12,2) NOT NULL CHECK (monto_reestructurado >= 0),
    tasa_interes_anual    NUMERIC(5,2)  NOT NULL CHECK (tasa_interes_anual >= 0),
    plazo_meses           INTEGER NOT NULL CHECK (plazo_meses > 0),
    pago_mensual          NUMERIC(12,2) NOT NULL CHECK (pago_mensual >= 0),
    interes_total         NUMERIC(12,2) NOT NULL CHECK (interes_total >= 0),
    monto_total_pagar     NUMERIC(12,2) NOT NULL CHECK (monto_total_pagar >= 0),
    fecha_aplicacion      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado                VARCHAR(20) NOT NULL DEFAULT 'activo'
                          CHECK (estado IN ('activo','liquidado','cancelado'))
);

-- =========================================================
-- 9. HISTORIAL DE PAGOS DE LA TARJETA
--    Decorativo: no suma al saldo_actual. Está en el BACKLOG.
-- =========================================================
CREATE TABLE historial_pagos (
    id           SERIAL PRIMARY KEY,
    cuenta_id    INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
    fecha        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo         VARCHAR(10) NOT NULL CHECK (tipo IN ('cargo','abono')),
    monto        NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    comercio     VARCHAR(100) NOT NULL,
    categoria    VARCHAR(50)  NOT NULL,
    descripcion  VARCHAR(255)
);
