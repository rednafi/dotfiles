#!/usr/bin/env bash
# Seed zoxide with local work and download directories. Safe to re-run.

set -euo pipefail

[[ "$(uname -s)" == "Darwin" ]] || exit 0
command -v zoxide >/dev/null 2>&1 || exit 0

export _ZO_MAXAGE="${_ZO_MAXAGE:-200000}"

roots=()
for dir in "$HOME/canvas" "$HOME/Downloads"; do
    [[ -d "$dir" ]] && roots+=("$dir")
done

((${#roots[@]})) || exit 0

find "${roots[@]}" -type d -print0 | xargs -0 -n 200 zoxide add --
