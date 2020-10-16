#!/bin/bash

# update the packages list and install the prerequisites
sudo apt update
sudo apt install software-properties-common

# add deadsnakes ppa to your sources' list (When prompted press Enter to continue)
sudo add-apt-repository ppa:deadsnakes/ppa

# install python
sudo apt install python3.7 python3.8 python3.9

# verify python installation
python3.9 --version
