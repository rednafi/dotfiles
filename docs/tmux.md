# Tmux

```
sudo apt install tmux
```
prefix := `ctrl + B (release)`

## General

* `ctrl+b c` — (c)reate a new window

* `ctrl+b n` — move to the (n)ext window

* `ctrl+b p` — move to the (p)revious window

* `ctrl+b 0[1..]` — move to n-th window

* `ctrl+b "` — split pane horizontally

* `ctrl+b %` — split pane vertically

* `ctrl+b arrow key` — switch pane

* Hold `ctrl+b`, don’t release it and hold one of the `arrow keys` — resize pane

* `ctrl + d` - exit pane/window


## Copy

* Enter ‘copy mode’ by pressing `ctrl+b [`.

* Use the arrow keys to go to the position from where you want to start copying. Press `ctrl+space` to start copying.

* Use arrow keys to go to the end of text you want to copy. Press  `ctrl+w` to copy into Tmux buffer.

* Press `ctrl+b ]` to paste in a possibly different Tmux pane/window.
