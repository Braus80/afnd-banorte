# CLAUDE.md

Reto Banorte en HackMTY 2026. Agente que genera interfaces en tiempo real sobre
LLM + MCP + A2UI. Caso: reestructuración de deuda de tarjeta de crédito.

## Estructura del repo

```
/
├── app/                  # Next.js App Router — front y páginas
│   ├── layout.tsx
│   └── page.tsx
├── docs/
│   ├── A2UI.md           # contrato de UI generativa — NO SE REESCRIBE sin ADR
│   ├── DECISIONS.md      # ADRs D1..D8
│   └── BACKLOG.md        # fuera del MVP
├── next.config.mjs
├── tsconfig.json
└── package.json
```

```
├── src/
│   ├── mcp/mock.ts       # contrato de firmas + tools falsas de respaldo
│   ├── mcp/tiger.ts      # tools reales sobre PostgreSQL (DATABASE_URL, D25)
│   ├── lib/
│   │   ├── llm.ts        # chat(messages, tools) — proveedor por LLM_PROVIDER
│   │   └── a2ui.ts       # tipos del contrato docs/A2UI.md
│   └── agent/
│       ├── systemPrompt.ts
│       ├── tools.ts      # declaraciones de tool-calling + dispatcher
│       ├── session.ts    # memoria de conversación por surfaceId (en proceso)
│       ├── stream.ts     # hub de suscriptores SSE
│       └── router.ts     # directo (simular/seleccionar_plan) vs vía agente
├── app/api/
│   ├── stream/route.ts   # GET, SSE
│   ├── event/route.ts    # POST, cuerpo sección 5 de A2UI.md
│   └── voz/route.ts      # POST {texto} → audio/mpeg (ElevenLabs TTS, D21)
└── migrations/           # SQL sin aplicar, para cuando exista Tiger Data (L2)
```

Tools: `src/mcp/tiger.ts` (PostgreSQL en Tiger Cloud, D25) es lo que cargan
agente y router; `src/mcp/mock.ts` sigue siendo el contrato de firmas y el
respaldo si no hay base.

### Variables de entorno

No hay `.env.example` en el repo (regla local bloquea escribir archivos
`.env*`). Configurar a mano en local (`.env.local`, gitignored) y en el
dashboard de DigitalOcean:

```
LLM_PROVIDER=gemini
GEMINI_API_KEY=<tu clave>
GEMINI_MODEL=gemini-3.6-flash   # opcional, default ya es este
ELEVENLABS_API_KEY=<tu clave>   # voz de Pixy (D21); sin ella /api/voz responde 503 y el botón no hace nada
ELEVENLABS_VOICE_ID=<voice id>  # opcional, para una voz en español latino de la Voice Library
DATABASE_URL=<cadena de Tiger Cloud>  # tools reales (D25); sin ella el servidor no arranca las rutas del agente
```

## Comandos

```bash
npm install       # instalar dependencias
npm run dev       # desarrollo local, http://localhost:3000
npm run build     # build de producción
npm start         # servir build de producción (usa $PORT)
npm run lint      # lint
```

## Deploy

DigitalOcean App Platform, deploy automático desde `main` vía integración GitHub.

Setup inicial (una vez, manual en el dashboard de DigitalOcean o con `doctl`):
1. Push del repo a GitHub.
2. En DigitalOcean → App Platform → Create App → conectar el repo de GitHub,
   rama `main`.
3. Buildpack autodetecta Next.js. Build command: `npm run build`. Run command:
   `npm start`. Puerto: variable `$PORT` que inyecta DO (ya usado en el script
   `start`).
4. Variables de entorno a configurar en el dashboard (no van al repo):
   `LLM_PROVIDER`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `DATABASE_URL`
   (`DATABASE_URL` debe existir también en build: Next importa las rutas al
   compilar y `src/mcp/tiger.ts` lanza si falta, D25).

## URL viva

`<pendiente — se llena tras el primer deploy exitoso>`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
