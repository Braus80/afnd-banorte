# AFND_Banorte26
Proyecto realizado como parte del reto de Banorte para el Hackaton MLH 2026

## Documentación

- [`docs/DOCUMENTO-TECNICO.md`](docs/DOCUMENTO-TECNICO.md) — resumen, arquitectura con diagrama, protocolo A2UI, trade-offs y cómo comprobar el demo (para jueces).
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — registro de decisiones (ADR D1–D29).
- [`docs/A2UI.md`](docs/A2UI.md) — contrato de interfaz generativa: mensajes, catálogo de componentes y eventos.
- [`docs/BACKLOG.md`](docs/BACKLOG.md) — límites conocidos y mejoras pendientes.

## Cómo correrlo

```bash
npm install
npm run dev        # http://localhost:3000
```

Variables de entorno en `.env.local` (ver `CLAUDE.md`): `LLM_PROVIDER=gemini`, `GEMINI_API_KEY`, `DATABASE_URL` y, opcional, `ELEVENLABS_API_KEY`.
