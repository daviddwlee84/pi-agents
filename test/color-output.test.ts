import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const pia = path.join(repoRoot, "bin", "pia");
const ANSI = /\u001b\[/;

function colorEnv(values: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const name of ["CLICOLOR_FORCE", "FORCE_COLOR", "NO_COLOR", "NODE_DISABLE_COLORS"]) delete env[name];
  return { ...env, ...values };
}

test("human output is colorful only when terminal color is enabled", () => {
  const plain = spawnSync(pia, ["list"], { cwd: repoRoot, env: colorEnv(), encoding: "utf8" });
  assert.equal(plain.status, 0, plain.stderr);
  assert.doesNotMatch(plain.stdout, ANSI);

  const forced = spawnSync(pia, ["list"], {
    cwd: repoRoot,
    env: colorEnv({ FORCE_COLOR: "1" }),
    encoding: "utf8",
  });
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(forced.stdout, ANSI);

  const disabled = spawnSync(pia, ["doctor"], {
    cwd: repoRoot,
    env: colorEnv({ NO_COLOR: "1" }),
    encoding: "utf8",
  });
  assert.doesNotMatch(disabled.stdout, ANSI);
});

test("machine-readable and raw-value commands never emit ANSI", () => {
  const env = colorEnv({ FORCE_COLOR: "1", PIA_COMBO: "pi/base" });
  for (const args of [["list", "--json"], ["doctor", "--json"], ["current"], ["--version"], ["completion", "bash"]]) {
    const result = spawnSync(pia, args, { cwd: repoRoot, env, encoding: "utf8" });
    assert.equal(result.status, 0, `${args.join(" ")}: ${result.stderr}`);
    assert.doesNotMatch(result.stdout, ANSI, args.join(" "));
  }
});

test("fatal errors color only their stderr prefix", () => {
  const result = spawnSync(pia, ["not-a-command"], {
    cwd: repoRoot,
    env: colorEnv({ CLICOLOR_FORCE: "1" }),
    encoding: "utf8",
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^\u001b\[31mpia:\u001b\[39m Unknown command/);
});
