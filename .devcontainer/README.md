# Runnable development container

Install Docker and the pinned CLI on the host:

```bash
npm install --global @devcontainers/cli@0.84.0
```

From a fresh clone, run:

```bash
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . sh .devcontainer/smoke.sh
```

`up` builds the Node 24/GitHub CLI image and waits for the full post-create
setup. Setup installs locked npm dependencies, generated Worker bindings, Git
hooks, and Chromium with its Linux dependencies. Initial setup requires network
access.
Browser installation may use the image's passwordless sudo inside the container;
it does not install packages on the host.

The smoke check verifies runtime versions and the installed hook before running
repository checks, the production build, bundle budgets, and desktop/mobile reader QA. The browser opens seeded Moby Dick,
jumps to Chapter 1 and reloads it; it also checks the unconfigured relay's safe
503 response. Tests use synthetic services, not paid inference.

Use a fresh clone without populated environment files for this check. The
workspace is mounted into the container; do not add credentials or private books
to a smoke-test checkout. No GitHub login is required inside the container.

`.github/workflows/devcontainer.yml` repeats both commands on pushes and PRs and
retains quality/browser reports. It does not skip lifecycle commands or repair
the environment before validation. A failure in setup or any check fails the job.

To start the reader for manual use after setup:

```bash
devcontainer exec --workspace-folder . npm run dev -- --host 127.0.0.1
```

In VS Code, **Reopen in Container** and open forwarded port 5173. Reading needs no
account or inference key. For CLI-only use, run the smoke check above, or open the
reader inside the container; automatic port forwarding is provided by VS Code,
not by the standalone CLI.
