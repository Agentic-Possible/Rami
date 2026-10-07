# Service and data boundaries

```mermaid
flowchart LR
  PWA[Reader PWA] --> IDB[(IndexedDB)]
  PWA --> Relay[Vite / Netlify / App Worker]
  KO[KOReader plugin] --> Relay
  Relay --> OR[OpenRouter, billed]
  PWA --> OA[Optional own-key OpenAI, billed]
  PWA --> Audio[Audiobook Worker]
  Audio --> R2[(Private R2)]
  Narrator[Offline narrator] --> Artifacts[Derived EPUB + sync.json + audio]
```

Deploy adapters share `shared/relay.ts`; they must not import browser modules.
The independently deployed audiobook Worker authenticates before reading R2.
Its production config uses remote R2. Only `wrangler.local.jsonc` and in-memory
Miniflare fixtures are safe for ordinary validation.

## Local storage schema

`src/db/types.ts` defines records; `src/db/db.ts` owns Dexie versions 1–4.
Books own highlights, conversations, and memory. Conversations own messages.
Compound indexes group children by book/conversation plus creation/update time.
Version 2 repairs old digest delimiters, version 3 adds archives, and version 4
adds external-id indexes for idempotent KOReader import. Do not rewrite migration
history. Use transactions and bulk `anyOf` lookups instead of per-row queries.
Deletion cascades; archiving removes EPUB bytes but preserves notes and file hash.

The narrator's versioned output contract is `docs/sync.schema.json`.
HTTP contracts are `docs/api.openapi.yml`. Lua-to-reader handoff validation is
`src/lib/koreader.ts`, exercised with synthetic fixtures and the real Lua VM.

## External services

Chat sends the user-selected context to the chosen model provider. Offline
reading, dry-run narration, and normal tests need no external services.
The app sends no third-party telemetry. Worker metrics are fixed operation names,
status codes, and numeric durations.
Local narrator progress contains book text-derived labels; treat generated
artifacts as private, never as telemetry or CI uploads.
