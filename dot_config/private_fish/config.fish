# Keep Fish's native bindings, history, completions, autosuggestions, and
# syntax highlighting. Only suppress the startup greeting.
if status is-interactive
    set -g fish_greeting
    fish_default_key_bindings
end
