import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, realpath } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { scanTree, treeDigest } from "./runtime.ts";
import { writeSourceJsonAtomic } from "./paths.ts";

export const ENGINES = ["pi", "omp"] as const;
export const COMBO_ID_PATTERN = /^(pi|omp)\/([a-z0-9](?:[a-z0-9._-]{0,58}[a-z0-9_-])?)$/;
export const SAFE_COMBO_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,58}[a-z0-9_-])?$/;
const MATURITIES = new Set<Maturity>(["experimental", "learning", "production"]);
const METADATA_KEYS = new Set([
  "$schema",
  "schemaVersion",
  "description",
  "maturity",
  "launchArgs",
  "history",
  "derivedFrom",
  "parentDigest",
]);
const RESERVED_FLAGS = new Set([
  "--profile",
  "--alias",
  "--session-dir",
  "--cwd",
  "--config",
  "--fork",
  "--resume",
  "--session",
  "--continue",
  "--api-key",
  "--",
  "-r",
  "-c",
]);

export type Engine = (typeof ENGINES)[number];
export type Maturity = "experimental" | "learning" | "production";
export type HistoryPolicy = { mode: "isolated" } | { mode: "shared"; group: string };

export interface ComboMetadata {
  $schema?: string;
  schemaVersion: 1;
  description: string;
  maturity: Maturity;
  launchArgs: string[];
  history: HistoryPolicy;
  derivedFrom?: string;
  parentDigest?: string;
}

export interface Combo {
  id: string;
  engine: Engine;
  name: string;
  comboDir: string;
  metadataPath: string;
  agentDir: string;
  metadata: ComboMetadata;
}

export interface ParsedComboId {
  engine: Engine;
  name: string;
}

export interface LineageAncestor {
  id: string;
  digest: string;
  reviewed: boolean;
  recordedDigest: string;
}

export interface LineageInfo {
  combo: Combo;
  ancestors: LineageAncestor[];
  descendants: string[];
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, stable(record[key])]));
  }
  return value;
}

export function parseComboId(id: string): ParsedComboId {
  const match = COMBO_ID_PATTERN.exec(id);
  if (!match) throw new Error(`Invalid combo id "${id}"; expected pi/<name> or omp/<name>`);
  return { engine: match[1] as Engine, name: match[2] };
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
}

function validateLaunchArgs(args: unknown, id: string): string[] {
  if (args === undefined) return [];
  if (!Array.isArray(args) || args.some((item) => typeof item !== "string")) {
    throw new Error(`${id}: launchArgs must be an array of strings`);
  }
  for (const arg of args as string[]) {
    const flag = arg.includes("=") ? arg.slice(0, arg.indexOf("=")) : arg;
    if (RESERVED_FLAGS.has(flag)) {
      throw new Error(`${id}: launchArgs may not contain wrapper-owned or secret-bearing flag ${flag}`);
    }
  }
  return args as string[];
}

export function validateComboMetadata(metadata: unknown, id: string): ComboMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error(`${id}: combo.json must contain an object`);
  }
  const record = metadata as Record<string, unknown>;
  if (record.schemaVersion !== 1) throw new Error(`${id}: schemaVersion must be 1`);
  const unknownKey = Object.keys(record).find((key) => !METADATA_KEYS.has(key));
  if (unknownKey) throw new Error(`${id}: unsupported combo.json field ${unknownKey}`);
  if (record.$schema !== undefined && typeof record.$schema !== "string") {
    throw new Error(`${id}: $schema must be a string`);
  }
  assertString(record.description, `${id}: description`);
  if (!MATURITIES.has(record.maturity as Maturity)) {
    throw new Error(`${id}: maturity must be experimental, learning, or production`);
  }
  const launchArgs = validateLaunchArgs(record.launchArgs, id);
  const history = record.history;
  if (!history || typeof history !== "object" || Array.isArray(history)) {
    throw new Error(`${id}: history must be an object`);
  }
  const historyRecord = history as Record<string, unknown>;
  if (historyRecord.mode !== "isolated" && historyRecord.mode !== "shared") {
    throw new Error(`${id}: history.mode must be isolated or shared`);
  }
  const allowedHistoryKeys = historyRecord.mode === "shared" ? new Set(["mode", "group"]) : new Set(["mode"]);
  const unknownHistoryKey = Object.keys(historyRecord).find((key) => !allowedHistoryKeys.has(key));
  if (unknownHistoryKey) throw new Error(`${id}: unsupported history field ${unknownHistoryKey}`);
  if (
    historyRecord.mode === "shared" &&
    (typeof historyRecord.group !== "string" || !SAFE_COMBO_NAME_PATTERN.test(historyRecord.group))
  ) {
    throw new Error(`${id}: shared history requires a safe group name`);
  }
  const validatedHistory: HistoryPolicy = historyRecord.mode === "shared"
    ? { mode: "shared", group: historyRecord.group as string }
    : { mode: "isolated" };
  if ((record.derivedFrom === undefined) !== (record.parentDigest === undefined)) {
    throw new Error(`${id}: derivedFrom and parentDigest must be set together`);
  }
  if (record.derivedFrom !== undefined) {
    if (typeof record.derivedFrom !== "string") throw new Error(`${id}: derivedFrom must be a combo id`);
    const current = parseComboId(id);
    const parent = parseComboId(record.derivedFrom);
    if (current.engine !== parent.engine) throw new Error(`${id}: parent must use the same engine`);
    if (typeof record.parentDigest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(record.parentDigest)) {
      throw new Error(`${id}: parentDigest must be sha256:<64 lowercase hex chars>`);
    }
  }
  return {
    ...(record.$schema === undefined ? {} : { $schema: record.$schema as string }),
    schemaVersion: 1,
    description: record.description,
    maturity: record.maturity as Maturity,
    launchArgs,
    history: validatedHistory,
    ...(record.derivedFrom === undefined
      ? {}
      : { derivedFrom: record.derivedFrom as string, parentDigest: record.parentDigest as string }),
  };
}

