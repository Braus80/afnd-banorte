"use client";

import { useEffect, useState } from "react";
import { store } from "./store";

// Para convenciones fijas del contrato que no son props autoreferenciadas
// del nodo (p. ej. /presupuesto en ComparisonTable, LOTE-V.md sección 5).
export function useStorePath(ruta: string): unknown {
  const [valor, setValor] = useState<unknown>(() => store.get(ruta));

  useEffect(() => {
    setValor(store.get(ruta));
    return store.subscribe(ruta, () => setValor(store.get(ruta)));
  }, [ruta]);

  return valor;
}
