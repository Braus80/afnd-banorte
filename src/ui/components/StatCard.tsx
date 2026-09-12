"use client";

import { useA2UINode } from "../useA2UINode";
import type { A2UIComponentProps } from "../types";

function formatearValor(valor: unknown, format?: string): string {
  if (valor === undefined || valor === null) return "—";
  if (format === "currency" && typeof valor === "number") {
    return `$${valor.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MN`;
  }
  if (format === "percent" && typeof valor === "number") {
    return `${valor.toLocaleString("es-MX", { maximumFractionDigits: 2 })} %`;
  }
  return String(valor);
}

export function StatCard({ node }: A2UIComponentProps) {
  console.debug("render", node.id);
  const { label, value, format, tone } = useA2UINode(node) as {
    label?: string;
    value?: number | string;
    format?: "currency" | "percent" | "plain";
    tone?: "neutral" | "warn" | "good";
  };

  return (
    <div className={`a2ui-card a2ui-statcard a2ui-tone-${tone ?? "neutral"}`}>
      <span className="a2ui-label">{label}</span>
      <span className="a2ui-value">{formatearValor(value, format)}</span>
    </div>
  );
}
