<!-- -*- mode: markdown -*- -->
# dotfiles

## Bootstrap

```sh
brew install chezmoi
chezmoi init --apply \
    --promptString machineName=<name> \
    --promptString role=<werk|pers|server> \
    https://github.com/rednafi/dotfiles.git
```

`machineName` becomes the macOS hostname and defaults to the current one. `role`
picks the default git identity (`werk` gets the work email, everything else gets
the personal one) and `server` machines skip the UI tweaks. Both answers persist
in `~/.config/chezmoi/chezmoi.toml`, so rerunning `chezmoi init` won't ask again.

Open a new zsh shell.

`chezmoi apply` installs missing Homebrew packages from `Brewfile` on macOS
when the `Brewfile` changes. It uses `--no-upgrade`; package upgrades stay
manual.

## Daily use

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

Re-import every drifted managed file at once:

```sh
chezmoi re-add
```

Commit from the source repo:

```sh
chezmoi cd
git status --short
git add -A
git commit -m "Update dotfiles"
git push
```
