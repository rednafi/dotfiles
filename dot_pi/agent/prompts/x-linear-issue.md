---
description: Create a short Linear issue in my What, Why, Work, Verify style
argument-hint: "[context] [URLs...]"
---

# Create a Linear issue

Create one Linear issue from `$ARGUMENTS` and the relevant conversation.

1. If the request includes URLs, read them first. Ask for the problem or team if the context
   doesn't make them clear.
2. Search Linear for duplicates before drafting.
3. Read `/Users/rednafi/.agents/skills/whip/SKILL.md` and both of its references in full.
   Apply Whip strictly to the title and tone. Run its trope audit and rewrite before saving.
   Keep the four headings below even if Whip advises against them.
4. Write a specific, plain title. Use this description format and keep it short:

   ## What

   One sentence, no more than two lines, stating the outcome.

   ## Why
   - One to three bullets on the problem and evidence. Separate facts from guesses.

   ## Work
   - One to three bullets on the concrete change. Leave out speculative work.

   ## Verify
   - One to three bullets on how to check the result.

   Cut filler, repeated context, and unsupported claims. Never include credentials or
   secrets.

5. Run `linear_get_user` with `query: "me"` and confirm the account is Redowan Delowar. Stop
   if it isn't.
6. Create the issue with `linear_save_issue`. Always pass `assignee: "me"`, even if the
   source names someone else. Set team, parent, cycle, labels, and priority only when the
   user names them or the context makes them clear. Don't guess.
7. Attach every URL passed to `/x-linear-issue` using `links: [{url, title}]` with a short
   title for each, even if the URL is mixed in with other text. If you couldn't read a link,
   attach it anyway and say what you couldn't verify. You can also cite links in Why.
8. Read the saved issue back. Confirm `createdBy` and `assignee` are both Redowan Delowar,
   and check the description, metadata, and links.
9. Return the issue URL. Don't mark it Done unless asked.
