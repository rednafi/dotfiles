# Only configure prompt if interactive
if status is-interactive
    # ---------------------- Prompt ------------------------------------------
    #  • Yellow “user@host:”, cyan PWD, green VCS, newline, symbol ($ / #)
    #  • Starts with a blank line for readability
    # -----------------------------------------------------------------------
    function fish_prompt --description "Yellow login, cyan path, green git"
        # Colour-coded user@host, path, and VCS branch
        echo
        set_color yellow; echo -n "$USER@"(prompt_hostname)":"
        set_color cyan;   echo -n (prompt_pwd)
        set_color green;  echo -n (fish_vcs_prompt)

        # Newline + symbol ($ for user / # for root)
        set_color normal
        set -l symbol '$'
        if functions -q fish_is_root_user; and fish_is_root_user
            set symbol '#'
        end
        printf "\n%s " $symbol
    end
end

# ---------------------- Environment ----------------------------------------

# Remove welcome message
set -U fish_greeting

# Add canvas to CDPATH for quick navigation
set -Ux CDPATH "$CDPATH:$HOME/canvas"

# Set Homebrew binary path for fish
set -U fish_user_paths /opt/homebrew/bin


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

# Start Cassandra container and open cqlsh
function ,cup
    set container_name cassandra-cup
    set host_port 9043
    set container_port 9042

    set name_filter (string join "" "^/" $container_name "\$")

    if docker ps -q -f name=$name_filter | grep -q .
        echo "Cassandra container '$container_name' is already running."
    else
        echo "Starting Cassandra on port $host_port..."
        docker run -d --rm \
            --name $container_name \
            -e CASSANDRA_USER=cassandra \
            -e CASSANDRA_PASSWORD=cassandra \
            -p $host_port:$container_port \
            bitnami/cassandra:latest

        echo "Waiting for Cassandra to accept CQL connections..."
        while not docker logs $container_name 2>&1 | grep -q "Starting listening for CQL clients"
            sleep 2
        end
    end

    echo "Connecting with cqlsh..."
    docker run -it --rm \
        --network container:$container_name \
        bitnami/cassandra:latest \
        cqlsh 127.0.0.1 $container_port -u cassandra -p cassandra
end

# Stop Cassandra container
alias ,cdown="docker rm -f cassandra-cup"

# --- Misc Tools ---
# Clear user and tmp caches (macOS specific)
alias ,clear-cache='\
    sudo rm -rf /System/Volumes/Data/Users/$USER/Library/Caches \
    && sudo rm -rf /var/tmp'

# Start a local web server on port 6969
alias ,www="python3 -m http.server 6969"

# Fuzzy history search with fzf
function fish_history_search
    set -l selected (history | fzf --exact)
    if test -n "$selected"
        commandline --replace "$selected"
    end
end

bind \cr fish_history_search
