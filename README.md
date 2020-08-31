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

### Fira Code

* Download (With `curl`):
    * `-O, --remote-name        Write output to a file named as the remote file`
    * `-J, --remote-header-name Use the header-provided filename`
    * `-L, --location           Follow redirects`

    ```
    curl -OJL https://github.com/tonsky/FiraCode/releases/download/5.2/Fira_Code_v5.2.zip
    ```

* Install:
    ```
    unzip ./Fira_Code_v5.2.zip -d /usr/share/fonts
    ```

* Scan font directories in order to build font cache files:
    ```
    fc-cache -f -v
    ```

### JetBrains Mono

```
$ curl -OJL https://download.jetbrains.com/fonts/JetBrainsMono-2.001.zip
$ unzip ./JetBrainsMono-2.001.zip -d /usr/share/fonts
$ fc-cache -f -v
```

## Fix Ubuntu Mirror Issues

* Select mirror server from [here](https://launchpad.net/ubuntu/+archivemirrors).

* Add mirror server to `/etc/apt/sources.list` and reboot. If the new mirror server isn't picked up by the OS, try commenting out other servers in the file. Here's the tail of a `sources.list` file:

    ```
    # deb http://apt.pop-os.org/proprietary focal main
    # deb-src http://apt.pop-os.org/proprietary focal main
    deb http://mirror.dhakacom.com/ubuntu/ focal main
    deb-src http://mirror.dhakacom.com/ubuntu/ focal main
    deb [arch=amd64] https://download.docker.com/linux/  ubuntu focal stable
    # deb-src [arch=amd64] https://download.docker.com/linux/ubuntu focal stable
    ```

## Fix Ctrl + Shift + E Hijacking in VSCode

This happens due to an obscure setting in IBus. To solve this:

* Run:
    ```
    ibus-setup
    ```
* Go to the `Emoji` tab and delete the shortcut for emoji-annotation.

## Install Micro

* Install

```
sudo apt install micro
```

* Set terminal color to 256 bit

```
export TERM=xterm-256color
```
