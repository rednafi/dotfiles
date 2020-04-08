## DotFiles

* Restoring ssh key
   * Copy the backup private ssh keys into `~/.ssh` folder
   * Create public key from private key
      ```
       $ ssh-keygen -y -f ~/.ssh/id_rsa > ~/.ssh/id_rsa.pub
      ```
   * Change folder permission
        ```bash
        sudo chown -R $USER:$USER ~/.ssh
        chmod -R 700 ~/.ssh
        ```

* Execute `.sh` files with the following command
    ```bash
     $ sudo chmod +x file.sh
     $ ./file sh
    ```

    **Execution order**
    * `zsh.sh`
    * `manager.sh`
    * `app.sh`
    * `docker.sh`

## Install Fish

```bash
!/bin/bash

sudo apt install fish
sudo chsh -s $(which fish)

# theme pythonista custom
cp -r ~/code/dotfiles/fish ~/.config
```