async function loadComboRecord(sourceRoot: string, id: string): Promise<Combo> {
  const { engine, name } = parseComboId(id);
  const comboDir = path.join(sourceRoot, "combos", engine, name);
  const metadataPath = path.join(comboDir, "combo.json");
  const sourceReal = await realpath(sourceRoot);
  for (const candidate of [path.join(sourceRoot, "combos"), path.join(sourceRoot, "combos", engine), comboDir]) {
    let stat;
    try {
      stat = await lstat(candidate);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") throw new Error(`Unknown combo ${id}`);
      throw error;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`${id}: combo path must be an ordinary directory inside the source root`);
    }
  }
  const comboReal = await realpath(comboDir);
  if (!comboReal.startsWith(`${sourceReal}${path.sep}`)) {
    throw new Error(`${id}: combo path escapes the source root`);
  }
  const comboEntries = await readdir(comboDir);
  const unexpected = comboEntries.find((entry) => entry !== "combo.json" && entry !== "agent");
  if (unexpected) throw new Error(`${id}: unsupported path in combo root: ${unexpected}`);
  const agentStat = await lstat(path.join(comboDir, "agent")).catch((error) => {
    if (isNodeError(error) && error.code === "ENOENT") throw new Error(`${id}: agent directory is missing`);
    throw error;
  });
  if (agentStat.isSymbolicLink() || !agentStat.isDirectory()) {
    throw new Error(`${id}: agent must be an ordinary directory`);
  }
  const metadataStat = await lstat(metadataPath).catch((error) => {
    if (isNodeError(error) && error.code === "ENOENT") throw new Error(`Unknown combo ${id}`);
    throw error;
  });
  if (metadataStat.isSymbolicLink() || !metadataStat.isFile()) {
    throw new Error(`${id}: combo.json must be an ordinary file`);
  }
  let metadata: unknown;
  try {
    metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") throw new Error(`Unknown combo ${id}`);
    if (error instanceof SyntaxError) throw new Error(`${id}: invalid combo.json: ${error.message}`);
    throw error;
  }
  return {
    id,
    engine,
    name,
    comboDir,
    metadataPath,
    agentDir: path.join(comboDir, "agent"),
    metadata: validateComboMetadata(metadata, id),
  };
}

/** Validate only this combo's ancestor chain, without loading unrelated combos. */
export async function validateComboLineage(sourceRoot: string, combo: Combo): Promise<Map<string, Combo>> {
  const chain = new Map<string, Combo>();
  let cursor = combo;
  while (true) {
    if (chain.has(cursor.id)) throw new Error(`Lineage cycle detected at ${cursor.id}`);
    chain.set(cursor.id, cursor);
    const parentId = cursor.metadata.derivedFrom;
    if (!parentId) return chain;
    cursor = await loadComboRecord(sourceRoot, parentId);
  }
}

export async function loadCombo(sourceRoot: string, id: string): Promise<Combo> {
  const combo = await loadComboRecord(sourceRoot, id);
  await validateComboLineage(sourceRoot, combo);
  return combo;
}

export async function listCombos(sourceRoot: string): Promise<Combo[]> {
  const result: Combo[] = [];
  for (const engine of ENGINES) {
    const engineDir = path.join(sourceRoot, "combos", engine);
    let entries: Dirent<string>[] = [];
    try {
      entries = await readdir(engineDir, { withFileTypes: true });
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") throw error;
    }
    for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      result.push(await loadCombo(sourceRoot, `${engine}/${entry.name}`));
    }
  }
  validateLineage(result);
  return result;
}

