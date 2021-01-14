#!/bin/bash

# Bash error handling.
set -euo pipefail

# Mention the versions of Python to be installed. Add versions as space seperated
# strings
PYTHON_VERSIONS=(3.6 3.7 3.8 3.9)


# Update the package-list and install the prerequisites.
sudo apt -y update
sudo apt -y autoremove
sudo apt -y install software-properties-common

# Add deadsnakes PPA to your sources' list.
sudo add-apt-repository -y ppa:deadsnakes/ppa


# Install Python.
echo "Installing Python..."
echo "===================="
echo
for v in ${PYTHON_VERSIONS[@]}
do
    echo "  Installing Python $v..."
    echo "  -------------------------"
    echo
    sudo apt install -y python$v
    echo
done
echo


# Verify Python installation.
echo "Verifying Python versions..."
echo "============================"
echo
for v in ${PYTHON_VERSIONS[@]}
do
    python$v --version
done
echo
