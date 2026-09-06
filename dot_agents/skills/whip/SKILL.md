---
name: whip
description: >-
  Use when generating or rewriting prose, especially when the user invokes whip,
  asks to humanize text, remove AI slop, unglaze writing, improve communications
  or documentation, or produce client-facing copy. Applies the upstream Writing
  Whip during generation, then runs the upstream trope checklist as a separate
  post-generation audit and rewrite.
metadata:
  category: writing
  author: Ossama Chaib
  adapted-by: rednafi
  sources:
    whip: https://tropes.fyi/whip
    tropes: https://tropes.fyi/tropes-md
  upstream-version: 0.1.0
---

# Whip

Run both phases in order. Do not merge, skip, or reverse them.

## Generation phase

1. Read [references/whip.md](references/whip.md) in full.
2. Create a complete draft in private working context while following every rule
   in that file. The Writing Whip governs generation itself, not a later review.
3. Do not read the trope reference until the complete first-pass draft exists.

## Post-generation trope phase

1. After the draft exists, read
   [references/tropes.md](references/tropes.md) in full.
2. Inspect the complete draft against every trope in that file.
3. Rewrite every violation unless keeping it is necessary for accuracy, safety,
   an explicit user constraint, a required format, code, or a quotation.
4. Check the rewritten draft once more so a correction does not introduce another
   listed trope.

Preserve the user's meaning, facts, constraints, intent, terminology, and personal
voice during the post-generation rewrite. Do not add unsupported claims or ideas
the user did not supply when editing existing text.

Return only the final revised text. Do not expose the first-pass draft, checklist,
audit, scores, reasoning, rule-break annotations, or changes unless the user asks
for them explicitly. Never return the first-pass draft as the final response.
