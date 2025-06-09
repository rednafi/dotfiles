# Only configure interactive elements
if status is-interactive
    # ---------------------- Aliases -------------------------------------------

    # --- Git Aliases ---
    # Delete all branches except main, master, staging, and development
    alias ,brclr="\
        git branch | grep -vwE 'main|master|staging|development' | xargs git branch -D"

    # --- Unix Core Aliases ---
    alias sudo="sudo "         # Allow alias expansion after sudo
    alias cp="cp -iv"          # Prompt and verbose for cp
    alias mv="mv -iv"          # Prompt and verbose for mv
    alias rm="rm -iv"          # Prompt and verbose for rm
    alias ls="ls -G"           # Colorized listing
    alias python="python3.13"  # Pin python alias to specific version
    alias cat="bat"            # Fancy cat replacement

    # --- Docker Aliases ---
    # Stop and remove all containers
    alias ,docker-prune-containers='\
        docker stop $(docker ps -aq) 2> /dev/null && docker rm $(docker ps -aq) 2> /dev/null'

    # Force-remove all images
    alias ,docker-prune-images='docker rmi --force $(docker images -q) || true'

    # Prune all unused data including volumes
    alias ,docker-prune-volumes='docker system prune -af --volumes'

    # Run all Docker prune steps
    alias ,docker-nuke="\
        ,docker-prune-containers && ,docker-prune-images && ,docker-prune-volumes"

    # --- Wolt / Doordash Dev Tools ---
    # Kubernetes shortcut via tsh
    alias tk="tsh kubectl"

    # --- Misc Tools ---
    # Clear user and tmp caches (macOS specific)
    alias ,clear-cache='\
        sudo rm -rf /System/Volumes/Data/Users/$USER/Library/Caches \
        && sudo rm -rf /var/tmp'

    # Start a local web server on port 6969
    alias ,www="python3 -m http.server 6969"

    bind \cr fish_history_search
end
