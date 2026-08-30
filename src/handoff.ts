import { createHash, randomBytes } from 'node:crypto';
import { promises as fs, type Stats } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { commandResult } from './process.ts';
import {
  buildActiveBranch,
  parseSessionFile,
  type ActiveSessionEntry,
  type Engine,
  type SessionEntry,
} from './sessions.ts';

export const DEFAULT_HANDOFF_MAX_BYTES = 128 * 1024;
export const FAILED_TOOL_EXCERPT_BYTES = 2 * 1024;

export interface HandoffCommandOptions {
  cwd?: string;
  input?: string;
}

export interface HandoffCommandResult {
  ok?: boolean;
  status?: number | null;
  exitCode?: number | null;
  code?: number | null;
  stdout?: string;
  stderr?: string;
}

export type HandoffCommandRunner = (
  command: string,
  args: string[],
  options: HandoffCommandOptions,
) => HandoffCommandResult | Promise<HandoffCommandResult>;

export interface GitProvenance {
  cwd?: string;
  branch: string;
  head: string;
  status: string;
  diffStat: string;
}

export interface HandoffSession {
  id: string;
  cwd: string;
  path?: string;
  filePath?: string;
  title?: string;
  entries: SessionEntry[];
  activeBranch?: ActiveSessionEntry[];
}

export interface HandoffBoundary {
  type: 'compaction' | 'reset_boundary';
  id: string;
  sourceIndex: number;
}

export interface RenderHandoffOptions {
  sourceEngine: Engine;
  sourceCombo: string;
  targetEngine?: Engine;
  targetCombo?: string;
  session: HandoffSession;
  branch?: ActiveSessionEntry[];
  goal: string;
  git: GitProvenance;
  maxBytes?: number;
}

export interface RenderedHandoff {
  content: string;
  bytes: number;
  boundary?: HandoffBoundary;
  totalBlocks: number;
  retainedBlocks: number;
  omittedBlocks: number;
  truncatedBlocks: number;
}

export interface CollectGitProvenanceOptions {
  cwd?: string;
  repoRoot?: string;
  commandRunner?: HandoffCommandRunner;
}

export interface CreateHandoffOptions {
  sourceEngine: Engine;
  sourceCombo: string;
  targetEngine?: Engine;
  targetCombo?: string;
  sessionPath: string;
  goal: string;
  stateRoot: string;
  repoRoot: string;
  projectCwd?: string;
  maxBytes?: number;
  commandRunner?: HandoffCommandRunner;
  redactorPath?: string;
  gitleaksConfig?: string;
}

export interface Handoff extends RenderedHandoff {
  artifactPath: string;
  sha256: string;
  source: {
    engine: Engine;
    combo: string;
    sessionId: string;
    sessionPath: string;
    cwd: string;
    title?: string;
    activeLeafId?: string;
  };
  target?: { engine: Engine; combo: string };
  projectCwd: string;
  redactionStatus: number | null;
  verificationStatus: number | null;
}

const COMBO_ID = /^(pi|omp)\/([a-z0-9](?:[a-z0-9._-]{0,58}[a-z0-9_-])?)$/;

type CodedError = Error & { code: string; details?: unknown };
type ConversationBlockKind = 'user' | 'assistant' | 'failed-tool' | 'compaction';

interface ConversationBlock {
  sourceIndex: number;
  kind: ConversationBlockKind;
  heading: string;
  body: string;
  required?: boolean;
}

interface SelectionResult {
  content: string;
  omittedBlocks: number;
  retainedBlocks: number;
  truncatedBlocks: number;
}

interface FittedResult extends SelectionResult {
  totalBlocks: number;
}

interface NormalizedCommandResult {
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
}

