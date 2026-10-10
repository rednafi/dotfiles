---
description: Review the current diff or a target for bugs, without editing
argument-hint: "[low|medium|high|max] [target]"
---

# Review code

Review the change as a senior engineer. Find real bugs and repo rule breaks. Don't edit
files. Arguments: `$ARGUMENTS`

## Arguments

- Effort can be `low`, `medium`, `high`, or `max`. The default is `medium`.
  - `low`: one careful pass that reports only clear runtime bugs.
  - `medium`: check every item in Steps.
  - `high` or `max`: check every item in Steps, then make one more fresh pass.
- The remaining argument is the target. It can be a pull request, branch, range, path, or
  commit.

## Scope

- Use the target when given.
- Otherwise use `git diff @{upstream}...HEAD`.
- Fall back to `main...HEAD` or `HEAD~1` when needed.
- Include `git diff HEAD` if local changes exist or the first diff is empty.
- Read nearby code, callers, tests, rules, and history when needed.

## Steps

Match the work to the effort and the diff size. Use separate `scout` subagents as finder and
checker when they are available. Otherwise do the work in one context and say so.

Check for bugs:

1. Conditions, boundaries, null access, zero values, and missing `await`. Wrong variables,
   hidden errors, bad checks, and platform failures.
2. Guards, cleanup, checks, tests, error paths, or behavior lost when code was removed.
3. Broken contracts between callers and callees. Return values, errors, order, timing, and
   parallel work.
4. Language and library traps. Threads, object life, escaping, timezones, numbers, and data
   formats.
5. Wrappers that call the wrong object or fail to pass through required behavior.

Check repo rules:

6. Clear rule breaks in `AGENTS.md`, `CLAUDE.md`, or other repo files. Quote the rule and
   file path.

## Rules

- Keep a finding only when you can prove the cause. Give a real failure case or a clear
  cost.
- Remove copies of the same finding.
- Don't invent findings. Return no findings if none hold up.
- Don't report style taste, guesses, old unrelated problems, or weak test requests. A test
  finding needs a real risk or a written repo rule.
- Don't edit files. This is review only.
- Don't report reuse, simplicity, or speed cleanups. Use `/p-simplify` for those.

## Report

For each finding, include the file and exact line, severity (`critical`, `high`, `medium`,
or `low`), a short summary, the failure case or cost, and a small fix. Use this format:

`path/to/file.ext:123 [severity] - summary`

List the worst findings first. If there are none, say so. Note any tests you couldn't run.
