# fish specific
funcsave fish_greeting

# add snap path
set -x PATH $PATH /snap/bin

# add go path
set -x PATH $PATH:/usr/local/go/bin

# git
set -x GIT_EDITOR 'code --wait'

# alias
alias dj_dendi="curl -s https://raw.githubusercontent.com/rednafi/dotfiles/master/scripts/dj_dendi.sh | bash"

alias pkill="pkill -ecfi"
alias pidof="pidof -xz"


# # >>> conda initialize >>>
# # !! Contents within this block are managed by 'conda init' !!
# eval /home/rednafi/miniconda3/bin/conda "shell.fish" "hook" $argv | source
# conda config --set auto_activate_base false
# # <<< conda initialize <<<

