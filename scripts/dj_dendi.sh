#!/bin/bash
# Bash script to start a dendi project
# prequisites :
# cd to your project's root folder (where the manage.py lives)
# install watchdog via `sudo apt install watchdog`
# make sure your virtual environment's name is `.venv`


set -euxo pipefail

# Run the django server
djrs="source .venv/bin/activate &&\
watchmedo auto-restart --directory=./ --pattern='*.py' --recursive -- python manage.py runserver"

# Spawn the default queue
djq1="source .venv/bin/activate &&\
watchmedo auto-restart --directory=./ --pattern='*.py' --recursive -- celery -A main worker -l info -Q default"

# Spawn the identifiers queue
djq2="source .venv/bin/activate &&\
watchmedo auto-restart --directory=./ --pattern='*.py' --recursive -- celery -A main worker -Q identifiers --concurrency=1 -l info"

# Spawn the reports queue
djq3="source .venv/bin/activate &&\
watchmedo auto-restart --directory=./ --pattern='*.py' --recursive -- celery -A main worker -Q reports --concurrency=2 -l info"


# Start all project's runners
# the ;SHELL command keeps and holds the tabs open
proj() {
    gnome-terminal --tab --title="Django Server" -- bash -ic "$djrs;$SHELL"
    gnome-terminal --tab --title="CeleryQ: default" -- bash -ic "$djq1;$SHELL"
    gnome-terminal --tab --title="CeleryQ: identifiers" -- bash -ic "$djq2;$SHELL"
    gnome-terminal --tab --title="CeleryQ: reports" -- bash -ic "$djq3;$SHELL"
}

proj
