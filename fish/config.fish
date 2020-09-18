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
