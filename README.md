<!-- -*- mode: markdown -*- -->
# dotfiles

The checkout at `~/canvas/dotfiles` is the chezmoi source. Plain `chezmoi`
commands should resolve there, not to chezmoi's default
`~/.local/share/chezmoi` source directory.

## Bootstrap

```sh
mkdir -p ~/canvas ~/.config/chezmoi
git clone https://github.com/rednafi/dotfiles.git ~/canvas/dotfiles
printf 'sourceDir = "~/canvas/dotfiles"\n' > ~/.config/chezmoi/chezmoi.toml
cd ~/canvas/dotfiles
/opt/homebrew/bin/brew bundle --file Brewfile
/opt/homebrew/bin/chezmoi apply
```

Open a new zsh shell.

Check that chezmoi is using the intended source:

```sh
chezmoi source-path
```

The output should resolve to `$HOME/canvas/dotfiles`.

## Maintain

Check local package drift:

```sh
cd ~/canvas/dotfiles
brew bundle check --file Brewfile --verbose
brew outdated --greedy
brew bundle cleanup --file Brewfile
```

Pull and apply dotfile changes:

```sh
cd ~/canvas/dotfiles
git pull --ff-only
chezmoi diff
chezmoi apply --verbose
```

Capture local target edits back into the source repo:

```sh
chezmoi add ~/.zshrc
chezmoi git -- diff --stat
```

Commit from the source repo:

```sh
cd ~/canvas/dotfiles
git status --short
git add -A
git commit -m "Update dotfiles"
git push
```
