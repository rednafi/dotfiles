---
description: Commit the current changes as one conventional commit
argument-hint: "[--no-attr] [instructions]"
---

# Commit changes

Create one Git commit. Arguments: `$ARGUMENTS`

## Arguments

- `--no-attr` turns off attribution. Attribution is on by default.
- Use the other arguments as commit guidance.

## Steps

1. Follow commit rules in `AGENTS.md`, `CLAUDE.md`, or similar files.
2. Check `git status`, diffs, untracked files, and recent commits.
3. Pick one clear scope. Ask if it's unclear.
4. Stage only that scope. Skip unrelated files, generated files, secrets, and user files.
5. Review `git diff --cached` and run `git diff --cached --check`.
6. Write a conventional commit message with a short command-style subject. Add a body only
   if it helps.
7. If attribution is on, add this trailer after a blank line:
   `Co-authored-by: Claude <noreply@anthropic.com>`
8. Commit. If a hook changes files or the commit fails, check why before retrying.

## Rules

- Don't discard changes.
- Don't bypass hooks.
- Don't invent facts in the message.
- Don't amend, rebase, or push unless asked.

## Report

Report the hash, subject, files, and remaining changes.
