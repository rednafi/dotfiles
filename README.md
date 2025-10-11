<!-- -*- mode: markdown -*- -->
# dotfiles

I used to rely on [GNU Stow] to [wrangle my dotfiles], but once I added a few more laptops and dev VMs, the maze of
symlinks became a headache. I'm now giving [chezmoi] a whirl to see if it scales better. So far, so good!


## Basic concepts

| Term             | What it really means                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| **source**       | Chez­moi's *single source of truth* (default: `~/.local/share/chezmoi`). It's just a Git repo.             |
| **destination**  | Your real home directory (or wherever a file ultimately lives). Files flow **source ➜ destination**.      |
| `add`            | Copy an existing file from destination *into* source and stage it for Git.                                |
| `forget`         | Remove a file from source but leave the destination copy untouched.                                       |
| `diff`           | Show a Git-style diff of what chezmoi *would* change right now.                                           |
| `apply`          | Make reality match source. Renders templates, backs up existing files, moves new files in atomically.     |


## Workflow

### 1. Bootstrap a new machine

```sh
chezmoi init git@github.com:rednafi/dotfiles   # clone into source
chezmoi apply -v                               # copy everything into place verbosely
````

### 2. Daily routine

| Goal                                  | Command(s)                                                           |
| ------------------------------------- | -------------------------------------------------------------------- |
| **Add** a new dotfile                 | `chezmoi add ~/.gitconfig`                                           |
| **See** what will change (dry-run)    | `chezmoi apply -n -v`                                                |
| **Review** a standard diff            | `chezmoi diff`                                                       |
| **Apply** the queued changes for real | `chezmoi apply -v`                                                   |
| **Stop tracking** a file              | `chezmoi forget ~/.gitconfig`                                        |
| **Jump into** the source Git repo     | `chezmoi cd`                                                         |
| **Commit + push** your latest tweaks  | <pre>git add -A<br>git commit -m "Added gitconfig"<br>git push</pre> |

### 3. What actually happens when `chezmoi apply` runs

1. Chez­moi compares **source** to **destination** (same diff you saw with `-n -v`).
2. For each file that needs work it:

   1. Renders templates (if any variables are used).
   2. Writes a temporary file in the destination directory.
   3. Backs up the existing destination file with a time-stamp suffix.
   4. Moves the temp file into place atomically (so half-written configs never happen).
3. If anything fails, it aborts the remaining operations, leaving your system in a consistent state.

That's it — **init → dry-run → apply → add/forget → push**.

[gnu stow]: https://www.gnu.org/software/stow/
[chezmoi]: https://www.chezmoi.io/
[wrangle my dotfiles]: https://rednafi.com/misc/dotfile_stewardship_for_the_indolent/
