"use client";

import { useSyncExternalStore } from "react";

// D22: estado de la lectura en voz alta. Vive fuera del store A2UI y del
// Renderer: es una affordance del shell, no un dato del agente. Una sola
// lectura a la vez en toda la página; PixyBubble observa `reproduciendo`
// para ponerse en "hablando".

export type EstadoVoz = "inactivo" | "cargando" | "reproduciendo";

const MAX_CACHE = 50;

let estado: EstadoVoz = "inactivo";
let textoActivo: string | null = null;
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

/** Detiene la lectura en curso (o cancela la descarga). Idempotente. */
export function detener(): void {
  abortActual?.abort();
  abortActual = null;
  if (audioActual) {
    soltarAudio(audioActual);
    audioActual = null;
  }
  if (estado !== "inactivo") fijar("inactivo", null);
}

/** Detiene solo si lo que suena es `texto` — para el unmount de una tarjeta. */
export function detenerSi(texto: string): void {
  if (textoActivo === texto.trim()) detener();
}

/** Pide el audio de `texto`, lo reproduce y actualiza el estado. Nunca lanza. */
export async function leer(texto: string): Promise<void> {
  const clave = texto.trim();
  if (!clave) return;
  detener();

  // El elemento se crea en el mismo tick del click: Safari solo deja
  // reproducir con sonido a un Audio nacido dentro del gesto del usuario.
  const audio = new Audio();
  audioActual = audio;
  const terminar = () => {
    if (audioActual !== audio) return;
    soltarAudio(audio);
    audioActual = null;
    fijar("inactivo", null);
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

function suscribir(fn: () => void) {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

// Snapshot primitivo (string) para que useSyncExternalStore compare por valor.
function snapshot(): string {
  return `${estado}|${textoActivo ?? ""}`;
}

function snapshotServidor(): string {
  return "inactivo|";
}

/** Estado de lectura de un texto concreto: "inactivo" si lo que suena es otro. */
export function useVoz(texto: string): { estado: EstadoVoz; alternar: () => void } {
  const snap = useSyncExternalStore(suscribir, snapshot, snapshotServidor);
  const clave = texto.trim();
  const [estadoGlobal, activo] = snap.split("|") as [EstadoVoz, string];
  const propio: EstadoVoz = activo === clave ? estadoGlobal : "inactivo";
  return {
    estado: propio,
    alternar: () => {
      if (propio === "inactivo") void leer(clave);
      else detener();
    },
  };
}

/** true mientras suena cualquier lectura — lo usa PixyBubble. */
export function useVozHablando(): boolean {
  const snap = useSyncExternalStore(suscribir, snapshot, snapshotServidor);
  return snap.startsWith("reproduciendo|");
}
