#!/usr/bin/env bash

# Added bash strict mode.

# Uninstall old version.
sudo apt-get remove docker docker-engine docker.io containerd runc

# Update apt.
sudo apt-get update

# Install packages to allow apt to use a repository over HTTPS.
sudo apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg-agent \
    software-properties-common

# Add Docker’s official GPG key.
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

# Verify fingerprint.
sudo apt-key fingerprint 0EBFCD88
sudo add-apt-repository \
    "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"

# Update apt.
sudo apt-get update

# Install docker ce.
sudo apt-get install docker-ce docker-ce-cli containerd.io

# Run hello world.
sudo docker run hello-world

# Install docker-compose.
sudo curl -L "https://github.com/docker/compose/releases/download/1.26.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
docker-compose --version


# Post installation (running docker as non-root).
sudo groupadd docker
sudo usermod -aG docker $USER
newgrp docker
docker run hello-world
sudo chown "$USER":"$USER" /home/"$USER"/.docker -R
sudo chmod g+rwx "$HOME/.docker" -R
sudo systemctl enable docker
sudo systemctl restart docker
