#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

# Verify lifecycle setup, not an environment repaired by this smoke check.
node -e "if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Expected Node 24')"
python3 -c "import sys; assert sys.version_info[:2] == (3, 12), 'Expected Python 3.12'"
python3 -c "import sys; from pathlib import Path; assert Path(sys.prefix).resolve() == Path('tools/narrate/.quality-venv').resolve(), 'Validation environment missing from PATH'"
gh --version
test "$(git config --get core.hooksPath)" = ".githooks"
test -x .githooks/pre-commit

npm run check
npm run quality
npm run check:narrate
npm run docs:check
npm run build:cloudflare
node scripts/bundle-budget.mjs

# Playwright launches Vite, renders a seeded book, reopens it, and checks
# the unconfigured relay. Its fixtures block hosted service requests.
npm run test:qa
(
  cd tools/narrate
  .quality-venv/bin/python -m narrate ../../public/books/moby-dick.epub --dry-run
)
printf '%s\n' "Devcontainer setup, validation, build, and reader smoke checks passed."
