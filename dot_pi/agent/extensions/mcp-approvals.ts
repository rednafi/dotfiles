import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Preserve the former pi-mcp-adapter approveTools rules for native MCP calls.
const rules: Record<string, string[]> = {
  "dynamic-value": ["Create*", "Update*", "Rollout*"],
  "pedregal-dv": ["Create*", "Update*", "Rollout*", "Delete*"],
  observability: ["obs_grafana_update_dashboard"],
  slack: [
    "slack_send_*", "slack_schedule_*", "slack_add_reaction",
    "slack_create_canvas", "slack_update_canvas",
  ],
  rootly: [
    "create_*", "update_*", "delete_*", "resolve_*", "acknowledge_*",
    "snooze_*", "trigger_*", "page_*", "add_*", "remove_*", "cancel_*", "escalate_*",
  ],
};

const patterns = Object.entries(rules).map(([server, globs]) => ({
  prefix: `mcp__${server}__`,
  patterns: globs.map((glob) => new RegExp(
    `^${glob.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`,
  )),
}));

export default function (pi: ExtensionAPI) {
  const approved = new Set<string>();
  let queue = Promise.resolve();
  pi.on("session_start", () => { approved.clear(); });

  pi.on("tool_call", async (event, ctx) => {
    const rule = patterns.find(({ prefix }) => event.toolName.startsWith(prefix));
    if (!rule || !rule.patterns.some((pattern) => pattern.test(event.toolName.slice(rule.prefix.length)))) return;
    if (approved.has(event.toolName)) return;
    if (!ctx.hasUI) return { block: true, reason: `Approval required for ${event.toolName} (no UI available)` };

    // Native codemode can call tools in parallel; serialize approval dialogs.
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      if (approved.has(event.toolName)) return;
      const choice = await ctx.ui.select(
        `Allow ${event.toolName}?\n\n${JSON.stringify(event.input, null, 2)}`,
        ["Allow once", "Allow for session", "Deny"],
      );
      if (choice === "Allow for session") approved.add(event.toolName);
      else if (choice !== "Allow once") return { block: true, reason: `${event.toolName} was not approved` };
    } finally {
      release();
    }
  });
}
