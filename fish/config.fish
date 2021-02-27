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
alias gp="git push origin HEAD"
alias brclr="git branch | grep -Ev 'master|staging' | xargs -I{} git branch -D '{}'"


## Unix magics
alias sudo="sudo "
alias cp="cp -iv"
alias mv="mv -iv"
alias rm="rm -iv"
alias hs="history|grep"
alias ls="ls --group-directories-first --color=auto"
alias pidof="pidof -xz"
alias ping="ping -c5"
alias pkill="pkill -ecfi"
alias update="sudo apt update && sudo apt upgrade && sudo apt autoclean && sudo apt autoremove"
alias www="python3 -m http.server 8001"


## Docker
function start_redis
    echo "Spinning up a Redis container..."
    echo "================================"
    echo
    stop_redis
    command docker run --name dev-redis -d -h localhost -p 6379:6379 redis:alpine
    echo
end

function stop_redis
    echo
    command docker stop dev-redis
    command docker rm dev-redis
    echo
end

function start_rabbit
    echo "Spinning up a Rabbitmq container..."
    echo "==================================="
    echo
    stop_rabbit
    command docker run -d                       \
            --hostname my-rabbit                \
            --name dev-rabbit                   \
            -p 15672:15672                      \
            -p 5672:5672                        \
            --memory 512m                       \
            -e RABBITMQ_DEFAULT_USER=ubuntu     \
            -e RABBITMQ_DEFAULT_PASS=debian     \
            -e RABBITMQ_VM_MEMORY_HIGH_WATERMARK=0.8 \
            rabbitmq:3-management
    echo
end

function stop_rabbit
    echo
    command docker stop dev-rabbit
    command docker rm dev-rabbit
    echo
end
