"use client";

import { useA2UINode } from "../useA2UINode";
import type { A2UIComponentProps } from "../types";

interface ItemPago {
  fecha: string;
  monto: number;
  estado: string;
}

export function ScheduleList({ node }: A2UIComponentProps) {
  console.debug("render", node.id);
  const { items, emptyLabel } = useA2UINode(node) as {
    items?: ItemPago[];
    emptyLabel?: string;
  };
  const lista = items ?? [];

  return (
    <div className="a2ui-card a2ui-schedule">
      {lista.length === 0 ? (
        <p>{emptyLabel ?? "Sin pagos programados."}</p>
      ) : (
        <ul>
          {lista.map((it, i) => (
            <li key={i} className="a2ui-schedule-item">
              <span>{it.fecha}</span>
              <span>${it.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MN</span>
              <span className="a2ui-estado">{it.estado}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
