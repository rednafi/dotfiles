# fish specific
funcsave fish_greeting

# add snap path
set -x PATH $PATH /snap/bin

# git
set -x GIT_EDITOR "code --wait"

# # >>> conda initialize >>>
# # !! Contents within this block are managed by 'conda init' !!
# eval /home/rednafi/miniconda3/bin/conda "shell.fish" "hook" $argv | source
# conda config --set auto_activate_base false
# # <<< conda initialize <<<