function fail(code: string, message: string, details?: unknown): never {
  const error = new Error(message) as CodedError;
  error.code = code;
  if (details !== undefined) error.details = details;
  throw error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function truncateUtf8Head(value: string, maxBytes: number, marker = '\n[… truncated …]'): string {
  if (utf8Bytes(value) <= maxBytes) return value;
  const markerBytes = utf8Bytes(marker);
  if (maxBytes <= markerBytes) {
    let result = '';
    for (const character of marker) {
      if (utf8Bytes(result + character) > maxBytes) break;
      result += character;
    }
    return result;
  }
  const budget = maxBytes - markerBytes;
  let result = '';
  let used = 0;
  for (const character of value) {
    const characterBytes = utf8Bytes(character);
    if (used + characterBytes > budget) break;
    result += character;
    used += characterBytes;
  }
  return `${result}${marker}`;
}

function textContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const texts: string[] = [];
  for (const part of content) {
    if (isRecord(part) && part.type === 'text' && typeof part.text === 'string') {
      texts.push(part.text);
    }
  }
  return texts.join('\n');
}

function toolNames(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  for (const part of content) {
    if (!isRecord(part)) continue;
    const isCall = ['toolCall', 'tool_call', 'toolUse', 'tool_use'].includes(String(part.type));
    if (!isCall || typeof part.name !== 'string' || part.name.trim() === '') continue;
    const name = part.name.trim();
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

function inlineCode(value: unknown): string {
  return `\`${String(value).replaceAll('`', "'").replace(/[\r\n]+/g, ' ')}\``;
}

function indented(value: unknown, emptyLabel: string): string {
  const normalized = String(value || '').trimEnd();
  const display = normalized === '' ? emptyLabel : normalized;
  return display.split('\n').map((line) => `    ${line}`).join('\n');
}

function messageBlock(entry: ActiveSessionEntry, sourceIndex: number): ConversationBlock | undefined {
  if (entry.type !== 'message' || !isRecord(entry.message)) return undefined;
  const message = entry.message;
  const role = message.role;
  if (role === 'user') {
    const body = textContent(message.content).trim();
    if (!body) return undefined;
    return { sourceIndex, kind: 'user', heading: '### User', body };
  }
  if (role === 'assistant') {
    const body = textContent(message.content).trim();
    const tools = toolNames(message.content);
    if (!body && tools.length === 0) return undefined;
    const toolsLine = tools.length > 0
      ? `Tools used: ${tools.map(inlineCode).join(', ')}`
      : '';
    return {
      sourceIndex,
      kind: 'assistant',
      heading: '### Assistant',
      body: [body, toolsLine].filter(Boolean).join('\n\n'),
    };
  }
  if (role === 'toolResult' || role === 'tool_result' || role === 'tool') {
    const isError = message.isError === true || message.is_error === true || message.status === 'error';
    if (!isError) return undefined;
    const toolName = typeof message.toolName === 'string'
      ? message.toolName
      : typeof message.name === 'string'
        ? message.name
        : 'unknown';
    const rawExcerpt = textContent(message.content).trim();
    const excerpt = truncateUtf8Head(
      rawExcerpt || '(no textual error output)',
      FAILED_TOOL_EXCERPT_BYTES,
      '\n[… failed tool output truncated …]',
    );
    return {
      sourceIndex,
      kind: 'failed-tool',
      heading: `### Failed tool: ${inlineCode(toolName)}`,
      body: excerpt,
    };
  }
  return undefined;
}

function selectConversationBlocks(branch: readonly ActiveSessionEntry[]): {
  blocks: ConversationBlock[];
  boundary?: HandoffBoundary;
} {
  let boundaryIndex = -1;
  let boundary: ActiveSessionEntry | undefined;
  for (let index = 0; index < branch.length; index += 1) {
    if (branch[index].type === 'compaction' || branch[index].type === 'reset_boundary') {
      boundaryIndex = index;
      boundary = branch[index];
    }
  }

  const blocks: ConversationBlock[] = [];
  if (boundary?.type === 'compaction' && typeof boundary.summary === 'string' && boundary.summary.trim()) {
    blocks.push({
      sourceIndex: boundaryIndex,
      kind: 'compaction',
      heading: '### Compaction summary',
      body: boundary.summary.trim(),
      required: true,
    });
  }

  const start = boundaryIndex + 1;
  for (let index = start; index < branch.length; index += 1) {
    const block = messageBlock(branch[index], index);
    if (block) blocks.push(block);
  }
  const boundaryType = boundary?.type;
  return {
    blocks,
    boundary: boundary && (boundaryType === 'compaction' || boundaryType === 'reset_boundary')
      ? { type: boundaryType, id: boundary.id, sourceIndex: boundaryIndex }
      : undefined,
  };
}

function renderBlock(block: ConversationBlock): string {
  return `${block.heading}\n\n${block.body}`;
}

function renderHeader({
  sourceEngine,
  sourceCombo,
  targetEngine,
  targetCombo,
  session,
  goal,
  git,
}: Omit<RenderHandoffOptions, 'branch' | 'maxBytes'>): string {
  const leaf = session.activeBranch?.at(-1)?.id || '(none)';
  return [
    '# Agent handoff',
    '',
    '## Goal',
    '',
    goal,
    '',
    '## Provenance',
    '',
    `- Source engine: ${inlineCode(sourceEngine)}`,
    `- Source combo: ${inlineCode(sourceCombo)}`,
    ...(targetEngine ? [`- Target engine: ${inlineCode(targetEngine)}`] : []),
    ...(targetCombo ? [`- Target combo: ${inlineCode(targetCombo)}`] : []),
    `- Session ID: ${inlineCode(session.id)}`,
    `- Session path: ${inlineCode(session.path || session.filePath || '(in-memory)')}`,
    `- Session cwd: ${inlineCode(session.cwd)}`,
    `- Active leaf: ${inlineCode(leaf)}`,
    ...(session.title ? [`- Session title: ${inlineCode(session.title)}`] : []),
    '',
    '## Repository',
    '',
    `- Project cwd: ${inlineCode(git.cwd || session.cwd)}`,
    `- Branch: ${inlineCode(git.branch || '(detached)')}`,
    `- HEAD: ${inlineCode(git.head)}`,
    '',
    '### Git status',
    '',
    indented(git.status, '(clean)'),
    '',
    '### Git diff stat',
    '',
    indented(git.diffStat, '(no diff)'),
    '',
    '## Conversation context',
  ].join('\n');
}

function renderSelection(
  header: string,
  blocks: readonly ConversationBlock[],
  included: ReadonlySet<number>,
  truncated: ReadonlyMap<ConversationBlock, ConversationBlock>,
  maxBytes: number,
): SelectionResult {
  const selected = blocks.filter((_, index) => included.has(index));
  const omittedBlocks = blocks.length - selected.length;
  const notes: string[] = [];
  if (omittedBlocks > 0) notes.push(`${omittedBlocks} earlier conversation block(s) omitted`);
  if (truncated.size > 0) notes.push(`${truncated.size} retained block(s) truncated`);
  const omission = notes.length > 0
    ? `\n\n> ${notes.join('; ')} to stay within the ${maxBytes}-byte handoff limit.`
    : '';
  const renderedBlocks = selected.map((block) => renderBlock(truncated.get(block) || block));
  const content = `${header}${omission}${renderedBlocks.length ? `\n\n${renderedBlocks.join('\n\n')}` : ''}\n`;
  return { content, omittedBlocks, retainedBlocks: selected.length, truncatedBlocks: truncated.size };
}

function truncateBlock(block: ConversationBlock, targetBytes: number): ConversationBlock | undefined {
  const prefix = `${block.heading}\n\n`;
  const marker = '\n[… retained block truncated …]';
  const bodyBudget = targetBytes - utf8Bytes(prefix);
  if (bodyBudget <= utf8Bytes(marker)) return undefined;
  return { ...block, body: truncateUtf8Head(block.body, bodyBudget, marker) };
}

function fitBlocks(
  header: string,
  blocks: readonly ConversationBlock[],
  maxBytes: number,
): FittedResult {
  const headerOnly = `${header}\n`;
  if (utf8Bytes(headerOnly) > maxBytes) {
    fail('PIA_HANDOFF_LIMIT_TOO_SMALL', 'Handoff limit cannot preserve the required goal and provenance');
  }
  const full = `${header}${blocks.length ? `\n\n${blocks.map(renderBlock).join('\n\n')}` : ''}\n`;
  if (utf8Bytes(full) <= maxBytes) {
    return {
      content: full,
      omittedBlocks: 0,
      retainedBlocks: blocks.length,
      truncatedBlocks: 0,
      totalBlocks: blocks.length,
    };
  }

  const included = new Set<number>();
  const truncated = new Map<ConversationBlock, ConversationBlock>();
  for (let index = 0; index < blocks.length; index += 1) {
    if (blocks[index].required) included.add(index);
  }
  const firstUser = blocks.findIndex((block) => block.kind === 'user');
  if (firstUser >= 0) included.add(firstUser);
  if (blocks.length > 0) included.add(blocks.length - 1);

  let result = renderSelection(header, blocks, included, truncated, maxBytes);
  while (utf8Bytes(result.content) > maxBytes) {
    const candidates = [...included]
      .map((index) => ({ index, block: truncated.get(blocks[index]) || blocks[index] }))
      .sort((left, right) => utf8Bytes(renderBlock(right.block)) - utf8Bytes(renderBlock(left.block)));
    const candidate = candidates[0];
    if (!candidate) {
      fail('PIA_HANDOFF_LIMIT_TOO_SMALL', 'Handoff limit cannot preserve required conversation context');
    }
    const overflow = utf8Bytes(result.content) - maxBytes;
    const currentBytes = utf8Bytes(renderBlock(candidate.block));
    const next = truncateBlock(candidate.block, Math.max(96, currentBytes - overflow - 64));
    if (!next || utf8Bytes(renderBlock(next)) >= currentBytes) {
      fail('PIA_HANDOFF_LIMIT_TOO_SMALL', 'Handoff limit cannot preserve required conversation context');
    }
    truncated.set(blocks[candidate.index], next);
    result = renderSelection(header, blocks, included, truncated, maxBytes);
  }

  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (included.has(index)) continue;
    const tentative = new Set(included);
    tentative.add(index);
    const next = renderSelection(header, blocks, tentative, truncated, maxBytes);
    if (utf8Bytes(next.content) <= maxBytes) included.add(index);
  }

  result = renderSelection(header, blocks, included, truncated, maxBytes);
  return { ...result, totalBlocks: blocks.length };
}

function integerStatus(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function normalizeCommandResult(result: unknown): NormalizedCommandResult {
  if (!isRecord(result)) return { ok: false, status: null, stdout: '', stderr: '' };
  const status = integerStatus(result.status)
    ?? integerStatus(result.exitCode)
    ?? integerStatus(result.code);
  return {
    ok: typeof result.ok === 'boolean' ? result.ok : status === 0,
    status,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
  };
}

async function capturedRun(
  commandRunner: HandoffCommandRunner,
  command: string,
  args: string[],
  options: HandoffCommandOptions,
  failureCode: string,
  failureLabel: string,
): Promise<NormalizedCommandResult> {
  let raw: HandoffCommandResult;
  try {
    raw = await commandRunner(command, args, options);
  } catch {
    fail(failureCode, `${failureLabel} failed; captured output was suppressed`);
  }
  const result = normalizeCommandResult(raw);
  if (!result.ok) {
    fail(failureCode, `${failureLabel} failed; captured output was suppressed`, { status: result.status });
  }
  return result;
}

export async function collectGitProvenance({
  cwd,
  repoRoot,
  commandRunner = commandResult as HandoffCommandRunner,
}: CollectGitProvenanceOptions = {}): Promise<GitProvenance> {
  const workingDirectory = path.resolve(cwd || repoRoot || '');
  const runGit = async (args: string[], label: string): Promise<string> => {
    const result = await capturedRun(
      commandRunner,
      'git',
      args,
      { cwd: workingDirectory },
      'PIA_GIT_PROVENANCE_FAILED',
      label,
    );
    return result.stdout.trimEnd();
  };
  const branch = await runGit(['branch', '--show-current'], 'Git branch discovery');
  const head = await runGit(['rev-parse', 'HEAD'], 'Git HEAD discovery');
  const status = await runGit(['status', '--short', '--untracked-files=all'], 'Git status discovery');
  const diffStat = await runGit(['diff', '--stat', '--no-ext-diff', 'HEAD'], 'Git diff-stat discovery');
  return { cwd: workingDirectory, branch: branch || '(detached)', head, status, diffStat };
}

/** Build deterministic Markdown. This pure step deliberately does not claim the output is secret-safe. */
export function renderHandoff({
  sourceEngine,
  sourceCombo,
  targetEngine,
  targetCombo,
  session,
  branch,
  goal,
  git,
  maxBytes = DEFAULT_HANDOFF_MAX_BYTES,
}: RenderHandoffOptions): RenderedHandoff {
  if (sourceEngine !== 'pi' && sourceEngine !== 'omp') {
    fail('PIA_INVALID_ENGINE', `Unsupported source engine: ${String(sourceEngine)}`);
  }
  const sourceMatch = typeof sourceCombo === 'string' ? sourceCombo.match(COMBO_ID) : undefined;
  if (!sourceMatch || sourceMatch[1] !== sourceEngine) {
    fail('PIA_INVALID_COMBO', 'sourceCombo must be a full combo ID matching sourceEngine');
  }
  if ((targetEngine === undefined) !== (targetCombo === undefined)) {
    fail('PIA_INVALID_COMBO', 'targetEngine and targetCombo must be supplied together');
  }
  if (targetEngine !== undefined) {
    const targetMatch = typeof targetCombo === 'string' ? targetCombo.match(COMBO_ID) : undefined;
    if ((targetEngine !== 'pi' && targetEngine !== 'omp') || !targetMatch || targetMatch[1] !== targetEngine) {
      fail('PIA_INVALID_COMBO', 'targetCombo must be a full combo ID matching targetEngine');
    }
  }
  if (typeof goal !== 'string' || goal.trim() === '') {
    fail('PIA_HANDOFF_GOAL_REQUIRED', 'A non-empty handoff goal is required');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    fail('PIA_INVALID_HANDOFF_LIMIT', 'maxBytes must be a positive safe integer');
  }
  if (!session || !git) fail('PIA_INVALID_HANDOFF', 'session and git provenance are required');

  const activeBranch = branch || session.activeBranch || buildActiveBranch(session);
  const normalizedSession: HandoffSession = { ...session, activeBranch };
  const selected = selectConversationBlocks(activeBranch);
  const header = renderHeader({
    sourceEngine,
    sourceCombo,
    targetEngine,
    targetCombo,
    session: normalizedSession,
    goal: goal.trim(),
    git,
  });
  const fitted = fitBlocks(header, selected.blocks, maxBytes);
  return {
    ...fitted,
    bytes: utf8Bytes(fitted.content),
    boundary: selected.boundary,
  };
}

async function assertRegularFile(filePath: string, code: string, label: string): Promise<void> {
  let stat: Stats;
  try {
    stat = await fs.stat(filePath);
  } catch {
    fail(code, `${label} is unavailable`);
  }
  if (!stat.isFile()) fail(code, `${label} is not a regular file`);
}

async function atomicSave(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await fs.chmod(path.dirname(filePath), 0o700);
  const temporary = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`,
  );
  try {
    await fs.writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await fs.chmod(temporary, 0o600);
    await fs.rename(temporary, filePath);
    await fs.chmod(filePath, 0o600);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

/**
 * Generate, redact, verify, and atomically persist a portable handoff artifact.
 * Captured scanner output is intentionally never returned or interpolated into errors.
 */
export async function createHandoff({
  sourceEngine,
  sourceCombo,
  targetEngine,
  targetCombo,
  sessionPath,
  goal,
  stateRoot,
  repoRoot,
  projectCwd,
  maxBytes = DEFAULT_HANDOFF_MAX_BYTES,
  commandRunner = commandResult as HandoffCommandRunner,
  redactorPath,
  gitleaksConfig,
}: CreateHandoffOptions): Promise<Handoff> {
  if (typeof stateRoot !== 'string' || stateRoot.trim() === '') {
    fail('PIA_INVALID_STATE_ROOT', 'stateRoot is required');
  }
  if (typeof repoRoot !== 'string' || repoRoot.trim() === '') {
    fail('PIA_INVALID_REPO_ROOT', 'repoRoot is required');
  }
  if (typeof sessionPath !== 'string' || !path.isAbsolute(sessionPath)) {
    fail('PIA_INVALID_SESSION_PATH', 'sessionPath must be absolute');
  }

  const absoluteRepoRoot = path.resolve(repoRoot);
  const scanner = path.resolve(
    redactorPath || path.join(
      absoluteRepoRoot,
      '.agents',
      'skills',
      'agent-history-hygiene',
      'assets',
      'redact_secrets.py',
    ),
  );
  const scannerConfig = path.resolve(gitleaksConfig || path.join(absoluteRepoRoot, '.gitleaks.toml'));
  await Promise.all([
    assertRegularFile(scanner, 'PIA_HANDOFF_REDACTOR_MISSING', 'Handoff redactor'),
    assertRegularFile(scannerConfig, 'PIA_HANDOFF_GITLEAKS_CONFIG_MISSING', 'Gitleaks config'),
  ]);

  const session = await parseSessionFile(sessionPath, { engine: sourceEngine });
  const absoluteProjectCwd = path.resolve(projectCwd || session.cwd);
  const git = await collectGitProvenance({ cwd: absoluteProjectCwd, commandRunner });
  const rendered = renderHandoff({
    sourceEngine,
    sourceCombo,
    targetEngine,
    targetCombo,
    session,
    goal,
    git,
    maxBytes,
  });

  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'pia-handoff-'));
  const temporaryMarkdown = path.join(temporaryDirectory, 'handoff.md');
  try {
    await fs.writeFile(temporaryMarkdown, rendered.content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await fs.chmod(temporaryMarkdown, 0o600);

    const redactor = await capturedRun(
      commandRunner,
      'python3',
      [scanner, '--fix', '--working-dir', '--paths', temporaryDirectory],
      { cwd: absoluteRepoRoot },
      'PIA_HANDOFF_REDACTION_FAILED',
      'Handoff redaction',
    );
    const safeContent = await fs.readFile(temporaryMarkdown, 'utf8');
    if (utf8Bytes(safeContent) > maxBytes) {
      fail('PIA_HANDOFF_LIMIT_EXCEEDED', 'Redacted handoff exceeds maxBytes');
    }

    const verification = await capturedRun(
      commandRunner,
      'gitleaks',
      ['stdin', '--config', scannerConfig, '--no-banner', '--no-color', '--redact=100', '--exit-code', '1'],
      { cwd: absoluteRepoRoot, input: safeContent },
      'PIA_HANDOFF_SECRET_SCAN_FAILED',
      'Handoff secret verification',
    );

    const digest = createHash('sha256').update(safeContent).digest('hex');
    const safeSessionId = session.id.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80) || 'session';
    const safeComboId = sourceCombo.replace('/', '-');
    const artifactName = `${safeComboId}-${safeSessionId}-${digest.slice(0, 12)}.md`;
    const artifactPath = path.join(path.resolve(stateRoot), 'handoffs', artifactName);
    await atomicSave(artifactPath, safeContent);

    return {
      artifactPath,
      content: safeContent,
      bytes: utf8Bytes(safeContent),
      sha256: digest,
      source: {
        engine: sourceEngine,
        combo: sourceCombo,
        sessionId: session.id,
        sessionPath: session.path,
        cwd: session.cwd,
        title: session.title,
        activeLeafId: session.activeBranch.at(-1)?.id,
      },
      target: targetEngine && targetCombo ? { engine: targetEngine, combo: targetCombo } : undefined,
      projectCwd: absoluteProjectCwd,
      boundary: rendered.boundary,
      totalBlocks: rendered.totalBlocks,
      retainedBlocks: rendered.retainedBlocks,
      omittedBlocks: rendered.omittedBlocks,
      truncatedBlocks: rendered.truncatedBlocks,
      redactionStatus: redactor.status,
      verificationStatus: verification.status,
    };
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
  }
}
