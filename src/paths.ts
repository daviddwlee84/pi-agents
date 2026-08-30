import { access, chmod, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Combo } from "./combos.ts";

const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
type ComboPathIdentity = Pick<Combo, "engine" | "name">;

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

export function getSourceRoot(env: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(env.PIA_SOURCE_ROOT || MODULE_ROOT);
}

export function getStateRoot(env: NodeJS.ProcessEnv = process.env): string {
  if (env.PIA_STATE_HOME) return path.resolve(env.PIA_STATE_HOME);
  const base = env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state");
  return path.join(base, "pi-agents");
}

export function getConfigRoot(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "pi-agents");
}

export function getSelectionPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(getConfigRoot(env), "selection.json");
}

export function getManifestPath(stateRoot: string, combo: ComboPathIdentity): string {
  return path.join(stateRoot, "manifests", combo.engine, `${combo.name}.json`);
}

export function getPiRuntimeDir(stateRoot: string, combo: ComboPathIdentity): string {
  return path.join(stateRoot, "runtime", "pi", combo.name, "agent");
}

export function getOmpProfileName(combo: ComboPathIdentity): string {
  return `pia-${combo.name}`;
}

export async function ensurePrivateDir(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await lstat(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Private state path must be an ordinary directory: ${directory}`);
  }
  await chmod(directory, 0o700);
  try {
    await access(directory);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot access directory ${directory}: ${detail}`);
  }
}

export async function readJsonIfExists<T = unknown>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return undefined;
    if (error instanceof SyntaxError) throw new Error(`Invalid JSON in ${file}: ${error.message}`);
    throw error;
  }
}

export async function writeJsonAtomic(file: string, value: unknown, mode = 0o600): Promise<void> {
  await ensurePrivateDir(path.dirname(file));
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

/** Write a Git-managed source file without changing its containing directory's permissions. */
export async function writeSourceJsonAtomic(file: string, value: unknown): Promise<void> {
  const directory = path.dirname(file);
  await mkdir(directory, { recursive: true });
  const stat = await lstat(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Source path must be an ordinary directory: ${directory}`);
  }
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o644 });
    await chmod(temporary, 0o644);
    await rename(temporary, file);
    await chmod(file, 0o644);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}
