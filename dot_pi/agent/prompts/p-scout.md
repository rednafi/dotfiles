---
description: Scout the codebase for code relevant to a task, without planning or editing
argument-hint: "<task or question>"
---

# Scout the codebase

Find the code relevant to this task with the `scout` subagent. Task: `$ARGUMENTS`

## Steps

1. Use the `scout` subagent to find all code relevant to: $ARGUMENTS

## Rules

- Don't plan or implement anything.
- Don't edit files.

## Report

Return the scout's findings: relevant files with line ranges, key types and functions, how
the pieces connect, and where to start.

End with: "Next: `/p-plan <task>`."
