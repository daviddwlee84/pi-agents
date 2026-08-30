import { spawn, spawnSync } from "node:child_process";

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

export function commandResult(
  command: string,
  args: readonly string[] = [],
  options: ProcessOptions = {},
): ProcessResult {
  const result = spawnSync(command, [...args], {
    encoding: "utf8",
    stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    input: options.input,
    env: options.env || process.env,
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
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env || process.env,
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
