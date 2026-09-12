"use client";

import { useEffect } from "react";
import { useA2UINode } from "../useA2UINode";
import { detenerSi, useVoz } from "../voz";
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
  // lee lo mismo que se ve, en el mismo orden. Nunca arranca sola.
  const textoVoz = [title, body, ...lista].filter((s) => typeof s === "string" && s.trim()).join("\n");
  const { estado: estadoVoz, alternar: alternarVoz } = useVoz(textoVoz);

  // Si el agente reemplaza la pantalla mientras suena, Pixy se calla: no se
  // lee una tarjeta que ya no está.
  useEffect(() => () => detenerSi(textoVoz), [textoVoz]);

  return (
    <div className="a2ui-card a2ui-explanation">
      <div className="a2ui-explanation-cabecera">
        {title ? <h3>{title}</h3> : <span aria-hidden="true" />}
        {textoVoz && <BotonVoz estado={estadoVoz} onClick={alternarVoz} />}
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

const ETIQUETA: Record<"inactivo" | "cargando" | "reproduciendo", string> = {
  inactivo: "Escuchar con Pixy",
  cargando: "Preparando la lectura, toca para cancelar",
  reproduciendo: "Detener la lectura",
};

function BotonVoz({ estado, onClick }: { estado: keyof typeof ETIQUETA; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`a2ui-voz a2ui-voz--${estado}`}
      onClick={onClick}
      aria-label={ETIQUETA[estado]}
      title={ETIQUETA[estado]}
      aria-pressed={estado === "reproduciendo"}
      aria-busy={estado === "cargando"}
      data-estado={estado}
    >
      {estado === "reproduciendo" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      )}
    </button>
  );
}
