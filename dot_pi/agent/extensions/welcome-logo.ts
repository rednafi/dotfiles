import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

const PI_LOGO = [
  "████████████",
  "████████████",
  "████    ████",
  "████    ████",
  "████████    ████",
  "████████    ████",
  "████        ████",
  "████        ████",
];

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    ctx.ui.setHeader((_tui, theme) => ({
      render(width: number): string[] {
        return PI_LOGO.map((line) => truncateToWidth(theme.fg("accent", line), width, ""));
      },
      invalidate() {},
    }));
  });
}
