# CLAUDE.md

Hackathon Banorte x Tec. Agente que genera interfaces en tiempo real sobre
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
│   ├── mcp/mock.ts       # tools falsas (L2 real las reemplaza, misma firma)
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
│   └── event/route.ts    # POST, cuerpo sección 5 de A2UI.md
└── migrations/           # SQL sin aplicar, para cuando exista Tiger Data (L2)
```

Pendiente: front (store/resolvedor/renderer de los 7 componentes — Lote V
punto 5), servidor MCP real y Tiger Data (L2).

### Variables de entorno

No hay `.env.example` en el repo (regla local bloquea escribir archivos
`.env*`). Configurar a mano en local (`.env.local`, gitignored) y en el
dashboard de DigitalOcean:

```
LLM_PROVIDER=gemini
GEMINI_API_KEY=<tu clave>
GEMINI_MODEL=gemini-3.6-flash   # opcional, default ya es este
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
   `LLM_PROVIDER`, `GEMINI_API_KEY`, `TIGER_DATA_URL` (se agregan cuando
   existan los lotes que los usan).

## URL viva

`<pendiente — se llena tras el primer deploy exitoso>`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
