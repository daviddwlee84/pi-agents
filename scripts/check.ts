import { access, readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { comboDigest, listCombos } from "../src/combos.ts";
import { getSourceRoot } from "../src/paths.ts";
import { scanTree } from "../src/runtime.ts";

const sourceRoot = getSourceRoot();
const combos = await listCombos(sourceRoot);
if (combos.length === 0) throw new Error("No combos found");

const byId = new Map(combos.map((combo) => [combo.id, combo]));
for (const combo of combos) {
  await scanTree(combo.agentDir);
  if (combo.metadata.derivedFrom) {
    const parent = byId.get(combo.metadata.derivedFrom);
    if (!parent) throw new Error(`${combo.id}: parent combo ${combo.metadata.derivedFrom} does not exist`);
    const expected = await comboDigest(parent);
    if (combo.metadata.parentDigest !== expected) {
      throw new Error(`${combo.id}: parentDigest is stale; run pia lineage ${combo.id} --ack after review`);
    }
  }
}

JSON.parse(await readFile(path.join(sourceRoot, "schema", "combo.schema.json"), "utf8"));
await access(path.join(sourceRoot, "bin", "pia"));
await access(path.join(sourceRoot, "bin", "pia.ps1"));
await access(path.join(sourceRoot, "bin", "pia.cmd"));
const binMode = (await stat(path.join(sourceRoot, "bin", "pia"))).mode & 0o111;
if (process.platform !== "win32" && binMode === 0) throw new Error("bin/pia must be executable");

const gitleaks = spawnSync(
  "gitleaks",
  [
    "dir",
    path.join(sourceRoot, "combos"),
    "--config",
    path.join(sourceRoot, ".gitleaks.toml"),
    "--no-banner",
    "--no-color",
    "--redact=100",
    "--exit-code",
    "1",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
if (gitleaks.error && "code" in gitleaks.error && gitleaks.error.code === "ENOENT") {
  process.stderr.write("Warning: gitleaks is unavailable; combo content secret scan skipped.\n");
} else if (gitleaks.error || gitleaks.status !== 0) {
  throw new Error("Secret scan failed for combo source; run gitleaks locally for redacted diagnostics");
}

process.stdout.write(`Validated ${combos.length} combos.\n`);