export function validateLineage(combos: readonly Combo[]): Map<string, Combo> {
  const byId = new Map<string, Combo>(combos.map((combo) => [combo.id, combo]));
  for (const combo of combos) {
    const parentId = combo.metadata.derivedFrom;
    if (!parentId) continue;
    const parent = byId.get(parentId);
    if (!parent) throw new Error(`${combo.id}: parent combo ${parentId} does not exist`);
    if (parent.engine !== combo.engine) throw new Error(`${combo.id}: parent must use the same engine`);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`Lineage cycle detected at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    const parent = byId.get(id)?.metadata.derivedFrom;
    if (parent) visit(parent);
    visiting.delete(id);
    visited.add(id);
  };
  for (const combo of combos) visit(combo.id);
  return byId;
}

export async function comboDigest(combo: Combo): Promise<string> {
  const metadata: Partial<ComboMetadata> = { ...combo.metadata };
  delete metadata.$schema;
  delete metadata.derivedFrom;
  delete metadata.parentDigest;
  const agentDigest = await treeDigest(combo.agentDir);
  const hash = createHash("sha256");
  hash.update(JSON.stringify(stable(metadata)));
  hash.update("\0");
  hash.update(agentDigest);
  return `sha256:${hash.digest("hex")}`;
}

export async function lineageInfo(sourceRoot: string, comboId: string): Promise<LineageInfo> {
  const combos = await listCombos(sourceRoot);
  const byId = new Map(combos.map((combo) => [combo.id, combo]));
  const combo = byId.get(comboId);
  if (!combo) throw new Error(`Unknown combo ${comboId}`);
  const ancestors: LineageAncestor[] = [];
  let cursor = combo;
  while (cursor.metadata.derivedFrom) {
    const parent = byId.get(cursor.metadata.derivedFrom);
    if (!parent) throw new Error(`${cursor.id}: parent combo ${cursor.metadata.derivedFrom} does not exist`);
    const digest = await comboDigest(parent);
    ancestors.push({
      id: parent.id,
      digest,
      reviewed: cursor.metadata.parentDigest === digest,
      recordedDigest: cursor.metadata.parentDigest as string,
    });
    cursor = parent;
  }
  const descendants = combos.filter((item) => item.metadata.derivedFrom === comboId).map((item) => item.id);
  return { combo, ancestors, descendants };
}

export async function acknowledgeParent(sourceRoot: string, comboId: string): Promise<string> {
  const combos = await listCombos(sourceRoot);
  const byId = new Map(combos.map((combo) => [combo.id, combo]));
  const combo = byId.get(comboId);
  if (!combo) throw new Error(`Unknown combo ${comboId}`);
  const parentId = combo.metadata.derivedFrom;
  if (!parentId) throw new Error(`${comboId} has no parent`);
  const parent = byId.get(parentId);
  if (!parent) throw new Error(`${comboId}: parent combo ${parentId} does not exist`);
  const digest = await comboDigest(parent);
  const metadata = { ...combo.metadata, parentDigest: digest };
  await writeSourceJsonAtomic(combo.metadataPath, metadata);
  return digest;
}

export async function deriveCombo(
  sourceRoot: string,
  parentId: string,
  childId: string,
  description?: string,
): Promise<Combo> {
  const parent = await loadCombo(sourceRoot, parentId);
  const childParts = parseComboId(childId);
  if (childParts.engine !== parent.engine) throw new Error("A derived combo must use the same engine as its parent");
  const childDir = path.join(sourceRoot, "combos", childParts.engine, childParts.name);
  try {
    await lstat(childDir);
    throw new Error(`Target combo ${childId} already exists`);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") throw error;
  }
  await scanTree(parent.agentDir);
  await mkdir(path.dirname(childDir), { recursive: true });
  await cp(parent.comboDir, childDir, { recursive: true, errorOnExist: true, force: false });
  const parentDigest = await comboDigest(parent);
  const metadata = {
    ...parent.metadata,
    description: description || `Derived from ${parentId}.`,
    derivedFrom: parentId,
    parentDigest,
  };
  await writeSourceJsonAtomic(path.join(childDir, "combo.json"), metadata);
  return await loadCombo(sourceRoot, childId);
}

export function renderComboTree(combos: readonly Combo[]): string {
  const children = new Map<string | null, Combo[]>();
  for (const combo of combos) {
    const parent = combo.metadata.derivedFrom || null;
    const list = children.get(parent) || [];
    list.push(combo);
    children.set(parent, list);
  }
  for (const list of children.values()) list.sort((a, b) => a.id.localeCompare(b.id));
  const lines: string[] = [];
  const walkChildren = (combo: Combo, prefix: string): void => {
    const next = children.get(combo.id) || [];
    next.forEach((child, index) => {
      const last = index === next.length - 1;
      lines.push(`${prefix}${last ? "└─ " : "├─ "}${child.id} [${child.metadata.maturity}]`);
      walkChildren(child, `${prefix}${last ? "   " : "│  "}`);
    });
  };
  const roots = children.get(null) || [];
  roots.forEach((root) => {
    lines.push(`${root.id} [${root.metadata.maturity}]`);
    walkChildren(root, "");
  });
  return lines.join("\n");
}
