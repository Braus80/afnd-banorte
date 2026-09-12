"use client";

import { useVozHablando } from "./voz";

// Burbuja de Pixy: parte del shell del front, NO del catálogo A2UI (no
// tiene id/type, el agente nunca la controla). El Renderer decide
// "pensando" mientras espera respuesta y "reposo" el resto; "hablando" lo
// deriva la propia burbuja del estado de lectura en voz alta (D22) — así el
// Renderer no cambia. Si Pixy piensa y habla a la vez, gana "pensando":
// es la señal que el usuario necesita para saber que su acción va en curso.

export type PixyEstado = "reposo" | "pensando" | "hablando";

interface Props {
  estado: PixyEstado;
}

export function PixyBubble({ estado }: Props) {
  const hablando = useVozHablando();
  const efectivo: PixyEstado = estado === "pensando" ? "pensando" : hablando ? "hablando" : estado;

  return (
    <div className={`pixy-bubble pixy-bubble--${efectivo}`} aria-hidden="true">
      <span className="pixy-anillo pixy-anillo--1" />
      <span className="pixy-anillo pixy-anillo--2" />
      <div className="pixy-circulo">
        {efectivo === "pensando" ? (
          <span className="pixy-dots">
            <span />
            <span />
            <span />
          </span>
        ) : (
          <span>P</span>
        )}
      </div>
    </div>
  );
}
