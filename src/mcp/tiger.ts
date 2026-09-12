// Tools reales contra Tiger Cloud (PostgreSQL) — ADR D25.
//
// MISMAS firmas que src/mcp/mock.ts: ese archivo es el contrato. Los tipos se
// importan de ahí para que no puedan divergir. src/agent/tools.ts importa de
// aquí; el router sigue usando el mock para el camino directo (D8).
//
// Esquema: db/esquema.sql. Datos: db/seed.sql (TRUNCATE ... RESTART IDENTITY,
// así que Sofía es usuarios.id = 1 y su tarjeta •••• 4321 es cuentas.id = 1).

import { Pool, type PoolClient } from "pg";
import type {
  CategoriaGasto,
  Diagnostico,
  Movimiento,
  Perfil,
  PlanCatalogo,
  PlanSimulado,
  ResumenMovimientos,
} from "./mock";

export type { CategoriaGasto, Diagnostico, Movimiento, Perfil, PlanCatalogo, PlanSimulado, ResumenMovimientos, Usuario } from "./mock";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "tiger: falta DATABASE_URL en el entorno. Defínela en .env.local (local) o en el dashboard de " +
      "DigitalOcean (deploy) con la cadena de Tiger Cloud, o vuelve al mock cambiando el import de " +
      "src/agent/tools.ts a @/src/mcp/mock. La cadena nunca va en el código."
  );
}

// Tiger Cloud exige TLS: la cadena trae ?sslmode=require y pg lo respeta.
// Si el certificado no valida en tu red, agrega &uselibpqcompat=true a la
// cadena (semántica libpq: cifra sin verificar) — cambio de entorno, no de código.
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 5_000, // fallar claro, no colgarse, si la base no responde
  idleTimeoutMillis: 30_000,
});
pool.on("error", (e) => console.error("tiger: error en una conexión ociosa del pool:", e.message));

const USUARIO_ID = "1"; // Sofía — db/seed.sql
const CUENTA_ID = "1"; // tarjeta •••• 4321 de Sofía

// Mismo catálogo que el mock; la tasa identifica al plan en planes_credito
// (db/seed.sql: 20.75 → "Banorte Solución 12 meses", 22.75 → 18 meses,
// 25.75 → 24 meses).
const CATALOGO_PLANES: PlanCatalogo[] = [
  { id: "plan-a", tasa: 20.75 },
  { id: "plan-b", tasa: 22.75 },
  { id: "plan-c", tasa: 25.75 },
];

// Igual que en el mock: el plazo de la última simulación vive en memoria del
// proceso (D13). Se llena cuando el agente llama simular_planes vía tools.ts.
const ultimoPlazoPorCuenta = new Map<string, number>();

