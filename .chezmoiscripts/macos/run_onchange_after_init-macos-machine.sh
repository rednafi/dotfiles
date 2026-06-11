#!/usr/bin/env bash
# Basic macOS machine setup. Safe to re-run.

set -euo pipefail

[[ "$(uname -s)" == "Darwin" ]] || exit 0

machine_name="diaspora"
screenshot_dir="$HOME/screenshots"
downloads_dir="$HOME/Downloads"
canvas_dir="$HOME/canvas"
raycast_app="/Applications/Raycast.app"
raycast_hotkey="Command-49"
spotlight_agent="/System/Library/LaunchAgents/com.apple.Spotlight.plist"
empty_binary_plist_data="62706c6973743030d0080000000000000101000000000000000100000000000000000000000000000009"
activate_settings="/System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings"

# Hostname.
for name_kind in ComputerName LocalHostName HostName; do
    current_name="$(scutil --get "$name_kind" 2>/dev/null || true)"
    [[ "$current_name" == "$machine_name" ]] || sudo scutil --set "$name_kind" "$machine_name"
done

current_smb_name="$(defaults read /Library/Preferences/SystemConfiguration/com.apple.smb.server NetBIOSName 2>/dev/null || true)"
[[ "$current_smb_name" == "$machine_name" ]] || sudo defaults write /Library/Preferences/SystemConfiguration/com.apple.smb.server NetBIOSName -string "$machine_name"

# Trackpad: tap to click, two-finger secondary click, no force click.
for domain in com.apple.AppleMultitouchTrackpad com.apple.driver.AppleBluetoothMultitouch.trackpad; do
    defaults write "$domain" Clicking -int 1
    defaults -currentHost write "$domain" Clicking -int 1
    defaults write "$domain" ForceSuppressed -int 1
    defaults -currentHost write "$domain" ForceSuppressed -int 1
    defaults write "$domain" TrackpadTwoFingerDoubleTapGesture -int 1
    defaults -currentHost write "$domain" TrackpadTwoFingerDoubleTapGesture -int 1

    defaults write "$domain" FirstClickThreshold -int 0
    defaults -currentHost write "$domain" FirstClickThreshold -int 0
    defaults write "$domain" SecondClickThreshold -int 0
    defaults -currentHost write "$domain" SecondClickThreshold -int 0
    defaults write "$domain" TrackpadRightClick -bool true
    defaults -currentHost write "$domain" TrackpadRightClick -bool true
    defaults write "$domain" TrackpadCornerSecondaryClick -int 0
    defaults -currentHost write "$domain" TrackpadCornerSecondaryClick -int 0
done

defaults write -g com.apple.mouse.tapBehavior -int 1
defaults -currentHost write -g com.apple.mouse.tapBehavior -int 1
defaults write -g com.apple.trackpad.forceClick -int 0
defaults -currentHost write -g com.apple.trackpad.forceClick -int 0
defaults write -g com.apple.trackpad.enableSecondaryClick -bool true
defaults -currentHost write -g com.apple.trackpad.enableSecondaryClick -bool true
defaults write -g com.apple.trackpad.trackpadCornerClickBehavior -int 0
defaults -currentHost write -g com.apple.trackpad.trackpadCornerClickBehavior -int 0
defaults -currentHost write -g com.apple.trackpad.twoFingerDoubleTapGesture -int 1

# Keyboard and pointer speed.
defaults write -g com.apple.keyboard.fnState -bool true
defaults write -g ApplePressAndHoldEnabled -bool false
defaults write -g InitialKeyRepeat -int 10
defaults -currentHost write -g InitialKeyRepeat -int 10
defaults write -g KeyRepeat -int 1
defaults -currentHost write -g KeyRepeat -int 1
defaults write com.apple.Accessibility KeyRepeatEnabled -bool true
defaults write com.apple.Accessibility KeyRepeatDelay -float 0.15
defaults write com.apple.Accessibility KeyRepeatInterval -float 0.015
defaults write com.apple.universalaccess slowKey -bool false >/dev/null 2>&1 || true
hidutil property --matching keyboard --set '{"InitialKeyRepeat":10,"KeyRepeat":1}' >/dev/null 2>&1 || true

