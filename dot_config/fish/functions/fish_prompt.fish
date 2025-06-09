#  • Yellow "user@host:", cyan PWD, green VCS, newline, symbol ($ / #)
#  • Starts with a blank line for readability
# -----------------------------------------------------------------------
function fish_prompt --description "Yellow login, cyan path, green git"
    # Colour-coded user@host, path, and VCS branch
    echo
    set_color yellow; echo -n "$USER@"(prompt_hostname)":"
    set_color cyan;   echo -n (prompt_pwd)
    set_color green;  echo -n (fish_vcs_prompt)

    # Newline + symbol ($ for user / # for root)
    set_color normal
    set -l symbol '$'
    if functions -q fish_is_root_user; and fish_is_root_user
        set symbol '#'
    end
    printf "\n%s " $symbol
end
