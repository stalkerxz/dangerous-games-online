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
- `GET /docs` (FastAPI Swagger UI)

## Content packs

The API serves a manifest at `/content/manifest.json` with pack metadata (`id`, `type`, `version`, `url`, `sha256`). Published pack files live in `apps/api/content/published`.

Current sample packs:
- `campaign_v1_1.0.0.json` – includes scenes with chat templates, choices, debrief notes, and quiz prompts.
- `weekly_2026_w09_1.0.0.json` – weekly mission pack with active date range, start scene, and rewards.
- `achievements_1.0.0.json` – achievements payload with trigger-based rules.

Web content sync flow:
1. On app startup the web client fetches the manifest from `VITE_API_BASE_URL` (defaults to `http://localhost:8000`).
2. Missing or outdated packs are downloaded.
3. SHA-256 hashes are verified before caching.
4. Packs are stored in IndexedDB, with localStorage fallback.
5. Campaign and Weekly pages render cached scenes and remain available offline after first successful sync.
6. Weekly completion is persisted locally (completed mission IDs, earned badges, and skill increments), and rewards are granted only once per weekly pack.
7. Achievement progress and unlock state are evaluated in the web app from local events and stored in localStorage, so progress works offline after the pack is cached.

### Achievements data format

`achievements_1.0.0.json` items use:

- `id`: stable string identifier
- `name`: display name (RU)
- `description`: player-facing description (RU)
- `icon`: string icon (emoji/text)
- `trigger`: evaluation rule
  - `kind: "count_event"` with `event`, `target`, optional `filters`
  - `kind: "skill_level"` with `skill`, `level`

### Runtime events used by achievements

The web client emits and evaluates these events locally:

- `choice_made`
- `quiz_answered` (`correct` flag included)
- `scene_completed`
- `weekly_completed`
- `skill_changed`

PWA offline support is enabled via `vite-plugin-pwa` in the web app.

## Docker

Start API via compose:

```bash
docker compose up api
```
