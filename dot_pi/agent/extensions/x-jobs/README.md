# pi-jobs

Schedule `pi -p` prompts on macOS. launchd runs them on time, even when pi is closed. A `jobs` tool and a `/x-jobs` command let you add, change and inspect them from inside pi.

```
you: every weekday at 8:45, build my standup from Linear and yesterday's Slack threads
pi:  -> jobs add {name: "standup", schedule: {calendar: [{Weekday: 1, Hour: 8, Minute: 45}, ...]}}
     added standup: Mon–Fri 08:45
```

## Install

Any pi package source works once the repo is pushed or published:

```bash
pi install git:github.com/<you>/pi-jobs   # git
pi install npm:pi-jobs                    # npm, after publishing
pi -e ./pi-jobs                           # local checkout, one session only
```

You need macOS and Node 22.18 or newer, the first release that runs TypeScript without flags.

## Use

Ask in plain language, or call the tool's actions directly:

| Action | Effect |
|---|---|
| `list` | Every job with its schedule, last run, next run and any drift |
| `add` | Validate, write `jobs.json`, generate the plist, `plutil -lint` it, load it |
| `update` | Change some fields. A prompt-only change skips the launchd reload |
| `pause` / `resume` | Unload or reload the job; the config stays in `jobs.json` |
| `run` | Start a run now through launchd (`wait: true` returns the result) |
| `logs` | Recent runs, the error tail of failed runs, and the latest output |
| `remove` | Unload and delete the job. `purge: true` also deletes its history |
| `sync` | Make launchd and the plists match `jobs.json` again |

`/x-jobs` shows the table and `/x-jobs <name>` shows one job's runs. If a job failed since you last looked, pi's footer shows a warning until you open `/x-jobs`.

## Job fields

| Field | Default | Notes |
|---|---|---|
| `prompt` | required | Passed to `pi --no-session -p --` as one argument |
| `schedule` | required | `{calendar: [{Minute, Hour?, Weekday?, Day?, Month?}]}` or `{intervalSeconds}` (at least 300) |
| `model`, `thinking` | pi defaults | Passed as `--model` and `--thinking` |
| `tools` | pi defaults | Passed as `--tools`. MCP tools stay callable unless an entry starts with `mcp__` |
| `cwd` | `~/.pi/jobs/work` | Working directory for the run |
| `timeoutSeconds` | 600 | Per attempt. The whole process group is killed, MCP servers included |
| `retries` | 2 | Waits 30s, 2m, 5m, 10m, 15m between attempts |
| `notify` | `always` | `always`, `failure`, `output` (failure or non-empty output) or `never` |
| `maxLateMinutes` | 120 | launchd runs a missed slot when the Mac wakes. Runs later than this are skipped. 0 runs them anyway |
| `retention` | 14 days, min 5 runs, 50 MB | Failed runs are kept twice as long |

Calendar entries use local time and follow `man launchd.plist`. A missing key matches every value, Weekday 0 and 7 are both Sunday, and a job with both Day and Weekday fires when either matches. Every entry must set `Minute`, because `{Hour: 9}` alone would fire every minute from 09:00 to 09:59.

## Files

```
~/.pi/jobs/
  jobs.json                    source of truth
  runs/<name>/<run-id>.md      pi's output
  runs/<name>/<run-id>.log     pi's stderr and the runner's notes
  runs/<name>/<run-id>.json    status, exit code, attempts, timing, error tail
  logs/<name>.launchd.log      only written when the runner itself fails
~/Library/LaunchAgents/com.rednafi.pi.job.<name>.plist   generated, do not edit
```

Each run prunes its own job's history. Once a day, a run also prunes paused and removed jobs and clears stale locks.

Jobs run with your user's permissions and no one watching. Give each job only the tools it needs.

## Develop

```bash
npm test          # unit, runner and integration tests with fake pi and launchctl (~20s)
npm run e2e       # real launchd, fake pi, labels prefixed com.rednafi.pi.jobtest (~3 min)
npm run eval      # does the model fill in the tool correctly? Calls a real model
```

Every external dependency has an environment override: `PI_JOBS_ROOT`, `PI_JOBS_AGENTS_DIR`, `PI_JOBS_LAUNCHCTL`, `PI_JOBS_PLUTIL`, `PI_JOBS_PI_BIN`, `PI_JOBS_NOTIFY`, `PI_JOBS_LABEL_PREFIX`, `PI_JOBS_MIN_INTERVAL`, `PI_JOBS_RETRY_DELAYS`, `PI_JOBS_KILL_GRACE_MS`, `PI_JOBS_NOW` and `PI_JOBS_DRY_RUN`.

Node will not strip types from files under `node_modules`, so `npm pack` builds a plain-JS copy into `dist/` for npm installs. Git and local installs run the `.ts` files directly.
