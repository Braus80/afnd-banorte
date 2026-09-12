import { NextRequest } from "next/server";

// D21: Pixy lee en voz alta vía ElevenLabs Text to Speech (API directa, no
// ElevenAgents — el agente sigue siendo Gemini). Bajo demanda: solo se llama
// cuando el usuario toca la bocina de una ExplanationCard. La key vive solo
// en el servidor; el cliente nunca la ve. Cualquier fallo del proveedor,
// timeout o key ausente responde 503 con cuerpo vacío — el front vuelve a
// "inactivo" sin mensaje intrusivo.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ELEVENLABS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
// Único modelo vigente que acepta `language_code` (multilingual_v2 lo rechaza
// con 422, turbo_v2_5 está deprecado) y el de menor latencia (~75 ms).
const MODEL_ID = "eleven_flash_v2_5";
const LANGUAGE_CODE = "es";
// Voz por defecto: premade multilingüe de ElevenLabs. Para un acento latino
// específico se agrega una voz de la Voice Library a la cuenta y se pone su
// id en ELEVENLABS_VOICE_ID.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL";
const TIMEOUT_MS = 8_000;
const MAX_CHARS = 2_000; // ExplanationCard: body ~400 + 4 bullets; esto es red de seguridad
const MAX_CACHE = 200;

// Caché en memoria del proceso por texto (D13: una sola instancia). Evita
// gastar créditos y repetir la espera cuando se relee la misma tarjeta.
const cache = new Map<string, Uint8Array>();

function respuestaAudio(audio: Uint8Array, origen: "cache" | "elevenlabs"): Response {
  return new Response(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-Voz-Origen": origen,
    },
  });
}

function noDisponible(): Response {
  return new Response(null, { status: 503 });
}

export async function POST(req: NextRequest) {
  let cuerpo: { texto?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const texto = typeof cuerpo?.texto === "string" ? cuerpo.texto.trim() : "";
  if (!texto || texto.length > MAX_CHARS) {
    return new Response(null, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn("voz: falta ELEVENLABS_API_KEY, se responde 503");
    return noDisponible();
  }

  const claveCache = `${MODEL_ID}|${VOICE_ID}|${texto}`;
  const enCache = cache.get(claveCache);
  if (enCache) return respuestaAudio(enCache, "cache");

  try {
    const res = await fetch(`${ELEVENLABS_URL}/${VOICE_ID}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text: texto, model_id: MODEL_ID, language_code: LANGUAGE_CODE }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      // El detalle se queda en el log del servidor; al cliente solo 503.
      console.error(`voz: ElevenLabs respondió ${res.status}`, (await res.text().catch(() => "")).slice(0, 300));
      return noDisponible();
    }

    const audio = new Uint8Array(await res.arrayBuffer());
    if (audio.byteLength === 0) return noDisponible();

    if (cache.size >= MAX_CACHE) {
      const masViejo = cache.keys().next().value;
      if (masViejo !== undefined) cache.delete(masViejo);
    }
    cache.set(claveCache, audio);
    return respuestaAudio(audio, "elevenlabs");
  } catch (e) {
    const esTimeout = e instanceof Error && e.name === "TimeoutError";
    console.error(esTimeout ? `voz: timeout de ${TIMEOUT_MS} ms` : "voz: error llamando a ElevenLabs", esTimeout ? "" : e);
    return noDisponible();
  }
}
