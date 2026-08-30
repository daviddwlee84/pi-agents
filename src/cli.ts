import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  acknowledgeParent,
  comboDigest,
  deriveCombo,
  lineageInfo,
  listCombos,
  loadCombo,
  renderComboTree,
} from "./combos.ts";
import { renderCompletion } from "./completion.ts";
import { applyCombo, runCombo, runtimeContext, statusCombo } from "./harness.ts";
import { createHandoff } from "./handoff.ts";
import { getConfigRoot, getSourceRoot, getStateRoot } from "./paths.ts";
import { commandExists, commandResult } from "./process.ts";
import { diffRuntime, diffTrees, scanTree } from "./runtime.ts";
import { readSelection, resolveSelectedCombo, saveSelection } from "./selection.ts";
import { assertForkCompatible, listSessions, resolveSession, sessionLeafDir } from "./sessions.ts";
import { ui, type UiTone } from "./ui.ts";

const HELP = `pia — Git-managed Pi and Oh My Pi harness combos

Usage:
  pia run [combo] -- [native args...]
  pia use <combo>
  pia current
  pia list [--tree] [--json]
  pia derive <parent> <child> [--description TEXT]
  pia lineage <combo> [--ack] [--json]
  pia status <combo> [--json]
  pia diff <combo> [--runtime|--parent] [--json]
  pia apply <combo> [--dry-run] [--force] [--json]
  pia sessions <combo> [--json]
  pia fork <from> <to> (--session ID|PATH | --latest) -- [target args...]
  pia handoff <from> <to> (--session ID|PATH | --latest) --goal TEXT
              [--max-bytes N] [--no-run] -- [target args...]
  pia doctor [--json]
  pia completion <zsh|bash|powershell>

Selection precedence: explicit combo, PIA_COMBO, then \`pia use\`.
`;

type Env = NodeJS.ProcessEnv;
type Combo = Awaited<ReturnType<typeof loadCombo>>;
type RuntimeStatus = Awaited<ReturnType<typeof statusCombo>>["status"];
type ApplyResult = Awaited<ReturnType<typeof applyCombo>>["result"];
type Severity = "error" | "warning";
interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
  severity: Severity;
}

const stdoutStyle = { stream: process.stdout } as const;
const stderrStyle = { stream: process.stderr } as const;

function tone(toneName: UiTone, value: string, stream: NodeJS.WritableStream = process.stdout): string {
  return ui[toneName](value, { stream });
}

function maturityTone(maturity: string): UiTone {
  if (maturity === "production") return "success";
  if (maturity === "learning") return "warning";
  return "accent";
}

function stateTone(state: string): UiTone {
  if (["ok", "clean", "applied", "unchanged", "reviewed", "added"].includes(state)) return "success";
  if (["error", "blocked", "refused", "runtime-drift", "conflict", "removed"].includes(state)) return "danger";
  return "warning";
}

function actionTone(action: string): UiTone {
  if (["blocked", "remove", "forget"].includes(action)) return "danger";
  if (["write", "adopt", "ensure-target", "write-manifest"].includes(action)) return "success";
  return "warning";
}

function styleTree(tree: string): string {
  return tree.split("\n").map((line) => line
    .replace(/(?:pi|omp)\/[a-z0-9][a-z0-9._-]*/u, (id) => ui.accent(id, stdoutStyle))
    .replace(/\[(experimental|learning|production)\]/u, (label, maturity: string) =>
      tone(maturityTone(maturity), label)))
    .join("\n");
}

