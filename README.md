<!-- -*- mode: markdown -*- -->
# dotfiles

## Bootstrap

```sh
mkdir -p ~/.local/share
git clone https://github.com/rednafi/dotfiles.git ~/.local/share/chezmoi
cd ~/.local/share/chezmoi
/opt/homebrew/bin/brew bundle --file Brewfile
/opt/homebrew/bin/chezmoi apply
```

Open a new zsh shell.

## Maintain

Check local package drift:

```sh
brew bundle check --file Brewfile --verbose
brew outdated --greedy
brew bundle cleanup --file Brewfile
```

Apply dotfile changes after reviewing them:

```sh
chezmoi add ~/.zshrc
chezmoi apply --dry-run --verbose
chezmoi diff
chezmoi apply --verbose
```

Commit from the source repo:

```sh
chezmoi cd
git status --short
git add -A
git commit -m "update dotfiles"
git push
```
