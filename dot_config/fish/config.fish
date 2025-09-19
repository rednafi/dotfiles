# Only configure interactive elements
if status is-interactive
    # ---------------------- Aliases -------------------------------------------

    # --- Git Aliases ---
    # Delete all branches except main, master, staging, and development
    abbr ,brclr "\
        git branch | grep -vwE 'main|master|staging|development' | xargs git branch -D"

    # --- Unix Core Aliases ---
    abbr sudo "sudo "         # Allow alias expansion after sudo
    abbr cp "cp -iv"          # Prompt and verbose for cp
    abbr mv "mv -iv"          # Prompt and verbose for mv
    abbr rm "rm -iv"          # Prompt and verbose for rm
    abbr ls "ls -G"           # Colorized listing
    abbr python "python3.13"  # Pin python alias to specific version
    abbr cat "bat"            # Fancy cat replacement

    # --- Docker Aliases ---
    # Stop and remove all containers
    abbr ,docker-prune-containers 'docker stop $(docker ps -aq) 2> /dev/null && docker rm $(docker ps -aq) 2> /dev/null'

    # Force-remove all images
    abbr ,docker-prune-images 'docker rmi --force $(docker images -q) || true'

    # Prune all unused data including volumes
    abbr ,docker-prune-volumes 'docker system prune -af --volumes'

    # Run all Docker prune steps (fully inlined)
    abbr ,docker-nuke 'docker stop $(docker ps -aq) 2> /dev/null && docker rm $(docker ps -aq) 2> /dev/null && docker rmi --force $(docker images -q) || true && docker system prune -af --volumes'

    # --- Wolt / Doordash Dev Tools ---
    # Kubernetes shortcut via tsh
    abbr tk "tsh kubectl"

    # --- Misc Tools ---
    # Clear user and tmp caches (macOS specific)
    abbr ,clear-cache 'sudo rm -rf /System/Volumes/Data/Users/$USER/Library/Caches && sudo rm -rf /var/tmp'

    # Start a local web server on port 6969
    abbr ,www "python3 -m http.server 6969"

    bind \cr history_search    
end

