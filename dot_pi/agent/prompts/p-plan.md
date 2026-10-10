---
description: Plan a task with the planner subagent, without implementing it
argument-hint: "<task>"
---

# Plan a task

Write an implementation plan with the `planner` subagent. Task: `$ARGUMENTS`

## Steps

1. Use the `planner` subagent to plan: $ARGUMENTS. Pass along any scout findings from this
   conversation. If there are none, tell the planner to read the relevant code itself. The
   plan must name the files to change and the tests or checks that prove the change works.

## Rules

- Don't scout beyond what the plan needs. Use `/p-scout` for that.
- Don't implement anything or edit files.

## Report

Return only the plan.

End with: "Next: ask me to implement the plan, then run `/p-simplify`."
