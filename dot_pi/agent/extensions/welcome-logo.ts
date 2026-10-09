import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { foregroundAnsi, rgbColor, truncateToWidth } from "@earendil-works/pi-tui";

// Brand colors from pi's built-in logo (components/pi-logo.js).
const CORAL = rgbColor(228, 138, 122);
const BLUE = rgbColor(79, 142, 179);
const YELLOW = rgbColor(234, 182, 93);
const RESET = "\x1b[0m";

// The default pi logo as a 4x4 pixel grid (C = coral, B = blue, Y = yellow, . = empty).
const PI_LOGO_GRID = ["CCC.", "B.C.", "BB.Y", "B..Y"];

// Each pixel is drawn as 4 columns x 2 lines, matching the previous splash size.
const PIXEL_WIDTH = 4;
const PIXEL_HEIGHT = 2;

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    ctx.ui.setHeader((_tui, theme) => ({
      render(width: number): string[] {
        const mode = theme.getColorMode();
        const colors = { C: CORAL, B: BLUE, Y: YELLOW } as const;
        const block = "█".repeat(PIXEL_WIDTH);
        const blank = " ".repeat(PIXEL_WIDTH);

        const lines: string[] = [];
        for (const row of PI_LOGO_GRID) {
          const line = row
            .replace(/\.+$/, "")
            .split("")
            .map((cell) => {
              const color = colors[cell as keyof typeof colors];
              return color ? `${foregroundAnsi(color, mode)}${block}${RESET}` : blank;
            })
            .join("");
          for (let i = 0; i < PIXEL_HEIGHT; i++) lines.push(truncateToWidth(line, width, ""));
        }
        return lines;
      },
      invalidate() {},
    }));
  });
}