defaults write -g com.apple.trackpad.scaling -float 3
defaults -currentHost write -g com.apple.trackpad.scaling -float 3
defaults write -g com.apple.mouse.scaling -float 3
defaults -currentHost write -g com.apple.mouse.scaling -float 3

# Text input for coding.
defaults write -g NSAutomaticSpellingCorrectionEnabled -bool false
defaults write -g NSAutomaticCapitalizationEnabled -bool false
defaults write -g NSAutomaticPeriodSubstitutionEnabled -bool false
defaults write -g NSAutomaticQuoteSubstitutionEnabled -bool false
defaults write -g NSAutomaticDashSubstitutionEnabled -bool false
defaults write -g NSAutomaticTextCompletionEnabled -bool false

# Finder.
defaults write -g AppleShowAllExtensions -bool true
defaults write com.apple.finder AppleShowAllFiles -bool true
defaults write com.apple.finder ShowPathbar -bool true
defaults write com.apple.finder ShowStatusBar -bool true
defaults write com.apple.finder FXDefaultSearchScope -string SCcf
defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false
defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true
defaults write com.apple.desktopservices DSDontWriteUSBStores -bool true

# Screenshots and folders used by the Dock.
mkdir -p "$screenshot_dir" "$downloads_dir" "$canvas_dir"
defaults write com.apple.screencapture location -string "$screenshot_dir"

# Dock apps and folders. Finder and Trash are managed by macOS.
defaults write com.apple.dock persistent-apps -array
for app_path in \
    "/Applications/Google Chrome.app" \
    "/Applications/Visual Studio Code.app" \
    "/Applications/Ghostty.app" \
    "/System/Applications/System Settings.app" \
    "/Applications/Slack.app"; do
    [[ -d "$app_path" ]] || continue
    defaults write com.apple.dock persistent-apps -array-add "$(printf '<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>%s</string><key>_CFURLStringType</key><integer>0</integer></dict></dict><key>tile-type</key><string>file-tile</string></dict>' "$app_path")"
done

defaults write com.apple.dock persistent-others -array
for dir_path in "$screenshot_dir" "$downloads_dir" "$canvas_dir"; do
    [[ -d "$dir_path" ]] || continue
    defaults write com.apple.dock persistent-others -array-add "$(printf '<dict><key>tile-data</key><dict><key>displayas</key><integer>1</integer><key>file-data</key><dict><key>_CFURLString</key><string>%s</string><key>_CFURLStringType</key><integer>0</integer></dict><key>showas</key><integer>2</integer></dict><key>tile-type</key><string>directory-tile</string></dict>' "$dir_path")"
done

defaults write com.apple.dock show-recents -bool false
defaults write com.apple.dock magnification -bool false
defaults write com.apple.dock mru-spaces -bool false
defaults write com.apple.WindowManager GloballyEnabled -bool false
defaults write com.apple.WindowManager EnableStandardClickToShowDesktop -bool false
defaults write com.apple.WindowManager StandardHideWidgets -bool true
defaults write com.apple.WindowManager StageManagerHideWidgets -bool true

# Free Command-Space for Raycast by disabling Spotlight and input-source shortcuts.
plist="$HOME/Library/Preferences/com.apple.symbolichotkeys.plist"
[[ -f "$plist" ]] || defaults write com.apple.symbolichotkeys AppleSymbolicHotKeys -dict
/usr/libexec/PlistBuddy -c "Add :AppleSymbolicHotKeys dict" "$plist" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Delete :AppleSymbolicHotKeys:nabled" "$plist" >/dev/null 2>&1 || true
for hotkey_spec in \
    "60:32:49:262144" \
    "61:32:49:786432" \
    "64:32:49:1048576" \
    "65:32:49:1572864"; do
    IFS=: read -r hotkey_id key_code char_code modifiers <<<"$hotkey_spec"
    hotkey_path=":AppleSymbolicHotKeys:${hotkey_id}"
    /usr/libexec/PlistBuddy -c "Delete $hotkey_path" "$plist" >/dev/null 2>&1 || true
    /usr/libexec/PlistBuddy -c "Add $hotkey_path dict" "$plist"
    /usr/libexec/PlistBuddy -c "Add ${hotkey_path}:enabled bool false" "$plist"
    /usr/libexec/PlistBuddy -c "Add ${hotkey_path}:value dict" "$plist"
    /usr/libexec/PlistBuddy -c "Add ${hotkey_path}:value:parameters array" "$plist"
    /usr/libexec/PlistBuddy -c "Add ${hotkey_path}:value:parameters:0 integer $key_code" "$plist"
    /usr/libexec/PlistBuddy -c "Add ${hotkey_path}:value:parameters:1 integer $char_code" "$plist"
    /usr/libexec/PlistBuddy -c "Add ${hotkey_path}:value:parameters:2 integer $modifiers" "$plist"
    /usr/libexec/PlistBuddy -c "Add ${hotkey_path}:value:type string standard" "$plist"
