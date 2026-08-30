import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import {
  acknowledgeParent,
  comboDigest,
  deriveCombo,
  lineageInfo,
  listCombos,
  loadCombo,
  parseComboId,
  renderComboTree,
} from "../src/combos.ts";
import type { ComboMetadata } from "../src/combos.ts";

async function writeCombo(root: string, id: string, metadata: Partial<ComboMetadata> = {}): Promise<void> {
  const [engine, name] = id.split("/");
  const directory = path.join(root, "combos", engine, name);
  await mkdir(path.join(directory, "agent"), { recursive: true });
  await writeFile(path.join(directory, "agent", engine === "pi" ? "settings.json" : "config.yml"), engine === "pi" ? "{}\n" : "{}\n");
  await writeFile(
    path.join(directory, "combo.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      description: `${id} fixture`,
      maturity: "learning",
      launchArgs: [],
      history: { mode: "isolated" },
      ...metadata,
    }, null, 2)}\n`,
  );
}

test("parseComboId accepts only engine/name identifiers", () => {
  assert.deepEqual(parseComboId("pi/coding"), { engine: "pi", name: "coding" });
  assert.equal(parseComboId(`omp/${"a".repeat(60)}`).name.length, 60);
  assert.throws(() => parseComboId(`omp/${"a".repeat(61)}`), /Invalid combo id/);
  assert.throws(() => parseComboId("omp/research."), /Invalid combo id/);
  assert.throws(() => parseComboId("pi/languages/python"), /Invalid combo id/);
  assert.throws(() => parseComboId("codex/base"), /Invalid combo id/);
});

test("derive records lineage and parent digest without runtime inheritance", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-combos-"));
  await writeCombo(root, "pi/base");
  await chmod(path.join(root, "combos", "pi", "base"), 0o755);
  const child = await deriveCombo(root, "pi/base", "pi/python", "Python work");
  const parent = await loadCombo(root, "pi/base");
  assert.equal(child.metadata.derivedFrom, "pi/base");
  assert.equal(child.metadata.parentDigest, await comboDigest(parent));
  assert.equal(child.metadata.description, "Python work");
  if (process.platform !== "win32") {
    assert.equal((await stat(child.comboDir)).mode & 0o777, 0o755);
    assert.equal((await stat(child.metadataPath)).mode & 0o777, 0o644);
  }
});

test("derive refuses any pre-existing target directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-derive-existing-"));
  await writeCombo(root, "pi/base");
  await mkdir(path.join(root, "combos", "pi", "occupied"), { recursive: true });
  await assert.rejects(deriveCombo(root, "pi/base", "pi/occupied"), /already exists/);
});

test("lineage reports stale parents and acknowledge updates metadata", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-lineage-"));
  await writeCombo(root, "pi/base");
  await deriveCombo(root, "pi/base", "pi/child");
  await writeFile(path.join(root, "combos", "pi", "base", "agent", "settings.json"), '{"quietStartup":true}\n');
  let info = await lineageInfo(root, "pi/child");
  assert.equal(info.ancestors[0].reviewed, false);
  const childDirectory = path.join(root, "combos", "pi", "child");
  await chmod(childDirectory, 0o755);
  await acknowledgeParent(root, "pi/child");
  info = await lineageInfo(root, "pi/child");
  assert.equal(info.ancestors[0].reviewed, true);
  if (process.platform !== "win32") {
    assert.equal((await stat(childDirectory)).mode & 0o777, 0o755);
    assert.equal((await stat(path.join(childDirectory, "combo.json"))).mode & 0o777, 0o644);
  }
});

test("lineage validation rejects cross-engine parents and cycles", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-cycle-"));
  await writeCombo(root, "pi/base", {
    derivedFrom: "omp/base",
    parentDigest: `sha256:${"0".repeat(64)}`,
  });
  await writeCombo(root, "omp/base");
  await assert.rejects(listCombos(root), /same engine/);

  const cycleRoot = await mkdtemp(path.join(os.tmpdir(), "pia-cycle-"));
  await writeCombo(cycleRoot, "pi/a", { derivedFrom: "pi/b", parentDigest: `sha256:${"0".repeat(64)}` });
  await writeCombo(cycleRoot, "pi/b", { derivedFrom: "pi/a", parentDigest: `sha256:${"0".repeat(64)}` });
  await assert.rejects(listCombos(cycleRoot), /cycle/i);
});

test("explicit loading validates only the selected combo ancestor chain", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-targeted-lineage-"));
  await writeCombo(root, "pi/good");
  await writeCombo(root, "omp/a", { derivedFrom: "omp/b", parentDigest: `sha256:${"0".repeat(64)}` });
  await writeCombo(root, "omp/b", { derivedFrom: "omp/a", parentDigest: `sha256:${"0".repeat(64)}` });

  assert.equal((await loadCombo(root, "pi/good")).id, "pi/good");
  await assert.rejects(loadCombo(root, "omp/a"), /cycle/i);
});

test("shared history group follows the combo-name safety policy", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-history-group-"));
  await writeCombo(root, "pi/valid", { history: { mode: "shared", group: "a".repeat(60) } });
  await writeCombo(root, "pi/too-long", { history: { mode: "shared", group: "a".repeat(61) } });
  await writeCombo(root, "pi/trailing-dot", { history: { mode: "shared", group: "research." } });

  assert.equal((await loadCombo(root, "pi/valid")).metadata.history.mode, "shared");
  await assert.rejects(loadCombo(root, "pi/too-long"), /safe group name/);
  await assert.rejects(loadCombo(root, "pi/trailing-dot"), /safe group name/);
});

test("renderComboTree shows roots and children", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-tree-"));
  await writeCombo(root, "pi/base");
  await deriveCombo(root, "pi/base", "pi/child");
  const rendered = renderComboTree(await listCombos(root));
  assert.match(rendered, /pi\/base/);
  assert.match(rendered, /pi\/child/);
});

test("stored launch args reject wrapper-owned and secret-bearing flags", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-args-"));
  await writeCombo(root, "pi/bad", { launchArgs: ["--api-key=secret"] });
  await assert.rejects(loadCombo(root, "pi/bad"), /secret-bearing flag/);

  const terminatorRoot = await mkdtemp(path.join(os.tmpdir(), "pia-args-"));
  await writeCombo(terminatorRoot, "pi/bad", { launchArgs: ["--"] });
  await assert.rejects(loadCombo(terminatorRoot, "pi/bad"), /secret-bearing flag/);
});

test("explicit combo loading rejects symlinked combo directories and metadata", async (t: TestContext) => {
  if (process.platform === "win32") t.skip("symlink permissions vary on Windows");
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-symlink-combo-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "pia-symlink-outside-"));
  await writeCombo(outside, "pi/escaped");
  await mkdir(path.join(root, "combos", "pi"), { recursive: true });
  const { symlink } = await import("node:fs/promises");
  await symlink(path.join(outside, "combos", "pi", "escaped"), path.join(root, "combos", "pi", "escaped"));
  await assert.rejects(loadCombo(root, "pi/escaped"), /ordinary directory/);

  const metadataRoot = await mkdtemp(path.join(os.tmpdir(), "pia-symlink-meta-"));
  await writeCombo(metadataRoot, "pi/base");
  const metadata = path.join(metadataRoot, "combos", "pi", "base", "combo.json");
  const realMetadata = path.join(metadataRoot, "combo.json.real");
  const { rename } = await import("node:fs/promises");
  await rename(metadata, realMetadata);
  await symlink(realMetadata, metadata);
  await assert.rejects(loadCombo(metadataRoot, "pi/base"), /ordinary file/);
});
