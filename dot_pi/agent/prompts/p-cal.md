---
description:
  Check the agenda or manage events and reminders on work and personal Google calendars
argument-hint: "[request in natural language]"
---

# Calendar

Handle this Google Calendar request with the `gws` CLI: `${@:-show today's agenda}`

## Accounts

| Profile    | Account                    | Config dir               | OAuth client                  |
| ---------- | -------------------------- | ------------------------ | ----------------------------- |
| `work`     | `redowan.delowar@wolt.com` | `~/.config/gws-work`     | Work desktop client in step 2 |
| `personal` | `redowan.nafi@gmail.com`   | `~/.config/gws-personal` | Own Google Cloud project      |

- Pick the profile from the request. "Personal", "gmail", "home", and "private" mean
  `personal`. "Work" and "wolt" mean `work`.
- Use `work` when the request names no profile. If the work client can't be set up in step 2
  (no DoorDash plugin on this machine), use `personal` instead and say so.
- "Both", "all", and "everything" mean both profiles. Query both and merge the results.

## Steps

### 1. Prepare the shell

Start every bash call with this preamble. Each bash call is a new shell.

```sh
export GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=file
W=~/.config/gws-work
P=~/.config/gws-personal
```

Run every command for a profile as `GOOGLE_WORKSPACE_CLI_CONFIG_DIR=$W gws ...` or
`GOOGLE_WORKSPACE_CLI_CONFIG_DIR=$P gws ...`. Drop the `Using keyring backend` line from the
output before parsing it with `jq`.

If `command -v gws` finds nothing, run `brew install googleworkspace-cli`. If brew fails,
run `npm install -g @googleworkspace/cli`. Confirm with `gws --version`.

### 2. Set up the work OAuth client

Do this only when the request needs `work`. The personal profile never depends on it. The work client is the shared `dd-gws-cli-skills` desktop OAuth client. The DoorDash `core`
agent-skills plugin ships it and writes it to `~/doordash-ai-helpers/.creds/gws/`. Keep it out
of this prompt and any repo. Run this block as is. It copies the plugin's file, or rebuilds the
file from the installed plugin bundle when that copy is missing:

```sh
if [ ! -s "$W/client_secret.json" ]; then
  mkdir -p "$W" && chmod 700 "$W"
  src=~/doordash-ai-helpers/.creds/gws/client_secret.json
  if [ -s "$src" ]; then
    install -m 600 "$src" "$W/client_secret.json"
  else
    bundle=$(ls -t ~/.claude/plugins/cache/doordash-agentskills/core/*/servers/doordash-helpers/index.mjs \
      ~/.codex/plugins/cache/*/core/*/servers/doordash-helpers/index.mjs 2>/dev/null | head -1)
    block=$(awk '/config_dir: "\.creds\/gws"/{f=1} f&&/client_secret:/{print; exit} f&&/client_id:/{print}' "$bundle")
    id=$(printf '%s' "$block" | sed -nE 's/.*client_id: "([^"]+)".*/\1/p')
    secret=$(printf '%s' "$block" | sed -nE 's/.*client_secret: "([^"]+)".*/\1/p')
    [ -n "$id" ] && [ -n "$secret" ] && (umask 077; jq -n --arg id "$id" --arg s "$secret" \
      '{installed:{client_id:$id,client_secret:$s,redirect_uris:["http://localhost","http://localhost/","urn:ietf:wg:oauth:2.0:oob"]}}' \
      > "$W/client_secret.json")
  fi
fi
test -s "$W/client_secret.json" && echo "work client ready"
```

If it doesn't print `work client ready`, the `core` plugin isn't installed. Say so, and use
`personal` for this request unless the user asked only for `work`.
Never print, `cat`, or paste the contents of any `client_secret.json`.

### 3. Set up the personal OAuth client

Do this only when the request needs `personal`. The personal client is the user's own and is
stored in Bitwarden as the secure note `gws-personal-client-secret`, so any machine with `bw`
can restore it without DoorDash access. Run this block as is:

```sh
if [ ! -s "$P/client_secret.json" ]; then
  command -v bw >/dev/null || brew install bitwarden-cli
  mkdir -p "$P" && chmod 700 "$P"
  if [ "$(bw status | jq -r .status)" = unlocked ]; then
    bw sync >/dev/null
    (umask 077; bw get notes gws-personal-client-secret > "$P/client_secret.json" 2>/dev/null) \
      || rm -f "$P/client_secret.json"
  else
    echo "bitwarden locked"
  fi
fi
jq -e .installed.client_id "$P/client_secret.json" >/dev/null 2>&1 && echo "personal client ready"
```

- `personal client ready`: go to step 4.
- `bitwarden locked`: tell the user to run `bw login` (or `bw unlock`) and
  `export BW_SESSION=...` in their shell, then rerun the block. Don't ask for the client JSON.
- Neither line: the note doesn't exist yet. Do the one-time setup below.

#### One-time setup

Walk the user through these steps in the Google Cloud Console while signed in as
`redowan.nafi@gmail.com`:

1. Create a project named `gws-personal` at
   `https://console.cloud.google.com/projectcreate`.
