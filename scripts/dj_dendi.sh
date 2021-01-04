#!/bin/bash
# Bash script to start a dendi project
# prequisites :
# cd to your project's root folder (where the manage.py lives)
# install watchdog via `sudo apt install watchdog`
# make sure your virtual environment's name is `.venv`

# Run the django server
djrs="source .venv/bin/activate &&\
python manage.py runserver"

# Spawn the default queue
djq1="source .venv/bin/activate &&\
watchmedo auto-restart --directory=./ --pattern='*.py' \
--ignore-patterns='./.venv/*; ./*/migrations/*' --recursive -- \
celery -A main worker -Q default -n default --loglevel=INFO --concurrency=1"

# Spawn the identifiers queue
djq2="source .venv/bin/activate &&\
watchmedo auto-restart --directory=./ --pattern='*.py'\
--ignore-patterns='./.venv/*; ./*/migrations/*' --recursive -- \
celery -A main worker -Q identifiers  -n identifiers --loglevel=INFO --concurrency=1"

# Spawn the reports queue
djq3="source .venv/bin/activate &&\
watchmedo auto-restart --directory=./ --pattern='*.py' \
--ignore-patterns='./.venv/*; ./*/migrations/*' --recursive -- \
celery -A main worker -Q reports -n reports --loglevel=INFO --concurrency=1"

# # Spawn the bop orders queue
# djq4="cd ../bulk_ordering_platform/ &&\
# source .venv/bin/activate &&\
# watchmedo auto-restart --directory=./ --pattern='*.py' \
# --ignore-patterns='./.venv/*; ./*/migrations/*' --recursive -- \
# celery -A main worker -Q orders -n orders --loglevel=INFO --concurrency=1"


# Start all project's runners
# the ;SHELL command keeps and holds the tabs open
proj() {
    gnome-terminal --tab --title="Django Server" -- bash -ic "$djrs;$SHELL"
    gnome-terminal --tab --title="CeleryQ: default" -- bash -ic "$djq1;$SHELL"
    gnome-terminal --tab --title="CeleryQ: identifiers" -- bash -ic "$djq2;$SHELL"
    gnome-terminal --tab --title="CeleryQ: reports" -- bash -ic "$djq3;$SHELL"
    gnome-terminal --tab --title="CeleryQ: bop_orders" -- bash -ic "$djq4;$SHELL"
}

proj
