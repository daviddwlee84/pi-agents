import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { promises as fs, type Dirent } from 'node:fs';
import path from 'node:path';

export type Engine = 'pi' | 'omp';

export type History =
  | { mode: 'isolated' }
  | { mode: 'shared'; group: string };

/** Alias for callers that prefer the configuration-oriented name. */
export type HistoryPolicy = History;

export type SessionEntry = Record<string, unknown>;

export type ActiveSessionEntry = SessionEntry & {
  id: string;
  parentId?: string | null;
};

export type SessionHeader = SessionEntry & {
  type: 'session';
  id: string;
  cwd: string;
  title?: string;
};

export type OmpTitleSlot = SessionEntry & {
  type: 'title';
  v: 1;
  title: string;
  updatedAt: string;
  pad: string;
  source?: 'auto' | 'user';
};

export interface ParsedSession {
  engine?: Engine;
  title?: string;
  titleSlot?: OmpTitleSlot;
  header: SessionHeader;
  id: string;
  cwd: string;
  entries: SessionEntry[];
  activeBranch: ActiveSessionEntry[];
}

export interface ParsedSessionFile extends ParsedSession {
  path: string;
  filePath: string;
  mtime: Date;
  mtimeMs: number;
  size: number;
}

export interface SessionLeafOptions {
  stateRoot: string;
  engine: Engine;
  comboName: string;
  cwd: string;
  history: History;
}

export interface ParseSessionOptions {
  engine?: Engine;
  filePath?: string;
}

export interface ParseSessionFileOptions extends ParseSessionOptions {
  filePath?: string;
}

export interface ListSessionsOptions {
  sessionDir?: string;
  engine?: Engine;
}

export interface ResolveSessionOptions extends ListSessionsOptions {
  selector?: string;
  latest?: boolean;
}

export interface ForkCompatibilityOptions {
  sourceEngine?: Engine;
  targetEngine?: Engine;
  source?: { engine?: Engine };
}

const SAFE_NAME = /^[a-z0-9](?:[a-z0-9._-]{0,58}[a-z0-9_-])?$/;
const OMP_TITLE_SLOT_BYTES = 256;
const PROJECT_BASENAME_MAX_CHARS = 120;

type CodedError = Error & { code: string; details?: unknown };

function fail(code: string, message: string, details?: unknown): never {
  const error = new Error(message) as CodedError;
  error.code = code;
  if (details !== undefined) error.details = details;
  throw error;
}

function isRecord(value: unknown): value is SessionEntry {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

function requireSafeName(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SAFE_NAME.test(value)) {
    fail(
      'PIA_INVALID_SESSION_SCOPE',
      `${label} must be 1-60 lowercase safe-name characters and must not end with a dot`,
    );
  }
  return value;
}

function requireEngine(engine: unknown): Engine {
  if (engine !== 'pi' && engine !== 'omp') {
    fail('PIA_INVALID_ENGINE', `Unsupported session engine: ${String(engine)}`);
  }
  return engine;
}

function parseLine(line: string, lineNumber: number, filePath: string): SessionEntry {
  if (line.trim() === '') {
    fail('PIA_INVALID_SESSION', `Blank JSONL record at line ${lineNumber} in ${filePath}`);
  }
  try {
    const value: unknown = JSON.parse(line);
    if (!isRecord(value)) {
      fail('PIA_INVALID_SESSION', `JSONL record at line ${lineNumber} is not an object in ${filePath}`);
    }
    return value;
  } catch (error) {
    if (hasErrorCode(error, 'PIA_INVALID_SESSION')) throw error;
    fail('PIA_INVALID_SESSION', `Invalid JSON at line ${lineNumber} in ${filePath}`);
  }
}

function isTitleSlot(value: SessionEntry): value is OmpTitleSlot {
  return (
    value.type === 'title' &&
    value.v === 1 &&
    typeof value.title === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.pad === 'string' &&
    (value.source === undefined || value.source === 'auto' || value.source === 'user')
  );
}

function latestEntryTitle(entries: readonly ActiveSessionEntry[]): string | undefined {
  let title: string | undefined;
  for (const entry of entries) {
    if (entry.type === 'session_info' && typeof entry.name === 'string') {
      title = entry.name.trim() || undefined;
    }
    if (entry.type === 'title_change' && typeof entry.title === 'string') {
      title = entry.title.trim() || undefined;
    }
  }
  return title;
}

