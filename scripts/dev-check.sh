#!/usr/bin/env bash
# Sanity-checks the Merkwacht workspace: installs dependencies, then runs
# typecheck, lint, and tests across every package/app. Intended for local
# use before pushing, and as a quick smoke test after scaffolding changes.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing dependencies"
pnpm install

echo ""
echo "==> Typecheck (pnpm -r typecheck)"
pnpm -r typecheck

echo ""
echo "==> Lint (pnpm -r lint)"
pnpm -r lint

echo ""
echo "==> Tests (pnpm -r test)"
pnpm -r test

echo ""
echo "Dev-check completed successfully."
