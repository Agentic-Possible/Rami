#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
npm ci
python3 -m venv tools/narrate/.quality-venv
tools/narrate/.quality-venv/bin/python -m pip install --require-hashes -r tools/narrate/requirements-dev.txt
npm run types:generate
git config core.hooksPath .githooks
printf '%s\n' "Setup complete. Optional GPU/model packages were not installed."
