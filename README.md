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


## Android wrapper (Capacitor)

The repository includes `apps/mobile`, a Capacitor wrapper for the existing PWA build output in `apps/web/dist`.

### Android commands

```bash
npm run android:sync
npm run android:open
npm run android:dev
npm run android:build
```

What they do:
- `android:sync`: builds the web app and runs Capacitor Android sync.
- `android:open`: opens the generated Android project in Android Studio.
- `android:dev`: syncs and opens Android Studio in one flow.
- `android:build`: syncs and prints Android Studio steps for APK/AAB generation.
- Inside Capacitor WebView, routing uses hash URLs so refresh/deep-link navigation works without server-side rewrite rules.

### Building APK/AAB

1. Run `npm run android:dev` (or `npm run android:sync` then `npm run android:open`).
2. In Android Studio:
   - Build debug APK: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
   - Build release AAB/APK: **Build → Generate Signed Bundle / APK**.

### API URL for Android device testing

When the app runs on a real Android device, `localhost` points to the device itself, not your development machine.

Use a LAN URL for the API in `.env`:

```bash
VITE_API_BASE_URL=http://192.168.x.x:8000
```

For desktop development you can keep:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

A starter template is provided in `.env.example`.

## API endpoints

- `GET /health`
- `GET /content/manifest.json`
- Static files under `GET /content/published/*`
- `GET /docs` (FastAPI Swagger UI)

## Content packs

The API serves a manifest at `/content/manifest.json` with pack metadata (`id`, `type`, `version`, `url`, `sha256`). Published pack files live in `apps/api/content/published`.

Current sample packs:
- `campaign_v1_1.0.2.json` – RU campaign chapter "Чаты" with age mode variants (`8-10`, `11-14`), standardized scene `tags`, and choice effect `clues` for achievements.
- `weekly_2026_w09_1.0.1.json` – weekly mission pack with active date range, start scene, and rewards.
- `achievements_1.0.0.json` – achievements payload with trigger-based rules.

Web content sync flow:
1. On app startup the web client fetches the manifest from `VITE_API_BASE_URL` (defaults to `http://localhost:8000`).
2. Missing or outdated packs are downloaded.
3. SHA-256 hashes are verified before caching.
4. Packs are stored in IndexedDB, with localStorage fallback.
5. Campaign and Weekly pages render cached scenes and remain available offline after first successful sync.
6. Weekly completion is persisted locally (completed mission IDs, earned badges, and skill increments), and rewards are granted only once per weekly pack.
7. Achievement progress and unlock state are evaluated in the web app from local events and stored in localStorage, so progress works offline after the pack is cached.


### Age mode in web app

- Open **Settings** in the web app to choose age mode: `8-10` or `11-14`.
- Selected mode is stored locally in browser storage and applied automatically in `ScenePlayer`.
- If a scene has no mode override, base scene text is used as fallback.

### Campaign scene mode schema

`StoryScene` supports mode-specific content in packs:

- `modes`: array of supported modes (e.g. `["8-10", "11-14"]`)
- `modeContent`: keyed overrides per mode
  - `title` (optional)
  - `chat` (optional replacement chat array)
  - `choices` (optional replacement choices array)
- `tags` on scenes: taxonomy for achievement/event classification (`urgency`, `antifake`, `evidence`, `bullying_witness`, `privacy`, `account`)
- `choices[].effects.clues`: optional taxonomy hints for safe/unsafe outcomes using the same tag set
- `choices[].effects.actions`: optional action markers (example: `evidence_saved`)
- `choices[].effects.skills`: optional skill deltas emitted as `skill_changed` runtime events

Example:

```json
{
  "id": "scene-id",
  "title": "Base title",
  "chat": [{ "speaker": "NPC", "text": "Base" }],
  "tags": ["urgency", "antifake"],
  "choices": [{ "id": "a", "label": "...", "debrief": "...", "quiz": { "question": "...", "options": ["..."], "answerIndex": 0 }, "effects": { "clues": ["urgency"] } }],
  "modes": ["8-10", "11-14"],
  "modeContent": {
    "8-10": {
      "chat": [{ "speaker": "NPC", "text": "Simpler text" }]
    }
  }
}
```

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


## Campaign KPI metrics (offline, no personal data)

The web app now tracks campaign KPIs locally per age mode, both **per chapter** and **overall**:

- `scenes_completed_count`
- `safe_choices_count` / `risky_choices_count`
- `quiz_correct_count` / `quiz_total_count`
- `chapter_final_completed`
- `tag_totals` / `tag_safe_counts` for per-tag safe-ratio ranking in parents KPI summary

Risk classification for choices:

1. If `choices[].effects.risk` is present and `<= 0`, it is treated as **safe**.
2. If `choices[].effects.risk` is present and `> 0`, it is treated as **risky**.
3. If missing, the client falls back to `tags` / `effects.clues` heuristics; if still unclear, it is stored as neutral (not counted as safe/risky).

Storage:

- KPI metrics are saved in browser local storage under `dgo-campaign-kpi:v1`.
- Existing campaign map progress remains in `dgo-campaign-progress:v1`.
- No KPI data is sent to backend APIs.

UX additions:

- Completing a chapter final shows a **Chapter Summary** with chapter KPI stats and 3 recommendations from most frequent risky tags.
- The chapter summary includes **Repeat weak skill**, launching a short 3-scene remediation flow from that chapter.
- `/parents` now includes an **Overall KPI summary** with explicit safe/risky counts, safe-rate %, and separate short/competition clipboard exports.

## Parents / Teachers dashboard

- New `/parents` page in web app shows a local skill summary for five areas: privacy, account safety, anti-fake, communication, and anti-bullying.
- Each skill card includes short interpretation text and practical recommendations in Russian.
- Two export buttons are available: **Copy short report** (5-8 lines) and **Copy competition report** (structured KPI text including age mode and achievements unlocked).
- In DEV mode, `/parents` includes **Load demo data** and **Clear demo data** buttons to seed/reset local KPI, skills, lesson-kit completion, and 2 unlocked achievements for demos.
- Added **20-minute lesson kits** with 3 presets and 4 scenes each:
  - `Приватность`
  - `Антифейк`
  - `Кибербуллинг` (includes `bullying_witness`-tagged scene)
- Lesson kits run a simple linear ScenePlayer flow, display scene progress, show a finish screen, and persist completion locally (Completed badge).

## Docker

Start API via compose:

```bash
docker compose up api
```
