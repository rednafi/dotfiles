---
description: Clean up changed code without changing behavior
argument-hint: "[target]"
---
# Simplify changed code

Improve the quality of the changed code without changing its intended behavior. This is a cleanup pass, not a correctness review; do not hunt for bugs. Use `/review` separately for correctness bugs.

## Scope

The optional review target is: `${ARGUMENTS:-the current branch and working-tree diff}`.

Determine the diff under review:

- If a target was supplied, review that branch, path, commit range, or PR.
- Otherwise inspect `git diff @{upstream}...HEAD` (fall back to `main...HEAD` or `HEAD~1` when necessary).
- Include `git diff HEAD` when there are uncommitted changes or the range diff is empty.
- Treat only that diff as the cleanup scope. Read surrounding code and nearby utilities as needed.

## Phase 1: Review four cleanup angles

If an active subagent/delegation tool is available, launch four independent reviewers concurrently, one for each angle below. Otherwise perform all four angles yourself in one pass. Each finding must include `file`, `line`, a one-line summary, and the concrete maintenance or efficiency cost.

### 1. Reuse

Find new code that reimplements something the codebase already provides. Search shared utilities and files adjacent to the change, and name the existing helper or abstraction to reuse.

### 2. Simplification

Find unnecessary complexity introduced by the diff: redundant or derivable state, copy-paste with slight variation, deep nesting, needless indirection, or dead code. Name the simpler form that preserves behavior.

### 3. Efficiency

Find wasted work introduced by the diff: redundant computation, repeated I/O, independent operations run sequentially, blocking work added to startup or hot paths, or long-lived closures that retain large enclosing scopes. Name the cheaper alternative.

### 4. Altitude

Check whether each change is implemented at the right abstraction level rather than as a fragile special case. Prefer improving the shared mechanism over layering a local workaround on top of it.

## Phase 2: Apply fixes

Deduplicate findings that identify the same mechanism, then directly apply each justified cleanup. Skip and report a finding when:

- it could change intended behavior;
- it requires changes well outside the reviewed diff; or
- it is a false positive.

Follow all repository instructions. Run focused formatting, tests, or checks appropriate to the files changed by this cleanup.

Finish with a concise summary of what you changed, what you skipped, and which checks passed. If no subagent tool was available, state that this was a single-pass four-angle review rather than a parallel four-reviewer pass.
