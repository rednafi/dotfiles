---
description: Clean up changed code without changing behavior
argument-hint: "[target]"
---
# Simplify code

Clean up changed code without changing what it does. Do not look for bugs. Use `/review` for bugs. Target: `${ARGUMENTS:-the current branch and working-tree diff}`

Scope:
- Use the target when given.
- Otherwise use `git diff @{upstream}...HEAD`.
- Fall back to `main...HEAD` or `HEAD~1` when needed.
- Include `git diff HEAD` if local changes exist or the first diff is empty.
- Review only that diff. Read nearby code and helpers when needed.

Check four areas. Use four separate agents when they are available. Otherwise check all four yourself.

1. Reuse
   - Find code that copies an existing helper or shared tool.
   - Name the code to reuse.
2. Simplicity
   - Find extra state, copied code, deep nesting, dead code, or needless layers.
   - Name the simpler form.
3. Speed
   - Find repeated work, repeated I/O, needless waiting, hot-path delays, or state kept too long.
   - Name the cheaper form.
4. Shared design
   - Find local workarounds that belong in shared code.
   - Fix the shared code when that stays in scope.

Each finding must have a file, line, short summary, and clear cost.

Remove copies of the same finding. Apply safe cleanups. Skip anything that may change behavior or needs broad changes. Skip false findings. Follow repo rules and run focused checks.

Report what changed, what you skipped, and which checks passed. If agents were not available, say you checked all four areas in one pass.
