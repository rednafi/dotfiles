## DotFiles

* Restoring ssh key
   * Copy the backup private ssh keys into `~/.ssh` folder
   * Create public key from private key
      ```
       ssh-keygen -y -f ~/.ssh/id_rsa > ~/.ssh/id_rsa.pub
      ```
   * Change folder permission
        ```bash
        sudo chown -R $USER:$USER ~/.ssh
        chmod -R 700 ~/.ssh
        ```
