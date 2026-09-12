"use client";

import { useEffect, useState } from "react";
import { store } from "./store";
import { resolveProps } from "./resolve";
import type { ComponentNode } from "@/src/lib/a2ui";

// Un componente se suscribe a sus refs y solo a ellas: cuando cambia una
// vía updateDataModel, se re-resuelve y re-renderiza únicamente él, sin
// tocar el árbol ni a sus hermanos — LOTE-V.md sección 5.
export function useA2UINode(node: ComponentNode): Record<string, unknown> {
  const { id: _id, type: _type, children: _children, ...props } = node as Record<string, unknown>;
  const propsKey = JSON.stringify(props);
  const [resolved, setResolved] = useState<Record<string, unknown>>(() => resolveProps(props).resolved);

  useEffect(() => {
    const { resolved: inicial, refs } = resolveProps(props);
    setResolved(inicial);
    const desuscribir = refs.map((ruta) =>
      store.subscribe(ruta, () => {
        setResolved(resolveProps(props).resolved);
      })
    );
    return () => desuscribir.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propsKey]);

  return resolved;
}
