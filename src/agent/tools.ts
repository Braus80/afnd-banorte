import type { ToolDeclaration } from "@/src/lib/llm";
import {
  obtener_diagnostico,
  simular_planes,
  aplicar_plan,
  deshacer_plan,
  guardar_perfil,
  obtener_movimientos,
  obtenerCatalogoPlanes,
  obtenerUsuarioId,
  obtenerCuentaId,
  type Perfil,
} from "@/src/mcp/tiger";

export const TOOL_DECLARATIONS: ToolDeclaration[] = [
  {
    name: "obtener_diagnostico",
    description: "Obtiene el diagnóstico financiero actual del usuario: saldo y tasa actual.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "simular_planes",
    description: "Calcula pago mensual e interés total de cada plan del catálogo a un plazo dado.",
    parameters: {
      type: "object",
      properties: {
        plazoMeses: { type: "number", description: "Plazo en meses a simular para todos los planes." },
      },
      required: ["plazoMeses"],
    },
  },
  {
    name: "seleccionar_plan",
    description:
      "Marca como elegido un plan del comparador (mismo efecto que el clic en su fila): llena /simulacion/selectedKey, /simulacion/plazo, /simulacion/pagoMensual e /simulacion/interesTotal en el data model. Llámala cuando el usuario elija un plan por texto ('quiero el plan C') antes de mostrar el ActionConfirmationModal.",
    parameters: {
      type: "object",
      properties: { plan_id: { type: "string", description: "id del plan (plan-a, plan-b, plan-c)." } },
      required: ["plan_id"],
    },
  },
  {
    name: "aplicar_plan",
    description: "Aplica el plan elegido a la cuenta del usuario.",
    parameters: {
      type: "object",
      properties: { plan_id: { type: "string", description: "id del plan del catálogo (plan-a, plan-b, plan-c)." } },
      required: ["plan_id"],
    },
  },
  {
    name: "deshacer_plan",
    description: "Revierte el último plan aplicado a la cuenta.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "obtener_movimientos",
    description:
      "Movimientos del último mes del usuario agrupados por categoría de gasto (total, porcentaje y detalle), ordenados de mayor a menor, más el total del mes. Úsala cuando el usuario pregunte en qué se le va el dinero, en qué gasta o pida ver sus gastos o movimientos (D24).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "guardar_perfil",
    description: "Guarda el perfil de accesibilidad que eligió el usuario.",
    parameters: {
      type: "object",
      properties: { perfil: { type: "string", enum: ["sencillo", "normal", "detallado"] } },
      required: ["perfil"],
    },
  },
];

export async function ejecutarTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const usuarioId = obtenerUsuarioId();
  const cuentaId = obtenerCuentaId();

  switch (name) {
    case "obtener_diagnostico":
      return obtener_diagnostico();

    case "simular_planes": {
      const plazoMeses = Number(args.plazoMeses);
      const { saldo } = await obtener_diagnostico();
      const planes = obtenerCatalogoPlanes().map((p) => ({ id: p.id, plazoMeses }));
      return simular_planes(saldo, planes);
    }

    case "seleccionar_plan":
      // Necesita el data model de la sesión: la resuelve el router antes de
      // llegar aquí (correrTurnoAgente). Si llega, es un bug de cableado.
      throw new Error("seleccionar_plan se resuelve en el router, no en ejecutarTool");

    case "aplicar_plan":
      return aplicar_plan(usuarioId, cuentaId, String(args.plan_id));

    case "deshacer_plan":
      return deshacer_plan(usuarioId, cuentaId);

    case "obtener_movimientos":
      return obtener_movimientos(usuarioId);

    case "guardar_perfil":
      return guardar_perfil(usuarioId, args.perfil as Perfil);

    default:
      throw new Error(`tool desconocida: ${name}`);
  }
}