done

defaults write com.apple.Spotlight SSActionKeyboardAliasStoreVersion -int 1
defaults write com.apple.Spotlight SSActionKeyboardAliasStoreKey -data "$empty_binary_plist_data"
defaults write com.apple.Spotlight "NSStatusItem VisibleCC Item-0" -bool false
launchctl disable "gui/$(id -u)/com.apple.Spotlight" >/dev/null 2>&1 || true
launchctl bootout "gui/$(id -u)" "$spotlight_agent" >/dev/null 2>&1 || true
killall Spotlight >/dev/null 2>&1 || true

# Spotlight's UI shortcut and its filesystem index are controlled separately.
if command -v mdutil >/dev/null 2>&1; then
    sudo mdutil -a -i off >/dev/null 2>&1 || true
    sudo mdutil -a -d >/dev/null 2>&1 || true
fi

if [[ -x /usr/bin/swift ]]; then
    /usr/bin/swift -e 'import ApplicationServices
@_silgen_name("CGSSetSymbolicHotKeyEnabled") func CGSSetSymbolicHotKeyEnabled(_ hotKey: Int32, _ enabled: Bool) -> Int32
for id in [60, 61, 64, 65] {
    _ = CGSSetSymbolicHotKeyEnabled(Int32(id), false)
}' >/dev/null 2>&1 || true
fi

current_raycast_hotkey="$(defaults read com.raycast.macos raycastGlobalHotkey 2>/dev/null || true)"
defaults write com.raycast.macos raycastGlobalHotkey -string "$raycast_hotkey"
defaults write com.raycast.macos onboarding_setupHotkey -bool true
defaults write com.raycast.macos mainWindow_isMonitoringGlobalHotkeys -bool true

if [[ -d "$raycast_app" ]]; then
    if [[ "$current_raycast_hotkey" != "$raycast_hotkey" ]] && pgrep -x Raycast >/dev/null 2>&1; then
        killall Raycast >/dev/null 2>&1 || true
        open -a Raycast >/dev/null 2>&1 || true
    elif ! pgrep -x Raycast >/dev/null 2>&1; then
        open -a Raycast >/dev/null 2>&1 || true
    fi
fi

# Disable background convenience features that add UI churn.
defaults -currentHost write com.apple.ImageCapture disableHotPlug -bool true
defaults -currentHost write com.apple.coreservices.useractivityd ActivityAdvertisingAllowed -bool false
defaults -currentHost write com.apple.coreservices.useractivityd ActivityReceivingAllowed -bool false
defaults write com.apple.Siri StatusMenuVisible -bool false
defaults write com.apple.assistant.support "Assistant Enabled" -bool false

killall cfprefsd >/dev/null 2>&1 || true
killall Spotlight >/dev/null 2>&1 || true
killall Dock >/dev/null 2>&1 || true
killall Finder >/dev/null 2>&1 || true
killall SystemUIServer >/dev/null 2>&1 || true

if [[ -x "$activate_settings" ]]; then
    "$activate_settings" -u >/dev/null 2>&1 || true
    "$activate_settings" -forcePrefUpdate >/dev/null 2>&1 || true
fi

if [[ -x /usr/bin/swift ]]; then
    /usr/bin/swift -e 'import ApplicationServices
@_silgen_name("CGSSetSymbolicHotKeyEnabled") func CGSSetSymbolicHotKeyEnabled(_ hotKey: Int32, _ enabled: Bool) -> Int32
for id in [60, 61, 64, 65] {
    _ = CGSSetSymbolicHotKeyEnabled(Int32(id), false)
}' >/dev/null 2>&1 || true
fi
