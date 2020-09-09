# add snap path
set -x PATH $PATH /snap/bin

# server ip
set -x ELOAN_SCORECARD "34.87.92.0"
set -x AREA_SEARCH_ENGINE "35.198.243.6"

# git
set -x GIT_EDITOR "code --wait"

# # >>> conda initialize >>>
# # !! Contents within this block are managed by 'conda init' !!
# eval /home/rednafi/miniconda3/bin/conda "shell.fish" "hook" $argv | source
# conda config --set auto_activate_base false
# # <<< conda initialize <<<
