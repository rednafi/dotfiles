<div align="center">
<h1>Dotfiles</h1>
<h3>Debian Linux<h3>
&nbsp;
<img src="https://images.unsplash.com/photo-1505855788694-023053764ae5?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1385&q=80" alt="containers">

&nbsp;
</div>

## 🔐 Restore SSH

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

* Put all the database `*.pem` keys in the `~/.ssh` folder.

## 🐟 Install Fish (From Bash / Zsh)

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
    
## Ctrl+Tab & Ctrl+Shift+Tab to Switch Between Gnome Terminal

```
gsettings set org.gnome.Terminal.Legacy.Keybindings:/org/gnome/terminal/legacy/keybindings/ next-tab '<Primary>Tab' && 
gsettings set org.gnome.Terminal.Legacy.Keybindings:/org/gnome/terminal/legacy/keybindings/ prev-tab '<Primary><Shift>Tab'
```

## ⚙️ Install Fonts

### 🧠 JetBrains Mono

```
$ curl -OJL https://download.jetbrains.com/fonts/JetBrainsMono-2.001.zip
$ unzip ./JetBrainsMono-2.001.zip -d /usr/share/fonts
$ fc-cache -f -v
```

## 🪑 Fix Ubuntu Mirror Issues

* Select mirror server from [here](https://launchpad.net/ubuntu/+archivemirrors).

* Add mirror server to `/etc/apt/sources.list` and reboot. If the new mirror server isn't picked up by the OS, try selectively commenting out other servers in the file. Here's a sample `sources.list` file:

    ```
    # deb http://apt.pop-os.org/proprietary focal main
    # deb-src http://apt.pop-os.org/proprietary focal main
    deb http://mirror.dhakacom.com/ubuntu/ focal main
    deb-src http://mirror.dhakacom.com/ubuntu/ focal main
    deb [arch=amd64] https://download.docker.com/linux/  ubuntu focal stable
    # deb-src [arch=amd64] https://download.docker.com/linux/ubuntu focal stable
    ```

## 🪑 Fix Ctrl + Shift + E Hijacking in VSCode

This happens due to an obscure setting in IBus. To solve this:

* Run:
    ```
    ibus-setup
    ```
* Go to the `Emoji` tab and delete the shortcut for emoji-annotation.


## 🕹️ Basic Os Settings

* Change window zoom via `gnome-tweaks` to 1.20.
* Terminal font         : JetBrains Mono Regular
* Terminal font size    : 17.5
