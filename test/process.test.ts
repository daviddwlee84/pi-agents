import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveCommandInvocation } from "../src/process.ts";

test("non-Windows command invocation stays direct", () => {
  assert.deepEqual(
    resolveCommandInvocation("pi", ["--version"], {}, "linux"),
    { command: "pi", args: ["--version"] },
  );
});

test("Windows command resolution prefers a direct executable in PATH order", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-process-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = path.join(root, "first");
  const second = path.join(root, "second");
  await Promise.all([mkdir(first, { recursive: true }), mkdir(second, { recursive: true })]);
  await writeFile(path.join(first, "pi.exe"), "");
  await writeFile(path.join(second, "pi.ps1"), "");

  assert.deepEqual(
    resolveCommandInvocation("pi", ["--version"], { Path: `${first};${second}` }, "win32"),
    { command: path.join(first, "pi.exe"), args: ["--version"] },
  );
});

test("Windows npm PowerShell shims use -File with literal forwarded argv", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-process-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const shim = path.join(root, "pi.ps1");
  const powershell = path.join(root, "powershell.exe");
  await Promise.all([writeFile(shim, ""), writeFile(powershell, "")]);
  const forwarded = ["--model", "literal; Write-Output pwned", "value with spaces"];

  const invocation = resolveCommandInvocation("pi", forwarded, { Path: root }, "win32");
  assert.equal(invocation.command, powershell);
  assert.deepEqual(invocation.args.slice(0, 7), [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    shim,
  ]);
  assert.deepEqual(invocation.args.slice(7), forwarded);
  assert.equal(invocation.args.includes("-Command"), false);
});

test("Windows explicit PowerShell shim paths resolve without PATH lookup", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-process-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const shimBase = path.join(root, "custom-pi");
  await writeFile(`${shimBase}.ps1`, "");

  const invocation = resolveCommandInvocation(shimBase, ["--version"], {}, "win32");
  assert.equal(invocation.command, "powershell.exe");
  assert.equal(invocation.args[6], `${shimBase}.ps1`);
  assert.deepEqual(invocation.args.slice(7), ["--version"]);
});

test("Windows explicit cmd shims are redirected to a safe PowerShell sibling", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-process-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cmd = path.join(root, "pi.cmd");
  const shim = path.join(root, "pi.ps1");
  await Promise.all([writeFile(cmd, ""), writeFile(shim, "")]);
  const forwarded = ["literal & whoami", "value|more"];

  const invocation = resolveCommandInvocation(cmd, forwarded, {}, "win32");
  assert.equal(invocation.command, "powershell.exe");
  assert.equal(invocation.args[6], shim);
  assert.deepEqual(invocation.args.slice(7), forwarded);
});

test("Windows cmd or bat shims without a PowerShell sibling fail closed", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pia-process-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cmd = path.join(root, "pi.cmd");
  await writeFile(cmd, "");

  assert.throws(
    () => resolveCommandInvocation(cmd, ["--version"], {}, "win32"),
    /unsupported without a same-basename \.ps1 sibling/,
  );
  assert.throws(
    () => resolveCommandInvocation(path.join(root, "missing.bat"), [], {}, "win32"),
    /never enables shell parsing/,
  );
});
