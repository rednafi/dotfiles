---
description: Update the grimoire worklog from GitHub activity
argument-hint: "[YYYY-MM-DD]"
---
# Update worklog

Update `~/canvas/werk/grimoire/Worklog.md` for `${ARGUMENTS:-today}`.

Use `rednafi` as the GitHub handle. Do not ask for it.

## 1. Set the date

- Use the argument as `DATE`.
- If there is no argument, use today's date.
- Require `YYYY-MM-DD` for a given date.
- Set `DAY` to the weekday name.
- Read the worklog.
- Look for `## ${DATE}, ${DAY}`.
- If it exists, ask whether to append, replace, or stop.

## 2. Find repos

- Look one level below each directory in `~/canvas/`.
- This includes only `~/canvas/werk/*/`.
- Keep directories with a `.git` directory and a non-empty `remote.origin.url`.
- Get `owner/name` from each remote.
- Remove `git@github.com:`, `https://github.com/`, and the final `.git`.
- Skip repos without a remote.
- Remove duplicate remotes.

## 3. Find PRs

Run all repo queries in parallel. Use one background `gh` process for each query. Use `--limit 50`. Wait for all processes.

Keep results whose `updatedAt` falls on `DATE`. UTC is fine.

Run these queries for each repo.

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

Save each result in a file under `/tmp/worklog-$$/`. Then run `wait`.

Use a real zsh array for repos.

```sh
repos=(owner/a owner/b owner/c)
for repo in "${repos[@]}"
```

Do not use a space-separated string. Zsh will not split it as Bash does.

A `gh` command may print a path to a JSON file. Check for this before parsing. If the output is a path, read that file with `jq`.

```sh
jq . "$(cat capture_file)"
```

Do not use `--involves` with `-- -author:rednafi`. It misses some approved PRs.

- Run both `--reviewed-by` and `--commenter`.
- Merge those results.
- Remove duplicate URLs.
- Remove PRs where `author.login == rednafi`.
- Put those PRs in the authored group instead.

An approval counts as a review. A merge of another person's PR also counts when `rednafi` made the merge on `DATE`.

For possible merges, call `gh api repos/$repo/pulls/$pr`. Keep the PR when `merged_by.login == rednafi` and `merged_at` starts with `DATE`.

Check the real engagement date for every reviewed or commented PR. Do not trust `updatedAt` alone.

```sh
gh api "repos/$repo/pulls/$pr/reviews" \
  --jq '.[] | select(.user.login=="rednafi") | .submitted_at'
gh api "repos/$repo/issues/$pr/comments" \
  --jq '.[] | select(.user.login=="rednafi") | .created_at'
gh api "repos/$repo/pulls/$pr/comments" \
  --jq '.[] | select(.user.login=="rednafi") | .created_at'
```

Keep the PR only when one of these timestamps starts with `DATE`. Also keep a merge that passed the merge check above. This removes stale PRs changed by bots or rebases.

## 4. Format PRs

Find a Linear key in each title with `([A-Z]+-\d+)`. Add it after the link as ` | DC-3432`.

Use these state rules.

- Draft or open gets ` (OPEN)`.
- Closed without a merge gets ` (CLOSED)`.
- Merged gets no suffix.

Keep each GitHub title unchanged.

## 5. Ask for more work

Show a short preview. Include the count and PR titles for each group.

Ask this question.

> Anything else to add for `${DATE}`? Meetings, RFCs, notes, or blockers?

If the user adds items, write them as bullets. Wrap only real highlights in `==...==`. Highlights include major decisions, incidents, and RFC milestones.

## 6. Write the entry

Keep the file in reverse date order. Add the new block above the newest heading. Keep the single blank line at the start of the file. Put the new heading after it.

Use this format.

```markdown


## ${DATE}, ${DAY}

- `COOKED` [<title>](<url>) | <Linear> (<STATE>)
- `COOKED` [<title>](<url>)
- `REVIEWED` [<title>](<url>) | <Linear>
- `REVIEWED` [<title>](<url>)
- <extra item>
- ==<highlight>==
```

Follow these rules.

- Put two blank lines before the heading.
- Put `COOKED` items first.
- Put `REVIEWED` items next.
- Always try to add the project linear if applicable.
- Put extra items last.
- Sort each group by repo and then by PR number.
- Use only `(OPEN)` and `(CLOSED)` as state suffixes.
- Add no suffix for merged PRs.
- Do not add Claude attribution.

## 7. Finish

Show the new block to the user. Do not commit or push.

## Errors and empty results

- If there are no PRs, still ask for extra items.
- If there are no PRs or extra items, do not write an empty heading.
- If `gh` is not authenticated, ask the user to run `gh auth login`.
- If a remote returns 404, skip it. List the repo in the summary.
- If the date already exists, ask whether to append, replace, or stop.
