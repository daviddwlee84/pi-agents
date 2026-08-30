import { lstat } from "node:fs/promises";
import path from "node:path";
import { applyRuntime, getRuntimeStatus } from "./runtime.ts";
import { sessionLeafDir } from "./sessions.ts";
import { ensurePrivateDir, getManifestPath, getOmpProfileName, getPiRuntimeDir } from "./paths.ts";
import { commandResult, runInherited } from "./process.ts";
import type { Combo, Engine } from "./combos.ts";
import type { ApplyRuntimeResult, RuntimeStatus } from "./runtime.ts";
import type { SessionLeafOptions } from "./sessions.ts";
import type { CommandRunner, InheritedRunner } from "./process.ts";

const WRAPPER_OWNED_FLAGS = new Set(["--profile", "--alias", "--session-dir", "--cwd", "--api-key"]);

export interface RuntimeContextOptions {
  combo: Combo;
  stateRoot: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  commandRunner?: CommandRunner;
}

export interface RuntimeContext {
  targetDir: string;
  manifestPath: string;
  sessionDir: string;
}

export interface StatusComboResult extends RuntimeContext {
  status: RuntimeStatus;
}

export interface ApplyComboOptions extends RuntimeContextOptions {
  dryRun?: boolean;
  force?: boolean;
}

export interface ApplyComboResult extends RuntimeContext {
  result: ApplyRuntimeResult;
}

export interface RunComboOptions extends RuntimeContextOptions {
  userArgs?: readonly string[];
  spawnRunner?: InheritedRunner;
}

export interface RunComboResult extends ApplyComboResult {
  exitCode: number;
  args: string[];
  command: string;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

function binaryFor(engine: Engine, env: NodeJS.ProcessEnv = process.env): string {
  return engine === "pi" ? env.PIA_PI_BIN || "pi" : env.PIA_OMP_BIN || "omp";
}

function assertNoOwnedFlags(args: readonly string[]): void {
  let literal = false;
  for (const arg of args) {
    if (arg === "--") {
      literal = true;
      continue;
    }
    if (literal) continue;
    const flag = arg.includes("=") ? arg.slice(0, arg.indexOf("=")) : arg;
    if (WRAPPER_OWNED_FLAGS.has(flag)) {
      throw new Error(`Pass ${flag} through combo metadata is not allowed; pia owns runtime isolation and credentials`);
    }
  }
}

export function nativeCommand(combo: Combo, env: NodeJS.ProcessEnv = process.env): string {
  return binaryFor(combo.engine, env);
}

export async function resolveRuntimeTarget(
  combo: Combo,
  stateRoot: string,
  env: NodeJS.ProcessEnv = process.env,
  runner: CommandRunner = commandResult,
): Promise<string> {
  if (combo.engine === "pi") return getPiRuntimeDir(stateRoot, combo);
  const binary = binaryFor("omp", env);
  const profile = getOmpProfileName(combo);
  const result = runner(binary, [`--profile=${profile}`, "config", "path"], { env });
  if (!result.ok) {
    const detail = (result.stderr || result.stdout || "OMP is not installed or could not resolve its profile").trim();
    throw new Error(`Unable to resolve OMP profile ${profile}: ${detail}`);
  }
  const target = result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!target || !path.isAbsolute(target)) throw new Error(`OMP returned an invalid profile path: ${JSON.stringify(target)}`);
  const resolved = path.resolve(target);
  if (path.basename(resolved) !== "agent" || path.basename(path.dirname(resolved)) !== profile) {
    throw new Error(`OMP profile path is outside the expected ${profile}/agent shape: ${resolved}`);
  }
  for (const candidate of [path.dirname(resolved), resolved]) {
    try {
      const stat = await lstat(candidate);
      if (stat.isSymbolicLink()) throw new Error(`OMP profile path contains a symbolic link: ${candidate}`);
      if (!stat.isDirectory()) throw new Error(`OMP profile path component is not a directory: ${candidate}`);
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") throw error;
    }
  }
  return resolved;
}

export async function runtimeContext({
  combo,
  stateRoot,
  cwd = process.cwd(),
  env = process.env,
  commandRunner,
}: RuntimeContextOptions): Promise<RuntimeContext> {
  const targetDir = await resolveRuntimeTarget(combo, stateRoot, env, commandRunner ?? commandResult);
  const manifestPath = getManifestPath(stateRoot, combo);
  const sessionOptions: SessionLeafOptions = {
    stateRoot,
    engine: combo.engine,
    comboName: combo.name,
    cwd,
    history: combo.metadata.history,
  };
  const sessionDir = sessionLeafDir(sessionOptions);
  return { targetDir, manifestPath, sessionDir };
}

export async function statusCombo(options: RuntimeContextOptions): Promise<StatusComboResult> {
  const context = await runtimeContext(options);
  return {
    ...context,
    status: await getRuntimeStatus({
      sourceDir: options.combo.agentDir,
      targetDir: context.targetDir,
      manifestPath: context.manifestPath,
    }),
  };
}

export async function applyCombo(options: ApplyComboOptions): Promise<ApplyComboResult> {
  const context = await runtimeContext(options);
  return {
    ...context,
    result: await applyRuntime({
      sourceDir: options.combo.agentDir,
      targetDir: context.targetDir,
      manifestPath: context.manifestPath,
      dryRun: options.dryRun || false,
      force: options.force || false,
    }),
  };
}

export async function runCombo({
  combo,
  stateRoot,
  cwd = process.cwd(),
  env = process.env,
  userArgs = [],
  commandRunner,
  spawnRunner = runInherited,
}: RunComboOptions): Promise<RunComboResult> {
  assertNoOwnedFlags(userArgs);
  const applied = await applyCombo({ combo, stateRoot, cwd, env, commandRunner });
  if (!applied.result.ok) {
    const reason = applied.result.reason || "runtime configuration has unresolved drift";
    throw new Error(`Refusing to launch ${combo.id}: ${reason}`);
  }
  await ensurePrivateDir(applied.sessionDir);

  const childEnv = { ...env };
  delete childEnv.PI_CODING_AGENT_SESSION_DIR;
  const args = [];
  if (combo.engine === "pi") {
    childEnv.PI_CODING_AGENT_DIR = applied.targetDir;
  } else {
    delete childEnv.PI_CODING_AGENT_DIR;
    delete childEnv.OMP_PROFILE;
    delete childEnv.PI_PROFILE;
    args.push(`--profile=${getOmpProfileName(combo)}`);
  }
  args.push(...combo.metadata.launchArgs, "--session-dir", applied.sessionDir, ...userArgs);
  const exitCode = await spawnRunner(binaryFor(combo.engine, env), args, { cwd, env: childEnv });
  return { exitCode, args, command: binaryFor(combo.engine, env), ...applied };
}
