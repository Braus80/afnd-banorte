// Tools falsas — mismo nombre y firma que tendrán las reales de L2.
// Cuando exista el servidor MCP real, este archivo se reemplaza y solo
// cambia el import en src/agent/tools.ts.
//
// Estado ("aplicar_plan guarda en memoria del proceso"): vive en memoria de
// este proceso Node. Se pierde en cada restart/redeploy — es lo esperado
// para un mock, y solo funciona porque el deploy es una sola instancia
// persistente (ver ADR D13).

export interface Usuario {
  id: string;
  nombre: string;
}

export interface Diagnostico {
  usuario: Usuario;
  saldo: number;
  tasaActual: number;
}

export interface PlanCatalogo {
  id: string;
  tasa: number;
}

export interface PlanSimulado {
  id: string;
  tasa: number;
  plazo_meses: number;
  pago_mensual: number;
  interes_total: number;
  recomendado: boolean;
}

export type Perfil = "sencillo" | "normal" | "detallado";

const USUARIO: Usuario = { id: "u-sofia", nombre: "Sofía" };
const CUENTA_ID = "cta-sofia-1";
const SALDO = 85240;
const TASA_ACTUAL = 68.5;

const CATALOGO_PLANES: PlanCatalogo[] = [
  { id: "plan-a", tasa: 20.75 },
  { id: "plan-b", tasa: 22.75 },
  { id: "plan-c", tasa: 25.75 },
];

interface EstadoCuenta {
  planAplicado: { planId: string; plazoMeses: number; aplicadoEn: number } | null;
}

const estadoPorCuenta = new Map<string, EstadoCuenta>();
const perfilPorUsuario = new Map<string, Perfil>();
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

export async function obtener_diagnostico(): Promise<Diagnostico> {
  return { usuario: USUARIO, saldo: SALDO, tasaActual: TASA_ACTUAL };
}

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

export async function aplicar_plan(
  usuario_id: string,
  cuenta_id: string,
  plan_id: string
): Promise<{ ok: true; planId: string; plazoMeses: number }> {
  const plazoMeses = ultimoPlazoPorCuenta.get(cuenta_id) ?? 12;
  estadoPorCuenta.set(cuenta_id, {
    planAplicado: { planId: plan_id, plazoMeses, aplicadoEn: Date.now() },
  });
  return { ok: true, planId: plan_id, plazoMeses };
}

export async function deshacer_plan(
  usuario_id: string,
  cuenta_id: string
): Promise<{ ok: true }> {
  estadoPorCuenta.set(cuenta_id, { planAplicado: null });
  return { ok: true };
}

export async function guardar_perfil(
  usuario_id: string,
  perfil: Perfil
): Promise<{ ok: true }> {
  perfilPorUsuario.set(usuario_id, perfil);
  return { ok: true };
}

// Helpers de lectura para el router — no son "tools" del catálogo del agente.
export function obtenerPerfilGuardado(usuario_id: string): Perfil | null {
  return perfilPorUsuario.get(usuario_id) ?? null;
}

export function obtenerCatalogoPlanes(): PlanCatalogo[] {
  return CATALOGO_PLANES;
}

export function obtenerEstadoCuenta(cuenta_id: string): EstadoCuenta {
  return estadoPorCuenta.get(cuenta_id) ?? { planAplicado: null };
}

export function obtenerUsuarioId(): string {
  return USUARIO.id;
}

export function obtenerCuentaId(): string {
  return CUENTA_ID;
}

// ---------------------------------------------------------------------------
// Segunda intención (ADR D24): "¿en qué se me va el dinero?"
//
// Firma que tiger.ts debe replicar:
//   obtener_movimientos(usuario_id) → ResumenMovimientos
// SQL equivalente sobre db/esquema.sql:
//   SELECT c.nombre, m.fecha, m.concepto, m.monto
//   FROM movimientos m JOIN categorias_gasto c ON c.id = m.categoria_id
//   WHERE m.usuario_id = $1 AND m.tipo <> 'Ingreso'
//     AND m.fecha >= now() - interval '30 days'
//   agrupado por categoría, total desc; movimientos por fecha desc.
//
// Los datos replican literalmente las filas de Sofía (usuario 1) en
// db/seed.sql para que la pantalla no cambie cuando el mock se reemplace
// por Tiger Data. No se filtra por reloj: el seed está fijo en sep 2026.

export interface Movimiento {
  fecha: string; // ISO yyyy-mm-dd
  descripcion: string;
  monto: number;
}

export interface CategoriaGasto {
  id: string; // slug estable, sirve de key de fila en ComparisonTable
  categoria: string;
  icono?: string;
  total: number;
  porcentaje: number; // del total del mes, 1 decimal
  movimientos: Movimiento[]; // más reciente primero
}

export interface ResumenMovimientos {
  usuario_id: string;
  periodo: { desde: string; hasta: string };
  total_mes: number;
  categorias: CategoriaGasto[]; // total desc
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

// db/seed.sql, tabla movimientos, usuario 1, sin la fila de 'Ingreso'.
const MOVIMIENTOS_SOFIA: (Movimiento & { categoria: string })[] = [
  { fecha: "2026-09-01", descripcion: "Soriana", monto: 1750, categoria: "Alimentos" },
  { fecha: "2026-09-02", descripcion: "Agua y Drenaje", monto: 320, categoria: "Servicios" },
  { fecha: "2026-09-03", descripcion: "Transporte", monto: 480, categoria: "Transporte" },
  { fecha: "2026-09-04", descripcion: "CFE", monto: 890, categoria: "Servicios" },
  { fecha: "2026-09-05", descripcion: "Coppel", monto: 1200, categoria: "Compras" },
  { fecha: "2026-09-06", descripcion: "Transferencia a Ana Martínez", monto: 1000, categoria: "Transferencias" },
  { fecha: "2026-09-08", descripcion: "OXXO", monto: 185, categoria: "Alimentos" },
  { fecha: "2026-09-10", descripcion: "Telcel", monto: 399, categoria: "Servicios" },
];

function slugCategoria(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

export async function obtener_movimientos(usuario_id: string): Promise<ResumenMovimientos> {
  const filas = usuario_id === USUARIO.id ? MOVIMIENTOS_SOFIA : [];
  const porCategoria = new Map<string, Movimiento[]>();
  for (const { categoria, ...mov } of filas) {
    const lista = porCategoria.get(categoria) ?? [];
    lista.push(mov);
    porCategoria.set(categoria, lista);
  }
  const total_mes = redondear(filas.reduce((s, m) => s + m.monto, 0));
  const categorias: CategoriaGasto[] = [...porCategoria.entries()]
    .map(([categoria, movimientos]) => {
      const total = redondear(movimientos.reduce((s, m) => s + m.monto, 0));
      return {
        id: slugCategoria(categoria),
        categoria,
        icono: ICONO_CATEGORIA[categoria],
        total,
        porcentaje: total_mes > 0 ? Math.round((total / total_mes) * 1000) / 10 : 0,
        movimientos: [...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha)),
      };
    })
    .sort((a, b) => b.total - a.total);
  const fechas = filas.map((f) => f.fecha).sort();
  return {
    usuario_id,
    periodo: { desde: fechas[0] ?? "", hasta: fechas[fechas.length - 1] ?? "" },
    total_mes,
    categorias,
  };
}
