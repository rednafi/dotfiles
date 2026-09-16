function ,clear-junk --description 'Clear user, application, and development caches'
    set -l dirs \
        "$HOME/Library/Caches" \
        "$HOME/Library/Logs" \
        "$HOME/.Trash" \
        "$HOME/.cache" \
        "$HOME/.npm" \
        "$HOME/.nvm/.cache" \
        "$HOME/Library/pnpm/store" \
        "$HOME/.cargo/registry/cache" \
        "$HOME/.cargo/registry/index" \
        "$HOME/.cargo/registry/src" \
        "$HOME/.cargo/git/checkouts" \
        "$HOME/.cargo/git/db" \
        "$HOME/.rustup/downloads" \
        "$HOME/.rustup/tmp" \
        "$HOME/Library/Application Support/virtualenv" \
        "$HOME/Library/Application Support/MobileSync/Backup" \
        "$HOME/Library/Application Support/Google/Chrome/OptGuideOnDeviceModel" \
        "$HOME/Library/Application Support/Google/Chrome/optimization_guide_model_store" \
        "$HOME/Library/Application Support/Google/Chrome/extensions_crx_cache" \
        "$HOME/Library/Application Support/Google/Chrome/component_crx_cache" \
        "$HOME/Library/Application Support/Google/GoogleUpdater/crx_cache" \
        "$HOME/Library/Application Support/Slack/Cache" \
        "$HOME/Library/Application Support/Slack/Service Worker/CacheStorage" \
        "$HOME/Library/Application Support/Code/Cache" \
        "$HOME/Library/Application Support/Code/CachedData" \
        "$HOME/Library/Application Support/Code/CachedExtensionVSIXs" \
        "$HOME/Library/Application Support/Code/CachedExtensions" \
        "$HOME/Library/Application Support/Code/Service Worker/CacheStorage" \
        "$HOME/Library/Application Support/Code/Service Worker/ScriptCache" \
        "$HOME/Library/Application Support/Code/GPUCache" \
        "$HOME/Library/Application Support/Zed/node/cache" \
        "$HOME/Library/Developer/Xcode/DerivedData"

    for profile in "$HOME/Library/Application Support/Google/Chrome"/Default "$HOME/Library/Application Support/Google/Chrome"/Profile\ *
        test -d "$profile"; or continue
        set --append dirs \
            "$profile/Service Worker/CacheStorage" \
            "$profile/GPUCache" \
            "$profile/ShaderCache" \
            "$profile/Crash Reports"
    end

    set -l free_before (command df -k "$HOME" | command awk 'NR == 2 { print $4 }')

    # Keep privileged deletion in one process so sudo prompts only once.
    command sudo /bin/sh -c '
        echo "Clearing user and application caches..."
        shift
        for dir do
            [ -d "$dir" ] || continue
            /usr/bin/find "$dir" -mindepth 1 -maxdepth 1 -exec /bin/rm -rf {} + 2>/dev/null
        done

        echo "Clearing system caches and old temporary files..."
        /usr/bin/find /Library/Caches -mindepth 1 -maxdepth 1 -exec /bin/rm -rf {} + 2>/dev/null
        /usr/bin/find /var/tmp -mindepth 1 -mtime +7 -exec /bin/rm -rf {} + 2>/dev/null
        /usr/bin/tmutil deletelocalsnapshots / 2>/dev/null || true
    ' clear-junk $dirs; or return 1

    echo 'Clearing development caches...'
    type -q uv; and command uv cache clean >/dev/null 2>&1
    type -q pip3; and command pip3 cache purge >/dev/null 2>&1
    if type -q go
        command go clean -cache -testcache >/dev/null 2>&1
        command go clean -modcache >/dev/null 2>&1
    end
    type -q npm; and command npm cache clean --force >/dev/null 2>&1
    type -q yarn; and command yarn cache clean >/dev/null 2>&1
    type -q brew; and command brew cleanup --prune=all >/dev/null 2>&1
    if type -q docker; and command docker info >/dev/null 2>&1
        command docker system prune -af >/dev/null 2>&1
    end
    type -q xcrun; and command xcrun simctl delete unavailable >/dev/null 2>&1
    type -q qlmanage; and command qlmanage -r cache >/dev/null 2>&1

    set -l free_after (command df -k "$HOME" | command awk 'NR == 2 { print $4 }')
    set -l reclaimed (math "max(0, $free_after - $free_before)")
    set -l cleaned (command awk -v kib="$reclaimed" 'BEGIN {
        split("KiB MiB GiB TiB", units)
        value = kib
        unit = 1
        while (value >= 1024 && unit < 4) { value /= 1024; unit++ }
        printf "%.1f %s", value, units[unit]
    }')
    echo "Done! Reclaimed approximately $cleaned. 🧹"
end
