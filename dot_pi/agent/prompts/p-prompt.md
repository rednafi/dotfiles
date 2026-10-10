---
description: Create or update a pi prompt template in the house style
argument-hint: "<name> [instructions]"
---

# Create a prompt template

Create or update the prompt template `p-$1` from these instructions: `${@:2}`

## Steps

1. Read
   `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs/prompt-templates.md`
   in full.
2. Read every file in `~/.pi/agent/prompts/` and match their style.
3. If `~/.pi/agent/prompts/p-$1.md` exists, read it and update it. Otherwise create it. Ask
   if the purpose or arguments are unclear.
4. Write the frontmatter:
   - `description`: one short imperative line, such as "Commit the current changes as one
     conventional commit".
   - `argument-hint`: quoted. Use `<arg>` for required and `[arg]` for optional arguments.
5. Write the body in this order. Use only the sections the prompt needs, but keep the order:

   ```markdown
   # <Title in sentence case>

   <One imperative line that states the job and shows the input with the all-arguments
   placeholder.>

   ## Arguments

   - <Only when the prompt takes flags or options. One bullet per flag and its default.>

   ## Scope

   - <Only when the prompt works on a diff or target. Say what to use and the fallbacks.>

   ## Steps

   1. <Numbered, imperative steps in order. Name exact files, tools, commands, and agents.>

   ## Rules

   - <Limits as short "Don't" bullets. Move every prohibition here, not into Steps.>

   ## Report

   <What to return or show when done.>
   ```

6. Use only the placeholders in the docs' substitution table. Pi substitutes them
   everywhere, including code blocks, and has no escape. So don't write a placeholder you
   don't want filled in, even as an example. Shell variables like `$repo` and `${DATE}` are
   safe.
7. Check every reference in the new prompt. Confirm that named files, `/p-*` commands,
   `/skill:*` skills, subagents in `~/.pi/agent/agents/`, and MCP tool names exist.
8. When the prompt changes code or data, add a step that runs a check, such as tests, a
   build, or a read-back, and fixes failures.
9. Run `prettier --print-width 92 --prose-wrap always --write ~/.pi/agent/prompts/p-$1.md`.
10. Load the template with pi's loader to confirm it parses and substitutes correctly:

    ```sh
    cd /opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent && node -e '
    const pt = require("./dist/core/prompt-templates.js");
    const r = pt.loadPromptTemplates({cwd: "/tmp", agentDir: require("os").homedir() + "/.pi/agent", promptPaths: [], includeDefaults: true});
    const t = r.templates.find((t) => t.name === "p-$1");
    console.log(r.diagnostics, t.description, t.argumentHint);
    console.log(pt.substituteArgs(t.content, ["ARG1", "ARG2"]));'
    ```

## Rules

- Name the file `p-<name>.md` in `~/.pi/agent/prompts/`. If the given name already starts
  with `p-`, don't add another prefix. Don't use subdirectories.
- Write short, plain, imperative sentences. Use "Don't", not "Do not".
- Use "subagent" for agents run by the subagent tool.
- Keep the prompt short. Cut anything the model already knows.
- Don't add attribution, dates, or time-sensitive facts.
- Don't edit other prompts unless asked.

## Report

Show the final prompt, the loader output, and any references you couldn't verify. Remind the
user to run `/reload`.
