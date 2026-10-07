# Readiness remediation snapshot

This records the **local, pre-publication assessment**, not a published release.
The assessed changes were based on `74a561cb894547b6e9d73c88bec2e63632ed1ccd`.
At assessment time, nothing was committed, pushed, deployed, or published as a PR.
The complete 84-signal reassessment was saved as report
`517f9593-8812-4140-8566-5c93d3cfc986`. It marks remaining partial/operational
signals as failures rather than treating configuration as live evidence.

## Verified locally

- Clean dependency install, zero npm audit vulnerabilities, strict TypeScript
  across app/Workers/harnesses, strict Python mypy, and warning-free lint.
- 118 Vitest tests (including real local R2/crypto/range fixtures), seven Python
  tests, and four desktop/mobile Chromium checks.
- All-module core coverage: 43% lines, 42% branches. Python coverage: 81%.
  Floors deliberately reflect current coverage, not comprehensive UI coverage.
- Prettier/Ruff formatting, Knip/Vulture unused-code checks, duplicate-code
  checks, complexity/size boundaries, generated contracts, flag ownership, and
  documented-command validation.
- Production build and 1.2 MB JavaScript budget; isolated setup command and
  installed pre-commit hook; devcontainer image built and Node/Python/GitHub CLI
  runtime smoke-tested.
- Optional Sentry/PostHog, default-off browser consent, allowlisted diagnostics,
  health handlers, bounded bodies, 30-second upstream header timeout, and an
  isolate-local circuit breaker. No live telemetry or billed provider calls.

## Verified GitHub changes, explicitly approved

All seven open issues have priority/type/area labels. Main requires a PR and the
existing `app` and `narrate` checks, including for admins, with zero approvals.
At assessment time, the new `qa`/security workflows had not run remotely.

## Remaining or deliberately unproven

| Signal | Reason |
| --- | --- |
| Automated PR review / agentic-development history | No review bot installed or new AI-authored PR published. |
| Deployment frequency | Historical evidence cannot be manufactured by adding files. |
| Progressive rollout / automated rollback | Runbook exists; no hosted rollout or rollback was executed or automated. |
| Distributed tracing | Deliberately off to avoid sending request/URL data. Needs a privacy-reviewed implementation. |
| Hosted metrics, alerts, dashboards, retention | Optional integrations are off; no hosted projects or policies provisioned. |
| Contextualized error tracking | Generic scrubbed events intentionally omit stack/request content; not full operational diagnosis. |
| Security analyses | CodeQL, Gitleaks, dependency review, and Dependabot configured locally; pending a published PR and actual runs. |
| DAST | Synthetic auth/range/relay tests run, but no standalone active scanner is configured. |
| Full per-app type coverage | Lua is dynamic; it has VM tests, LuaJIT syntax/global/complexity gates, and StyLua, not static typing. |
| Flake history / performance trends | Test durations/retries/reports exist, but no repeated-run trend or flaky-test service is established. |
| Version drift | Python/npm dependencies are pinned/locked and checked for unused imports; no cross-ecosystem SDK version-alignment gate. |
| Backlog acceptance criteria | Labels/priorities added; existing issue bodies and scope were not rewritten or closed. |
| Privacy compliance | Consent/scrubbing/deletion guidance is implemented; legal approval and hosted retention verification are not established. |
| Full devcontainer application setup | Image and runtime smoke test passed; complete post-create setup inside a running container was not executed. |

These are not all hosted blockers. Remaining local items need a separate
validated follow-up; no claim of 100% readiness or complete remediation is made.
Production builds also emit an upstream Tailwind CSS source-map warning; JavaScript
source maps and the build succeed.
