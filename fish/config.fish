# fish specific
funcsave fish_greeting

# add snap path
set -x PATH $PATH /snap/bin

# git
set -x GIT_EDITOR "code --wait"

# alias
alias djrs="source .venv/bin/activate.fish && python manage.py runserver"

alias djq1="source .venv/bin/activate.fish &&\
celery -A main worker -l info -Q default"

alias djq2="source .venv/bin/activate.fish &&\
celery -A main worker -Q identifiers --concurrency=1 -l info"

# # >>> conda initialize >>>
# # !! Contents within this block are managed by 'conda init' !!
# eval /home/rednafi/miniconda3/bin/conda "shell.fish" "hook" $argv | source
# conda config --set auto_activate_base false
# # <<< conda initialize <<<
