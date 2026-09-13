"use client";

import { useEffect, useRef, useState } from "react";
import { store } from "./store";
import { sendEvent } from "./sendEvent";
import { COMPONENTS } from "./components";
import { TextInput } from "./TextInput";
import { PixyBubble } from "./PixyBubble";
import type { A2UIMessage, ComponentNode, Profile } from "@/src/lib/a2ui";
import type { OnEvento } from "./types";

const SURFACE_ID = "main"; // única superficie del MVP — A2UI.md sección 2
const ACCIONES_SIN_ESPERA = new Set(["simular", "seleccionar_plan"]); // caminos directos, sin LLM

export function AppRenderer() {
  const [root, setRoot] = useState<ComponentNode | null>(null);
  const [, setTitle] = useState("");
  const [profile, setProfile] = useState<Profile>("normal");
  const [conectado, setConectado] = useState(false);
  const [pensando, setPensando] = useState(false);
  const reintentoRef = useRef(1000);
  // Espejos del estado para decidir dentro del handler del EventSource sin
  // depender de closures viejos.
  const rootRef = useRef<ComponentNode | null>(null);
  const perfilRef = useRef<Profile>("normal");

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelado = false;

    function manejarMensaje(m: A2UIMessage) {
      setPensando(false);
      if ("createSurface" in m) {
        const perfilNuevo = m.createSurface.profile ?? "normal";
        setTitle(m.createSurface.title);
        // D28: una reconexión rehidrata con createSurface del MISMO perfil
        // seguido del data model completo y el árbol vigente. Si ya hay
        // pantalla montada, no se desmonta ni se vacía el store: React
        // reconcilia por id, no hay destello de "Cargando…" ni reinicio de
        // la lectura en voz. Perfil distinto = superficie nueva de verdad.
        if (perfilNuevo === perfilRef.current && rootRef.current) return;
        perfilRef.current = perfilNuevo;
        store.reset();
        setProfile(perfilNuevo);
        setRoot(null);
        rootRef.current = null;
        return;
      }
      if ("updateComponents" in m) {
        rootRef.current = m.updateComponents.root;
        setRoot(m.updateComponents.root);
        return;
      }
      if ("updateDataModel" in m) {
        store.applyDataModel(m.updateDataModel);
        return;
      }
    }

    function conectar() {
      es = new EventSource(`/api/stream?surfaceId=${SURFACE_ID}`);

      es.onopen = () => {
        setConectado(true);
        reintentoRef.current = 1000;
      };

      es.onmessage = (ev) => {
        let mensaje: A2UIMessage;
        try {
          mensaje = JSON.parse(ev.data);
        } catch {
          console.warn("A2UI: mensaje SSE no es JSON válido", ev.data);
          return;
        }
        manejarMensaje(mensaje);
      };

      es.onerror = () => {
        setConectado(false);
        es?.close();
        if (cancelado) return;
        const espera = reintentoRef.current;
        reintentoRef.current = Math.min(espera * 2, 10000);
        setTimeout(() => {
          if (!cancelado) conectar();
        }, espera);
      };
    }

    conectar();
    return () => {
      cancelado = true;
      es?.close();
    };
  }, []);

  const onEvento: OnEvento = (componentId, action, payload) => {
    if (!ACCIONES_SIN_ESPERA.has(action)) setPensando(true);
    sendEvent({ surfaceId: SURFACE_ID, componentId, action, payload, ts: Date.now() }).catch((e) => {
      console.error("error enviando evento:", e);
      setPensando(false);
    });
  };

  return (
    <div data-profile={profile} className="a2ui-root">
      <header className="a2ui-header">
        <div className="a2ui-header-marca">
          {/* D26: logo oficial, blanco sobre el rojo. */}
          <img className="a2ui-header-logo" src="/logo-banorte.svg" alt="Banorte" />
          <span className="a2ui-header-separador" aria-hidden="true" />
          <span className="a2ui-header-saludo">Buen día, Sofía</span>
        </div>
        <div className="a2ui-header-info">
          <span className="a2ui-header-tarjeta">•••• 4321</span>
        </div>
      </header>

      {!conectado && <div className="a2ui-aviso">Reconectando…</div>}

      <main className="a2ui-main">{root ? <NodoRenderer node={root} onEvento={onEvento} /> : <p>Cargando…</p>}</main>

      <PixyBubble estado={pensando ? "pensando" : "reposo"} />

      <TextInput disabled={pensando} onEnviar={(texto) => onEvento("input-texto", "mensaje_libre", { texto })} />
    </div>
  );
}

function NodoRenderer({ node, onEvento }: { node: ComponentNode; onEvento: OnEvento }) {
  if (node.type === "Column") {
    const hijos = (node.children as ComponentNode[] | undefined) ?? [];
    return (
      <div className="a2ui-column">
        {hijos.map((hijo) => (
          <NodoRenderer key={hijo.id} node={hijo} onEvento={onEvento} />
        ))}
      </div>
    );
  }

  const Componente = COMPONENTS[node.type];
  if (!Componente) {
    console.warn("A2UI: type desconocido", node.type);
    return null;
  }
  return <Componente node={node} onEvento={onEvento} />;
}
