# Agent Workflow Rules

## Commands

- Install dependencies: `npm install`
- Start web + api: `npm run dev`
- Start web only: `npm run web:dev`
- Start api only: `npm run api:dev`
- Lint all: `npm run lint`
- Build all: `npm run build`

## Rules

1. Keep `apps/web` as a Vite + React + TypeScript project.
2. Keep `apps/api` as a FastAPI project serving manifest and static content.
3. Prefer root npm scripts over direct workspace command usage in docs.
4. Add new cross-project tools at repo root for consistency.
5. Keep changes small and documented in `README.md` when setup steps change.
