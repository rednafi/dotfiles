---
description: Update the grimoire worklog from GitHub activity for a date
argument-hint: "[YYYY-MM-DD]"
---

# Update worklog

Update `~/canvas/werk/grimoire/Worklog.md` with GitHub activity for `${@:-today}`.

## Arguments

- The date must be `YYYY-MM-DD`. The default is today.

## Steps

### 1. Set the date

- Set `DATE` to the argument, or today's date when there is none.
- Set `DAY` to the weekday name.
- Read the worklog and look for `## ${DATE}, ${DAY}`. If it exists, ask whether to append,
  replace, or stop.

### 2. Find repos

- Look only at directories directly under `~/canvas/werk/`.
- Keep directories with a `.git` directory and a non-empty `remote.origin.url`. Skip the
  rest.
- Get `owner/name` from each remote. Remove `git@github.com:`, `https://github.com/`, and
  the final `.git`.
- Remove duplicate remotes.

### 3. Find PRs

Use `rednafi` as the GitHub handle. If `gh` isn't authenticated, ask the user to run
`gh auth login`.

Run all repo queries in parallel, one background `gh` process per query, with `--limit 50`.
Save each result in a file under `/tmp/worklog-$$/`, then run `wait`. Keep results whose
`updatedAt` falls on `DATE`. UTC is fine.

Loop over a real zsh array:

```sh
repos=(owner/a owner/b owner/c)
for repo in "${repos[@]}"
```

Run these queries for each repo:

```sh
# Authored
gh pr list --repo "$repo" --author rednafi --state all \
  --search "updated:>=${DATE}" \
  --json number,title,url,state,updatedAt,createdAt,isDraft,mergedAt &

# Reviewed
gh search prs --repo "$repo" --reviewed-by rednafi --updated ">=${DATE}" \
  --json number,title,url,state,updatedAt,author &

# Commented
gh search prs --repo "$repo" --commenter rednafi --updated ">=${DATE}" \
  --json number,title,url,state,updatedAt,author &
```

A `gh` command may print a path to a JSON file. Check for this before parsing. If the output
is a path, read that file with `jq`:

```sh
jq . "$(cat capture_file)"
```

If a remote returns 404, skip it and list the repo in the report.

Then sort the results:

- Merge the `--reviewed-by` and `--commenter` results and remove duplicate URLs.
- Move PRs where `author.login == rednafi` to the authored group.
- An approval counts as a review. A merge of another person's PR counts when `rednafi` made
  the merge on `DATE`. For possible merges, call `gh api repos/$repo/pulls/$pr`. Keep the PR
  when `merged_by.login == rednafi` and `merged_at` starts with `DATE`.
- Check the real engagement date for every reviewed or commented PR:

  ```sh
  gh api "repos/$repo/pulls/$pr/reviews" \
    --jq '.[] | select(.user.login=="rednafi") | .submitted_at'
  gh api "repos/$repo/issues/$pr/comments" \
    --jq '.[] | select(.user.login=="rednafi") | .created_at'
  gh api "repos/$repo/pulls/$pr/comments" \
    --jq '.[] | select(.user.login=="rednafi") | .created_at'
  ```

  Keep the PR only when one of these timestamps starts with `DATE`, or when it passed the
  merge check. This removes stale PRs changed by bots or rebases.

### 4. Format PRs

- Keep each GitHub title unchanged.
- Find a Linear key in each title with `([A-Z]+-\d+)`. Add it after the link as
  ` | DC-3432`.
- Add ` (OPEN)` to draft or open PRs and ` (CLOSED)` to PRs closed without a merge. Add no
  suffix to merged PRs.

### 5. Ask for more work

Show a short preview with the count and PR titles for each group, even when there are no
PRs. Then ask:

> Anything else to add for `${DATE}`? Meetings, RFCs, notes, or blockers?

Write the user's items as bullets. Wrap only real highlights in `==...==`, such as major
decisions, incidents, and RFC milestones.

### 6. Write the entry

Keep the file in reverse date order. Keep the two blank lines at the start of the file, and
add the new block after them, above the newest heading. Put two blank lines before the new
heading. Use this format:

```markdown
## ${DATE}, ${DAY}

- `COOKED` [<title>](url) | <Linear> (<STATE>)
- `COOKED` [<title>](url)
- `REVIEWED` [<title>](url) | <Linear>
- `REVIEWED` [<title>](url)
- <extra item>
- ==<highlight>==
```

- Put `COOKED` items first, `REVIEWED` items next, and extra items last.
- Sort each group by repo and then by PR number.
- Add the Linear key or Linear project link when one applies.

### 7. Check the entry

Read the worklog back. Confirm the new block sits above the previous newest heading, matches
the format, and has no duplicate heading for `DATE`. Fix any problems.

## Rules

- Don't ask for the GitHub handle.
- Don't use a space-separated string for repos. Zsh won't split it as Bash does.
- Don't use `--involves` with `-- -author:rednafi`. It misses some approved PRs.
- Don't trust `updatedAt` alone for reviewed or commented PRs.
- Don't use state suffixes other than `(OPEN)` and `(CLOSED)`.
- Don't write an empty heading when there are no PRs or extra items.
- Don't add Claude attribution.
- Don't commit or push.

## Report

Show the new block and list any skipped repos.
