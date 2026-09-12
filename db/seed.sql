-- =============================================================================
-- SEED — AFND Banorte26
-- Ejecutar UNA VEZ sobre el esquema unificado, en Tiger Cloud.
--
-- AVISO: hace TRUNCATE. No correrlo después de que haya estado de demo
-- cargado a mano.
--
-- TASAS: la tarjeta al 62-68% anual es un SUPUESTO DEL DEMO, no verificado
-- contra fuente oficial. Los planes salen de TIIE 28 días (6.75%, DOF del
-- 9 de septiembre de 2026) más margen. El contraste 65% vs 22% es el momento
-- del demo: si el ahorro no salta a la vista, no convence.
-- =============================================================================

TRUNCATE TABLE
    planes_aplicados, historial_pagos, movimientos, cuentas,
    banca_personal, preferencias, categorias_gasto, planes_credito, usuarios
RESTART IDENTITY CASCADE;

-- =========================================================
-- USUARIOS
-- Sofía: adulta mayor, perfil sencillo. Es la del demo principal.
-- =========================================================
INSERT INTO usuarios (nombre, email, telefono, edad, ciudad) VALUES
('Sofía Torres',   'sofia.torres@gmail.com',   '8112345678', 67, 'Monterrey'),
('Carlos Ramírez', 'carlos.ramirez@gmail.com', '8198765432', 58, 'Saltillo'),
('Ana Martínez',   'ana.martinez@gmail.com',   '8155512345', 22, 'Monterrey');

-- =========================================================
-- PREFERENCIAS
-- Se mapean a los modos ya implementados (D12):
--   texto_grande + alto_contraste + navegacion_simple -> 'sencillo'
-- =========================================================
INSERT INTO preferencias
(usuario_id, texto_grande, alto_contraste, alertas_visuales, navegacion_simple, lector_pantalla, no_usar_color) VALUES
(1, TRUE,  TRUE,  TRUE, TRUE,  TRUE,  FALSE),   -- Sofía  -> sencillo
(2, TRUE,  FALSE, TRUE, TRUE,  FALSE, FALSE),   -- Carlos -> sencillo
(3, FALSE, FALSE, TRUE, FALSE, FALSE, TRUE);    -- Ana    -> normal

-- =========================================================
-- CUENTAS  (tarjeta de crédito)
-- =========================================================
INSERT INTO cuentas
(usuario_id, ultimos_4, banco, saldo_actual, limite_credito, pago_minimo,
 tasa_interes_anual, estado, fecha_corte, fecha_vencimiento) VALUES
(1, '4321', 'Banorte', 85240.00, 100000.00, 6819.00, 68.50, 'activo', 15, '2026-09-28'),
(2, '9876', 'Banorte', 42150.00,  50000.00, 3372.00, 62.90, 'activo', 10, '2026-09-30'),
(3, '2048', 'Banorte', 12400.00,  30000.00,  992.00, 65.40, 'activo',  5, '2026-09-25');

-- =========================================================
-- BANCA PERSONAL  (segunda intención)
-- =========================================================
INSERT INTO banca_personal
(usuario_id, saldo_disponible, ingreso_mensual, gasto_mensual, ahorro_mensual) VALUES
(1, 28750.00, 25000.00, 17000.00, 4000.00),
(2, 42350.00, 32000.00, 21500.00, 6000.00),
(3, 18500.00, 18500.00, 12500.00, 3000.00);

-- =========================================================
-- CATEGORÍAS
-- =========================================================
INSERT INTO categorias_gasto (nombre) VALUES
('Alimentos'), ('Transporte'), ('Servicios'),
('Entretenimiento'), ('Compras'), ('Transferencias'), ('Otros');

-- =========================================================
-- PLANES DE CRÉDITO
-- TIIE 6.75% + margen. El plan con quita lleva descuento al principal.
-- =========================================================
INSERT INTO planes_credito
(nombre, descripcion, tasa_interes_anual, plazo_meses, descuento_principal_porcentaje) VALUES
('Banorte Solución 12 meses',
 'Liquidas más rápido y pagas mucho menos interés total.',
 20.75, 12, 0.00),
('Banorte Solución 18 meses',
 'El equilibrio entre una mensualidad manejable y una tasa baja.',
 22.75, 18, 0.00),
('Banorte Solución 24 meses',
 'La mensualidad más baja, para recuperar tu tranquilidad.',
 25.75, 24, 0.00),
('Plan Rescate Banorte',
 'Descuento del 30% sobre el saldo a cambio de liquidar en 12 pagos.',
 26.75, 12, 30.00);