/** Resolve a project directory without requiring it to still exist. */
export function canonicalCwd(cwd: string): string {
  if (typeof cwd !== 'string' || cwd.trim() === '') {
    fail('PIA_INVALID_CWD', 'cwd must be a non-empty path');
  }
  const absolute = path.resolve(cwd);
  try {
    return realpathSync.native(absolute);
  } catch (error) {
    if (
      hasErrorCode(error, 'ENOENT') ||
      hasErrorCode(error, 'ENOTDIR') ||
      hasErrorCode(error, 'ENAMETOOLONG')
    ) return absolute;
    throw error;
  }
}

/** Stable, filesystem-safe key: a bounded project basename plus a canonical-path hash. */
export function projectKey(cwd: string): string {
  const canonical = canonicalCwd(cwd);
  const rawBase = path.basename(canonical) || 'root';
  const sanitized = rawBase
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';
  const base = sanitized.slice(0, PROJECT_BASENAME_MAX_CHARS);
  const digest = createHash('sha256').update(canonical).digest('hex').slice(0, 12);
  return `${base}-${digest}`;
}

/**
 * Return the exact session leaf for a combo and project.
 * Shared history remains engine- and project-scoped; it only removes the combo scope.
 */
export function sessionLeafDir({
  stateRoot,
  engine,
  comboName,
  cwd,
  history,
}: SessionLeafOptions): string {
  if (typeof stateRoot !== 'string' || stateRoot.trim() === '') {
    fail('PIA_INVALID_STATE_ROOT', 'stateRoot must be a non-empty path');
  }
  const validEngine = requireEngine(engine);
  const validComboName = requireSafeName(comboName, 'comboName');
  if (history?.mode === 'isolated') {
    return path.join(path.resolve(stateRoot), 'sessions', validEngine, validComboName, projectKey(cwd));
  }
  if (history?.mode === 'shared') {
    const validGroup = requireSafeName(history.group, 'history.group');
    return path.join(path.resolve(stateRoot), 'sessions', validEngine, 'shared', validGroup, projectKey(cwd));
  }
  fail('PIA_INVALID_HISTORY', "history must be {mode:'isolated'} or {mode:'shared', group:'safe-name'}");
}

/** Build the durable root-to-active-leaf path from append-only entries. */
export function buildActiveBranch(
  sessionOrEntries: readonly unknown[] | { entries: readonly unknown[] },
): ActiveSessionEntry[] {
  const entries = Array.isArray(sessionOrEntries) ? sessionOrEntries : sessionOrEntries?.entries;
  if (!Array.isArray(entries)) fail('PIA_INVALID_SESSION', 'Session entries must be an array');

  const byId = new Map<string, ActiveSessionEntry>();
  let leaf: ActiveSessionEntry | undefined;
  for (const rawEntry of entries) {
    if (!isRecord(rawEntry) || typeof rawEntry.id !== 'string' || rawEntry.id === '') continue;
    const entry = rawEntry as ActiveSessionEntry;
    if (byId.has(entry.id)) {
      fail('PIA_INVALID_SESSION_TREE', `Duplicate session entry id: ${entry.id}`);
    }
    byId.set(entry.id, entry);
    leaf = entry;
  }
  if (!leaf) return [];

  const reverse: ActiveSessionEntry[] = [];
  const visited = new Set<string>();
  let current: ActiveSessionEntry | undefined = leaf;
  while (current) {
    if (visited.has(current.id)) {
      fail('PIA_INVALID_SESSION_TREE', `Cycle in session entry parents at ${current.id}`);
    }
    visited.add(current.id);
    reverse.push(current);
    if (current.parentId === null || current.parentId === undefined) break;
    if (typeof current.parentId !== 'string' || current.parentId === '') {
      fail('PIA_INVALID_SESSION_TREE', `Invalid parentId on session entry ${current.id}`);
    }
    const parent = byId.get(current.parentId);
    if (!parent) {
      fail('PIA_INVALID_SESSION_TREE', `Missing parent ${current.parentId} for session entry ${current.id}`);
    }
    current = parent;
  }
  return reverse.reverse();
}

