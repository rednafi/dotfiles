---
description: Create or update a pull request for the current branch
argument-hint: "[--no-attr] [--ready] [instructions]"
---

# Create or update a pull request

Prepare a pull request for the current branch. Arguments: `$ARGUMENTS`

## Arguments

- `--no-attr` turns off attribution in commits and the PR body. Attribution is on by
  default.
- `--ready` creates a ready PR. New PRs are drafts by default.
- Use the other arguments as PR guidance.

## Steps

1. Check the branch, remotes, commits, full diff, and working tree. Find the default base
   branch from the remote and refresh it.
2. Run the relevant tests.
3. If this workflow creates a commit, follow the `/p-commit` rules.
4. Push the branch if needed.
5. Look for an existing PR. Update an open one instead of making a new one. If only a closed
   or merged one exists, ask before creating another.
6. Write a one-line title and a body in this format:
   - At most three simple points that explain the change and name the Linear ticket.
   - Use short sentences without em dashes or semicolons.
   - Avoid too much implementation detail.
   - Keep existing author notes and hidden data. Hidden data stays last.
   - If attribution is on, add this line once, just before any hidden data:
     `Generated with [Claude](https://claude.ai).`
7. For an open PR, save the old body, then run `gh pr edit`.
8. For a new PR, run `gh pr create --draft`. Drop `--draft` only when `--ready` was given.
9. Check the result with `gh pr view`.

## Rules

- Use Git and `gh` only. Don't use the GitHub Git-data API.
- Don't force-push, rebase, rewrite commits, merge, or close PRs unless asked.
- Don't change an open PR's draft state unless asked.

## Report

Report the URL, title, branches, draft state, and CI status.
