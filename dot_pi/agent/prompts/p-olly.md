---
description:
  Answer a Wolt Drive observability question from logs, traces, metrics, or alerts
argument-hint: "<question>"
---

# Drive observability

Answer this observability question about Wolt EMEA Drive. Query the right source for the
environment and show what you found. Question: `$ARGUMENTS`

## Scope

Use production by default. Use development when the question says dev, development, or
staging. Use the last hour unless the question gives a window.

| Environment | ODIN logs region | ODIN `environment` | k8s namespace | Datadog `env`      | Datadog org                    | Sentry `environment` |
| ----------- | ---------------- | ------------------ | ------------- | ------------------ | ------------------------------ | -------------------- |
| Production  | `wolt`           | `prod`             | `production`  | `prod-distributed` | `wolt-prod.datadoghq.eu` (MCP) | `production`         |
| Development | `wolt-dev`       | `dev`              | `development` | `dev-distributed`  | `wolt-dev.datadoghq.eu` (UI)   | `development`        |

The Datadog MCP only reaches `wolt-prod`. For dev traces, metrics, and monitors, link to
`wolt-dev.datadoghq.eu` with the same query.

### Services

The ODIN `index_name` and the Datadog `service` are the same name.

- DaaS Core (`~/canvas/werk/daas-core`): `daas-public-api` (REST, `fastapi.request`),
  `daas-internal-api` (gRPC, `grpc`), `daas-background-tasks` (arq,
  `sdk.background_tasks.execute`), `daas-celery` (deprecated, `celery.run`),
  `daas-delivery-events-consumer` and `daas-sync-service` (Kafka, `event.process`),
  `daas-vat-events-consumer`, `daas-sync-orders`, and the `daas-core-*` cronjobs.
- DaaS Core dependencies, in Datadog APM only: `daas-core-mongodb`, `daas-celeryapp-redis`,
  `daas-public-api-redis`, `daas-internal-api-redis`, `daas-*-requests`,
  `daas-*-grpc-client`, `daas-core-geocoding-client`,
  `daas-core-communications-service-client`.
- Drive web: `daas-self-service-api`, `daas-self-service-webapp`, and `daas-track` for the
  tracking page.
- Packages (P2P) live in order-xp (`~/canvas/werk/order-xp`): `order-xp`, `order-xp-intake`,
  and `order-xp-pedregal-grpc`. Packages V2 is `resource_name:*/v2/p2p/*` in Datadog and
  loggers `orderxp.peer_to_peer.v2.*` and `orderxp.pages.peer_to_peer_checkout.v2.*` in
  ODIN. V1 uses `/v1/p2p/*`. order-xp reads P2P deliveries from `daas-internal-api`, so
  check both when "Packages" points at DaaS Core.
- Webhooks: `webhook-events-consumer`, `webhook-callbacks-worker`, `webhooks-internal-api`.
- Also: `order-tracking`, `proof-of-delivery`, `restaurant-api-daas-order-events-consumer`.

### Sources

| Signal         | Source                                                                                |
| -------------- | ------------------------------------------------------------------------------------- |
| Logs           | ODIN only. Datadog Logs has no Drive logs.                                            |
| Traces         | Datadog APM. ODIN OTel traces and service map don't exist for Wolt.                   |
| RED metrics    | Datadog APM spans and `trace.<operation>.{hits,errors,duration}` metrics              |
| Monitors, SLOs | Datadog monitors, Steiger alert definitions, `#daas-alerts`, `#alerts-order-xp`       |
| Errors         | Sentry MCP (`mcp__sentry__*`) for dev and prod, and Datadog Error Tracking for prod   |
| Incidents      | Rootly and `#war-room`. Use `/p-incidents` for a weekly summary.                      |
| Deploys        | `#daas-deploy-prod`, `#daas-deploy-dev`, wolt.dev deployments, Datadog change stories |
| Config, data   | wolt.dev live config `daas-config`, RedisInsight, MongoDB Atlas `daas_core_db`        |

Use these links in answers:

- ODIN Explorer: `https://obs.doordash.team/a/doordash-odin-explorer-app?env=wolt`, or
  `env=wolt-dev` for dev.
- Saved ODIN views. Drive backend errors: prod
  `https://obs.doordash.team/goto/ffwu0qojhgcg0f?orgId=1`, dev
  `https://obs.doordash.team/goto/dfwu0oowuh7uoe?orgId=1`. daas-celery errors:
  `https://obs.doordash.team/goto/afwu0t3sczegwc?orgId=1`. Drive Parcel (v1, Tesco) logs:
  `https://grafana.obs.wo.lt/goto/afge5a530stfkc?orgId=1`.
- Datadog dashboards on `https://wolt-prod.datadoghq.eu/dashboard/<id>`: Wolt Drive Works
  `4fc-qpe-6ve` (API success by country), Wolt Drive Overview `2xi-gg3-v4j` (webhooks, Kafka
  lag, workers, orders; also exists in dev with the same id), DaaS Core `j75-xa9-kax`,
  Packages V2 `epa-kma-bda`, Geocoding `35m-2jc-sa4`, Webhooks `mzq-455-prt`, HTTP Client
  `pfm-sgj-g9p`, Drive Runbook `uzm-fcq-7ps`, Not Delivered Orders `h6p-qrv-9hm`, SMS Send
  `88w-a73-66k`, Courier Event Consumer lag `e5c-sn4-239`, DaaS Kubernetes `n47-qae-rgb`,
  order-xp Summary `wjx-ss2-k9j`. Find others with
  `mcp__datadog__search_datadog_dashboards`.