/** Parse a Pi or OMP JSONL body without touching the filesystem. */
export function parseSessionContent(
  content: string,
  { engine, filePath = '<session>' }: ParseSessionOptions = {},
): ParsedSession {
  if (engine !== undefined) requireEngine(engine);
  if (typeof content !== 'string' || content === '') {
    fail('PIA_INVALID_SESSION', `Empty session file: ${filePath}`);
  }

  const physicalLines = content.split('\n');
  if (physicalLines.at(-1) === '') physicalLines.pop();
  if (physicalLines.length === 0) fail('PIA_INVALID_SESSION', `Empty session file: ${filePath}`);

  let logicalIndex = 0;
  let titleSlot: OmpTitleSlot | undefined;
  const first = parseLine(physicalLines[0], 1, filePath);
  if (first.type === 'title') {
    if (engine === 'pi') {
      fail('PIA_FOREIGN_SESSION', `OMP title slot found while parsing a Pi session: ${filePath}`);
    }
    if (!isTitleSlot(first)) {
      fail('PIA_INVALID_SESSION', `Malformed OMP title slot in ${filePath}`);
    }
    if (Buffer.byteLength(`${physicalLines[0]}\n`, 'utf8') !== OMP_TITLE_SLOT_BYTES) {
      fail('PIA_INVALID_SESSION', `OMP title slot is not ${OMP_TITLE_SLOT_BYTES} bytes in ${filePath}`);
    }
    titleSlot = first;
    logicalIndex = 1;
  }

  if (logicalIndex >= physicalLines.length) {
    fail('PIA_INVALID_SESSION', `Session header is missing from ${filePath}`);
  }
  const headerRecord = parseLine(physicalLines[logicalIndex], logicalIndex + 1, filePath);
  if (
    headerRecord.type !== 'session' ||
    typeof headerRecord.id !== 'string' ||
    headerRecord.id === '' ||
    typeof headerRecord.cwd !== 'string'
  ) {
    fail('PIA_INVALID_SESSION', `First logical record is not a valid session header in ${filePath}`);
  }
  const header = headerRecord as SessionHeader;

  const entries: SessionEntry[] = [];
  for (let index = logicalIndex + 1; index < physicalLines.length; index += 1) {
    entries.push(parseLine(physicalLines[index], index + 1, filePath));
  }
  // Validate the tree while parsing so callers never receive a subtly corrupt active branch.
  const branch = buildActiveBranch(entries);
  const inferredEngine = engine || (titleSlot ? 'omp' : undefined);
  const branchTitle = latestEntryTitle(branch);
  const headerTitle = typeof header.title === 'string' ? header.title.trim() : '';
  const title = titleSlot?.title.trim() || branchTitle || headerTitle || undefined;

  return {
    engine: inferredEngine,
    title,
    titleSlot,
    header,
    id: header.id,
    cwd: header.cwd,
    entries,
    activeBranch: branch,
  };
}

/** Parse a session file and attach filesystem metadata used for list/latest resolution. */
export function parseSessionFile(
  filePath: string,
  options?: ParseSessionOptions,
): Promise<ParsedSessionFile>;
export function parseSessionFile(
  options: ParseSessionFileOptions & { filePath: string },
): Promise<ParsedSessionFile>;
export async function parseSessionFile(
  fileOrOptions: string | ParseSessionFileOptions = {},
  maybeOptions: ParseSessionOptions = {},
): Promise<ParsedSessionFile> {
  const options: ParseSessionFileOptions = typeof fileOrOptions === 'string'
    ? { ...maybeOptions, filePath: fileOrOptions }
    : fileOrOptions;
  if (typeof options.filePath !== 'string' || options.filePath.trim() === '') {
    fail('PIA_INVALID_SESSION_PATH', 'filePath must resolve to an absolute path');
  }
  const filePath = path.resolve(options.filePath);
  if (!path.isAbsolute(filePath)) {
    fail('PIA_INVALID_SESSION_PATH', 'filePath must resolve to an absolute path');
  }
  const [content, stat] = await Promise.all([fs.readFile(filePath, 'utf8'), fs.stat(filePath)]);
  if (!stat.isFile()) fail('PIA_INVALID_SESSION_PATH', `Session path is not a file: ${filePath}`);
  const parsed = parseSessionContent(content, { engine: options.engine, filePath });
  return {
    ...parsed,
    path: filePath,
    filePath,
    mtime: stat.mtime,
    mtimeMs: stat.mtimeMs,
    size: stat.size,
  };
}

