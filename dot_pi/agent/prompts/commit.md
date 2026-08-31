---
description: Commit the current changes
argument-hint: "[--no-attr] [instructions]"
---
# Commit changes

Create one Git commit. Arguments: `$ARGUMENTS`

Options:
- Attribution is on by default.
- `--no-attr` turns it off. Remove the flag before using the other arguments.
- Use the other arguments as commit guidance.

Steps:
1. Read `AGENTS.md`, `CLAUDE.md`, and other commit rules that apply.
2. Check the branch, recent commits, `git status`, all diffs, and untracked files.
3. Choose one clear commit scope. Ask if the scope is unclear.
4. Do not stage unrelated files, generated files, secrets, or user files.
5. Never discard changes.
6. Run focused checks when practical. Only report checks you ran.
7. Stage only the chosen files or hunks.
8. Review `git diff --cached`. Run `git diff --cached --check`. Stop if nothing is staged.
9. Write a conventional commit message. Use a short command-style subject. Add a body only when it helps.
10. Do not invent issue links, facts, or test results.
11. When attribution is on, add this trailer once:

   `Co-authored-by: Codex <noreply@openai.com>`

   Put one blank line before it. Do not add it when attribution is off.
12. Save the full message in a temporary file.
13. Open the file with `$VISUAL`, then `$EDITOR`. Keep editor arguments such as `code --wait`.
14. Wait for the user to review it. An empty file means cancel.
15. Read the file again. Check the attribution. Ask before changing a user edit.
16. Show the staged summary and final subject.
17. Run `git commit --file <edited-file>`.
18. Do not amend, rebase, force-push, or push unless asked.
19. Report the commit hash, subject, files, checks, and remaining changes. Check before saying the tree is clean.

Do not bypass hooks. If a hook changes files or the commit fails, inspect the result. Do not retry without checking.
