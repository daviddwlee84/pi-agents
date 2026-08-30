import { spawn, spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

export interface ProcessOptions {
  input?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  maxBuffer?: number;
}

export interface ProcessResult {
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

export interface InheritedProcessOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export type CommandRunner = (
  command: string,
  args?: readonly string[],
  options?: ProcessOptions,
) => ProcessResult;

export type MaybeAsyncCommandRunner = (
  command: string,
  args?: readonly string[],
  options?: ProcessOptions,
) => ProcessResult | Promise<ProcessResult>;

export type InheritedRunner = (
  command: string,
  args: readonly string[],
  options?: InheritedProcessOptions,
) => Promise<number>;

export interface CommandInvocation {
  command: string;
  args: string[];
}

function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const direct = env[name];
  if (direct !== undefined) return direct;
  const match = Object.keys(env).find((key) => key.toLowerCase() === name.toLowerCase());
  return match ? env[match] : undefined;
}

function isRegularFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function windowsPathEntries(env: NodeJS.ProcessEnv): string[] {
  return (envValue(env, "PATH") || "")
    .split(";")
    .map((entry) => entry.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function hasPathSeparator(command: string): boolean {
  return command.includes("/") || command.includes("\\");
}

function findWindowsCommand(
  command: string,
  env: NodeJS.ProcessEnv,
  extensions: readonly string[],
): string | undefined {
  const extension = path.extname(command).toLowerCase();
  const names = extension ? [command] : extensions.map((suffix) => `${command}${suffix}`);
  if (hasPathSeparator(command)) return names.find(isRegularFile);

  for (const directory of windowsPathEntries(env)) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (isRegularFile(candidate)) return candidate;
    }
  }
  return undefined;
}

function findPowerShell(env: NodeJS.ProcessEnv): string {
  for (const command of ["pwsh", "powershell"]) {
    const resolved = findWindowsCommand(command, env, [".exe"]);
    if (resolved) return resolved;
  }

  const systemRoot = envValue(env, "SystemRoot");
  if (systemRoot) {
    const bundled = path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    if (isRegularFile(bundled)) return bundled;
  }
  return "powershell.exe";
}

/**
 * Resolve Windows executables without enabling child_process shell parsing.
 * npm always creates a PowerShell shim alongside its cmd shim; invoking that
 * file through `-File` keeps every forwarded value as a distinct argv item.
 */
export function resolveCommandInvocation(
  command: string,
  args: readonly string[] = [],
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): CommandInvocation {
  if (platform !== "win32") return { command, args: [...args] };

  const requestedExtension = path.extname(command).toLowerCase();
  let resolved = findWindowsCommand(command, env, [".exe", ".com", ".ps1", ".cmd", ".bat"]);
  if (!resolved && (requestedExtension === ".cmd" || requestedExtension === ".bat")) {
    const siblingCommand = command.slice(0, -requestedExtension.length) + ".ps1";
    resolved = findWindowsCommand(siblingCommand, env, [".ps1"]);
  }
  if (!resolved) {
    if (requestedExtension === ".cmd" || requestedExtension === ".bat") {
      throw new Error(
        `Windows command shim ${command} is unsupported without a same-basename .ps1 sibling; pia never enables shell parsing`,
      );
    }
    return { command, args: [...args] };
  }

  const resolvedExtension = path.extname(resolved).toLowerCase();
  if (resolvedExtension === ".cmd" || resolvedExtension === ".bat") {
    const sibling = resolved.slice(0, -resolvedExtension.length) + ".ps1";
    if (!isRegularFile(sibling)) {
      throw new Error(
        `Windows command shim ${resolved} is unsupported without a same-basename .ps1 sibling; pia never enables shell parsing`,
      );
    }
    resolved = sibling;
  }
  if (path.extname(resolved).toLowerCase() !== ".ps1") {
    return { command: resolved, args: [...args] };
  }

  return {
    command: findPowerShell(env),
    args: [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      resolved,
      ...args,
    ],
  };
}

export function commandResult(
  command: string,
  args: readonly string[] = [],
  options: ProcessOptions = {},
): ProcessResult {
  const env = options.env || process.env;
  const invocation = resolveCommandInvocation(command, args, env);
  const result = spawnSync(invocation.command, invocation.args, {
    encoding: "utf8",
    stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    input: options.input,
    env,
    cwd: options.cwd,
    maxBuffer: options.maxBuffer || 8 * 1024 * 1024,
  });
  if (result.error) {
    return { ok: false, status: null, stdout: "", stderr: result.error.message, error: result.error };
  }
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

export async function runInherited(
  command: string,
  args: readonly string[],
  options: InheritedProcessOptions = {},
): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const env = options.env || process.env;
    const invocation = resolveCommandInvocation(command, args, env);
    const child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd,
      env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

export function commandExists(command: string): string | undefined {
  const probe = commandResult(command, ["--version"]);
  return probe.ok ? probe.stdout.trim() || probe.stderr.trim() : undefined;
}