/** List direct JSONL children newest-first. A missing leaf is an empty history. */
export async function listSessions({
  sessionDir,
  engine,
}: ListSessionsOptions = {}): Promise<ParsedSessionFile[]> {
  if (typeof sessionDir !== 'string' || sessionDir.trim() === '') {
    fail('PIA_INVALID_SESSION_PATH', 'sessionDir must be a non-empty path');
  }
  const directory = path.resolve(sessionDir);
  let children: Dirent<string>[];
  try {
    children = await fs.readdir(directory, { withFileTypes: true, encoding: 'utf8' });
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return [];
    throw error;
  }

  const files = children
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map((entry) => path.join(directory, entry.name))
    .sort();
  const sessions = await Promise.all(files.map((filePath) => parseSessionFile(filePath, { engine })));
  sessions.sort((left, right) => right.mtimeMs - left.mtimeMs || left.path.localeCompare(right.path));
  return sessions;
}

/** Resolve only an explicit absolute path, an unambiguous ID prefix, or explicit latest. */
export async function resolveSession({
  sessionDir,
  selector,
  latest = false,
  engine,
}: ResolveSessionOptions = {}): Promise<ParsedSessionFile> {
  if (selector !== undefined && (typeof selector !== 'string' || selector.trim() === '')) {
    fail('PIA_INVALID_SESSION_SELECTOR', 'Session selector must be a non-empty string');
  }
  if (latest && selector !== undefined && selector !== 'latest') {
    fail('PIA_INVALID_SESSION_SELECTOR', 'Choose either a selector or latest, not both');
  }
  if (selector && path.isAbsolute(selector)) {
    return await parseSessionFile(selector, { engine });
  }

  const wantsLatest = latest || selector === 'latest';
  if (!wantsLatest && selector === undefined) {
    fail('PIA_SESSION_SELECTOR_REQUIRED', 'Specify an absolute session path, ID prefix, or latest');
  }
  const sessions = await listSessions({ sessionDir, engine });
  if (sessions.length === 0) {
    fail('PIA_SESSION_NOT_FOUND', `No sessions found under ${path.resolve(sessionDir || '')}`);
  }
  if (wantsLatest) return sessions[0];

  const prefix = selector!.toLowerCase();
  const matches = sessions.filter((session) => session.id.toLowerCase().startsWith(prefix));
  if (matches.length === 0) fail('PIA_SESSION_NOT_FOUND', `No session ID starts with ${selector}`);
  if (matches.length > 1) {
    fail('PIA_AMBIGUOUS_SESSION', `Session ID prefix ${selector} matches ${matches.length} sessions`, {
      matches: matches.map((session) => ({ id: session.id, path: session.path })),
    });
  }
  return matches[0];
}

/** Raw session forks are only valid inside the same harness format. */
export function assertForkCompatible(options: ForkCompatibilityOptions): true;
export function assertForkCompatible(sourceEngine: Engine, targetEngine: Engine): true;
export function assertForkCompatible(
  sourceOrOptions: Engine | ForkCompatibilityOptions,
  maybeTargetEngine?: Engine,
): true {
  const objectOptions = typeof sourceOrOptions === 'object' ? sourceOrOptions : undefined;
  const sourceEngine = objectOptions
    ? objectOptions.sourceEngine || objectOptions.source?.engine
    : sourceOrOptions;
  const targetEngine = objectOptions ? objectOptions.targetEngine : maybeTargetEngine;
  if (!sourceEngine || !targetEngine) {
    fail('PIA_INVALID_ENGINE', 'Both sourceEngine and targetEngine are required for a raw fork');
  }
  const validSourceEngine = requireEngine(sourceEngine);
  const validTargetEngine = requireEngine(targetEngine);
  if (validSourceEngine !== validTargetEngine) {
    fail(
      'PIA_FOREIGN_SESSION',
      `Raw session fork cannot cross harness formats (${validSourceEngine} -> ${validTargetEngine}); use handoff instead`,
    );
  }
  return true;
}
