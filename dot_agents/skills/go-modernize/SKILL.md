---
name: go-modernize
description: Use when writing, reviewing, or modernizing Go code and the user wants modern Go idioms, version-aware language features, stdlib replacements, or cleanup of legacy Go patterns. Applies JetBrains modern Go guidance while respecting the project's declared Go version.
---

# Go Modernize

Use this skill to modernize Go code without exceeding the target Go version.

## Workflow

1. Determine the target Go version from `go.mod` files in the current project. If several modules exist, use the version for the module that owns the files being edited. If no version is available, ask the user which Go version to target.
2. Read [references/jetbrains-use-modern-go.md](references/jetbrains-use-modern-go.md).
3. Apply only recommendations whose minimum Go version is less than or equal to the target version.
4. Prefer modern standard library helpers and built-ins when they improve clarity or remove boilerplate.
5. Do not modernize code in a way that changes behavior, expands public API surface, or adds churn unrelated to the user's request.
6. Run the relevant formatter and tests when editing code, normally `gofmt` and the narrowest useful `go test` command.

## Version Boundaries

- Never use a feature newer than the target Go version.
- For libraries with broad compatibility requirements, preserve the lowest supported Go version even if a local toolchain is newer.
- If a modernization depends on build tags, generated code, cgo, or platform-specific behavior, verify the surrounding project pattern before changing it.
