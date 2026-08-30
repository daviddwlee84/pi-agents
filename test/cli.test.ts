import assert from "node:assert/strict";
import { chmod, cp, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test, { type TestContext } from "node:test";
import type { SpawnSyncReturns } from "node:child_process";
import { sessionLeafDir } from "../src/sessions.ts";

const repoRoot = path.resolve(import.meta.dirname, "..");
const pia = path.join(repoRoot, "bin", "pia");

interface Fixture {
  root: string;
  stateRoot: string;
  configRoot: string;
  fakeBin: string;
  capture: string;
  ompDir: string;
  env: NodeJS.ProcessEnv;
}

interface HarnessCapture {
  argv: string[];
  env: {
    agentDir?: string;
    sessionDir?: string;
    ompProfile?: string;
    piProfile?: string;
  };
}

async function executable(file: string, source: string): Promise<void> {
  await writeFile(file, source, { mode: 0o700 });
  await chmod(file, 0o700);
}

async function fixture(t: TestContext): Promise<Fixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-cli-"));
  const stateRoot = path.join(root, "state");
  const configRoot = path.join(root, "config");
  const fakeBin = path.join(root, "bin");
  const capture = path.join(root, "capture.json");
  const ompDir = path.join(root, "profiles", "pia-base", "agent");
  await mkdir(fakeBin, { recursive: true });
  await executable(
    path.join(fakeBin, "fake-pi"),
    `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(process.env.PIA_CAPTURE, JSON.stringify({ argv: process.argv.slice(2), env: { agentDir: process.env.PI_CODING_AGENT_DIR, sessionDir: process.env.PI_CODING_AGENT_SESSION_DIR } }));
process.exit(Number(process.env.PIA_FAKE_EXIT || 0));
`,
  );
  await executable(
    path.join(fakeBin, "fake-omp"),
    `#!/usr/bin/env node
const fs = require('node:fs');
const argv = process.argv.slice(2);
if (argv.includes('config') && argv.includes('path')) { process.stdout.write(process.env.PIA_FAKE_OMP_DIR + '\\n'); process.exit(0); }
fs.writeFileSync(process.env.PIA_CAPTURE, JSON.stringify({ argv, env: { agentDir: process.env.PI_CODING_AGENT_DIR, ompProfile: process.env.OMP_PROFILE, piProfile: process.env.PI_PROFILE } }));
`,
  );
  await executable(path.join(fakeBin, "python3"), "#!/bin/sh\nexit 0\n");
  await executable(path.join(fakeBin, "gitleaks"), "#!/bin/sh\ncat >/dev/null\nexit 0\n");
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(root, { recursive: true, force: true });
  });
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PIA_SOURCE_ROOT: repoRoot,
    PIA_STATE_HOME: stateRoot,
    XDG_CONFIG_HOME: configRoot,
    PIA_PI_BIN: path.join(fakeBin, "fake-pi"),
    PIA_OMP_BIN: path.join(fakeBin, "fake-omp"),
    PIA_CAPTURE: capture,
    PIA_FAKE_OMP_DIR: ompDir,
    PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ""}`,
  };
  return { root, stateRoot, configRoot, fakeBin, capture, ompDir, env };
}

function run(args: string[], env: NodeJS.ProcessEnv): SpawnSyncReturns<string> {
  return spawnSync(pia, args, { cwd: repoRoot, env, encoding: "utf8" });
}

test("selection persists outside the repo and explicit run configures Pi isolation", async (t) => {
  const f = await fixture(t);
  const selected = run(["use", "pi/base"], f.env);
  assert.equal(selected.status, 0, selected.stderr);
  assert.equal(run(["current"], f.env).stdout.trim(), "pi/base");

  const launched = run(["run", "pi/base", "--", "--model", "example"], f.env);
  assert.equal(launched.status, 0, launched.stderr);
  const capture = JSON.parse(await readFile(f.capture, "utf8")) as HarnessCapture;
  assert.equal(capture.env.agentDir, path.join(f.stateRoot, "runtime", "pi", "base", "agent"));
  assert.deepEqual(capture.argv.slice(-2), ["--model", "example"]);
  assert.ok(capture.argv.includes("--session-dir"));
});

test("OMP uses a namespaced native profile and runtime config path", async (t) => {
  const f = await fixture(t);
  const launched = run(["run", "omp/base"], f.env);
  assert.equal(launched.status, 0, launched.stderr);
  const capture = JSON.parse(await readFile(f.capture, "utf8")) as HarnessCapture;
  assert.equal(capture.argv[0], "--profile=pia-base");
  assert.equal(capture.env.agentDir, undefined);
  assert.equal(await readFile(path.join(f.ompDir, "config.yml"), "utf8"), "{}\n");
});

test("OMP refuses a broad or unexpected config path before applying", async (t) => {
  const f = await fixture(t);
  const bad = run(["apply", "omp/base"], { ...f.env, PIA_FAKE_OMP_DIR: f.root });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /outside the expected pia-base\/agent shape/);
});

test("OMP refuses a symlinked profile directory", async (t) => {
  if (process.platform === "win32") t.skip("symlink permissions vary on Windows");
  const f = await fixture(t);
  const { rm, symlink } = await import("node:fs/promises");
  await rm(path.dirname(f.ompDir), { recursive: true, force: true });
  await mkdir(path.dirname(path.dirname(f.ompDir)), { recursive: true });
  const outside = path.join(f.root, "outside-profile");
  await mkdir(path.join(outside, "agent"), { recursive: true });
  await symlink(outside, path.dirname(f.ompDir));
  const refused = run(["apply", "omp/base"], f.env);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /symbolic link/);
});

test("run refuses managed runtime drift before invoking the harness", async (t) => {
  const f = await fixture(t);
  assert.equal(run(["run", "pi/base"], f.env).status, 0);
  const runtimeSettings = path.join(f.stateRoot, "runtime", "pi", "base", "agent", "settings.json");
  await writeFile(runtimeSettings, '{"changedAtRuntime":true}\n');
  await writeFile(f.capture, "sentinel");
  const refused = run(["run", "pi/base"], f.env);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /Refusing to launch/);
  assert.equal(await readFile(f.capture, "utf8"), "sentinel");
});

test("run rejects native cwd overrides that would misroute session history", async (t) => {
  const f = await fixture(t);
  const refused = run(["run", "omp/base", "--", "--cwd", f.root], f.env);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /pia owns runtime isolation/);
});

test("same-engine fork resolves the source latest session and launches the target", async (t) => {
  const f = await fixture(t);
  const sourceSessions = sessionLeafDir({
    stateRoot: f.stateRoot,
    engine: "pi",
    comboName: "base",
    cwd: repoRoot,
    history: { mode: "isolated" },
  });
  await mkdir(sourceSessions, { recursive: true });
  const sessionPath = path.join(sourceSessions, "session.jsonl");
  await writeFile(
    sessionPath,
    `${JSON.stringify({ type: "session", version: 3, id: "abcdef123456", timestamp: new Date().toISOString(), cwd: repoRoot })}\n${JSON.stringify({ type: "message", id: "u1", parentId: null, timestamp: new Date().toISOString(), message: { role: "user", content: "continue" } })}\n`,
  );
  const launched = run(["fork", "pi/base", "pi/vanilla", "--latest"], f.env);
  assert.equal(launched.status, 0, launched.stderr);
  const capture = JSON.parse(await readFile(f.capture, "utf8")) as HarnessCapture;
  const index = capture.argv.indexOf("--fork");
  assert.equal(capture.argv[index + 1], sessionPath);
  assert.ok(capture.argv.includes("--no-skills"));
});

test("fork and handoff reject conflicting target session-routing flags", async (t) => {
  const f = await fixture(t);
  const forked = run(["fork", "pi/base", "pi/vanilla", "--latest", "--", "--resume"], f.env);
  assert.equal(forked.status, 2);
  assert.match(forked.stderr, /owns target session creation/);
  const handed = run([
    "handoff",
    "pi/base",
    "omp/base",
    "--latest",
    "--goal",
    "continue",
    "--",
    "--continue",
  ], f.env);
  assert.equal(handed.status, 2);
  assert.match(handed.stderr, /owns target session creation/);
});

test("OMP parent diff and session listing do not require an OMP binary", async (t) => {
  const f = await fixture(t);
  const sourceRoot = path.join(f.root, "source");
  await cp(path.join(repoRoot, "combos"), path.join(sourceRoot, "combos"), { recursive: true });
  await cp(
    path.join(sourceRoot, "combos", "omp", "base"),
    path.join(sourceRoot, "combos", "omp", "child"),
    { recursive: true },
  );
  const childMetadata = path.join(sourceRoot, "combos", "omp", "child", "combo.json");
  const metadata = JSON.parse(await readFile(childMetadata, "utf8"));
  metadata.description = "Child";
  metadata.derivedFrom = "omp/base";
  metadata.parentDigest = `sha256:${"0".repeat(64)}`;
  await writeFile(childMetadata, `${JSON.stringify(metadata, null, 2)}\n`);
  const env = { ...f.env, PIA_SOURCE_ROOT: sourceRoot, PIA_OMP_BIN: path.join(f.root, "missing-omp") };
  const diff = run(["diff", "omp/child", "--parent"], env);
  assert.equal(diff.status, 0, diff.stderr);
  const sessions = run(["sessions", "omp/base"], env);
  assert.equal(sessions.status, 0, sessions.stderr);
});

test("cross-engine handoff creates a private redacted artifact without launching when requested", async (t) => {
  const f = await fixture(t);
  const sourceSessions = sessionLeafDir({
    stateRoot: f.stateRoot,
    engine: "pi",
    comboName: "base",
    cwd: repoRoot,
    history: { mode: "isolated" },
  });
  await mkdir(sourceSessions, { recursive: true });
  await writeFile(
    path.join(sourceSessions, "handoff.jsonl"),
    `${JSON.stringify({ type: "session", version: 3, id: "handoff123", timestamp: new Date().toISOString(), cwd: repoRoot })}\n${JSON.stringify({ type: "message", id: "u1", parentId: null, timestamp: new Date().toISOString(), message: { role: "user", content: "Original task" } })}\n${JSON.stringify({ type: "message", id: "a1", parentId: "u1", timestamp: new Date().toISOString(), message: { role: "assistant", content: [{ type: "text", text: "Current state" }] } })}\n`,
  );
  const result = run(["handoff", "pi/base", "omp/base", "--latest", "--goal", "Continue safely", "--no-run"], f.env);
  assert.equal(result.status, 0, result.stderr);
  const artifact = result.stdout.trim();
  assert.equal(path.dirname(artifact), path.join(f.stateRoot, "handoffs"));
  const contents = await readFile(artifact, "utf8");
  assert.match(contents, /Source combo: `pi\/base`/);
  assert.match(contents, /Target combo: `omp\/base`/);
});

test("selection precedence and child exit-code forwarding are explicit", async (t) => {
  const f = await fixture(t);
  assert.equal(run(["use", "pi/base"], f.env).status, 0);

  const envSelected = run([], { ...f.env, PIA_COMBO: "pi/vanilla" });
  assert.equal(envSelected.status, 0, envSelected.stderr);
  let capture = JSON.parse(await readFile(f.capture, "utf8")) as HarnessCapture;
  assert.ok(capture.argv.includes("--no-skills"));

  const explicit = run(["run", "pi/base"], { ...f.env, PIA_COMBO: "pi/vanilla" });
  assert.equal(explicit.status, 0, explicit.stderr);
  capture = JSON.parse(await readFile(f.capture, "utf8")) as HarnessCapture;
  assert.equal(capture.argv.includes("--no-skills"), false);

  const forwarded = run(["run", "pi/base"], { ...f.env, PIA_FAKE_EXIT: "7" });
  assert.equal(forwarded.status, 7);
});
