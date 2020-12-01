# Fish specific
funcsave fish_greeting

# Add snap path
set -x PATH $PATH /snap/bin

# Add go path
set -x PATH $PATH:/usr/local/go/bin

# Git
set -x GIT_EDITOR 'code --wait'

# Alias
alias dj_dendi="curl -s https://raw.githubusercontent.com/rednafi/dotfiles/master/scripts/dj_dendi.sh | bash"

alias upgrade="sudo apt update && sudo apt upgrade"
alias pkill="pkill -ecfi"
alias pidof="pidof -xz"
alias www="python3 -m http.server 6666"
alias ls="ls --group-directories-first --color=auto"



# # >>> conda initialize >>>
# # !! Contents within this block are managed by 'conda init' !!
# eval /home/rednafi/miniconda3/bin/conda "shell.fish" "hook" $argv | source
# conda config --set auto_activate_base false
# # <<< conda initialize <<<
