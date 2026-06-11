---
name: go-styleguide
description: Use when writing, reviewing, or explaining Go code style, idiomatic Go, Google Go readability guidance, naming, comments, package structure, tests, errors, interfaces, concurrency style, or styleguide tradeoffs. Loads the compiled Google Go Style Guide, Decisions, and Best Practices.
---

# Go Styleguide

Use this skill for Go style decisions and readability reviews.

## Workflow

1. Read [references/google-go-styleguide.md](references/google-go-styleguide.md) before giving style guidance beyond basic `gofmt`.
2. Treat the Google Go Style Guide as the canonical baseline, Style Decisions as normative supporting guidance, and Best Practices as non-canonical advice.
3. Apply the guidance in proportion to the task. For small edits, fix nearby style issues only. For reviews, call out issues that affect readability, correctness, maintainability, or API clarity.
4. Prefer local project conventions when they are deliberate and do not conflict with Go correctness or the style guide's core principles.
5. Explain style advice with concrete code references or examples when useful, but avoid broad rewrites unless the user asks for them.

## Review Priorities

- Clarity before cleverness.
- Simple standard-library mechanisms before custom abstractions.
- Names that make call sites and package APIs readable.
- Comments that explain why, not comments that restate what the code says.
- Tests with clear structure, useful failure messages, and maintainable setup.
