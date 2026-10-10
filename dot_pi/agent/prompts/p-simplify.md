---
description: Run /p-review, then clean up changed code without changing behavior
argument-hint: "[target]"
---

# Review, then simplify code

Review the changed code for bugs, then clean it up without changing what it does. Target:
`${@:-the current branch and working-tree diff}`

## Scope

- Use the target when given.
- Otherwise use `git diff @{upstream}...HEAD`.
- Fall back to `main...HEAD` or `HEAD~1` when needed.
- Include `git diff HEAD` if local changes exist or the first diff is empty.
- Review only that diff. Read nearby code and helpers when needed.

## Steps

### 1. Review

Read `~/.pi/agent/prompts/p-review.md` and follow it at `medium` effort on the same scope.
Report its findings before you edit anything.

### 2. Simplify

Check four areas. Use four separate `scout` subagents to find issues when they are
available. Otherwise check all four yourself.

1. Reuse
   - Find code that copies an existing helper or shared tool.
   - Name the code to reuse.
2. Simplicity
   - Find extra state, copied code, deep nesting, dead code, or needless layers.
   - Name the simpler form.
   - Keep comments simple. Follow `/skill:whip` (`references/whip.md`) strictly.
3. Speed
   - Find repeated work, repeated I/O, needless waiting, hot-path delays, or state kept too
     long.
   - Name the cheaper form.
4. Shared design
   - Find local workarounds that belong in shared code.
   - Fix the shared code when that stays in scope.

Then remove copies of the same finding, apply safe cleanups, and run focused checks.

## Rules

- Don't fix bugs. Report them from the review step.
- Don't touch code that a review finding covers, so the cleanup doesn't hide a bug.
- Each finding needs a file, line, short summary, and clear cost.
- Skip false findings, anything that may change behavior, and anything that needs broad
  changes.
- Follow repo rules.

## Report

Report the review findings first, in the `/p-review` format. Then report what changed, what
you skipped, and which checks passed. If subagents weren't available, say you checked all
four areas in one pass.

End with: "Next: `/p-review` for a final bug check."
