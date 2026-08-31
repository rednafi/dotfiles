---
description: Commit the current changes
argument-hint: "[--no-attr] [instructions]"
---
# Create a reviewed commit

Create one appropriate Git commit from the current work. Arguments: `$ARGUMENTS`

## Options

- Attribution is enabled by default.
- If `--no-attr` appears anywhere in the arguments, remove that flag from the remaining instructions and do not add Codex attribution.
- Treat every other argument as additional guidance for selecting changes or writing the commit message.

## Workflow

1. Read all applicable global and repository instructions, including `AGENTS.md`, `CLAUDE.md`, and commit-specific guidance. Inspect `git status`, staged and unstaged diffs, the current branch, recent commit style, and any untracked files.
2. Do not stage unrelated, generated, secret, or user-owned files. Never discard changes. If the intended commit scope is ambiguous or cannot be separated safely, ask before staging.
3. Run focused validation appropriate to the staged changes when practical. Do not claim checks that were not run.
4. Stage only the intended files or hunks. Review `git diff --cached` and `git diff --cached --check`. Stop if nothing is staged.
5. Draft a commit message matching repository conventions:
   - concise imperative subject;
   - explanatory body only when useful;
   - no fabricated issue references or test claims;
   - when attribution is enabled, end with exactly one `Co-authored-by: Codex <noreply@openai.com>` trailer, separated from the body by one blank line;
   - when attribution is disabled, do not add that trailer;
   - follow conventional commit structure
6. Write the complete proposed commit message to a temporary file and open that file in the user's editor. Prefer `$VISUAL`, then `$EDITOR`; preserve configured arguments such as `code --wait`. Wait for the editor to close. The user may revise, extend, or abort by emptying the file.
7. Re-read the edited message. If it is empty, stop without committing. Validate that its attribution matches the selected option and ask before changing any deliberate user edit. Show the final staged summary and commit subject.
8. Commit with `git commit --file <edited-file>`. Do not amend, rebase, force-push, or push unless explicitly requested.
9. Report the commit hash, subject, files committed, checks run, and remaining working-tree changes. Never state that the tree is clean without checking.

Do not bypass hooks. If a hook modifies files or the commit fails, inspect and report the resulting state rather than blindly retrying.
