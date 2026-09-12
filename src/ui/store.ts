// Data model del front: objeto anidado, direccionable por rutas con barra
// ("/simulacion/pagoMensual"). Suscripción exacta por ruta — LOTE-V.md
// sección 5: "notifica solo a los suscriptores de esas rutas".

type Callback = () => void;
type Nodo = { [clave: string]: unknown };

function partes(ruta: string): string[] {
  return ruta.split("/").filter(Boolean);
}

class DataModelStore {
  private datos: Nodo = {};
  private suscriptores = new Map<string, Set<Callback>>();

  get(ruta: string): unknown {
    let actual: unknown = this.datos;
    for (const p of partes(ruta)) {
      if (typeof actual !== "object" || actual === null) return undefined;
      actual = (actual as Nodo)[p];
    }
    return actual;
  }

  set(ruta: string, valor: unknown): void {
    const segs = partes(ruta);
    if (segs.length === 0) return;
    let actual: Nodo = this.datos;
    for (let i = 0; i < segs.length - 1; i++) {
      const seg = segs[i];
      if (typeof actual[seg] !== "object" || actual[seg] === null) actual[seg] = {};
      actual = actual[seg] as Nodo;
    }
    actual[segs[segs.length - 1]] = valor;
  }

  subscribe(ruta: string, cb: Callback): () => void {
    let set = this.suscriptores.get(ruta);
    if (!set) {
      set = new Set();
      this.suscriptores.set(ruta, set);
    }
    set.add(cb);
    return () => {
      set!.delete(cb);
      if (set!.size === 0) this.suscriptores.delete(ruta);
    };
  }

  applyDataModel(patch: Record<string, unknown>): void {
    const rutas = Object.keys(patch);
    for (const ruta of rutas) this.set(ruta, patch[ruta]);
    for (const ruta of rutas) {
      const set = this.suscriptores.get(ruta);
      if (set) for (const cb of set) cb();
    }
  }

  reset(): void {
    this.datos = {};
  }
}

export const store = new DataModelStore();
