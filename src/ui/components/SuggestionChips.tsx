"use client";

import { useA2UINode } from "../useA2UINode";
import type { A2UIComponentProps } from "../types";

interface Chip {
  label: string;
  prompt: string;
}

export function SuggestionChips({ node, onEvento }: A2UIComponentProps) {
  console.debug("render", node.id);
  const { items } = useA2UINode(node) as { items?: Chip[] };

  return (
    <div className="a2ui-chips">
      {(items ?? []).map((chip, i) => (
        <button
          key={i}
          type="button"
          className="a2ui-chip"
          onClick={() => onEvento(node.id, "mensaje_libre", { texto: chip.prompt })}
        >
          <span className="a2ui-chip-icono" aria-hidden="true">
            💬
          </span>
          <span className="a2ui-chip-label">{chip.label}</span>
        </button>
      ))}
    </div>
  );
}
