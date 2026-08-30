#!/usr/bin/env bash
# Install the latest Pi release and ensure its globally configured packages exist.

set -euo pipefail

[[ "$(uname -s)" == "Darwin" ]] || exit 0

if ! command -v npm >/dev/null 2>&1; then
    printf '%s\n' "npm not found; skipping Pi installation." >&2
    exit 0
fi

npm install --global --ignore-scripts @earendil-works/pi-coding-agent@latest

adapter_manifest="$HOME/.pi/agent/npm/node_modules/pi-mcp-adapter/package.json"
if [[ ! -f "$adapter_manifest" ]]; then
    pi install npm:pi-mcp-adapter
fi
