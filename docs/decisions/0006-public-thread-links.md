# Publish shared threads at unlisted links

Date: 2026-10-11
Status: Proposed

## Context

Issue #130 asks for a way to share a whole thread as a link, like a private
GitHub gist, so a reader can send a conversation without pasting a wall of
text. Sharing as text (PR #131) works, but a long thread is awkward in a
message, and a link can carry a preview card and lead the recipient into Rami.

This reverses a stated non-goal: `docs/architecture.md` rules out "server-side
storage of books and conversations." A published thread is a conversation
stored on our server, so accepting this record means narrowing that non-goal
to "except threads a reader explicitly publishes."

## Decision

Proposed design, pending review:

- **Opt-in snapshot.** Nothing leaves the device until the reader taps
  "Publish link" and confirms that anyone with the link can read the thread.
  The server stores a snapshot: book title and author, chapter, the seed
  passage, and the user and assistant turns. No context paragraphs, memory,
  instructions, settings, or book file.
- **Unguessable id.** 128 random bits, base64url encoded (22 characters),
  served at `/t/<id>`. Links are unlisted, not secret: anyone holding one can
  read it.
- **Storage: Workers KV.** Write-once, read-many snapshots keyed by id, with
  KV's built-in expiry for retention. A shared handler in `shared/threads.ts`
  takes a small store interface, so the Worker passes KV and the Vite dev
  server passes an in-memory map, the same pattern as `shared/relay.ts`.
- **Owner token.** Publishing returns a random owner token alongside the id.
  The server keeps only its SHA-256. The PWA saves the id and token on the
  conversation record (two non-indexed fields, no Dexie version bump), which
  lets the reader republish to the same link after the thread grows, or
  unpublish it. Losing the device loses the ability to delete; the expiry
  still applies.
- **Viewer page rendered by the Worker.** `GET /t/<id>` returns static HTML
  with every value escaped, no scripts, `noindex`, the existing strict CSP,
  and Open Graph tags so chat apps show a card. It ends with a link to open
  Rami. This keeps the viewer working without the PWA bundle or IndexedDB.
- **Limits.** Same-origin check and a per-IP rate limit as the relay uses, a
  64 KB body cap, and a cap on the seed passage length so a link cannot
  republish long stretches of an imported, possibly copyrighted, book.
- **API.** `POST /api/threads` (create), `PUT /api/threads/<id>` and
  `DELETE /api/threads/<id>` (owner token in `Authorization`), documented in
  `docs/api.openapi.yml`.

## Open questions

1. Retention: expire links after a fixed period (90 days, 1 year) or keep them
   until the owner deletes them?
2. Republish: should republishing keep the same link (proposed), or mint a new
   one each time?
3. Moderation: is unpublish by the owner plus the contact email enough, or do
   we want a report link on the viewer page?

## Alternatives and tradeoffs

- **R2 objects:** cheaper for large blobs, but no built-in expiry per object
  without lifecycle rules, and snapshots are small.
- **D1:** queryable, but a schema and migrations for what is a key-value
  lookup.
- **Encode the thread in the URL fragment:** no server storage at all, but
  links run to many kilobytes, break in SMS and some chat apps, and cannot
  show a preview card.
- **SPA route that fetches JSON:** reuses React components, but the recipient
  downloads the whole reader to see a page of text, and preview cards need
  server-rendered meta tags anyway.
- **Cost:** we host user-published text under our domain, take on deletion
  requests, and give up the claim that conversations never leave the device.
