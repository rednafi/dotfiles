import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent";
import { foregroundAnsi, rgbColor, truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

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

// Global extensions in ~/.pi/agent/extensions: a dir with index.ts/index.js (labelled by dir name) or a .ts/.js file.
function listGlobalExtensions(): string[] {
  const dir = join(getAgentDir(), "extensions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) =>
      e.isDirectory()
        ? existsSync(join(dir, e.name, "index.ts")) || existsSync(join(dir, e.name, "index.js"))
        : /\.(ts|js)$/.test(e.name),
    )
    .map((e) => e.name);
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    // Prompt templates (e.g. ~/.pi/agent/prompts/*.md), sorted by name.
    const prompts = pi
      .getCommands()
      .filter((c) => c.source === "prompt")
      .map((c) => `/${c.name}`);
    const extensions = listGlobalExtensions();

    ctx.ui.setHeader((_tui, theme) => ({
      render(width: number): string[] {
        const mode = theme.getColorMode();
        const colors = { C: CORAL, B: BLUE, Y: YELLOW } as const;
        const block = "█".repeat(PIXEL_WIDTH);
        const blank = " ".repeat(PIXEL_WIDTH);

        // Left-align with 1 column of padding, matching "✓ New session started" (paddingX = 1).
        const pad = " ";

        const lines: string[] = [""];
        for (const row of PI_LOGO_GRID) {
          const line = row
            .replace(/\.+$/, "")
            .split("")
            .map((cell) => {
              const color = colors[cell as keyof typeof colors];
              return color ? `${foregroundAnsi(color, mode)}${block}${RESET}` : blank;
            })
            .join("");
          for (let i = 0; i < PIXEL_HEIGHT; i++) lines.push(truncateToWidth(pad + line, width, ""));
        }
        lines.push("");

        // Same format as core's loaded-resources sections: mdHeading [Name], dim indented sorted list, blank line.
        const section = (name: string, items: string[]) => {
          if (items.length === 0) return;
          const list = [...items].sort((a, b) => a.localeCompare(b)).join(", ");
          for (const line of [theme.fg("mdHeading", `[${name}]`), theme.fg("dim", `  ${list}`)])
            lines.push(...wrapTextWithAnsi(line, Math.max(1, width)));
          lines.push("");
        };
        section("Prompts", prompts);
        section("Extensions", extensions);

        // Pi adds its own Spacer after the header (and before each warning), so drop our trailing blank.
        while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

        return lines;
      },
      invalidate() {},
    }));
  });
}
