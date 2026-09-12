"use client";

import { useEffect } from "react";
import { useA2UINode } from "../useA2UINode";
import { detenerSi, leerAutomatico, useVoz } from "../voz";
import type { A2UIComponentProps } from "../types";

export function ExplanationCard({ node }: A2UIComponentProps) {
  console.debug("render", node.id);
  const { title, body, bullets } = useA2UINode(node) as {
    title?: string;
    body?: string;
    bullets?: string[];
  };
  const lista = (bullets ?? []).slice(0, 4);

  // D22: la bocina es una affordance del shell, no una prop del contrato —
  // lee lo mismo que se ve, en el mismo orden. No arranca sola salvo con el
  // modo de lectura continua encendido (D23).
  const textoVoz = [title, body, ...lista].filter((s) => typeof s === "string" && s.trim()).join("\n");
  const { estado: estadoVoz, continuo, alternar: alternarVoz } = useVoz(textoVoz);

  // D23: al montarse (llegó por updateComponents) se lee sola si el modo está
  // activo. Si el agente reemplaza la pantalla mientras suena, Pixy se calla:
  // no se lee una tarjeta que ya no está.
  useEffect(() => {
    leerAutomatico(textoVoz);
    return () => detenerSi(textoVoz);
  }, [textoVoz]);

  return (
    <div className="a2ui-card a2ui-explanation">
      <div className="a2ui-explanation-cabecera">
        {title ? <h3>{title}</h3> : <span aria-hidden="true" />}
        {textoVoz && <BotonVoz estado={estadoVoz} continuo={continuo} onClick={alternarVoz} />}
      </div>
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

type EstadoBoton = "inactivo" | "cargando" | "reproduciendo";

function etiqueta(estado: EstadoBoton, continuo: boolean): string {
  if (continuo) return estado === "cargando" ? "Preparando la lectura. Desactivar lectura automática" : "Desactivar lectura automática";
  return "Escuchar y activar lectura automática";
}

function BotonVoz({ estado, continuo, onClick }: { estado: EstadoBoton; continuo: boolean; onClick: () => void }) {
  const texto = etiqueta(estado, continuo);
  return (
    <button
      type="button"
      className={`a2ui-voz a2ui-voz--${estado}${continuo ? " a2ui-voz--auto" : ""}`}
      onClick={onClick}
      aria-label={texto}
      title={texto}
      aria-pressed={continuo}
      aria-busy={estado === "cargando"}
      data-estado={estado}
      data-continuo={continuo ? "true" : "false"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}
