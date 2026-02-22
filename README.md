# Dangerous Games Online Monorepo

Initial scaffold for web and API applications.

## Requirements

- Node.js 20 (`nvm use` reads `.nvmrc`)
- Python 3.11+ (for FastAPI local dev)

## Install

```bash
npm install
```

## Run everything

```bash
npm run dev
```

This runs:
- `apps/web` on http://localhost:5173
- `apps/api` on http://localhost:8000

## Run individually

```bash
npm run web:dev
npm run api:dev
```

## Quality + build

```bash
npm run lint
npm run build
```

## API endpoints

- `GET /health`
- `GET /content/manifest.json`
- Static files under `GET /content/published/*`

## Docker

Start API via compose:

```bash
docker compose up api
```
