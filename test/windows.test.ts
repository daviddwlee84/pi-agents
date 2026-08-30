import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test, { type TestContext } from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function windowsFixture(t: TestContext): Promise<{
  root: string;
  capture: string;
  env: NodeJS.ProcessEnv;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-windows-"));
  const bin = path.join(root, "bin");
  const capture = path.join(root, "capture.json");
  const ompDir = path.join(root, "profiles", "pia-base", "agent");
  await mkdir(bin, { recursive: true });
  const shim = (script: string) => [
    '$ErrorActionPreference = "Stop"',
    `& node (Join-Path $PSScriptRoot "${script}") @args`,
    "exit $LASTEXITCODE",
    "",
  ].join("\r\n");
  await Promise.all([
    writeFile(path.join(bin, "fake-pi.ps1"), shim("fake-pi.mjs")),
    writeFile(path.join(bin, "fake-omp.ps1"), shim("fake-omp.mjs")),
    writeFile(
      path.join(bin, "fake-pi.mjs"),
      `import fs from "node:fs";
fs.writeFileSync(process.env.PIA_CAPTURE, JSON.stringify({ argv: process.argv.slice(2), env: { agentDir: process.env.PI_CODING_AGENT_DIR } }));
process.exit(Number(process.env.PIA_FAKE_EXIT || 0));
`,
    ),
    writeFile(
      path.join(bin, "fake-omp.mjs"),
      `import fs from "node:fs";
const argv = process.argv.slice(2);
if (argv.includes("config") && argv.includes("path")) {
  process.stdout.write(process.env.PIA_FAKE_OMP_DIR + "\\n");
} else {
  fs.writeFileSync(process.env.PIA_CAPTURE, JSON.stringify({ argv, env: { agentDir: process.env.PI_CODING_AGENT_DIR } }));
}
`,
    ),
  ]);
  t.after(() => rm(root, { recursive: true, force: true }));
  return {
    root,
    capture,
    env: {
      ...process.env,
      PIA_SOURCE_ROOT: repoRoot,
      PIA_STATE_HOME: path.join(root, "state"),
      XDG_CONFIG_HOME: path.join(root, "config"),
      PIA_PI_BIN: path.join(bin, "fake-pi"),
      PIA_OMP_BIN: path.join(bin, "fake-omp"),
      PIA_CAPTURE: capture,
      PIA_FAKE_OMP_DIR: ompDir,
      PATH: `${bin};${process.env.PATH || process.env.Path || ""}`,
    },
  };
}

function runPia(args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync("powershell.exe", [
    "-NoLogo",
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(repoRoot, "bin", "pia.ps1"),
    ...args,
  ], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
  });
}

test("Windows launchers execute the Node-native TypeScript CLI", { skip: process.platform !== "win32" }, () => {
  const expected = (JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as { version: string }).version;
  const powershell = spawnSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(repoRoot, "bin", "pia.ps1"), "--version"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.equal(powershell.status, 0, powershell.stderr);
  assert.equal(powershell.stdout.trim(), expected);
  const powershellFailure = spawnSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(repoRoot, "bin", "pia.ps1"), "not-a-command"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.equal(powershellFailure.status, 2, powershellFailure.stderr);

  const cmd = spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/c", "bin\\pia.cmd --version"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(cmd.status, 0, cmd.stderr);
  assert.equal(cmd.stdout.trim(), expected);
  const failureCommand = `""${path.join(repoRoot, "bin", "pia.cmd")}" not-a-command"`;
  const cmdFailure = spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", failureCommand], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(cmdFailure.status, 2, cmdFailure.stderr);
});

test("Windows runs npm-style PowerShell harness shims without shell parsing", { skip: process.platform !== "win32" }, async (t) => {
  const fixture = await windowsFixture(t);
  const sentinel = path.join(fixture.root, "injected.txt");
  const hostile = `literal; Set-Content -Path '${sentinel}' -Value injected`;

  const pi = runPia(["run", "pi/base", "--", hostile], fixture.env);
  assert.equal(pi.status, 0, pi.stderr);
  let capture = JSON.parse(await readFile(fixture.capture, "utf8")) as { argv: string[]; env: { agentDir?: string } };
  assert.equal(capture.argv.at(-1), hostile);
  assert.match(capture.env.agentDir || "", /runtime[\\/]pi[\\/]base[\\/]agent$/);
  await assert.rejects(access(sentinel), { code: "ENOENT" });

  const omp = runPia(["run", "omp/base"], fixture.env);
  assert.equal(omp.status, 0, omp.stderr);
  capture = JSON.parse(await readFile(fixture.capture, "utf8")) as { argv: string[]; env: { agentDir?: string } };
  assert.equal(capture.argv[0], "--profile=pia-base");
  assert.equal(capture.env.agentDir, undefined);

  const forwarded = runPia(["run", "pi/base"], { ...fixture.env, PIA_FAKE_EXIT: "7" });
  assert.equal(forwarded.status, 7, forwarded.stderr);
});
