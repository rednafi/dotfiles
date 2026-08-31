---
description: Draft or update a pull request after editor review
argument-hint: "[--no-attr] [--ready] [instructions]"
---
# Create or update a reviewed pull request

Prepare a pull request for the current branch. Arguments: `$ARGUMENTS`

## Options

- PR attribution is enabled by default.
- If `--no-attr` appears anywhere in the arguments, remove that flag from the remaining instructions and do not add Codex attribution to the PR body.
- New pull requests are drafts by default. If `--ready` appears, remove that flag and create the new PR as ready for review. Never change an existing PR's draft state unless explicitly requested.
- Treat every other argument as additional guidance for the PR title, body, scope, or testing.

## Workflow

1. Read all applicable global and repository instructions, including `AGENTS.md`, `CLAUDE.md`, PR guidance, and the repository's pull-request template. Inspect the current branch, remotes, upstream/base branch, commits, complete diff, working-tree state, and available test evidence.
2. Use normal Git and `gh` workflows. Do not use GitHub Git-data API workarounds. Do not push, force-push, merge, close, or mark a PR ready without the user's explicit authorization. If the branch is not published and publishing was not requested, ask before pushing.
3. Check for an existing PR for the current branch before creating one. Update the existing open PR instead of creating a duplicate. If only a closed or merged PR exists, explain the situation before creating another.
4. Determine the correct default base from the remote repository and ensure the comparison is based on a fresh view of that branch. Do not silently rebase or rewrite commits.
5. Build a truthful title and body from the actual commits and diff:
   - add exactly three simple points explaining what it does;
   - no em dash, semicolon, or overly long comma-spliced sentences;
   - always reference the relevant linear ticket;
   - and nothing else, the body should be short.
6. Attribution handling:
   - when enabled, include exactly one `Generated with [Codex](https://openai.com/codex).` near the end of the body, before trailing hidden metadata when such metadata must remain last;
   - when disabled, do not add that marker;
   - preserve other authorship content unless the user asks to remove it, but never duplicate the selected marker.
7. Write the proposed title to a temporary text file and the complete proposed body to a temporary Markdown file. Open both files in the user's editor, preferring `$VISUAL` and then `$EDITOR`, and preserving configured arguments such as `code --wait`. Wait for the editor to close so the user can review, revise, or add content.
8. Re-read both edited files. Stop if the title or body is empty. Require the title to be one non-empty line. Validate the repository template, hidden markers, truthful claims, and selected attribution behavior. Ask before changing a deliberate user edit.
9. Show the final title, a concise body summary, base/head branches, draft state, and the exact action to be taken. Then:
   - update an existing PR with `gh pr edit`; or
   - create a new PR with `gh pr create --draft` by default, omitting `--draft` only when `--ready` was supplied.
10. Verify the resulting PR with `gh pr view`, including URL, title, base/head, draft state, and body attribution count. Report CI status separately; do not merge.

Keep temporary drafts until the command succeeds so the user's edits are recoverable. Never overwrite an existing PR body without first preserving its content and hidden markers in the editor draft.
