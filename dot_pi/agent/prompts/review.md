---
description: Review the current diff or a target for bugs and cleanups
argument-hint: "[low|medium|high|max] [--fix] [target]"
---
# Review code

Review the change as a senior engineer. Find real bugs first. Then check reuse, simplicity, speed, shared design, and repo rules. Arguments: `$ARGUMENTS`

Options:
- Effort can be `low`, `medium`, `high`, or `max`. The default is `medium`.
- `--fix` allows fixes after you report the findings.
- The remaining argument is the target. It can be a pull request, branch, range, path, or commit.

Scope:
- Use the target when given.
- Otherwise use `git diff @{upstream}...HEAD`.
- Fall back to `main...HEAD` or `HEAD~1` when needed.
- Include `git diff HEAD` if local changes exist or the first diff is empty.
- Read nearby code, callers, tests, rules, and history when needed.

Effort:
- At `low`, make one careful pass. Report only clear runtime bugs.
- At `medium` or above, check every item below.
- Use separate finder and checker agents when they are available.
- If agents are not available, do the work in one context and say so.
- At `high` or `max`, make one more fresh pass.
- Match the work to the diff size. Do not invent findings.

Check for bugs:
1. Check conditions, boundaries, null access, zero values, and missing `await`. Check wrong variables, hidden errors, bad checks, and platform failures.
2. Guards, cleanup, checks, tests, error paths, or behavior lost when code was removed.
3. Broken contracts between callers and callees. Check return values, errors, order, timing, and parallel work.
4. Language and library traps. Check threads, object life, escaping, timezones, numbers, and data formats.
5. Wrappers that call the wrong object or fail to pass through required behavior.

Check code quality:
6. New code that should use an existing helper.
7. Extra state, deep nesting, copied code, dead code, or needless layers.
8. Repeated work, repeated I/O, needless waiting, slow work on a hot path, or objects kept too long.
9. A local fix that belongs in shared code.
10. Clear rule breaks in `AGENTS.md`, `CLAUDE.md`, or other repo files. Quote the rule and file path.

Keep a finding only when you can prove the cause. Give a real failure case or a clear cost. Remove copies of the same finding.

Do not report style taste, guesses, old unrelated problems, or weak test requests. A test finding needs a real risk or a written repo rule. Return no findings if none hold up.

For each finding, include:
- File and exact line.
- Severity: `critical`, `high`, `medium`, or `low`.
- Short summary.
- Failure case or cost.
- Small fix.

Use this format:

`path/to/file.ext:123 [severity] - summary`

List the worst findings first. If there are none, say so. Note any tests you could not run.

Do not edit files unless `--fix` was given. With `--fix`, report findings before editing. Apply only safe fixes in scope. Run focused checks. Report what you fixed and skipped.
