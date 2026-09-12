// D3: proveedor detrás de un único módulo, intercambiable por LLM_PROVIDER.
// D15: Gemini implementado con fetch directo a la API, sin SDK — menos
// dependencias, menos superficie de fallo en 48 h (ver D1).

export interface ToolParamSchema {
  type: "object" | "string" | "number" | "boolean" | "array";
  description?: string;
  enum?: string[];
  properties?: Record<string, ToolParamSchema>;
  required?: string[];
  items?: ToolParamSchema;
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: ToolParamSchema;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  // Modelos "thinking" (gemini-3.x) lo exigen al reenviar el functionCall
  // en el siguiente turno — probado en vivo, sin esto el 400 dice
  // "Function call is missing a thought_signature".
  thoughtSignature?: string;
}

export interface ChatMessage {
  role: "user" | "model";
  text?: string;
  toolCall?: ToolCall;
  toolResult?: { name: string; result: unknown };
}

export interface ChatResponse {
  text?: string;
  toolCalls: ToolCall[];
}

// D19: 429 de cuota diaria/mensual no se reintenta (no se va a resolver en
// segundos) — el router lo atrapa y muestra un mensaje amable en vez de
// tronar. 429 de RPM sí se reintenta una vez, porque ese normalmente cede
// en poco tiempo.
export class CuotaAgotadaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "CuotaAgotadaError";
  }
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: { result: unknown } };
  thoughtSignature?: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiResponseBody {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
}

function toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  return messages.map((m): GeminiContent => {
    if (m.toolCall) {
      return {
        role: "model",
        parts: [
          {
            functionCall: { name: m.toolCall.name, args: m.toolCall.args },
            ...(m.toolCall.thoughtSignature ? { thoughtSignature: m.toolCall.thoughtSignature } : {}),
          },
        ],
      };
    }
    if (m.toolResult) {
      // Este modelo no acepta role "function" ("Role 'function' is not
      // supported", probado en vivo) — la respuesta de la tool va como
      // "user" con una parte functionResponse.
      return {
        role: "user",
        parts: [{ functionResponse: { name: m.toolResult.name, response: { result: m.toolResult.result } } }],
      };
    }
    return { role: m.role, parts: [{ text: m.text ?? "" }] };
  });
}

function toGeminiTools(tools: ToolDeclaration[]) {
  if (tools.length === 0) return undefined;
  return [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function llamarGemini(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function geminiChat(
  messages: ChatMessage[],
  tools: ToolDeclaration[],
  systemInstruction?: string
): Promise<ChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");

  // D19: gemini-flash-lite-latest es alias flotante (no versión fija) y
  // gemini-3.1-flash-lite-image es variante de imagen — se descartan los
  // dos. El más reciente versionado sin "preview"/"exp" es 3.5.
  const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: toGeminiContents(messages),
    tools: toGeminiTools(tools),
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
  };

  let res = await llamarGemini(url, body);

  if (res.status === 429) {
    const errText = await res.text();
    const esCuota = /quota|daily/i.test(errText);
    if (esCuota) {
      throw new CuotaAgotadaError(`Gemini 429 (cuota): ${errText}`);
    }
    // RPM: probablemente cede pronto — un solo reintento.
    console.warn("Gemini 429 (RPM), reintentando en 20s:", errText);
    await sleep(20_000);
    res = await llamarGemini(url, body);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as GeminiResponseBody;
  const parts = data.candidates?.[0]?.content?.parts ?? [];

  const toolCalls: ToolCall[] = parts
    .filter((p): p is GeminiPart & { functionCall: NonNullable<GeminiPart["functionCall"]> } => Boolean(p.functionCall))
    .map((p) => ({
      name: p.functionCall.name,
      args: p.functionCall.args ?? {},
      thoughtSignature: p.thoughtSignature,
    }));

  // Probado en vivo: en tool-calls paralelas del mismo turno, solo una
  // trae thoughtSignature — las demás vienen sin ella y el 400 vuelve a
  // pedirla igual. Se propaga la firma del turno a las que falten.
  const firmaDelTurno = toolCalls.find((t) => t.thoughtSignature)?.thoughtSignature;
  if (firmaDelTurno) {
    for (const t of toolCalls) t.thoughtSignature ??= firmaDelTurno;
  }

  const text = parts.find((p) => typeof p.text === "string")?.text;

  return { text, toolCalls };
}

export async function chat(
  messages: ChatMessage[],
  tools: ToolDeclaration[] = [],
  systemInstruction?: string
): Promise<ChatResponse> {
  const provider = process.env.LLM_PROVIDER ?? "gemini";
  switch (provider) {
    case "gemini":
      return geminiChat(messages, tools, systemInstruction);
    default:
      throw new Error(`LLM_PROVIDER desconocido: ${provider}`);
  }
}