2. Enable the Google Calendar API and the Google Tasks API at
   `https://console.cloud.google.com/apis/library/calendar-json.googleapis.com` and
   `https://console.cloud.google.com/apis/library/tasks.googleapis.com`.
3. Configure the app at `https://console.cloud.google.com/auth/overview`. Choose the
   **External** audience and use the Gmail address for the support and contact emails.
4. Open `https://console.cloud.google.com/auth/audience` and click **Publish app** to move
   it to **In production**. Testing mode expires refresh tokens after 7 days.
5. Create a **Desktop app** client at `https://console.cloud.google.com/auth/clients` and
   download its JSON.

Then save the newest download to `$P` and to Bitwarden, so no machine needs this setup again:

```sh
f=$(ls -t ~/Downloads/client_secret_*.json | head -1)
install -m 600 "$f" "$P/client_secret.json" && rm "$f"
jq -n --arg n "$(jq -c . "$P/client_secret.json")" \
  '{type:2,name:"gws-personal-client-secret",notes:$n,secureNote:{type:0}}' \
  | bw encode | bw create item >/dev/null && echo "saved to bitwarden"
```

### 4. Log in

For each profile the request needs, run `gws auth status` with that profile's config dir.
Skip the profile when `encrypted_credentials_exists` is true.

Otherwise, start the login in the background so the shell doesn't block. Replace `DIR` with
`$W` or `$P`, and `NAME` with the profile:

```sh
GOOGLE_WORKSPACE_CLI_CONFIG_DIR=DIR gws auth login \
  --scopes https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/tasks \
  > /tmp/gws-login-NAME.log 2>&1 &
sleep 3; cat /tmp/gws-login-NAME.log
```

Run `open` on the `accounts.google.com` URL from the log. Tell the user which account to
pick from the Accounts table and to approve both scopes. For `personal`, the consent screen
warns that Google hasn't verified the app. Tell the user to click **Advanced** and then **Go
to gws-personal**. Poll `gws auth status` every 5 seconds for up to 3 minutes. If the poll
times out, show the log and stop.

### 5. Check the account

Run `gws calendar calendarList get --params '{"calendarId":"primary"}'` for each profile in
use. If `id` doesn't match the Accounts table, run `gws auth logout` for that profile and
repeat step 4. Note `timeZone`.

If any later command exits with code 2, the token was revoked or has expired. Run
`gws auth logout` for that profile and repeat step 4.

### 6. Resolve dates

Run `date` for the local date, weekday, and UTC offset. Resolve relative dates such as
"tomorrow", "next Friday", or "this month" from it. Use RFC3339 times with that offset.

### 7. Do the request

- **Agenda.** Use `gws calendar +agenda --format json` with `--today`, `--tomorrow`,
  `--week`, or `--days N`. For a month, use `--days` up to the last day of the month. For a
  specific range, use `gws calendar events list` with `calendarId`, `timeMin`, `timeMax`,
  `"singleEvents": true`, and `"orderBy": "startTime"`.
- **Create event.** Use `gws calendar +insert` with `--summary`, `--start`, `--end`, and
  optional `--attendee`, `--location`, `--description`, and `--meet`. Default to 30 minutes
  when no end or duration is given. For recurrence or custom notifications, use
  `gws calendar events insert` with `--params '{"calendarId":"primary"}'` and a `--json`
  body with `recurrence` or `reminders.overrides`.
- **Edit or delete event.** Find the event with `gws calendar events list` and the `q`,
  `timeMin`, and `timeMax` params. If several events match, list them and ask which one.
  Then run `gws calendar events patch` or `gws calendar events delete` with `calendarId` and
  `eventId`. For a recurring event, ask whether to change one instance or the series.
- **Reminder.** Use Google Tasks. Get the list ID from `gws tasks tasklists list` and use
  the first list unless the user names one. Then run `gws tasks tasks` with `list`,
  `insert`, `patch`, or `delete`. Tasks keep only a due date. For a reminder at a set time,
  add a popup to a matching event, or create a 0-minute event with a popup.

Run `gws schema calendar.events.<method>` or `gws schema tasks.tasks.<method>` when unsure
about a param or body field.

### 8. Confirm writes

Before a write, show the change in one line: profile, title, local start and end, attendees,
and calendar. Ask for confirmation. After the write, read the event or task back with `get`
and check that it matches.

## Rules

- Don't create, change, or delete anything without confirmation.
- Don't send invites to attendees the user didn't name.
- Don't copy events between the work and personal accounts unless asked.
- Don't touch events the user doesn't own, or `workingLocation` and `outOfOffice` events,
  unless asked.
- Don't run `gws auth login` in the foreground. It blocks until the browser callback.
- Don't use `--full` or the default scope set for `personal`. Unverified apps can't request
  that many scopes.
- Don't use `~/.config/gws`. Keep each account in its own config dir.
- Don't print the contents of credential files.
- Don't show raw JSON.

## Report

Name the connected accounts on first setup. For an agenda, show a compact table grouped by
day with local start and end times, the title, and a `W` or `P` tag when both profiles are
shown. Put all-day events first on each day. Mention location or Meet links only when they
exist. For writes, show the profile, what changed, and the event or task link.
