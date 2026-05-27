#!/usr/bin/env zsh
# Reduce macOS animation latency. Safe to re-run.
# Source gist: https://gist.github.com/rednafi/d8584cd23a2a999bcb27ce95fc7ce2b6

set -euo pipefail

[[ "$(uname -s)" == "Darwin" ]] || exit 0

fast="0.05"
near_instant="0.01"

# Accessibility/global motion knobs.
defaults write -g reduceMotion -bool true
defaults write -g reduceTransparency -bool true
defaults write com.apple.Accessibility ReduceMotionEnabled -bool true
defaults write com.apple.Accessibility ReduceTransparencyEnabled -bool true
defaults write com.apple.universalaccess reduceMotion -bool true >/dev/null 2>&1 || true
defaults write com.apple.universalaccess reduceTransparency -bool true >/dev/null 2>&1 || true

# AppKit animations and delays.
defaults write -g NSAutomaticWindowAnimationsEnabled -bool false
defaults write -g NSWindowResizeTime -float 0.001
defaults write -g QLPanelAnimationDuration -float 0
defaults write -g NSToolbarFullScreenAnimationDuration -float 0
defaults write -g NSDocumentRevisionsWindowTransformAnimation -bool false
defaults write -g NSScrollAnimationEnabled -bool false
defaults write -g NSScrollViewRubberbanding -bool false
defaults write -g NSUseAnimatedFocusRing -bool false
defaults write -g NSInitialToolTipDelay -int 0
defaults write -g NSMenuFlashCount -int 0
defaults write -g ApplePressAndHoldEnabled -bool false
defaults write -g NSWindowShouldDragOnGesture -bool false

# Dock animations.
defaults write com.apple.dock autohide-time-modifier -float 0
defaults write com.apple.dock autohide-delay -float 0
defaults write com.apple.dock launchanim -bool false
defaults write com.apple.dock animate-opening-applications -bool false
defaults write com.apple.dock mineffect -string scale
defaults write com.apple.dock no-bouncing -bool true
defaults write com.apple.dock slow-motion-allowed -bool false
defaults write com.apple.dock workspaces-swoosh-animation-off -bool true
defaults write com.apple.dock expose-animation-duration -float "$fast"
defaults write com.apple.dock showDesktopDuration -float "$near_instant"
defaults write com.apple.dock springboard-show-duration -float "$near_instant"
defaults write com.apple.dock springboard-hide-duration -float "$near_instant"
defaults write com.apple.dock springboard-page-duration -float "$near_instant"

# Finder/Desktop animations and spring-loaded folders.
defaults write com.apple.finder DisableAllAnimations -bool true
defaults write com.apple.finder AnimateWindowZoom -bool false
defaults write NSGlobalDomain com.apple.springing.delay -float 0
defaults write NSGlobalDomain com.apple.springing.enabled -bool true

killall cfprefsd >/dev/null 2>&1 || true
killall Dock >/dev/null 2>&1 || true
killall Finder >/dev/null 2>&1 || true
killall SystemUIServer >/dev/null 2>&1 || true
