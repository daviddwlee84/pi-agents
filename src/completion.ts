import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const COMPLETION_SHELLS = ["zsh", "bash", "powershell"] as const;

export type CompletionShell = (typeof COMPLETION_SHELLS)[number];

const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT_PLACEHOLDER = "__PIA_DEFAULT_SOURCE_ROOT__";

function normalizeShell(value: string): CompletionShell {
  if (value === "pwsh") return "powershell";
  if ((COMPLETION_SHELLS as readonly string[]).includes(value)) return value as CompletionShell;
  throw new Error("Usage: pia completion <zsh|bash|powershell>");
}

function quotePosix(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function quotePowerShell(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function renderCompletion(shellName: string, defaultSourceRoot = MODULE_ROOT): Promise<string> {
  const shell = normalizeShell(shellName);
  const extension = shell === "powershell" ? "ps1" : shell;
  const templatePath = path.join(MODULE_ROOT, "completions", `pia.${extension}`);
  const template = await readFile(templatePath, "utf8");
  const quotedRoot = shell === "powershell" ? quotePowerShell(defaultSourceRoot) : quotePosix(defaultSourceRoot);
  return template.replaceAll(SOURCE_ROOT_PLACEHOLDER, quotedRoot);
}
