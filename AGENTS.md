# AGENTS.md — Socratic Data Analysis Tutor (repo root)

Multi-project workspace. **No root git repo, no root package.json, no root CI, no tests.** Git only exists inside `gridcraft/`. Each subproject is independent.

## Layout

| Path | What it is |
|---|---|
| `frontend/` | React 19 + Vite 6 + TS + Tailwind SPA (port 3000) |
| `server/` | Node ESM backend on **:8000** — 4 modules, no framework/router: `server.mjs` (routing/SSE), `auth.mjs` (JWT/OTP), `db.mjs` (Mongo + in-memory fallback), `email.mjs` (Resend) |
| `gridcraft/` | Vendored Rust→WASM spreadsheet — **own git repo, own CI, own `AGENTS.md`/`CLAUDE.md`**; follow those, not this file, when editing it |
| `app/plugins/` | Python plugin *reference* implementations — **not imported by server or frontend**, not wired into any runtime (`.venv/` is empty) |
| `content/concepts/` | Markdown battle cards — **not loaded by the app** |
| `frontend/src/data/battlesData.ts` | The battle content the app actually loads (edit this to change what users see) |
| `data/`, `content/sandboxes/`, `South African University Data 2009 to 2016/` | Sample + real Excel/PDF source workbooks |
| `docs/`, `tests/`, `.system_generated/`, `content/hints/` | Empty placeholders |

`README.md` and `ARCHITECTURE.md` describe product vision; trust the code when they disagree.

## Run

```bash
# Frontend (proxies /api → 127.0.0.1:8000)
cd frontend && npm install && npm run dev        # http://localhost:3000

# Backend — must run from repo root so process.cwd() finds root .env
node server/server.mjs                           # http://localhost:8000 (binds 0.0.0.0)
```

Env (root `.env`, hand-parsed line-by-line — no dotenv): `OPENAI_API_KEY` required for the AI coach (without it `/api/chat/stream` emits an error token). Optional: `MONGO_URI`/`MONGO_DB` (also accepts `MONGODB_URI`/`MONGODB_DB`; code's fallback DB name is misspelled `AutonoumousDB` — changing it changes which DB is used when `MONGO_DB` is unset), `RESEND_API`/`RESEND_API_KEY`, `JWT_SECRET` (falls back to a hardcoded dev secret in `auth.mjs`). No Mongo → in-memory user/chat store (lost on restart). No Resend → signup OTP is printed to the server console instead of emailed. `/api/parse-document` shells out to the `pdftotext` binary for PDFs (regex fallback if missing).

## Backend routing

All routes are a hand-rolled `pathname === '/api/...'` chain inside `server/server.mjs` — adding an endpoint means editing that chain. Endpoints: `/api/health`, `/api/auth/{status,signup,verify-otp,login,me,resend-otp}`, `/api/chat/{stream,save,history,clear}`, `/api/sessions` (GET list, POST create — note: **not** under `/api/chat/`), `/api/parse-document`.

## Chat wiring (easy to get wrong)

- Live path: `App.tsx` → `streamBackendChat` (`frontend/src/utils/apiClient.ts`) → SSE `POST /api/chat/stream` on the backend.
- `frontend/src/utils/openaiClient.ts` is **legacy** (browser-direct OpenAI): imported by nothing, and no `import.meta.env.VITE_*` reference exists anywhere in `frontend/src`. Do not re-enable browser-side keys.
- The `@assistant-ui/elements-*` features in the README are **hand-rolled local components**, not the npm package (no assistant-ui dependency in `package.json`). They live in `frontend/src/components/assistant-ui/elements/` (`streaming-text`, `thinking-indicator`, `computer-use`, `guardrail-notice`, `chat-history-sidebar`) — edit those files directly.
- Refusal patterns (`CHEAT_PATTERNS` in `server/server.mjs`, `frontend/src/utils/tutorEngine.ts`, mirrored in `app/plugins/refusal.py`) are **product behavior** (cheat-proof Socratic pedagogy) and are maintained in three places — keep them in sync when editing. Never remove guardrails or add file/code-execution tools to "make it work."

## GridCraft embed

- Static WASM site is **copied into** `frontend/public/gridcraft/` (from `gridcraft/dist/web/` after `cargo xtask wasm` run inside `gridcraft/`). The app iframe-loads `/gridcraft/index.html?host=parent&webgl&author=Student` (`GridCraftEmbed.tsx`).
- Host ↔ iframe protocol lives in `frontend/src/components/GridCraftBridge.ts`: iframe→host `gridcraft:ready|save|dirty|failed`; host→iframe `gridcraft:open`, `gridcraft:trigger_save`.
- After rebuilding GridCraft web, sync `gridcraft/dist/web/*` → `frontend/public/gridcraft/` (hashes in filenames change). The embed `index.html` is patched vs the dist copy (canvas CSS, 50 vs 31 lines) — re-apply that patch if regenerating wholesale.
- For GridCraft engine/UI work: start from `gridcraft/AGENTS.md` (its quality gates, clean-room rules, and layering apply there only).

## Quality gate

Only automated check available at root/frontend/server:

```bash
cd frontend && npm run build   # tsc && vite build — passes clean
```

No lint, format, typecheck-only, or test scripts exist outside `gridcraft/` (which uses `cargo xtask ci`). TypeScript is strict but `noUnusedLocals`/`noUnusedParameters` are off. Path alias `@/` → `frontend/src/`.

## Secrets & hygiene

- Root `.env` holds live secrets — never commit, never paste into chat or docs.
- `frontend/.env.example` contains a real-looking OpenAI key; treat as compromised and do not copy it around.
- `node_modules/` trees are present in both `frontend/` and `server/`; ignore them.
- Client storage: `localStorage` keys prefixed `khokhi_`, plus IndexedDB db `khokhi_workbook_store`.
