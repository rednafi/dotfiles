---
description:
  "Summarize DoorDash and Wolt S0 and S1 incidents from Rootly and #war-room for the last
  week"
argument-hint: "[focus]"
---

# Incidents

Summarize DoorDash and Wolt S0 and S1 incidents from Rootly and Wolt's `#war-room` for the
last 7 days. Focus: `${@:-everything}`

## Steps

### 1. Set the window

Run `/bin/date -u -v-7d +%Y-%m-%dT%H:%M:%SZ` for `SINCE` and `/bin/date -u -v-7d +%s` for
`SINCE_TS`. Use `/bin/date`, because the `date` on `PATH` isn't BSD date. Show all times in
`Europe/Berlin`.

### 2. Load state

Read `~/.cache/p-incidents/state.json` if it exists. It maps each `INC-<N>` to its last seen
`status`, `retrospective_progress_status`, and `started_at`. It also maps each war-room
thread as `warroom-<ts>` to its reply count and `started_at`.

### 3. Collect incidents

In one codemode script, run these in parallel:

- `mcp__rootly__collect_incidents` with `started_after: SINCE`, `max_results: 100`, and
  `severity: "s0"`.
- The same call with `severity: "s1"`.
- `mcp__slack__slack_read_channel` on `#war-room` (`CJYFK1W3C`) with `oldest: SINCE_TS`,
  `limit: 100`, and `response_format: "detailed"`, to get thread reply counts.

Then filter:

- Keep incidents whose `Brand:` line in `summary` names DoorDash or Wolt.
- Drop incidents without a `Brand:` line.
- Drop tests, where the title or summary says "TEST", "Testing", or "not real incident".
- Drop `cancelled` incidents.

### 4. Add details

For each incident left, run these in one parallel codemode script:

- `mcp__rootly__get_incident` with the `INC-<N>` id. Keep `data.id` as the UUID, plus
  `title`, `summary`, `status`, `started_at`, `mitigated_at`, `resolved_at`,
  `mitigation_message`, `resolution_message`, `retrospective_progress_status`, `url`,
  `slack_channel_url`, `zoom_meeting_join_url`, and `jira_issue_url`.
- `mcp__rootly__list_incident_events` with the UUID and `page_size: 20`. Drop events whose
  `kind` is `slack_member_joined` or `slack_member_left`. Keep the newest status changes,
  role assignments, and notes.
- `mcp__rootly__list_incident_action_items` with the UUID and `page_size: 20`.
- `mcp__rootly__get_incident_retrospective` with the `INC-<N>` id when
  `retrospective_progress_status` isn't `not_started`. Strip the HTML and keep the summary,
  root cause, impact, and action items.

Take the latest update from `resolution_message`, then `mitigation_message`, then the newest
kept event. Take the cause from the retrospective, then the `Root cause` part of `summary`.

### 5. Check the war room

For each `#war-room` message with replies, call `mcp__slack__slack_read_thread` with
`channel_id: "CJYFK1W3C"`, the message `ts`, `limit: 200`, and `response_format: "concise"`.
Read the end of the thread for the outcome.

Match each thread to a Rootly incident by an `INC-<N>`, `#inc-<N>-*` channel, or Rootly link
in the thread, or else by title. Use a matched thread only to add context to that incident.
Keep unmatched threads as war-room-only items, and note any postmortem link they share.

### 6. Mark changes

Tag an incident `NEW` when it's missing from the state, and `CHANGED` when its status or
retrospective status differs. Tag a war-room-only thread `NEW` when it's missing from the
state, and `CHANGED` when its reply count grew. Write the current state to
`~/.cache/p-incidents/state.json`. Create the directory when it's missing. Drop entries that
started more than 14 days ago. Read the file back with `jq` to confirm it's valid JSON.

### 7. Apply the focus

When the focus isn't `everything`, narrow the report to it, for example one brand, ongoing
incidents only, or postmortems only.

## Rules

- Read only Rootly and `#war-room` in Slack. Don't read Jira, Confluence, or other Slack
  channels.
- Don't use `PEV-<N>` ids or `#pev-*` channels. Rootly replaced them.
- Don't post, react, or reply in Slack.
- Don't use `mcp__slack__slack_search_public_and_private`. It needs consent.
- Don't report S2s, investigations, or Deliveroo-only incidents.
- Don't ask questions. This prompt runs in the background.
- Don't change anything in Rootly.
- Don't quote whole retrospectives or event logs. Summarize them.
- Don't print the raw JSON.

## Report

Start with one line of counts: S0s, S1s, ongoing, war-room-only threads, and new or changed
since the last run. If nothing is new or changed and nothing is ongoing, say so in one line
and stop.

Then show these sections, and skip a section when it's empty:

1. **Ongoing**: incidents that aren't `resolved`, S0s first. One bullet each:
   `[NEW|CHANGED] S0 · Brand · INC-<N> title · <status> since <time>`. Add the latest update
   in one sentence, open action items, and links to Rootly, Slack, and Zoom.
2. **Resolved this week**: one line each with severity, brand, `INC-<N>`, title, duration,
   and a one-line cause when known.
3. **Retrospectives**: incidents whose retrospective is in progress or done. Give two or
   three lines on the cause, impact, and action items, plus the Rootly and Jira links.
4. **War room only**: `#war-room` threads with no Rootly S0 or S1. One bullet each:
   `[NEW|CHANGED] Brand · title · <start>–<end or ongoing>`. Add the impact and outcome in
   one or two sentences, plus the thread link and any postmortem link.
