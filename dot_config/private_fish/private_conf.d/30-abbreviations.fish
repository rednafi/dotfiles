if status is-interactive
    # Abbreviations expand visibly, so command history records what was run.
    abbr --add --global --position command ,www 'python -m http.server 6969'
end
