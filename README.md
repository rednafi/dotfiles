<!-- -*- mode: markdown -*- -->
# dotfiles

## Bootstrap

```sh
brew install chezmoi
chezmoi init --apply --verbose https://github.com/rednafi/dotfiles.git
```

Open a new zsh shell.

`chezmoi apply` installs missing Homebrew packages from `Brewfile` on macOS
when the `Brewfile` changes. It uses `--no-upgrade`; package upgrades stay
manual.

## Daily Use

Pull and apply the latest committed dotfiles:

```sh
chezmoi update --verbose
```

Preview before applying:

```sh
chezmoi git pull -- --autostash --rebase
chezmoi diff
chezmoi apply --verbose
```

Check local package drift:

```sh
brew bundle check --no-upgrade --file "$(chezmoi source-path)/Brewfile" --verbose
brew outdated --greedy
brew bundle cleanup --file "$(chezmoi source-path)/Brewfile"
```

Edit source dotfiles directly:

```sh
chezmoi edit --apply ~/.zshrc
```

Import a live file back into source:

```sh
chezmoi add ~/.zshrc
```

Commit from the source repo:

```sh
chezmoi cd
git status --short
git add -A
git commit -m "Update dotfiles"
git push
```
