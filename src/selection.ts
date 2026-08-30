import { getSelectionPath, readJsonIfExists, writeJsonAtomic } from "./paths.ts";
import { loadCombo } from "./combos.ts";
import type { Combo } from "./combos.ts";

interface SelectionFile {
  schemaVersion: 1;
  combo: string;
}

export async function readSelection(env: NodeJS.ProcessEnv = process.env): Promise<string | undefined> {
  const value = await readJsonIfExists<unknown>(getSelectionPath(env));
  if (!value) return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof value !== "object" ||
    Array.isArray(value) ||
    record.schemaVersion !== 1 ||
    typeof record.combo !== "string"
  ) {
    throw new Error(`Invalid selection file ${getSelectionPath(env)}`);
  }
  return record.combo;
}

export async function resolveSelectedCombo(
  sourceRoot: string,
  explicit: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Combo> {
  const id = explicit || env.PIA_COMBO || (await readSelection(env));
  if (!id) throw new Error("No combo selected; pass one to `pia run` or use `pia use <combo>`");
  return await loadCombo(sourceRoot, id);
}

export async function saveSelection(
  sourceRoot: string,
  comboId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  await loadCombo(sourceRoot, comboId);
  const selection: SelectionFile = { schemaVersion: 1, combo: comboId };
  await writeJsonAtomic(getSelectionPath(env), selection);
  return getSelectionPath(env);
}
