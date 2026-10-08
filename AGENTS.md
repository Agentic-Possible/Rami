# Working on Marginalia

## Applications and boundaries

- `.`: React/TypeScript EPUB reader PWA. `src/` contains the UI and IndexedDB
  model; `shared/relay.ts` serves chat through Vite and Cloudflare.
  `workers/app/` is a deployment adapter for this app, not a separate service.
- `workers/audiobooks/`: independently deployed private R2 streaming API.
- `tools/narrate/`: standalone Python EPUB-to-audio tool.
- `koreader/`: independently installed Lua plugin. Its README covers device
  installation; its unit and integration tests run through the root Vitest setup.

Keep deploy adapters thin. Do not import browser code into a Worker or a Python
pipeline into the PWA. Read the relevant application's README before changing it.

## Setup and commands

Use Node.js 24 and npm. From the repository root:

```bash
npm run setup
npm run dev -- --host 127.0.0.1
```

The PWA runs at `http://127.0.0.1:5173`, needs no login, and seeds three sample
books. Reading works without external services. For local chat, copy
`.env.example` to `.env.local` and set `OPENROUTER_API_KEY`. Without a key,
`/api/chat` returns 503; do not mistake this for a reader failure.

Validation commands, also from the root:

```bash
npm run test:list            # collect tests without executing them
npm run check                # lint, PWA/relay/test-harness type checks, Vitest
npm run build               # production PWA and service worker
npm run build:cloudflare     # production PWA plus Cloudflare adapter type check
```

Run focused tests while editing, then run the checks above before handing off:

```bash
npm test -- src/lib/anchor.test.ts
npm test -- shared/relay.test.ts
npm test -- koreader/tests/plugin.test.ts koreader/tests/integration.test.ts
```

These tests use fake inference responses; no API key or billed model request is
needed. `vitest.config.ts` keeps discovery explicit and isolates test files.
`.github/workflows/checks.yml` runs the documented checks/build and Python tests.

Additional gates:

```bash
npm run quality              # formatter, unused/dead/duplicate code, module size, docs
npm run check:narrate        # strict Python typing, lint/format, dead code, coverage, contracts
npm run test:qa              # desktop/mobile Chromium, synthetic/offline paths
npm run types:generate       # example secrets only, both Worker bindings
npm run docs:check           # generated API/storage documentation freshness
node scripts/bundle-budget.mjs # after build
```

Setup installs the repository's pre-commit hook and an isolated `.quality-venv`.
It does not alter an existing GPU `.venv` or download models. Coverage includes
untested core modules: current global floors are 30% statements/lines, 40%
branches, and 25% functions, not a claim of comprehensive UI coverage. Python's
floor is 60%. Complexity limits are 45 for TypeScript/Lua and 25 for Python; production
modules are capped at 750 lines. Increase tests or split modules, not these limits.

For narrator development, use Python 3.12 and a virtual environment:

```bash
cd tools/narrate
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
cd ../..
npm run test:narrate
cd tools/narrate
python -m narrate ../../public/books/moby-dick.epub --dry-run
```

The test runner is Python's standard-library `unittest`, not pytest. The dry run
does not load a model or write output. Do not download model weights or start GPU
narration for ordinary validation.

The audiobook Worker's production config uses a private, remote R2 bucket.
Its example secrets are placeholders, not access to the real bucket. The explicit
`npm run dev:audiobooks` local config disables remote bindings and uses synthetic
credentials. Vitest creates an isolated in-memory R2 bucket with real Worker
crypto/range requests. Never use the production config for ordinary QA.

## Interactive QA

After launching Vite, open the library, select Moby Dick, open the table of
contents, and jump to Chapter 1. Wait for images/layout to settle, then verify
forward/back taps and reopen the book to confirm saved position. This path
needs no account, token, or inference key.

For reader layout or touch changes, follow the detailed checks in
`.claude/skills/marginalia-dev/SKILL.md`. EPUB content spans a long horizontal
strip: inspect the visible scroll window, not the first text in the iframe.

For KOReader UI changes, follow `koreader/README.md` on a device with KOReader:
install the plugin, restart, open a book, select text, and choose Ask Marginalia.
The fake-host integration harness tests wiring, not the device's real APIs.
Device chat uses the hosted relay and is billed; ask before testing live chat.

## Conventions

- TypeScript: camelCase functions/variables, PascalCase React components/types,
  and UPPER_SNAKE_CASE module constants. Keep existing single quotes and omitted
  semicolons. Prefer explicit types at storage, API, and untrusted-input boundaries.
- Python and Lua: snake_case functions/variables and UPPER_SNAKE_CASE constants.
  Preserve Python dataclasses/type hints and Lua module-table conventions.
- Name TypeScript tests `*.test.ts` under `src/`, `shared/`, `workers/`, or
  `koreader/tests/`. Name Python tests `tools/narrate/tests/test_*.py` and Lua
  specs `koreader/tests/*_spec.lua`, exercised through their Vitest harnesses.
- Follow `docs/design-system.md` (Rami) for UI: use its token utilities and the
  controls in `src/components/ui.ts`, not raw colors or one-off button styles.
- Mirror system-prompt changes between `src/lib/prompt.ts` and
  `koreader/marginalia.koplugin/marginalia_prompt.lua`; run the plugin prompt specs.
- Preserve Dexie migrations and edition matching by file hash, not title.
- Do not enable EPUB scripts or weaken CSP/TLS checks. Book text is untrusted
  and must remain fenced before entering model prompts.

## Privacy and safety

Never read or print populated `.env*`/`.dev.vars*` files, API keys, personal
tokens, signed URLs, private EPUBs, or exported conversations for routine checks.
Commit only empty/example environment files. Keep secrets server-side; never
add them to Wrangler `vars` or `VITE_*` client configuration.

Use supplied public-domain books and synthetic conversations in tests. Do not
log request bodies, authorization headers, or signed URL query strings. Keep
API keys and audiobook tokens out of exports.

Preserve user changes and untracked files. Do not commit, push, deploy, change
repository settings, or make billed provider calls unless explicitly requested.
Lint rejects all warnings. The KOReader harness uses Wasmoon, not Fengari, and
closes every Lua VM in `finally`. Lua also uses StyLua formatting and LuaJIT
syntax/global/complexity checks; Python dependencies are checked by Deptry.
Consult `docs/architecture.md`,
`docs/api.openapi.yml`, and `docs/operations.md` for storage contracts, telemetry,
health, spending limits, and release/rollback procedures.
