# =====================
# MINIMALIST ZSHRC
# AUTHOR: REDNAFI
# =====================

# omz path
export ZSH="$HOME/.oh-my-zsh"

# theme settings
setopt PROMPT_PERCENT
setopt PROMPT_SUBST
PROMPT='[%n:%F{yellow}%25<..<%~%f%<<]$ '
precmd() {
    precmd() {
        #echo
    }
}

# pluging settings
plugins=(git zsh-syntax-highlighting zsh-autosuggestions)

# autosuggestion highlight
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="fg=4"

# source omz
source $ZSH/oh-my-zsh.sh

#History setup
HISTFILE=$HOME/.zsh_history
HISTSIZE=100000
SAVEHIST=$HISTSIZ

setopt hist_ignore_all_dups # remove older duplicate entries from history
setopt hist_reduce_blanks   # remove superfluous blanks from history items
setopt inc_append_history   # save history entries as soon as they are entered
setopt share_history        # share history between different instances of the shell
setopt auto_list            # automatically list choices on ambiguous completion
setopt auto_menu            # automatically use menu completion
setopt always_to_end        # move cursor to end if word had one match

zstyle ':completion:*' menu select
zstyle ':completion:*' group-name ''                                        # group results by category
zstyle ':completion:::::' completer _expand _complete _ignored _approximate #enable approximate matches for completion

#disable auto correct
unsetopt correct_all

# add snap path
export PATH=$PATH:/snap/bin

# >>> conda initialize >>>
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$('$HOME/miniconda3/bin/conda' 'shell.bash' 'hook' 2>/dev/null)"
if [ $? -eq 0 ]; then
    eval "$__conda_setup"
else
    if [ -f "$HOME/miniconda3/etc/profile.d/conda.sh" ]; then
        . "$HOME/miniconda3/etc/profile.d/conda.sh"
    else
        export PATH="$HOME/miniconda3/bin:$PATH"
    fi
fi
unset __conda_setup
# <<< conda initialize <<<

# server ip
