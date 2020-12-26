# Meta
funcsave fish_greeting

# Adds snap path
set -x PATH $PATH /snap/bin

# Adds go path
set -x PATH $PATH:/usr/local/go/bin

# Git
set -x GIT_EDITOR "code --wait"

# Aliases

## Dendi
alias dj_dendi="curl -s https://raw.githubusercontent.com/rednafi/dotfiles/master/scripts/dj_dendi.sh | bash"

## Git
alias ga="git add ."
alias gac="git add . && git commit -m "
alias gp="git push origin HEAD"

## Python
# Run any command on the unstaged files.
function pylint
    echo "Applying black..."
    echo "================="
    echo
    command git status -s | grep '.py$' | awk '{print $2}' | xargs black
    echo

    echo "Applying isort..."
    echo "================="
    echo
    command git status -s | grep '.py$' | awk '{print $2}' | xargs isort
    echo
end


## Unix magics
alias sudo="sudo "
alias cp="cp -i"
alias hs="history|grep"
alias ls="ls --group-directories-first --color=auto"
alias mv="mv -i"
alias pidof="pidof -xz"
alias ping="ping -c5"
alias pkill="pkill -ecfi"
alias rm="rm -i"
alias update="sudo apt update && sudo apt upgrade"
alias www="python3 -m http.server 8001"

## Docker
function runredis
    echo "Spinning up a Redis container..."
    echo "================================"
    echo
    command docker stop dev-redis
    command docker rm dev-redis
    command docker run --name dev-redis -d -h localhost -p 6379:6379 redis:alpine
    echo
end


# # >>> conda initialize >>>
# # !! Contents within this block are managed by 'conda init' !!
# eval /home/rednafi/miniconda3/bin/conda "shell.fish" "hook" $argv | source
# conda config --set auto_activate_base false
# # <<< conda initialize <<<
