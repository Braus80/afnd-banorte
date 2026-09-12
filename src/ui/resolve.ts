// Resolvedor de {"$": "/ruta"}. Cualquier prop puede ser literal o
// referencia — LOTE-V.md sección 5. Recorre objetos/arrays anidados por si
// un $ref vive dentro de una prop compuesta (p. ej. summary de
// ActionConfirmationModal).

import { store } from "./store";

interface Ref {
  $: string;
}

function esRef(valor: unknown): valor is Ref {
  return (
    typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor) &&
    Object.keys(valor).length === 1 &&
    typeof (valor as Record<string, unknown>)["$"] === "string"
  );
}

function resolverValor(valor: unknown, refs: Set<string>): unknown {
  if (esRef(valor)) {
    refs.add(valor.$);
    return store.get(valor.$);
  }
  if (Array.isArray(valor)) return valor.map((v) => resolverValor(v, refs));
  if (valor && typeof valor === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) out[k] = resolverValor(v, refs);
    return out;
  }
  return valor;
}

export function resolveProps(props: Record<string, unknown>): {
  resolved: Record<string, unknown>;
  refs: string[];
} {
  const refs = new Set<string>();
  const resolved: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) resolved[k] = resolverValor(v, refs);
  return { resolved, refs: [...refs] };
}
