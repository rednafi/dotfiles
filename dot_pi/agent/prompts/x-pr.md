---
description: Draft or update a pull request after editor review
argument-hint: "[--no-attr] [--ready] [instructions]"
---

# Create or update a pull request

Prepare a pull request for the current branch. Arguments: `$ARGUMENTS`

Attribution is on by default for commits and the PR body. `--no-attr` turns it off. New PRs
are drafts unless `--ready` is given. Use the other arguments as PR guidance.

1. Check the branch, remotes, commits, full diff, and working tree. Find the default base
   branch from the remote and refresh it.
2. Run the relevant tests.
3. Use Git and `gh` only. Don't use the GitHub Git-data API.
4. Push the branch if needed. Don't force-push, rebase, rewrite commits, merge, or close PRs
   unless asked.
5. If this workflow creates a commit, follow the `/x-commit` rules.
6. Look for an existing PR. Update an open one instead of making a new one. If only a closed
   or merged one exists, ask before creating another.
7. Write a one-line title and a body in this format:
   - At most three simple points that explain the change and name the Linear ticket.
   - No em dashes, semicolons, or long comma-spliced sentences.
   - Avoid too much implementation detail.
   - Keep existing author notes and hidden data. Hidden data stays last.
   - If attribution is on, add this line once, just before any hidden data:
     `Generated with [Codex](https://openai.com/codex).`
8. For an open PR, save the old body, then run `gh pr edit`. Don't change its draft state
   unless asked.
9. For a new PR, run `gh pr create --draft`. Drop `--draft` only when `--ready` was given.
10. Check the result with `gh pr view`. Report the URL, title, branches, draft state, and CI
    status. Don't merge.
