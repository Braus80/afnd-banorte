"use client";

import { useA2UINode } from "../useA2UINode";
import type { A2UIComponentProps } from "../types";

export function ExplanationCard({ node }: A2UIComponentProps) {
  console.debug("render", node.id);
  const { title, body, bullets } = useA2UINode(node) as {
    title?: string;
    body?: string;
    bullets?: string[];
  };
  const lista = (bullets ?? []).slice(0, 4);

  return (
    <div className="a2ui-card a2ui-explanation">
      {title && <h3>{title}</h3>}
      {body && <p>{body}</p>}
      {lista.length > 0 && (
        <ul>
          {lista.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
