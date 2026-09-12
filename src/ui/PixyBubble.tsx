"use client";

// Burbuja de Pixy: parte del shell del front, NO del catálogo A2UI (no
// tiene id/type, el agente nunca la controla). El Renderer decide su
// estado: "pensando" mientras espera respuesta, "reposo" el resto.
// "hablando" queda implementado en CSS para cuando haya un disparador
// real (p. ej. streaming de voz) — hoy nadie lo activa.

export type PixyEstado = "reposo" | "pensando" | "hablando";

interface Props {
  estado: PixyEstado;
}

export function PixyBubble({ estado }: Props) {
  return (
    <div className={`pixy-bubble pixy-bubble--${estado}`} aria-hidden="true">
      <span className="pixy-anillo pixy-anillo--1" />
      <span className="pixy-anillo pixy-anillo--2" />
      <div className="pixy-circulo">
        {estado === "pensando" ? (
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
