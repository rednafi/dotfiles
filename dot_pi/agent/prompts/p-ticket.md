---
description: Create a short Linear issue in the What, Why, Work, Verify format
argument-hint: "[context] [URLs...]"
---

# Create a Linear issue

Create one Linear issue from `$ARGUMENTS` and the relevant conversation.

## Steps

1. If the request includes URLs, read them first. Ask for the problem or team if the context
   doesn't make them clear.
2. Search Linear for duplicates before drafting.
3. Follow `/skill:whip` strictly for the title and tone. Read `references/whip.md` before
   drafting. Read `references/tropes.md` only after the first draft, then run the trope
   audit and rewrite before saving. Keep the four headings below even if Whip advises
   against them.
4. Write a specific, plain title. Use this description format and keep it short:

   ```markdown
   ## What

   One sentence, no more than two lines, stating the outcome.

   ## Why

   - One to three bullets on the problem and evidence. Separate facts from guesses.

   ## Work

   - One to three bullets on the concrete change. Leave out speculative work.

   ## Verify

   - One to three bullets on how to check the result.
   ```

5. Run `mcp__linear__get_user` with `query: "me"` and confirm the account is Redowan
   Delowar. Stop if it isn't.
6. Create the issue with `mcp__linear__save_issue`. Always pass `assignee: "me"`, even if
   the source names someone else. `team` is required, so ask if it isn't clear. Set
   `parentId`, cycle, labels, and priority only when the user names them or the context
   makes them clear.
7. Attach every URL passed to `/p-ticket` using `links: [{url, title}]` with a short title
   for each, even if the URL is mixed in with other text. If you couldn't read a link,
   attach it anyway and say what you couldn't verify. You can also cite links in Why.
8. Read the saved issue back. Confirm `createdBy` and `assignee` are both Redowan Delowar,
   and check the description, metadata, and links.

## Rules

- Cut filler, repeated context, and unsupported claims.
- Don't include credentials or secrets.
- Don't guess metadata.
- Don't mark the issue Done unless asked.

## Report

Return the issue URL and anything you couldn't verify.
