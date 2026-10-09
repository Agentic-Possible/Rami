#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
npm ci
npm run types:generate
git config core.hooksPath .githooks
printf '%s\n' "Setup complete."
