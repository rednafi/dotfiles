# Shared command-line environment. Keep secrets in 00-private.fish.
set -gx GOPATH "$HOME/go"
set -gx EDITOR micro
set -gx VISUAL "code --wait"
set -gx GIT_EDITOR "$EDITOR"
set -gx SUDO_EDITOR "$EDITOR"
set -gx GH_EDITOR "$EDITOR"
set -gx KUBE_EDITOR "$EDITOR"
set -gx CLICOLOR 1
set -gx VIRTUAL_ENV_DISABLE_PROMPT 1
set -gx PI_CACHE_RETENTION long
set -gx BUN_INSTALL "$HOME/.bun"

# fish_add_path is idempotent and avoids the duplicate PATH entries common in
# shell startup files. Earlier entries in this list take precedence.
set -l preferred_paths \
    "$BUN_INSTALL/bin" \
    /opt/homebrew/opt/rustup/bin \
    /usr/local/opt/rustup/bin \
    "$HOME/.cargo/bin" \
    /opt/homebrew/bin \
    /opt/homebrew/opt/sqlite/bin \
    /opt/homebrew/opt/uutils-coreutils/libexec/uubin \
    /Applications/OrbStack.app/Contents/MacOS/xbin \
    "$HOME/.local/bin" \
    "$HOME/.local/share/uv/python" \
    "$HOME/go/bin" \
    "$HOME/canvas/bin"

# Add in reverse because each path is prepended.
for path_dir in $preferred_paths[-1..1]
    test -d "$path_dir"; and fish_add_path --global --move "$path_dir"
end
