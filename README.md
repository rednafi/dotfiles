# Dotfiles

## Restore SSH

* Copy the backup ssh keys into the `~/.ssh` folder:

    ```
    cp -r backup_ssh_path/* ~/.ssh
    ```

* Change folder permission:

    ```
    sudo chown -R $USER:$USER ~/.ssh
    chmod -R 700 ~/.ssh
    ```
* If you've changed the username from `rednafi` to anything else, in that case you've to regenerate the public ssh key from the private key.

    First copy the `id_rsa` private key to the `~/.ssh` folder and change the permisison via the commands stated above. Then run:

    ```
    ssh-keygen -y -f ~/.ssh/id_rsa > ~/.ssh/id_rsa.pub
    ```

* Put all the database `*.pem` keys in the `~/.ssh` folder:

## Install Fish (From Bash / Zsh)

* Install:

    ```
    sudo apt install fish
    ```

* Change shell:

    ```
    sudo chsh -s $(which fish)
    ```
* Copy the config (theme: *Pythonista custom*):

    ```
    cp -r ~/code/personal/dotfiles/fish ~/.config
    ```

## Install Fonts

* Download (With `curl`):
    * `-O, --remote-name        Write output to a file named as the remote file`
    * `-J, --remote-header-name Use the header-provided filename`
    * `-L, --location           Follow redirects`

    ```
    curl -OJL https://github.com/tonsky/FiraCode/releases/download/5.2/Fira_Code_v5.2.zip
    ```
* Install:
    ```
    unzip ~/Fira_Code_v5.2.zip -d /usr/share/fonts
    ```
* Scan font directories in order to build font cache files:
    ```
    fc-cache -f -v
    ```

