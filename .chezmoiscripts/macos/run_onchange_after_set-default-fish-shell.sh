#!/usr/bin/env bash
# Make Homebrew Fish an approved login shell and select it for this user.

set -euo pipefail

[[ "$(uname -s)" == "Darwin" ]] || exit 0

if [[ -x /opt/homebrew/bin/fish ]]; then
    fish_bin=/opt/homebrew/bin/fish
elif [[ -x /usr/local/bin/fish ]]; then
    fish_bin=/usr/local/bin/fish
else
    printf '%s\n' "Fish is not installed; skipping default-shell setup." >&2
    exit 0
fi

sudo -v

grep -Fqx "$fish_bin" /etc/shells \
    || printf '%s\n' "$fish_bin" | sudo tee -a /etc/shells >/dev/null

current_shell="$(dscl . -read "/Users/$USER" UserShell 2>/dev/null | awk '{print $2}')"
if [[ "$current_shell" != "$fish_bin" ]]; then
    sudo chsh -s "$fish_bin" "$USER"
fi
