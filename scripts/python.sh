#!/bin/bash

# update the packages list and install the prerequisites
sudo apt update
sudo apt install software-properties-common

# add deadsnakes ppa to your sources' list (When prompted press Enter to continue)
sudo add-apt-repository ppa:deadsnakes/ppa

# install python3.8
sudo apt install python3.8

# verify python installation
python3.8 --version

