# Native fish wrappers for the interactive aliases used in zsh.
if status is-interactive
    function cp --wraps cp --description 'Copy interactively and verbosely'
        command cp -iv $argv
    end

    function mv --wraps mv --description 'Move interactively and verbosely'
        command mv -iv $argv
    end

    function rm --wraps rm --description 'Remove interactively and verbosely'
        command rm -iv $argv
    end

    if command ls --color=auto -d . >/dev/null 2>&1
        function ls --wraps ls
            command ls --color=auto $argv
        end
    else
        function ls --wraps ls
            command ls -G $argv
        end
    end

    if type -q bat
        function cat --wraps bat --description 'View files with bat'
            command bat $argv
        end
    end

    if type -q python3.14
        function python --wraps python3.14
            command python3.14 $argv
        end
    end

    if type -q tsh
        function tk --wraps kubectl --description 'Run kubectl through Teleport'
            command tsh kubectl $argv
        end
    end

    if test -x "$HOME/.local/bin/jetbox"
        function jetbox
            command "$HOME/.local/bin/jetbox" $argv
        end
    end
end
