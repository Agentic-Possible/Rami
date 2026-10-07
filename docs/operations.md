# Operations and privacy runbook

## Configuration and secrets

Use `.env.example` for local keys; never commit populated environment files.
The OpenRouter key, audiobook token, and signing key are server-side secrets.
The browser's optional personal OpenAI key remains in IndexedDB, is not encrypted,
and must not be used on a shared profile. Never export keys or access tokens.

Telemetry is disabled until configured. Public `VITE_SENTRY_DSN`,
`VITE_POSTHOG_KEY`, and `VITE_POSTHOG_HOST` identifiers are not authentication
secrets. Browser SDKs start only after Settings consent. Set each Worker's
`SENTRY_DSN` variable separately to enable server error capture. Automatic
integrations and tracing are disabled. Error messages and arbitrary event data
are replaced by an allowlisted generic event. This deliberately limits debugging
detail rather than risking book/prompt leakage. Hosts still see transport IPs;
configure short retention and restricted project access before enabling services.

Cloudflare and Netlify CSP allow the standard Sentry ingest and US/EU PostHog
hosts. Self-hosted telemetry needs an explicit CSP change, never a wildcard.
For source-map upload, explicitly set `SENTRY_UPLOAD_SOURCE_MAPS=true`,
`SENTRY_ORG`, `SENTRY_PROJECT`, and server-only `SENTRY_AUTH_TOKEN`. Ordinary builds
do not upload. Keep source maps private in production. No hosted projects, alert
rules, dashboards, or billing settings are provisioned by this repository.

## Health, outages, and spending

App and audiobook Workers expose `/health`, a liveness check only. It does not
call OpenRouter or R2. An absent inference key returns 503 for chat, not a reader
failure. Set `CHAT_ENABLED=false` on the relevant deploy target to stop paid chat
while keeping reading available. Vite, Netlify, and Cloudflare honor it.

Relay metrics log operation/status/duration, never URLs, prompts, or IPs.
Upstream header waits stop after 30 seconds; request/error bodies have byte
limits. Five consecutive transient provider failures open an isolate-local
30-second breaker. This and IP throttling are best effort, not global budgets.
Set a hard credit cap on the provider key. No automatic retries of paid requests.

For rising 5xx rates: inspect status/duration aggregates, provider status and
credit usage, turn off chat if needed, and reproduce using fake upstream tests.
For audiobook 401: check token/signing-key deployment consistency and URL expiry
without copying secrets or signed URLs into logs. For 416: reproduce local range
fixtures. Never test against the production R2 bucket as a debugging shortcut.

Suggested hosted alerts, after deliberate operator setup: 5xx >5% for 5 minutes
(minimum 20 requests), p95 relay header latency >20s for 10 minutes, health failures
from two locations, or provider spend >80% of the chosen cap. Link alerts to this
runbook. These are recommendations, not proof that alerts currently run.

## Release, canary, and rollback

PR checks must pass before main changes. CI produces test, coverage, and bundle
reports, but does not deploy. Review the complete diff and secret scan first.
Release/deploy only with explicit permission. Use an immutable Git tag, update
`CHANGELOG.md`, and link the PR, test evidence, and deploy version in the release.
The manual `draft-release` workflow accepts an existing version tag and generates
draft notes using issue-type labels. It does not publish a release or deploy.
Dispatch it only when explicitly authorized; it has not been run during remediation.

For Cloudflare, dry-run first, then upload an immutable Worker version and use
`wrangler versions deploy` for a small canary before 100% rollout. Monitor error
rate, health, and latency. The exact traffic split must be an explicit operator
decision. Restore the previous known-good version with `wrangler rollback`
on regression. Netlify operators restore a previously published deploy.
These actions require hosted credentials and authorization; local QA never runs
them. No deployment-frequency or successful-rollback claim follows from this doc.

## Data requests and error-to-issue flow

Books, notes, conversations, and personal keys stay on the reader's device.
Use the UI's export/delete controls for reader data. Clear browser site data for
complete local removal, including consent. Revoking consent reloads to clear SDK
queues and volatile identifiers; separately delete any prior hosted telemetry
through the operator's retention/deletion process.

For a telemetry incident, disable collection, restrict access, inspect only
allowlisted event IDs and release metadata, fix the privacy test, and review the
hosted retention/deletion process. Do not attach private books or conversations.
File a bug using the template, assign priority/type/area labels, reference the
generic event ID and failing synthetic regression, then close only after a
verified fix. No bot posts externally without explicit authorization.
