function ,brclr --description 'Delete local branches except the current and protected branches'
    set -l current (command git branch --show-current 2>/dev/null); or return

    command git branch --format='%(refname:short)' 2>/dev/null | while read -l branch
        contains -- "$branch" "$current" main master staging development; and continue
        command git branch -D "$branch"
    end
end
