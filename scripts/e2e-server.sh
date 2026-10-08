#!/usr/bin/env bash
# Starts the real backend serving the production frontend build, for Playwright: test mode (the
# reset, seed and clock endpoints, localhost only), a throwaway data folder, and no APP_PASSWORD,
# so the first-run wizard runs as a family would see it.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$(mktemp -d)"
export APP_SECRET_KEY="e2e-only-secret-key-0123456789abcdef"
export TZ="America/New_York"
export PORT=4173
export DATA_DIR="$DATA"
export SUNROOM_TEST_MODE=1
# What a phone should open, as kiosk/install.sh sets it on a Pi (the wall itself is on loopback).
export SUNROOM_ADVERTISED_URL="http://sunroom.local:4173"
export SUNROOM_STATIC_DIR="$ROOT/frontend/dist"
export LOG_LEVEL=WARNING
cd "$ROOT/backend"
uv run sunroom serve --host 127.0.0.1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; rm -rf "$DATA"' EXIT INT TERM
wait "$PID"
