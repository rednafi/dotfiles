---
description: Review the current diff or a target for correctness bugs and cleanups
argument-hint: "[low|medium|high|max] [--fix] [target]"
---
# Review code changes

Review the changed code as a senior engineer. Prioritize real correctness bugs, then justified reuse, simplification, efficiency, abstraction-level, and repository-convention findings.

Arguments: `$ARGUMENTS`

Interpret an optional first argument of `low`, `medium`, `high`, or `max` as review effort. Default to `medium`. Interpret `--fix` as permission to apply verified findings after reporting them. Any remaining argument is the review target: a PR number or URL, branch, commit range, path, or other target.

## Phase 0: Establish scope

- For an explicit target, obtain and review its diff.
- Otherwise inspect `git diff @{upstream}...HEAD`, falling back to `main...HEAD` or `HEAD~1` when necessary.
- Include `git diff HEAD` when uncommitted changes exist or the range diff is empty.
- Treat the resulting diff as the review scope, but read enclosing functions, callers, callees, tests, project instructions, and history when needed to verify a finding.

## Phase 1: Find candidates

At `low` effort, make one careful line-by-line diff pass and report only obvious, high-confidence runtime bugs visible from the changed code.

At `medium` or higher effort, cover every angle below. If an active subagent/delegation tool is available, run independent finder reviews concurrently and use separate verification passes. Otherwise perform every angle sequentially yourself and explicitly say the review was single-context.

### Correctness angles

1. **Line-by-line diff scan:** Look for wrong or inverted conditions, off-by-one errors, null or undefined dereferences, falsy-zero mistakes, missing `await`, wrong-variable copy/paste, swallowed errors, malformed validation, and platform-specific failures.
2. **Removed behavior:** For deleted or replaced code, identify the invariant it enforced and verify that the new code preserves it. Watch for dropped guards, error paths, validation, cleanup, and meaningful tests.
3. **Cross-file behavior:** Inspect callers and callees of changed functions for broken preconditions, return shapes, exceptions, ordering, timing, and parallel changes.
4. **Language and framework pitfalls:** Check realistic pitfalls specific to the language and framework, including concurrency, lifetime, escaping, timezone, numeric, and serialization issues.
5. **Wrappers and adapters:** Ensure proxies, caches, decorators, and adapters delegate to the intended wrapped object and forward the complete behavior callers rely on.

### Quality angles

6. **Reuse:** Identify new code that duplicates an existing helper or shared mechanism and name what should be reused.
7. **Simplification:** Identify redundant state, needless indirection, deep nesting, copy-paste variation, or dead code, and name the simpler equivalent.
8. **Efficiency:** Identify repeated I/O or computation, avoidably sequential independent work, hot-path blocking, and retained closures or objects that waste memory.
9. **Altitude:** Identify local special cases that should instead be solved in the shared underlying abstraction.
10. **Repository conventions:** Check applicable `AGENTS.md`, `CLAUDE.md`, and other repository instructions. Report only clear violations, quoting the exact rule and its source path.

For `high` and `max`, make an additional fresh sweep for findings not already identified. Scale investigation depth with diff size rather than inventing findings to meet a quota.

Every candidate must name:

- file and precise line;
- severity (`critical`, `high`, `medium`, or `low`);
- concise summary;
- a concrete failure scenario for correctness bugs, or a concrete maintenance/efficiency cost for cleanup findings.

Do not report pure style preferences, vague speculation, pre-existing issues unrelated to changed code, or missing tests unless they expose a concrete regression risk or violate an explicit repository rule.

## Phase 2: Verify and deduplicate

Deduplicate findings that describe the same defect and location. Re-read the relevant diff and surrounding code for each candidate. Keep a finding only when the mechanism is supported by the code and a realistic trigger or concrete cost can be stated. When subagents are available, use an independent verifier; otherwise self-check carefully.

Correctness findings outrank cleanup findings when limiting output. Return no findings rather than manufacturing weak ones.

## Output

List verified findings first, ordered by severity. Use this format:

`path/to/file.ext:123 [severity] — summary`

Follow each with the concrete failure scenario or cost and a concise suggested fix. If nothing survives verification, say so explicitly and mention any residual testing uncertainty.

Do not modify files unless `--fix` was supplied. With `--fix`, report the verified list first, apply each safe fix, skip anything that changes intended behavior or reaches far outside the reviewed diff, run focused checks, and finish with fixed/skipped outcomes.
