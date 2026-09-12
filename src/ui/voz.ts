"use client";

import { useSyncExternalStore } from "react";

// D22: estado de la lectura en voz alta. Vive fuera del store A2UI y del
// Renderer: es una affordance del shell, no un dato del agente. Una sola
// lectura a la vez en toda la página; PixyBubble observa `reproduciendo`
// para ponerse en "hablando".
//
// D23: modo de lectura continua. Se activa al tocar la bocina; mientras esté
// activo, cada ExplanationCard que se monta (llega por updateComponents) se
// lee sola vía `leerAutomatico`. Un fallo de /api/voz no apaga el modo.

export type EstadoVoz = "inactivo" | "cargando" | "reproduciendo";

const MAX_CACHE = 50;

let estado: EstadoVoz = "inactivo";
let textoActivo: string | null = null;
let modoContinuo = false;
let cola: string[] = []; // tarjetas del mismo lote que esperan turno (D23)
let lotePendiente: string[] | null = null; // montajes del mismo commit de React, aún sin despachar
let audioActual: HTMLAudioElement | null = null;
let abortActual: AbortController | null = null;
const oyentes = new Set<() => void>();
const cache = new Map<string, string>(); // texto → object URL del audio ya descargado

function notificar() {
  oyentes.forEach((fn) => fn());
}

function fijar(nuevo: EstadoVoz, texto: string | null) {
  estado = nuevo;
  textoActivo = texto;
  notificar();
}

function fijarModo(activo: boolean) {
  if (modoContinuo === activo) return;
  modoContinuo = activo;
  notificar();
}

function guardarEnCache(clave: string, url: string) {
  if (cache.size >= MAX_CACHE) {
    const masViejo = cache.keys().next().value;
    if (masViejo !== undefined) {
      URL.revokeObjectURL(cache.get(masViejo)!);
      cache.delete(masViejo);
    }
  }
  cache.set(clave, url);
}

function soltarAudio(audio: HTMLAudioElement) {
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  audio.removeAttribute("src");
}

// Corta el audio o la descarga en curso sin tocar la cola: lo usa `leer`
// para garantizar un solo audio a la vez.
function detenerAudio() {
  abortActual?.abort();
  abortActual = null;
  if (audioActual) {
    soltarAudio(audioActual);
    audioActual = null;
  }
  if (estado !== "inactivo") fijar("inactivo", null);
}

/** Detiene la lectura en curso (o cancela la descarga) y vacía la cola. Idempotente. */
export function detener(): void {
  cola = [];
  lotePendiente = null;
  detenerAudio();
}

/** Detiene solo si lo que suena es `texto` — para el unmount de una tarjeta. */
export function detenerSi(texto: string): void {
  if (textoActivo === texto.trim()) detener();
}

function siguienteEnCola() {
  if (!modoContinuo) {
    cola = [];
    return;
  }
  const siguiente = cola.shift();
  if (siguiente) void leer(siguiente);
}

/** Pide el audio de `texto`, lo reproduce y actualiza el estado. Nunca lanza. */
export async function leer(texto: string): Promise<void> {
  const clave = texto.trim();
  if (!clave) return;
  detenerAudio();

  // El elemento se crea en el mismo tick del click: Safari solo deja
  // reproducir con sonido a un Audio nacido dentro del gesto del usuario.
  const audio = new Audio();
  audioActual = audio;
  const terminar = () => {
    if (audioActual !== audio) return;
    soltarAudio(audio);
    audioActual = null;
    fijar("inactivo", null);
    siguienteEnCola();
  };
  audio.onended = terminar;
  audio.onerror = terminar;

  fijar("cargando", clave);

  let url = cache.get(clave);
  if (!url) {
    const ctrl = new AbortController();
    abortActual = ctrl;
    try {
      const res = await fetch("/api/voz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: clave }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`voz: /api/voz respondió ${res.status}`);
      const blob = await res.blob();
      if (ctrl.signal.aborted) return; // detuvieron mientras bajaba
      url = URL.createObjectURL(blob);
      guardarEnCache(clave, url);
    } catch (e) {
      if (ctrl.signal.aborted) return; // cancelación explícita, ya está en inactivo
      // D23: la tarjeta no suena, pero el modo continuo sigue activo y la
      // cola avanza — el fallo es de esta lectura, no del modo.
      console.warn("voz no disponible, se vuelve a inactivo:", e);
      abortActual = null;
      terminar();
      return;
    }
    abortActual = null;
  }

  if (audioActual !== audio) return; // detuvieron entre la descarga y el play
  audio.src = url;
  try {
    await audio.play();
    if (audioActual === audio) fijar("reproduciendo", clave);
  } catch (e) {
    console.warn("voz: el navegador no dejó reproducir:", e);
    terminar();
  }
}

/** Toque de la bocina con el modo apagado: lee esta tarjeta y enciende el modo continuo. */
export function activarLecturaContinua(texto: string): void {
  fijarModo(true);
  void leer(texto);
}

/** Toque de la bocina con el modo encendido: apaga el modo y detiene lo que suene. */
export function desactivarLecturaContinua(): void {
  fijarModo(false);
  detener();
}

/**
 * Lo llama ExplanationCard al montarse. Solo hace algo con el modo continuo
 * activo. Los montajes de un mismo commit de React se juntan en un lote
 * (microtask): un lote nuevo corta lo que sonaba, se lee su primera tarjeta
 * y las demás esperan turno en la cola — un solo audio a la vez.
 */
export function leerAutomatico(texto: string): void {
  if (!modoContinuo) return;
  const clave = texto.trim();
  if (!clave) return;
  if (lotePendiente) {
    if (!lotePendiente.includes(clave)) lotePendiente.push(clave);
    return;
  }
  lotePendiente = [clave];
  queueMicrotask(() => {
    const lote = lotePendiente ?? [];
    lotePendiente = null;
    if (!modoContinuo || lote.length === 0) return;
    detener();
    cola = lote.slice(1);
    void leer(lote[0]);
  });
}

function suscribir(fn: () => void) {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

// Snapshot primitivo (string) para que useSyncExternalStore compare por valor.
function snapshot(): string {
  return `${estado}|${modoContinuo ? "1" : "0"}|${textoActivo ?? ""}`;
}

function snapshotServidor(): string {
  return "inactivo|0|";
}

/** Estado de lectura de un texto concreto ("inactivo" si lo que suena es otro) y del modo continuo. */
export function useVoz(texto: string): { estado: EstadoVoz; continuo: boolean; alternar: () => void } {
  const snap = useSyncExternalStore(suscribir, snapshot, snapshotServidor);
  const clave = texto.trim();
  const [estadoGlobal, modo, activo] = snap.split("|") as [EstadoVoz, "0" | "1", string];
  const continuo = modo === "1";
  return {
    estado: activo === clave ? estadoGlobal : "inactivo",
    continuo,
    alternar: () => {
      if (continuo) desactivarLecturaContinua();
      else activarLecturaContinua(clave);
    },
  };
}

/** true mientras suena cualquier lectura — lo usa PixyBubble. */
export function useVozHablando(): boolean {
  const snap = useSyncExternalStore(suscribir, snapshot, snapshotServidor);
  return snap.startsWith("reproduciendo|");
}
