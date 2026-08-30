import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import { style, ui } from "../src/ui.ts";

const COLOR_ENV = ["CLICOLOR_FORCE", "FORCE_COLOR", "NO_COLOR", "NODE_DISABLE_COLORS"] as const;

type ColorEnvironment = Partial<Record<(typeof COLOR_ENV)[number], string>>;
type TestStream = PassThrough & {
  isTTY: boolean;
  hasColors: () => boolean;
};

function testStream(hasColors: boolean): TestStream {
  const stream = new PassThrough() as TestStream;
  stream.isTTY = hasColors;
  stream.hasColors = () => hasColors;
  return stream;
}

function withColorEnvironment<T>(environment: ColorEnvironment, callback: () => T): T {
  const previous = Object.fromEntries(COLOR_ENV.map((name) => [name, process.env[name]]));
  for (const name of COLOR_ENV) delete process.env[name];
  for (const [name, value] of Object.entries(environment)) {
    if (value !== undefined) process.env[name] = value;
  }
  try {
    return callback();
  } finally {
    for (const name of COLOR_ENV) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test("semantic helpers use a stable palette", () => {
  withColorEnvironment({ CLICOLOR_FORCE: "1" }, () => {
    const stream = testStream(false);
    assert.equal(ui.accent("id", { stream }), "\u001b[36mid\u001b[39m");
    assert.equal(ui.success("ok", { stream }), "\u001b[32mok\u001b[39m");
    assert.equal(ui.warning("warn", { stream }), "\u001b[33mwarn\u001b[39m");
    assert.equal(ui.danger("error", { stream }), "\u001b[31merror\u001b[39m");
    assert.equal(ui.muted("detail", { stream }), "\u001b[90mdetail\u001b[39m");
  });
});

test("automatic color detection follows the selected output stream", () => {
  withColorEnvironment({}, () => {
    assert.match(style("success", "tty", { stream: testStream(true) }), /^\u001b\[/);
    assert.equal(style("success", "pipe", { stream: testStream(false) }), "pipe");
  });
});

test("NO_COLOR and NODE_DISABLE_COLORS suppress automatic color", () => {
  for (const environment of [{ NO_COLOR: "1" }, { NODE_DISABLE_COLORS: "1" }]) {
    withColorEnvironment(environment, () => {
      assert.equal(style("danger", "plain", { stream: testStream(true) }), "plain");
    });
  }
});

test("FORCE_COLOR controls color on streams without TTY support", () => {
  withColorEnvironment({ FORCE_COLOR: "1", NO_COLOR: "1" }, () => {
    assert.match(style("accent", "forced", { stream: testStream(false) }), /^\u001b\[/);
  });
  withColorEnvironment({ FORCE_COLOR: "0" }, () => {
    assert.equal(style("accent", "plain", { stream: testStream(true) }), "plain");
  });
});

test("nonzero CLICOLOR_FORCE forces color and takes precedence over disable variables", () => {
  withColorEnvironment({ CLICOLOR_FORCE: "1", NO_COLOR: "1", NODE_DISABLE_COLORS: "1", FORCE_COLOR: "0" }, () => {
    assert.match(style("warning", "forced", { stream: testStream(false) }), /^\u001b\[/);
  });
  withColorEnvironment({ CLICOLOR_FORCE: "0" }, () => {
    assert.equal(style("warning", "plain", { stream: testStream(false) }), "plain");
  });
});
