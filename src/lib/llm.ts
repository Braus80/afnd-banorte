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

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: { result: unknown } };
}

interface GeminiContent {
  role: "user" | "model" | "function";
  parts: GeminiPart[];
}

interface GeminiResponseBody {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
}

function toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  return messages.map((m): GeminiContent => {
    if (m.toolCall) {
      return { role: "model", parts: [{ functionCall: { name: m.toolCall.name, args: m.toolCall.args } }] };
    }
    if (m.toolResult) {
      return {
        role: "function",
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

async function geminiChat(
  messages: ChatMessage[],
  tools: ToolDeclaration[],
  systemInstruction?: string
): Promise<ChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");

  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: toGeminiContents(messages),
    tools: toGeminiTools(tools),
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as GeminiResponseBody;
  const parts = data.candidates?.[0]?.content?.parts ?? [];

  const toolCalls: ToolCall[] = parts
    .filter((p): p is GeminiPart & { functionCall: NonNullable<GeminiPart["functionCall"]> } => Boolean(p.functionCall))
    .map((p) => ({ name: p.functionCall.name, args: p.functionCall.args ?? {} }));

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