- Kubernetes: `/dash/integration/208/kubernetes-pods-overview` and
  `/dash/integration/223/kubernetes-deployments-overview` with `tpl_var_deployment` set to
  `daas-*`, on either Datadog org.
- SLOs: `https://wolt-prod.datadoghq.eu/slo/manage?query=DaaS%20Core`.
- Sentry org `wolt-enterprises-oy`. One project serves both environments, split by the
  `environment` tag. Projects: `5950186` daas-public-api, `5950187` daas-internal-api,
  `6182088` daas-background-tasks and daas-celery, `6240988` order-xp, and `6254056`,
  `6254057`, `4503937832583168` webhooks-service. UI link:
  `https://wolt-enterprises-oy.sentry.io/issues/?environment=<env>&project=<id>`.
- Slack: `#daas-alerts` (`C01JR3LQHSS`), `#alerts-order-xp` (`C04Q30K75T5`),
  `#daas-deploy-prod` (`C057B97H7HV`), `#daas-deploy-dev` (`C02NEN51TAT`), `#daas-releases`
  (`C050D5G7NUE`), `#dev-drive` (`C04Q5EL0BPY`).
- Alert definitions: `~/canvas/werk/steiger/apps/<app>/resources/alerts.yaml` for
  `daas-core`, `order-xp`, `order-xp-intake`, and `webhooks-service`. Deployment values live
  in
  `~/canvas/werk/steiger/apps/daas-core/overlays/distributed-{production,development}/values/`.
- Runbooks: `~/canvas/werk/daas-core/docs/runbook.md`, `docs/prod-deployment.md`,
  `docs/alerts/*.md`, `~/canvas/werk/order-xp/docs/runbook.md`, and
  `~/canvas/werk/webhooks-service/docs/runbook.md`.

## Steps

1. Parse the question into services, environment, signal, window, and any IDs such as order,
   merchant, venue, purchase, request, or trace IDs. Map loose names to services with the
   Scope lists. If the service is unknown, run
   `mcp__observability__obs_logs_guess_index_names` in the matching region.
2. For Datadog, follow the server's instructions: run `mcp__datadog__load_datadog_skill` for
   the domain (`datadog/traces`, `datadog/metrics`, or `datadog/monitors`) and
   `mcp__datadog__list_datadog_skills` in parallel, once per domain.
3. Run independent queries in one codemode script with `Promise.allSettled`:
   - Logs: `mcp__observability__obs_logs_get` for rows. Use
     `mcp__observability__obs_logs_query` on `odin.logs_beta` for counts and top-N. Scope by
     `index_name`. Filter on `severity_text` (`info`, `warning`, `error`), `k8s_pod_name`,
     and `attributes_string` keys: `log.logger`, `url.path`, `http.request.method`,
     `x-request-id`, `version` (git SHA). Run `mcp__observability__obs_logs_describe` before
     writing SQL.
   - Traces: `mcp__datadog__search_datadog_spans` for rows, `mcp__datadog__aggregate_spans`
     for rates and percentiles, and `mcp__datadog__get_datadog_trace` for one trace. Always
     scope the query with `env:`. Use `@_top_level:1` for entry spans. Use
     `rollout_phase:canary` or `stable` and `git.commit.sha` for deploy questions.
   - RED: aggregate spans grouped by `resource_name` and `@http.status_code`, or
     `mcp__datadog__get_datadog_metric` on `trace.fastapi.request.*`, `trace.grpc.*`,
     `trace.event.process.*`, or `trace.celery.run.*`.
   - Monitors: `mcp__datadog__search_datadog_monitors` with `service:daas-*`, a service
     name, `daas`, or `tag:"feature:packages-v2"`. Read the Steiger `alerts.yaml` for the
     query and thresholds.
   - Dashboards: `mcp__datadog__get_datadog_dashboard` to read widget queries, then run
     them.
   - Errors: list the tools with `describeNamespace("mcp__sentry")`, then search issues and
     events in org `wolt-enterprises-oy`. Filter by the project from Scope, or by project
     slug if the tools resolve slugs, and by `environment:production` or
     `environment:development`. Read the latest event of the top issues for the stack trace,
     release, and tags. For prod, also check Datadog Error Tracking through the `issue.id`
     on error spans.
4. Correlate signals. ODIN logs have no trace IDs, so join logs and spans by `x-request-id`,
   entity IDs in the log body, pod, version, and time. For a cross-service flow, follow
   `public-api` or `order-xp` to `internal-api` to the Kafka consumers and workers.
5. When the alert matches a playbook in `~/canvas/werk/daas-core/docs/alerts/`, read it and
   follow its triage steps.

## Rules

- Don't use Datadog Logs for Drive logs. Don't use ODIN traces or the service map for Wolt.
- Don't mix environments. Check `env` or region on every query.
- Don't change monitors, dashboards, live config, or Rootly. This is read-only.
- Don't print PII from log bodies. Mask names, phone numbers, emails, and addresses.
- Don't guess IDs, metric names, or thresholds. Read them from the source.

## Report

Answer the question first. Then list each source you used with its environment, the query,
and a link: ODIN Explorer, Datadog traces explorer, monitor, dashboard, or Sentry. Give
counts and times in `Europe/Berlin`. Say which signals you couldn't reach, such as dev
Datadog, or Sentry before sign-in, and give the UI link to check by hand. If the Sentry
tools are missing, tell the user to run `/mcp login sentry`.
