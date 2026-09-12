"use client";

import { useA2UINode } from "../useA2UINode";
import type { A2UIComponentProps } from "../types";

interface ResumenItem {
  label: string;
  value: unknown;
  format?: string;
}

function formatear(valor: unknown, format?: string): string {
  if (valor === undefined || valor === null) return "—";
  if (format === "currency" && typeof valor === "number") {
    return `$${valor.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MN`;
  }
  if (format === "percent" && typeof valor === "number") return `${valor} %`;
  return String(valor);
}

export function ActionConfirmationModal({ node, onEvento }: A2UIComponentProps) {
  console.debug("render", node.id);
  const { title, summary, confirmLabel, cancelLabel, action } = useA2UINode(node) as {
    title?: string;
    summary?: ResumenItem[];
    confirmLabel?: string;
    cancelLabel?: string;
    action?: string;
  };

  return (
    <div className="a2ui-modal-overlay">
      <div className="a2ui-card a2ui-modal">
        {title && <h3>{title}</h3>}
        <ul className="a2ui-modal-resumen">
          {(summary ?? []).map((s, i) => (
            <li key={i}>
              <span>{s.label}</span>
              <span>{formatear(s.value, s.format)}</span>
            </li>
          ))}
        </ul>
        <div className="a2ui-modal-acciones">
          <button
            type="button"
            className="a2ui-boton-secundario"
            onClick={() => action && onEvento(node.id, action, { confirmado: false })}
          >
            {cancelLabel ?? "Cancelar"}
          </button>
          <button
            type="button"
            className="a2ui-boton-primario"
            onClick={() => action && onEvento(node.id, action, { confirmado: true })}
          >
            {confirmLabel ?? "Aplicar plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
