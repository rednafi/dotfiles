# Tmux

```
sudo apt install tmux
```
prefix := `ctrl + b (release)`

## Shortcuts

### Window
* `ctrl+b c` — (c)reate a new window
* `ctrl+b n` — move to the (n)ext window
* `ctrl+b p` — move to the (p)revious window
* `ctrl+b 0[1..n]` — move to n-th window

### Pane
* `ctrl+b "` — split pane horizontally
* `ctrl+b %` — split pane vertically
* `ctrl+b arrow key` — switch pane
* Hold `ctrl+b`, and hold one of the `arrow keys` — resize pane
* `ctrl +b z` - make the current pane maximum (zoom)

### Session
* `tmux attach-session -t 0[session_name]` -attach session
* `ctrl +b d` - detach session
* `ctrl + d` - exit session

### Copy

* Enter ‘copy mode’ by pressing `ctrl+b [`
* Use the arrow keys to go to the position from where you want to start copying
Press `ctrl+space` to start copying
* Use arrow keys to go to the end of text you want to copy
Press  `ctrl+w` to copy into Tmux buffer
* Press `ctrl+b ]` to paste in a possibly different Tmux pane/window