function cuotaMensual(saldo: number, tasaAnualPorc: number, plazoMeses: number): number {
  const i = tasaAnualPorc / 100 / 12;
  if (i === 0) return saldo / plazoMeses;
  const factor = Math.pow(1 + i, plazoMeses);
  return (saldo * i * factor) / (factor - 1);
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

function primerNombre(nombreCompleto: string): string {
  return nombreCompleto.trim().split(/\s+/)[0] ?? nombreCompleto;
}

export async function obtener_diagnostico(): Promise<Diagnostico> {
  const { rows } = await pool.query<{ usuario_id: number; nombre: string; saldo_actual: string; tasa_interes_anual: string }>(
    `SELECT u.id AS usuario_id, u.nombre, c.saldo_actual, c.tasa_interes_anual
       FROM cuentas c JOIN usuarios u ON u.id = c.usuario_id
      WHERE c.id = $1`,
    [CUENTA_ID]
  );
  const fila = rows[0];
  if (!fila) throw new Error(`tiger: no existe la cuenta ${CUENTA_ID}`);
  return {
    // El mock devuelve "Sofía"; la base guarda "Sofía Torres". Primer nombre
    // para que el copy del agente suene igual.
    usuario: { id: String(fila.usuario_id), nombre: primerNombre(fila.nombre) },
    saldo: Number(fila.saldo_actual),
    tasaActual: Number(fila.tasa_interes_anual),
  };
}

// Matemática pura, copiada del mock tal cual.
export async function simular_planes(
  saldo: number,
  planes: { id: string; plazoMeses: number }[]
): Promise<PlanSimulado[]> {
  const calculados = planes.map(({ id, plazoMeses }) => {
    const catalogo = CATALOGO_PLANES.find((p) => p.id === id);
    if (!catalogo) throw new Error(`plan desconocido: ${id}`);
    const pago_mensual = redondear(cuotaMensual(saldo, catalogo.tasa, plazoMeses));
    const interes_total = redondear(pago_mensual * plazoMeses - saldo);
    ultimoPlazoPorCuenta.set(CUENTA_ID, plazoMeses);
    return { id, tasa: catalogo.tasa, plazo_meses: plazoMeses, pago_mensual, interes_total };
  });
  // LOTE-V.md sección 5, ComparisonTable: badge "Recomendado" en la fila
  // que trae recomendado: true. Convención: menor interés total.
  const minInteres = Math.min(...calculados.map((p) => p.interes_total));
  return calculados.map((p) => ({ ...p, recomendado: p.interes_total === minInteres }));
}

interface PlanActivo {
  id: number;
  saldo_inicial: string;
}

// Dentro de una transacción: si la cuenta ya tiene un plan activo, lo revierte
// (saldo y estado originales, fila fuera) para que aplicar dos veces no
// encadene saldos. Devuelve el saldo original o null si no había plan.
async function revertirPlanActivo(client: PoolClient, cuentaId: string): Promise<number | null> {
  const { rows } = await client.query<PlanActivo>(
    `SELECT id, saldo_inicial FROM planes_aplicados
      WHERE cuenta_id = $1 AND estado = 'activo'
      ORDER BY fecha_aplicacion DESC, id DESC
      LIMIT 1 FOR UPDATE`,
    [cuentaId]
  );
  const activo = rows[0];
  if (!activo) return null;
  const saldoInicial = Number(activo.saldo_inicial);
  await client.query(`UPDATE cuentas SET saldo_actual = $1, estado = 'activo' WHERE id = $2`, [saldoInicial, cuentaId]);
  // D25: deshacer vuelve la base al estado inicial exacto, así que la fila se
  // borra (el comentario "bitácora" de db/esquema.sql cede ante ese criterio).
  await client.query(`DELETE FROM planes_aplicados WHERE id = $1`, [activo.id]);
  return saldoInicial;
}

export async function aplicar_plan(
  usuario_id: string,
  cuenta_id: string,
  plan_id: string
): Promise<{
  ok: true;
  planId: string;
  plazoMeses: number;
  pagoMensual: number;
  interesTotal: number;
  montoTotalPagar: number;
  planAplicadoId: number;
}> {
  const catalogo = CATALOGO_PLANES.find((p) => p.id === plan_id);
  if (!catalogo) throw new Error(`plan desconocido: ${plan_id}`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cuenta = await client.query<{ saldo_actual: string }>(
      `SELECT saldo_actual FROM cuentas WHERE id = $1 AND usuario_id = $2 FOR UPDATE`,
      [cuenta_id, usuario_id]
    );
    if (!cuenta.rows[0]) throw new Error(`tiger: la cuenta ${cuenta_id} no pertenece al usuario ${usuario_id}`);
    const saldoInicial = (await revertirPlanActivo(client, cuenta_id)) ?? Number(cuenta.rows[0].saldo_actual);

    const plan = await client.query<{ id: number; plazo_meses: number; descuento_principal_porcentaje: string }>(
      `SELECT id, plazo_meses, descuento_principal_porcentaje
         FROM planes_credito WHERE tasa_interes_anual = $1 AND activo
        ORDER BY id LIMIT 1`,
      [catalogo.tasa]
    );
    if (!plan.rows[0]) throw new Error(`tiger: no hay plan de crédito activo con tasa ${catalogo.tasa}`);

    // Plazo: el de la última simulación (contrato del mock); si el agente no
    // simuló en este proceso, el plazo propio del plan en el catálogo.
    const plazoMeses = ultimoPlazoPorCuenta.get(cuenta_id) ?? Number(plan.rows[0].plazo_meses);
    // El descuento se resta del principal ANTES de amortizar.
    const descuento = redondear((saldoInicial * Number(plan.rows[0].descuento_principal_porcentaje)) / 100);
    const montoReestructurado = redondear(saldoInicial - descuento);
    const pagoMensual = redondear(cuotaMensual(montoReestructurado, catalogo.tasa, plazoMeses));
    const interesTotal = redondear(pagoMensual * plazoMeses - montoReestructurado);
    const montoTotalPagar = redondear(montoReestructurado + interesTotal);

    const insertado = await client.query<{ id: number }>(
      `INSERT INTO planes_aplicados
         (usuario_id, cuenta_id, plan_credito_id, saldo_inicial, descuento_aplicado, monto_reestructurado,
          tasa_interes_anual, plazo_meses, pago_mensual, interes_total, monto_total_pagar, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'activo')
       RETURNING id`,
      [
        usuario_id,
        cuenta_id,
        plan.rows[0].id,
        saldoInicial,
        descuento,
        montoReestructurado,
        catalogo.tasa,
        plazoMeses,
        pagoMensual,
        interesTotal,
        montoTotalPagar,
      ]
    );
    // La tarjeta pasa a "reestructurado" y su saldo a lo que se va a pagar
    // bajo el plan (capital tras descuento + interés total). deshacer restaura
    // saldo_inicial y 'activo'.
    await client.query(`UPDATE cuentas SET saldo_actual = $1, estado = 'reestructurado' WHERE id = $2`, [
      montoTotalPagar,
      cuenta_id,
    ]);

    await client.query("COMMIT");
    return {
      ok: true,
      planId: plan_id,
      plazoMeses,
      pagoMensual,
      interesTotal,
      montoTotalPagar,
      planAplicadoId: insertado.rows[0].id,
    };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function deshacer_plan(usuario_id: string, cuenta_id: string): Promise<{ ok: true }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cuenta = await client.query(`SELECT 1 FROM cuentas WHERE id = $1 AND usuario_id = $2 FOR UPDATE`, [
      cuenta_id,
      usuario_id,
    ]);
    if (!cuenta.rows[0]) throw new Error(`tiger: la cuenta ${cuenta_id} no pertenece al usuario ${usuario_id}`);
    await revertirPlanActivo(client, cuenta_id); // sin plan activo es no-op, igual que el mock
    await client.query("COMMIT");
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function guardar_perfil(usuario_id: string, perfil: Perfil): Promise<{ ok: true }> {
  // usuarios.perfil es JSONB { "modo": ... } (db/esquema.sql, D12).
  const { rowCount } = await pool.query(
    `UPDATE usuarios SET perfil = COALESCE(perfil, '{}'::jsonb) || jsonb_build_object('modo', $2::text) WHERE id = $1`,
    [usuario_id, perfil]
  );
  if (!rowCount) throw new Error(`tiger: no existe el usuario ${usuario_id}`);
  return { ok: true };
}

const ICONO_CATEGORIA: Record<string, string> = {
  Alimentos: "🛒",
  Transporte: "🚌",
  Servicios: "💡",
  Entretenimiento: "🎬",
  Compras: "🛍️",
  Transferencias: "🔁",
  Otros: "📦",
};

function slugCategoria(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

export async function obtener_movimientos(usuario_id: string): Promise<ResumenMovimientos> {
  // "Último mes" = los 30 días anteriores al movimiento más reciente del
  // usuario, no al reloj: el seed está fijo en sep 2026 y el demo no debe
  // quedarse en blanco cuando pase el mes.
  const { rows } = await pool.query<{ categoria: string; fecha: string; concepto: string; monto: string }>(
    `WITH tope AS (
       SELECT COALESCE(MAX(fecha), now()) AS hasta
         FROM movimientos WHERE usuario_id = $1 AND tipo <> 'Ingreso'
     )
     SELECT COALESCE(c.nombre, 'Otros') AS categoria,
            to_char(m.fecha AT TIME ZONE 'America/Monterrey', 'YYYY-MM-DD') AS fecha,
            m.concepto, m.monto
       FROM movimientos m
       LEFT JOIN categorias_gasto c ON c.id = m.categoria_id
       CROSS JOIN tope
      WHERE m.usuario_id = $1 AND m.tipo <> 'Ingreso' AND m.estado <> 'Rechazado'
        AND m.fecha >= tope.hasta - interval '30 days'
      ORDER BY m.fecha DESC`,
    [usuario_id]
  );

  const porCategoria = new Map<string, Movimiento[]>();
  for (const f of rows) {
    const lista = porCategoria.get(f.categoria) ?? [];
    lista.push({ fecha: f.fecha, descripcion: f.concepto, monto: Number(f.monto) });
    porCategoria.set(f.categoria, lista);
  }
  const total_mes = redondear(rows.reduce((s, f) => s + Number(f.monto), 0));
  const categorias: CategoriaGasto[] = [...porCategoria.entries()]
    .map(([categoria, movimientos]) => {
      const total = redondear(movimientos.reduce((s, m) => s + m.monto, 0));
      return {
        id: slugCategoria(categoria),
        categoria,
        icono: ICONO_CATEGORIA[categoria],
        total,
        porcentaje: total_mes > 0 ? Math.round((total / total_mes) * 1000) / 10 : 0,
        movimientos, // ya vienen del más reciente al más antiguo
      };
    })
    .sort((a, b) => b.total - a.total);
  const fechas = rows.map((f) => f.fecha).sort();
  return {
    usuario_id,
    periodo: { desde: fechas[0] ?? "", hasta: fechas[fechas.length - 1] ?? "" },
    total_mes,
    categorias,
  };
}

// Helpers que tools.ts importa del módulo de tools — misma firma que el mock.
export function obtenerCatalogoPlanes(): PlanCatalogo[] {
  return CATALOGO_PLANES;
}

export function obtenerUsuarioId(): string {
  return USUARIO_ID;
}

export function obtenerCuentaId(): string {
  return CUENTA_ID;
}