function printHelp(): void {
  const rendered = HELP
    .replace(/^pia —/u, `${ui.accent("pia", stdoutStyle)} —`)
    .replace(/^(Usage:|Selection precedence:)/gmu, (label) => ui.accent(label, stdoutStyle));
  process.stdout.write(rendered);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function takeFlag(args: string[], name: string): boolean {
  const index = args.indexOf(name);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

function takeOption(args: string[], name: string): string | undefined {
  const equalsIndex = args.findIndex((arg) => arg.startsWith(`${name}=`));
  if (equalsIndex !== -1) {
    const value = args.splice(equalsIndex, 1)[0];
    return value?.slice(name.length + 1);
  }
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  if (index + 1 >= args.length) throw new Error(`${name} requires a value`);
  const [, value] = args.splice(index, 2);
  return value;
}

function splitPassthrough(args: string[]): { own: string[]; passthrough: string[] } {
  const index = args.indexOf("--");
  if (index === -1) return { own: [...args], passthrough: [] };
  return { own: args.slice(0, index), passthrough: args.slice(index + 1) };
}

function assertNoTargetSessionRouting(args: string[], operation: string): void {
  const reserved = new Set(["--continue", "-c", "--resume", "-r", "--session", "--fork", "--session-dir", "--no-session"]);
  for (const arg of args) {
    if (arg === "--") break;
    const flag = arg.includes("=") ? arg.slice(0, arg.indexOf("=")) : arg;
    if (reserved.has(flag)) {
      throw new Error(`${operation} owns target session creation; remove conflicting native flag ${flag}`);
    }
  }
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printStatus(status: RuntimeStatus): void {
  process.stdout.write(`${ui.muted("state:", stdoutStyle)} ${tone(stateTone(status.state), status.state)}\n`);
  process.stdout.write(`${ui.muted("source:", stdoutStyle)} ${ui.accent(status.sourceDir, stdoutStyle)}\n`);
  process.stdout.write(`${ui.muted("runtime:", stdoutStyle)} ${ui.accent(status.targetDir, stdoutStyle)}\n`);
  for (const file of status.files.filter((item) => item.status !== "clean")) {
    const label = tone(stateTone(file.status), file.status.padEnd(18));
    const reason = file.reason ? ` ${ui.muted(`(${file.reason})`, stdoutStyle)}` : "";
    process.stdout.write(`${label} ${ui.accent(file.path, stdoutStyle)}${reason}\n`);
  }
}

function printActions(result: ApplyResult): void {
  const outcome = result.dryRun ? "planned" : result.applied ? "applied" : "unchanged";
  process.stdout.write(`${tone(stateTone(outcome), outcome)}: ${result.actions.length} action(s)\n`);
  for (const action of result.actions) {
    const suffix = "path" in action && action.path ? ` ${ui.accent(action.path, stdoutStyle)}` : "";
    const classification = "classification" in action && action.classification
      ? ` ${tone(stateTone(action.classification), `[${action.classification}]`)}`
      : "";
    process.stdout.write(`${tone(actionTone(action.action), action.action)}${suffix}${classification}\n`);
  }
  if (!result.ok) process.stdout.write(`${ui.danger("refused:", stdoutStyle)} ${result.reason}\n`);
}

async function resolveRequiredSession({
  combo,
  stateRoot,
  cwd,
  selector,
  latest,
}: {
  combo: Combo;
  stateRoot: string;
  cwd: string;
  selector?: string;
  latest: boolean;
}) {
  const sessionDir = sessionLeafDir({
    stateRoot,
    engine: combo.engine,
    comboName: combo.name,
    cwd,
    history: combo.metadata.history,
  });
  const session = await resolveSession({ sessionDir, selector, latest, engine: combo.engine });
  return { sessionDir, session };
}

async function cmdRun(sourceRoot: string, stateRoot: string, args: string[], env: Env): Promise<void> {
  const { own, passthrough } = splitPassthrough(args);
  if (own.length > 1) throw new Error("run accepts at most one combo before --");
  const combo = await resolveSelectedCombo(sourceRoot, own[0], env);
  if (combo.metadata.derivedFrom) {
    const parent = await loadCombo(sourceRoot, combo.metadata.derivedFrom);
    const currentParentDigest = await comboDigest(parent);
    if (currentParentDigest !== combo.metadata.parentDigest) {
      process.stderr.write(
        `${ui.warning("pia: warning:", stderrStyle)} ${ui.accent(combo.id, stderrStyle)} parent ` +
        `${ui.accent(parent.id, stderrStyle)} changed since last review\n`,
      );
    }
  }
  const result = await runCombo({ combo, stateRoot, env, userArgs: passthrough });
  process.exitCode = result.exitCode;
}

async function cmdList(sourceRoot: string, args: string[]): Promise<void> {
  const json = takeFlag(args, "--json");
  const tree = takeFlag(args, "--tree");
  if (args.length) throw new Error(`Unknown list argument: ${args[0]}`);
  const combos = await listCombos(sourceRoot);
  if (json) {
    printJson(combos.map((combo) => ({ id: combo.id, ...combo.metadata })));
  } else if (tree) {
    process.stdout.write(`${styleTree(renderComboTree(combos))}\n`);
  } else {
    for (const combo of combos) {
      process.stdout.write(
        `${ui.accent(combo.id, stdoutStyle)}\t${tone(maturityTone(combo.metadata.maturity), combo.metadata.maturity)}` +
        `\t${ui.muted(combo.metadata.description, stdoutStyle)}\n`,
      );
    }
  }
}

async function cmdLineage(sourceRoot: string, args: string[]): Promise<void> {
  const json = takeFlag(args, "--json");
  const ack = takeFlag(args, "--ack");
  if (args.length !== 1) throw new Error("Usage: pia lineage <combo> [--ack]");
  if (ack) await acknowledgeParent(sourceRoot, args[0]);
  const info = await lineageInfo(sourceRoot, args[0]);
  if (json) {
    printJson({
      combo: info.combo.id,
      ancestors: info.ancestors,
      descendants: info.descendants,
    });
    return;
  }
  process.stdout.write(`${ui.accent(info.combo.id, stdoutStyle)}\n`);
  for (const ancestor of info.ancestors) {
    const review = ancestor.reviewed ? "reviewed" : "changed since review";
    process.stdout.write(
      `${ui.muted("  <-", stdoutStyle)} ${ui.accent(ancestor.id, stdoutStyle)} ` +
      `${tone(stateTone(review), `(${review})`)}\n`,
    );
  }
  for (const child of info.descendants) {
    process.stdout.write(`${ui.muted("  ->", stdoutStyle)} ${ui.accent(child, stdoutStyle)}\n`);
  }
}

async function cmdStatus(sourceRoot: string, stateRoot: string, args: string[], env: Env): Promise<void> {
  const json = takeFlag(args, "--json");
  if (args.length !== 1) throw new Error("Usage: pia status <combo>");
  const combo = await loadCombo(sourceRoot, args[0]);
  const result = await statusCombo({ combo, stateRoot, env });
  if (json) printJson(result);
  else printStatus(result.status);
  if (result.status.state === "blocked") process.exitCode = 1;
}

async function cmdDiff(sourceRoot: string, stateRoot: string, args: string[], env: Env): Promise<void> {
  const json = takeFlag(args, "--json");
  const parentMode = takeFlag(args, "--parent");
  const runtimeMode = takeFlag(args, "--runtime");
  if (parentMode && runtimeMode) throw new Error("Choose either --parent or --runtime");
  if (args.length !== 1) throw new Error("Usage: pia diff <combo> [--runtime|--parent]");
  const combo = await loadCombo(sourceRoot, args[0]);
  if (parentMode) {
    if (!combo.metadata.derivedFrom) throw new Error(`${combo.id} has no parent`);
    const parent = await loadCombo(sourceRoot, combo.metadata.derivedFrom);
    const result = await diffTrees({ sourceDir: combo.agentDir, parentDir: parent.agentDir });
    if (json) return printJson(result);
    for (const file of result.files.filter((item) => item.status !== "unchanged")) {
      process.stdout.write(
        `${tone(stateTone(file.status), file.status.padEnd(9))} ${ui.accent(file.path, stdoutStyle)}\n`,
      );
    }
    if (result.counts.total === result.counts.unchanged) {
      process.stdout.write(`${ui.success("No parent differences.", stdoutStyle)}\n`);
    }
    return;
  }
  const context = await runtimeContext({ combo, stateRoot, env });
  const result = await diffRuntime({
    sourceDir: combo.agentDir,
    targetDir: context.targetDir,
    manifestPath: context.manifestPath,
  });
  if (json) return printJson(result);
  printStatus(result.runtime);
}

async function cmdApply(sourceRoot: string, stateRoot: string, args: string[], env: Env): Promise<void> {
  const json = takeFlag(args, "--json");
  const dryRun = takeFlag(args, "--dry-run");
  const force = takeFlag(args, "--force");
  if (args.length !== 1) throw new Error("Usage: pia apply <combo> [--dry-run] [--force]");
  const combo = await loadCombo(sourceRoot, args[0]);
  const applied = await applyCombo({ combo, stateRoot, env, dryRun, force });
  if (json) printJson(applied);
  else printActions(applied.result);
  if (!applied.result.ok) process.exitCode = 1;
}

async function cmdSessions(sourceRoot: string, stateRoot: string, args: string[]): Promise<void> {
  const json = takeFlag(args, "--json");
  if (args.length !== 1) throw new Error("Usage: pia sessions <combo>");
  const combo = await loadCombo(sourceRoot, args[0]);
  const sessionDir = sessionLeafDir({
    stateRoot,
    engine: combo.engine,
    comboName: combo.name,
    cwd: process.cwd(),
    history: combo.metadata.history,
  });
  const sessions = await listSessions({ sessionDir, engine: combo.engine });
  if (json) printJson(sessions);
  else {
    for (const session of sessions) {
      process.stdout.write(`${session.id}\t${session.title || "(untitled)"}\t${session.mtime || ""}\t${session.path}\n`);
    }
  }
}

async function cmdFork(sourceRoot: string, stateRoot: string, args: string[], env: Env): Promise<void> {
  const { own, passthrough } = splitPassthrough(args);
  const latest = takeFlag(own, "--latest");
  const selector = takeOption(own, "--session");
  if (own.length !== 2 || (latest ? 1 : 0) + (selector ? 1 : 0) !== 1) {
    throw new Error("Usage: pia fork <from> <to> (--session ID|PATH | --latest) -- [target args]");
  }
  const sourceCombo = await loadCombo(sourceRoot, own[0]);
  const targetCombo = await loadCombo(sourceRoot, own[1]);
  assertNoTargetSessionRouting(passthrough, "pia fork");
  assertForkCompatible(sourceCombo.engine, targetCombo.engine);
  const { session } = await resolveRequiredSession({
    combo: sourceCombo,
    stateRoot,
    cwd: process.cwd(),
    selector,
    latest,
  });
  const result = await runCombo({
    combo: targetCombo,
    stateRoot,
    cwd: session.cwd,
    env,
    userArgs: ["--fork", session.path, ...passthrough],
  });
  process.exitCode = result.exitCode;
}

async function cmdHandoff(sourceRoot: string, stateRoot: string, args: string[], env: Env): Promise<void> {
  const { own, passthrough } = splitPassthrough(args);
  const latest = takeFlag(own, "--latest");
  const selector = takeOption(own, "--session");
  const goal = takeOption(own, "--goal");
  const maxBytesRaw = takeOption(own, "--max-bytes");
  const noRun = takeFlag(own, "--no-run");
  if (own.length !== 2 || !goal || (latest ? 1 : 0) + (selector ? 1 : 0) !== 1) {
    throw new Error("Usage: pia handoff <from> <to> (--session ID|PATH | --latest) --goal TEXT [--no-run]");
  }
  const maxBytes = maxBytesRaw === undefined ? 128 * 1024 : Number(maxBytesRaw);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 4096) throw new Error("--max-bytes must be an integer of at least 4096");
  const sourceCombo = await loadCombo(sourceRoot, own[0]);
  const targetCombo = await loadCombo(sourceRoot, own[1]);
  assertNoTargetSessionRouting(passthrough, "pia handoff");
  const { session } = await resolveRequiredSession({
    combo: sourceCombo,
    stateRoot,
    cwd: process.cwd(),
    selector,
    latest,
  });
  const redactorPath = path.join(sourceRoot, ".agents", "skills", "agent-history-hygiene", "assets", "redact_secrets.py");
  const handoff = await createHandoff({
    sourceEngine: sourceCombo.engine,
    sourceCombo: sourceCombo.id,
    targetEngine: targetCombo.engine,
    targetCombo: targetCombo.id,
    sessionPath: session.path,
    goal,
    stateRoot,
    repoRoot: sourceRoot,
    maxBytes,
    redactorPath,
    gitleaksConfig: path.join(sourceRoot, ".gitleaks.toml"),
  });
  process.stdout.write(`${handoff.artifactPath}\n`);
  if (noRun) return;
  const initialPrompt = `Continue from the attached pia handoff. Treat it as lossy historical context, verify the current repository state, and pursue this goal: ${goal}`;
  const result = await runCombo({
    combo: targetCombo,
    stateRoot,
    cwd: session.cwd,
    env,
    userArgs: [...passthrough, `@${handoff.artifactPath}`, initialPrompt],
  });
  process.exitCode = result.exitCode;
}

async function cmdDoctor(sourceRoot: string, stateRoot: string, args: string[], env: Env): Promise<void> {
  const json = takeFlag(args, "--json");
  if (args.length) throw new Error(`Unknown doctor argument: ${args[0]}`);
  const checks: DoctorCheck[] = [];
  const add = (name: string, ok: boolean, detail: string, severity: Severity = "error") => {
    checks.push({ name, ok, detail, severity });
  };
  const [major, minor] = process.versions.node.split(".").map(Number);
  add("node", major > 22 || (major === 22 && minor >= 19), process.versions.node);
  add("git", Boolean(commandExists("git")), commandExists("git") || "not found");
  add("python3", Boolean(commandExists("python3")), commandExists("python3") || "not found", "warning");
  add("gitleaks", Boolean(commandExists("gitleaks")), commandExists("gitleaks") || "not found", "warning");
  for (const engine of ["pi", "omp"]) {
    const binary = engine === "pi" ? env.PIA_PI_BIN || "pi" : env.PIA_OMP_BIN || "omp";
    const probe = commandResult(binary, ["--version"], { env });
    add(engine, probe.ok, probe.ok ? (probe.stdout || probe.stderr).trim() : "not installed", "warning");
  }
  try {
    const combos = await listCombos(sourceRoot);
    for (const combo of combos) await scanTree(combo.agentDir);
    add("combos", true, `${combos.length} valid`);
  } catch (error) {
    add("combos", false, errorMessage(error));
  }
  try {
    const selected = env.PIA_COMBO || (await readSelection(env));
    if (selected) await loadCombo(sourceRoot, selected);
    add("selection", true, selected || "none", "warning");
  } catch (error) {
    add("selection", false, errorMessage(error));
  }
  add("sourceRoot", true, sourceRoot);
  add("stateRoot", true, stateRoot);
  add("configRoot", true, getConfigRoot(env));
  if (json) printJson({ checks });
  else {
    for (const check of checks) {
      const label = check.ok ? "ok" : check.severity === "warning" ? "warn" : "error";
      process.stdout.write(
        `${tone(stateTone(label), label)}\t${ui.accent(check.name, stdoutStyle)}\t` +
        `${ui.muted(check.detail, stdoutStyle)}\n`,
      );
    }
  }
  if (checks.some((check) => !check.ok && check.severity === "error")) process.exitCode = 1;
}

export async function main(argv: string[], env: Env = process.env): Promise<void> {
  const sourceRoot = getSourceRoot(env);
  const stateRoot = getStateRoot(env);
  const args = [...argv];
  if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    printHelp();
    return;
  }
  if (args[0] === "--version" || args[0] === "-V") {
    const pkg = JSON.parse(await readFile(path.join(sourceRoot, "package.json"), "utf8")) as { version: string };
    process.stdout.write(`${pkg.version}\n`);
    return;
  }
  const command = args.shift();
  if (!command) return await cmdRun(sourceRoot, stateRoot, [], env);
  if (command === "run") return await cmdRun(sourceRoot, stateRoot, args, env);
  if (command === "use") {
    if (args.length !== 1) throw new Error("Usage: pia use <combo>");
    const file = await saveSelection(sourceRoot, args[0], env);
    process.stdout.write(`${args[0]}\n${file}\n`);
    return;
  }
  if (command === "current") {
    const selected = env.PIA_COMBO || (await readSelection(env));
    if (!selected) throw new Error("No combo selected");
    await loadCombo(sourceRoot, selected);
    process.stdout.write(`${selected}\n`);
    return;
  }
  if (command === "list") return await cmdList(sourceRoot, args);
  if (command === "derive") {
    const description = takeOption(args, "--description");
    if (args.length !== 2) throw new Error("Usage: pia derive <parent> <child> [--description TEXT]");
    const combo = await deriveCombo(sourceRoot, args[0], args[1], description);
    process.stdout.write(`${combo.id}\n`);
    return;
  }
  if (command === "lineage") return await cmdLineage(sourceRoot, args);
  if (command === "status") return await cmdStatus(sourceRoot, stateRoot, args, env);
  if (command === "diff") return await cmdDiff(sourceRoot, stateRoot, args, env);
  if (command === "apply") return await cmdApply(sourceRoot, stateRoot, args, env);
  if (command === "sessions") return await cmdSessions(sourceRoot, stateRoot, args);
  if (command === "fork") return await cmdFork(sourceRoot, stateRoot, args, env);
  if (command === "handoff") return await cmdHandoff(sourceRoot, stateRoot, args, env);
  if (command === "doctor") return await cmdDoctor(sourceRoot, stateRoot, args, env);
  if (command === "completion") {
    if (args.length !== 1) throw new Error("Usage: pia completion <zsh|bash|powershell>");
    process.stdout.write(await renderCompletion(args[0]));
    return;
  }
  throw new Error(`Unknown command ${command}; run pia --help`);
}
