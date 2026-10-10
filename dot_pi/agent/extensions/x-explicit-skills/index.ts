import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Keep every skill out of the system prompt so the model never auto-loads one.
// Skills stay loaded, so `/skill:name` still works when invoked manually.
export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", (event) => {
    event.systemPromptOptions.skills = [];
  });
}
