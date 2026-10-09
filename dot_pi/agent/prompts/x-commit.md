---
description: Commit the current changes
argument-hint: "[--no-attr] [instructions]"
---

# Commit changes

Create one Git commit. Arguments: `$ARGUMENTS`

Attribution is on by default. `--no-attr` turns it off. Use the other arguments as commit
guidance.

1. Follow commit rules in `AGENTS.md`, `CLAUDE.md`, or similar files.
2. Check `git status`, diffs, untracked files, and recent commits.
3. Pick one clear scope. Ask if it's unclear.
4. Stage only that scope. Skip unrelated files, generated files, secrets, and user files.
   Never discard changes.
5. Review `git diff --cached` and run `git diff --cached --check`.
6. Write a conventional commit message with a short command-style subject. Add a body only
   if it helps. Don't invent facts.
7. If attribution is on, add this trailer after a blank line:
   `Co-authored-by: Codex <noreply@openai.com>`
8. Commit without bypassing hooks. If a hook changes files or the commit fails, check why
   before retrying.
9. Report the hash, subject, files, and remaining changes.

Don't amend, rebase, or push unless asked.
