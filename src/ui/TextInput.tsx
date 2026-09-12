"use client";

import { useState } from "react";

interface Props {
  disabled: boolean;
  onEnviar: (texto: string) => void;
}

export function TextInput({ disabled, onEnviar }: Props) {
  const [texto, setTexto] = useState("");

  function enviar() {
    const limpio = texto.trim();
    if (!limpio || disabled) return;
    onEnviar(limpio);
    setTexto("");
  }

  return (
    <div className="a2ui-textinput">
      <input
        type="text"
        value={texto}
        placeholder={disabled ? "Pixi está pensando…" : "Escribe tu pregunta…"}
        disabled={disabled}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") enviar();
        }}
      />
      <button type="button" disabled={disabled || !texto.trim()} onClick={enviar}>
        Enviar
      </button>
    </div>
  );
}
