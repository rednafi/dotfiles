# Fuzzy history search with fzf
function history_search
    set -l selected (history | fzf --exact)
    if test -n "$selected"
        commandline --replace "$selected"
    end
end
