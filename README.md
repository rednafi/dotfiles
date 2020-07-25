# Dotfiles

## Restore SSH

* Copy the backup ssh keys into the `~/.ssh` folder

    ```
    cp -r backup_ssh_path/* ~/.ssh
    ```

* Change folder permission

    ```
    sudo chown -R $USER:$USER ~/.ssh
    chmod -R 700 ~/.ssh
    ```
* If you've changed the username from `rednafi` to anything else, in that case you've to regenerate the public ssh key from the private key.

    * First copy the `id_rsa` private key to the `~/.ssh` folder and change the permisison via the commands stated above. Then run:

    ```
    ssh-keygen -y -f ~/.ssh/id_rsa > ~/.ssh/id_rsa.pub
    ```

* Put all the database `*.pem` keys in the `~/.ssh` folder

## Install Fish (From Bash/Zsh)

* Install

    ```
    sudo apt install fish
    ```

* Change shell

    ```
    sudo chsh -s $(which fish)
    ```
* Copy the config (theme: *Pythonista custom*)

    ```
    cp -r ~/code/personal/dotfiles/fish ~/.config
    ```