-- =========================================================
-- MOVIMIENTOS — SOFÍA (usuario 1)
-- =========================================================
INSERT INTO movimientos (usuario_id, categoria_id, tipo, concepto, monto, fecha, estado) VALUES
(1, NULL, 'Ingreso',        'Nómina mensual',              25000.00, '2026-09-01 08:00:00-06', 'Completado'),
(1, 1,    'Gasto',          'Soriana',                      1750.00, '2026-09-01 12:30:00-06', 'Completado'),
(1, 3,    'Gasto',          'Agua y Drenaje',                320.00, '2026-09-02 10:00:00-06', 'Completado'),
(1, 2,    'Gasto',          'Transporte',                    480.00, '2026-09-03 09:20:00-06', 'Completado'),
(1, 3,    'Gasto',          'CFE',                           890.00, '2026-09-04 11:00:00-06', 'Completado'),
(1, 5,    'Gasto',          'Coppel',                       1200.00, '2026-09-05 15:40:00-06', 'Completado'),
(1, 6,    'Transferencia',  'Transferencia a Ana Martínez',  1000.00, '2026-09-06 13:00:00-06', 'Completado'),
(1, 1,    'Gasto',          'OXXO',                          185.00, '2026-09-08 19:10:00-06', 'Completado'),
(1, 3,    'Gasto',          'Telcel',                        399.00, '2026-09-10 09:30:00-06', 'Completado');

-- =========================================================
-- MOVIMIENTOS — CARLOS (usuario 2)
-- =========================================================
INSERT INTO movimientos (usuario_id, categoria_id, tipo, concepto, monto, fecha, estado) VALUES
(2, NULL, 'Ingreso',        'Nómina mensual',              32000.00, '2026-09-01 08:00:00-06', 'Completado'),
(2, 1,    'Gasto',          'Walmart',                      2340.00, '2026-09-01 17:30:00-06', 'Completado'),
(2, 2,    'Gasto',          'Gasolinera Pemex',             1200.00, '2026-09-03 08:45:00-06', 'Completado'),
(2, 3,    'Gasto',          'Telmex',                        549.00, '2026-09-04 11:20:00-06', 'Completado'),
(2, 6,    'Transferencia',  'Transferencia a María López',  3000.00, '2026-09-05 16:00:00-06', 'Completado'),
(2, 4,    'Gasto',          'Cinépolis',                     650.00, '2026-09-07 19:30:00-06', 'Pendiente');

-- =========================================================
-- MOVIMIENTOS — ANA (usuario 3)
-- =========================================================
INSERT INTO movimientos (usuario_id, categoria_id, tipo, concepto, monto, fecha, estado) VALUES
(3, NULL, 'Ingreso',        'Nómina mensual',              18500.00, '2026-09-01 08:00:00-06', 'Completado'),
(3, 1,    'Gasto',          'Soriana',                      1280.00, '2026-09-02 10:30:00-06', 'Completado'),
(3, 2,    'Gasto',          'Gasolinera Pemex',              850.00, '2026-09-03 18:20:00-06', 'Completado'),
(3, 3,    'Gasto',          'CFE',                           685.00, '2026-09-04 09:15:00-06', 'Completado'),
(3, 6,    'Transferencia',  'Transferencia a Juan Pérez',   1500.00, '2026-09-05 14:10:00-06', 'Completado'),
(3, 1,    'Gasto',          'Starbucks',                     420.00, '2026-09-06 20:30:00-06', 'Completado');

-- =========================================================
-- HISTORIAL DE PAGOS DE LA TARJETA (decorativo)
-- =========================================================
INSERT INTO historial_pagos (cuenta_id, fecha, tipo, monto, comercio, categoria, descripcion) VALUES
(1, '2026-08-14 11:20:00-06', 'cargo', 2340.00, 'Soriana',           'Supermercado',  'Compra en Soriana'),
(1, '2026-08-19 17:05:00-06', 'cargo', 1180.00, 'Coppel',            'Ropa y Calzado','Compra en Coppel'),
(1, '2026-08-23 09:40:00-06', 'abono', 3500.00, 'Banca Móvil',       'Pago',          'Abono recibido'),
(1, '2026-08-27 20:15:00-06', 'cargo',  640.00, 'OXXO',              'Conveniencia',  'Compra en OXXO'),
(1, '2026-09-02 13:55:00-06', 'cargo', 1890.00, 'Mercado Libre',     'E-commerce',    'Compra en Mercado Libre'),
(2, '2026-08-16 10:10:00-06', 'cargo', 1450.00, 'Walmart',           'Supermercado',  'Compra en Walmart'),
(2, '2026-08-25 08:30:00-06', 'abono', 2800.00, 'Banca Móvil',       'Pago',          'Abono recibido'),
(2, '2026-09-04 19:45:00-06', 'cargo',  980.00, 'Gasolinera Pemex',  'Gasolina',      'Carga de combustible'),
(3, '2026-08-21 15:25:00-06', 'cargo',  760.00, 'Starbucks',         'Alimentos',     'Consumo en Starbucks'),
(3, '2026-09-01 12:00:00-06', 'abono', 1200.00, 'Banca Móvil',       'Pago',          'Abono recibido');
