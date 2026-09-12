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
