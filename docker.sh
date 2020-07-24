#!/bin/bash

# uninstall old version
sudo apt-get remove docker docker-engine docker.io containerd runc

# update apt
sudo apt-get update

# install packages to allow apt to use a repository over HTTPS
sudo apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg-agent \
    software-properties-common

# add Docker’s official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

# verify fingerprint
sudo apt-key fingerprint 0EBFCD88
sudo add-apt-repository \
    "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"

# update apt
sudo apt-get update

# install docker ce
sudo apt-get install docker-ce docker-ce-cli containerd.io

# run hello world
sudo docker run hello-world
