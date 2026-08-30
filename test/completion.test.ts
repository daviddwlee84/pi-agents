import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { renderCompletion } from "../src/completion.ts";
import { commandExists } from "../src/process.ts";

const repoRoot = path.resolve(import.meta.dirname, "..");
const pia = path.join(repoRoot, "bin", "pia");
const plainEnv = { ...process.env };
for (const name of ["CLICOLOR_FORCE", "FORCE_COLOR", "NO_COLOR", "NODE_DISABLE_COLORS"]) delete plainEnv[name];

async function combo(root: string, id: string): Promise<void> {
  const comboDir = path.join(root, "combos", ...id.split("/"));
  await mkdir(path.join(comboDir, "agent"), { recursive: true });
  await writeFile(path.join(comboDir, "combo.json"), "{}\n");
}

async function fixture(t: TestContext): Promise<{ root: string; scripts: Record<string, string> }> {
  const temp = await mkdtemp(path.join(os.tmpdir(), "pia completion source's "));
  t.after(() => rm(temp, { recursive: true, force: true }));
  await combo(temp, "pi/base");
  await combo(temp, "pi/vanilla");
  await combo(temp, "omp/base");
  const scripts: Record<string, string> = {};
  for (const shell of ["bash", "zsh", "powershell"] as const) {
    const extension = shell === "powershell" ? "ps1" : shell;
    const script = path.join(temp, `pia.${extension}`);
    await writeFile(script, await renderCompletion(shell, temp));
    scripts[shell] = script;
  }
  return { root: temp, scripts };
}

test("completion command emits plain scripts for all supported shell names", () => {
  for (const shell of ["zsh", "bash", "powershell", "pwsh"]) {
    const result = spawnSync(pia, ["completion", shell], {
      cwd: repoRoot,
      env: { ...plainEnv, FORCE_COLOR: "1" },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /\u001b\[/);
    assert.match(result.stdout, /pia/);
    assert.doesNotMatch(result.stdout, /__PIA_DEFAULT_SOURCE_ROOT__/);
  }
  const unsupported = spawnSync(pia, ["completion", "fish"], { cwd: repoRoot, env: plainEnv, encoding: "utf8" });
  assert.equal(unsupported.status, 2);
  assert.match(unsupported.stderr, /zsh\|bash\|powershell/);
});

test("generated bash completion discovers live combos and filters fork targets", async (t) => {
  if (!commandExists("bash")) return t.skip("bash is not installed");
  const f = await fixture(t);
  const command = [
    'source "$1"',
    "_pia_combo_ids",
    "COMP_WORDS=(pia use pi/); COMP_CWORD=2; _pia; printf 'use:%s\\n' \"${COMPREPLY[@]}\"",
    "COMP_WORDS=(pia fork pi/base ''); COMP_CWORD=3; _pia; printf 'fork:%s\\n' \"${COMPREPLY[@]}\"",
    "COMP_WORDS=(pia use pi/base ''); COMP_CWORD=3; _pia; printf 'done:%s\\n' \"${#COMPREPLY[@]}\"",
    "COMP_WORDS=(pia run pi/base -- comb); COMP_CWORD=4; _pia; printf 'native:%s\\n' \"${COMPREPLY[@]}\"",
  ].join("; ");
  const first = spawnSync("bash", ["--noprofile", "--norc", "-c", command, "_", f.scripts.bash], {
    env: { ...plainEnv, PIA_SOURCE_ROOT: "" },
    cwd: f.root,
    encoding: "utf8",
  });
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /^pi\/base$/m);
  assert.match(first.stdout, /^omp\/base$/m);
  assert.match(first.stdout, /^use:pi\/base$/m);
  assert.doesNotMatch(first.stdout, /^use:omp\//m);
  assert.match(first.stdout, /^fork:pi\/vanilla$/m);
  assert.doesNotMatch(first.stdout, /^fork:omp\//m);
  assert.match(first.stdout, /^done:0$/m);
  assert.match(first.stdout, /^native:combos$/m);

  await combo(f.root, "omp/new");
  const refreshed = spawnSync("bash", ["--noprofile", "--norc", "-c", 'source "$1"; _pia_combo_ids', "_", f.scripts.bash], {
    env: { ...plainEnv, PIA_SOURCE_ROOT: "" },
    encoding: "utf8",
  });
  assert.equal(refreshed.status, 0, refreshed.stderr);
  assert.match(refreshed.stdout, /^omp\/new$/m);
});

test("generated zsh completion discovers combos from a safely quoted root", async (t) => {
  if (!commandExists("zsh")) return t.skip("zsh is not installed");
  const f = await fixture(t);
  const result = spawnSync("zsh", ["-f", "-c", 'source "$1"; _pia_combo_values; print -rl -- $reply', "_", f.scripts.zsh], {
    env: { ...plainEnv, PIA_SOURCE_ROOT: "" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split("\n"), ["pi/base", "pi/vanilla", "omp/base"]);

  const action = spawnSync("zsh", [
    "-f",
    "-c",
    'source "$1"; _describe() { local name="$4"; print -rl -- "${(@P)name}"; }; _pia_combo_ids -J -default-',
    "_",
    f.scripts.zsh,
  ], { env: { ...plainEnv, PIA_SOURCE_ROOT: "" }, encoding: "utf8" });
  assert.equal(action.status, 0, action.stderr);
  assert.deepEqual(action.stdout.trim().split("\n"), ["pi/base", "pi/vanilla", "omp/base"]);
});

test("generated PowerShell completion discovers combos and registers with TabExpansion2", async (t) => {
  const pwsh = commandExists("pwsh") ? "pwsh" : commandExists("powershell") ? "powershell" : undefined;
  if (!pwsh) return t.skip("PowerShell is not installed");
  const f = await fixture(t);
  const script = [
    '. $env:PIA_COMPLETION_TEST_SCRIPT',
    "Get-PiaCompletionComboId | ForEach-Object { \"helper:$_\" }",
    "$line = 'pia use '",
    "(TabExpansion2 $line $line.Length).CompletionMatches.CompletionText | ForEach-Object { \"blank:$_\" }",
    "$line = 'pia use pi/'",
    "(TabExpansion2 $line $line.Length).CompletionMatches.CompletionText | ForEach-Object { \"prefix:$_\" }",
  ].join("; ");
  const result = spawnSync(pwsh, ["-NoProfile", "-Command", script], {
    env: {
      ...plainEnv,
      PATH: `${path.join(repoRoot, "bin")}${path.delimiter}${plainEnv.PATH || ""}`,
      PIA_SOURCE_ROOT: "",
      PIA_COMPLETION_TEST_SCRIPT: f.scripts.powershell,
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^helper:omp\/base$/m);
  assert.match(result.stdout, /^blank:pi\/base$/m);
  assert.match(result.stdout, /^blank:omp\/base$/m);
  assert.match(result.stdout, /^prefix:pi\/base$/m);
  assert.match(result.stdout, /^prefix:pi\/vanilla$/m);
  assert.doesNotMatch(result.stdout, /^prefix:omp\//m);
});
