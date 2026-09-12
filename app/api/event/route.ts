import { NextRequest, NextResponse } from "next/server";
import { manejarEvento } from "@/src/agent/router";
import type { EventoFront } from "@/src/lib/a2ui";

export async function POST(req: NextRequest) {
  let evento: EventoFront;
  try {
    evento = await req.json();
  } catch {
    return NextResponse.json({ error: "cuerpo no es JSON válido" }, { status: 400 });
  }

  if (!evento?.surfaceId || !evento?.action) {
    return NextResponse.json({ error: "evento incompleto: faltan surfaceId o action" }, { status: 400 });
  }

  try {
    await manejarEvento(evento);
  } catch (e) {
    console.error("error manejando evento:", e);
    return NextResponse.json({ error: "error interno procesando el evento" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
