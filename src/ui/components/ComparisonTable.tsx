"use client";

import { useA2UINode } from "../useA2UINode";
import { useStorePath } from "../useStorePath";
import type { A2UIComponentProps } from "../types";

interface Columna {
  key: string;
  label: string;
  format?: "currency" | "percent" | "plain";
}

interface Fila {
  id?: string;
  key?: string;
  recomendado?: boolean;
  pago_mensual?: number;
  [prop: string]: unknown;
}

function formatearCelda(valor: unknown, format?: string): string {
  if (valor === undefined || valor === null) return "—";
  if (format === "currency" && typeof valor === "number") {
    return `$${valor.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MN`;
  }
  if (format === "percent" && typeof valor === "number") return `${valor} %`;
  return String(valor);
}

export function ComparisonTable({ node, onEvento }: A2UIComponentProps) {
  console.debug("render", node.id);
  const { columns, rows, selectedKey, action } = useA2UINode(node) as {
    columns?: Columna[];
    rows?: Fila[];
    selectedKey?: string;
    action?: string | null;
  };
  // /presupuesto no es prop autoreferenciada del nodo, es convención fija
  // del contrato (LOTE-V.md sección 5) — se suscribe aparte.
  const presupuesto = useStorePath("/presupuesto") as number | undefined;

  const cols = columns ?? [];
  const filas = rows ?? [];

  return (
    <div className="a2ui-card a2ui-comparison">
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => {
            const key = String(fila.id ?? fila.key ?? i);
            const seleccionada = selectedKey !== undefined && key === selectedKey;
            const atenuada =
              typeof presupuesto === "number" &&
              typeof fila.pago_mensual === "number" &&
              fila.pago_mensual > presupuesto;
            return (
              <tr
                key={key}
                className={[seleccionada && "a2ui-selected", atenuada && "a2ui-atenuada"]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => action && onEvento(node.id, action, { plan_id: key })}
              >
                {cols.map((c, ci) => (
                  <td key={c.key}>
                    {formatearCelda(fila[c.key], c.format)}
                    {ci === 0 && fila.recomendado ? <span className="a2ui-badge">Recomendado</span> : null}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
