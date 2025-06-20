# Remove welcome message
set -U fish_greeting

# Add canvas to CDPATH for quick navigation
set -Ux CDPATH "$CDPATH:$HOME/canvas"

# Set Homebrew binary path for fish
set -U fish_user_paths /opt/homebrew/bin

set -gx GOPATH $HOME/go
set -gx PATH $GOPATH/bin $PATH
