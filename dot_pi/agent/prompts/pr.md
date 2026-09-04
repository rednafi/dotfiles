---
description: Draft or update a pull request after editor review
argument-hint: "[--no-attr] [--ready] [instructions]"
---
# Create or update a pull request

Prepare a pull request for the current branch. Arguments: `$ARGUMENTS`

Options:
- Attribution is on by default for both commits created by this workflow and the pull request body.
- `--no-attr` turns it off. Remove the flag before using the other arguments.
- New pull requests are drafts by default.
- `--ready` makes a new pull request ready for review. Remove the flag before using the other arguments.
- Do not change an existing pull request's draft state unless asked.
- Use the other arguments as pull request guidance.

Steps:
1. Read `AGENTS.md`, `CLAUDE.md`, the pull request template, and other rules that apply.
2. Check the branch, remotes, base branch, commits, full diff, working tree, and test results.
3. Use Git and `gh`. Do not use the GitHub Git-data API as a workaround.
4. Do not push, force-push, merge, close, or mark a pull request ready without permission.
5. Ask before publishing a local branch.
6. Look for an existing pull request. Update an open one instead of making a copy.
7. If only a closed or merged pull request exists, explain before creating another.
8. Find the default base branch from the remote. Refresh it before comparing.
9. Do not rebase or rewrite commits unless asked.
10. If this workflow creates or amends a commit, follow the `/commit` rules. When attribution is on, include this trailer once:

    `Co-authored-by: Codex <noreply@openai.com>`

    Put one blank line before it. Do not add it when attribution is off. Do not rewrite commits created before this workflow only to add attribution unless asked.
11. Write a truthful title and a short body.
12. The body must have exactly three simple points. Explain the change and name the Linear ticket.
13. Do not use em dashes, semicolons, or long comma-spliced sentences.
14. When attribution is on, add this line once near the end:

    `Generated with [Codex](https://openai.com/codex).`

    Put it before hidden data that must stay last. Do not add it when attribution is off.
15. Keep other author notes. Do not add the Codex line twice.
16. Save the title and body in separate temporary files.
17. Open both files with `$VISUAL`, then `$EDITOR`. Keep editor arguments such as `code --wait`.
18. Wait for the user to review them. Stop if either file is empty.
19. The title must be one line.
20. Check the template, hidden data, claims, and attribution. Ask before changing a user edit.
21. Show the title, body summary, base branch, head branch, draft state, and next command.
22. Use `gh pr edit` for an open pull request.
23. Use `gh pr create --draft` for a new one. Leave out `--draft` only when `--ready` was given.
24. Check the result with `gh pr view`. Report the URL, title, branches, draft state, and attribution count.
25. Report CI on its own. Do not merge.

Keep the draft files until the command works. Save the old body and hidden data before editing an existing pull request.
