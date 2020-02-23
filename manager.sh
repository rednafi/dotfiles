#!/bin/bash

# install snap
sudo apt update
sudo apt install snapd

# install pip
sudo apt install python3-pip

# install firacode 
sudo apt install fonts-firacode

# install miniconda
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
chmod +x Miniconda3-latest-Linux-x86_64.sh
sudo ./Miniconda3-latest-Linux-x86_64.sh


