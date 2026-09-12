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

Pendiente de lotes siguientes (no existen aún): rutas API (`app/api/stream`,
`app/api/event`), `llm.ts`, cliente MCP, store/renderer A2UI en el front.

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
