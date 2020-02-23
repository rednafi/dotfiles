## DotFiles

* Restoring ssh key
   * Copy the backup ssh keys into `~/.ssh` folder
   * Change folder permission
        ```bash
        sudo chown -R $USER:$USER ~/.ssh
        chmod -R 700 ~/.ssh
        ```
* zsh :
    ```bash
    $ wget -O - https://raw.githubusercontent.com/rednafi/dotfiles/master/zsh/zsh.sh | sudo bash
    ```
