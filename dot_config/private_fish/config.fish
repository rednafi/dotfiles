# Keep Fish's native key bindings and suppress only the startup greeting.
if status is-interactive
    set -g fish_greeting
    fish_default_key_bindings
end
