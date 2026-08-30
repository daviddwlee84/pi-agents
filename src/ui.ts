import { styleText } from "node:util";

export type UiTone = "accent" | "success" | "warning" | "danger" | "muted";

export interface UiStyleOptions {
  stream?: NodeJS.WritableStream;
}

const TONE_STYLES = {
  accent: "cyan",
  success: "green",
  warning: "yellow",
  danger: "red",
  muted: "gray",
} as const;

function clicolorForcesColor(value: string | undefined): boolean {
  return value !== undefined && value !== "" && value !== "0";
}

function forceColorForcesColor(value: string | undefined): boolean {
  return value !== undefined && value !== "0";
}

function disablesColor(value: string | undefined): boolean {
  return value !== undefined && value !== "";
}

/**
 * Apply a semantic terminal style without adding a runtime dependency.
 *
 * Node handles stream capability detection plus NO_COLOR,
 * NODE_DISABLE_COLORS, and FORCE_COLOR. CLICOLOR_FORCE is also supported as
 * a force-through-pipe alias to match the surrounding dotfiles tooling.
 */
export function style(tone: UiTone, text: string, options: UiStyleOptions = {}): string {
  const stream = options.stream ?? process.stdout;
  if (
    clicolorForcesColor(process.env.CLICOLOR_FORCE) ||
    forceColorForcesColor(process.env.FORCE_COLOR)
  ) {
    return styleText(TONE_STYLES[tone], text, { validateStream: false, stream });
  }
  if (
    process.env.FORCE_COLOR === "0" ||
    disablesColor(process.env.NO_COLOR) ||
    disablesColor(process.env.NODE_DISABLE_COLORS)
  ) {
    return text;
  }
  return styleText(TONE_STYLES[tone], text, { stream });
}

export const ui = {
  accent: (text: string, options?: UiStyleOptions): string => style("accent", text, options),
  success: (text: string, options?: UiStyleOptions): string => style("success", text, options),
  warning: (text: string, options?: UiStyleOptions): string => style("warning", text, options),
  danger: (text: string, options?: UiStyleOptions): string => style("danger", text, options),
  muted: (text: string, options?: UiStyleOptions): string => style("muted", text, options),
} as const;
