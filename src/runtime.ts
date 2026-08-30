import { createHash, randomBytes } from 'node:crypto';
import { constants as fsConstants, promises as fs } from 'node:fs';
import type { Dirent, Stats } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import path from 'node:path';

const MANIFEST_VERSION = 1 as const;
const FILE_MODE = 0o600;
const EXECUTABLE_MODE = 0o700;
const DIRECTORY_MODE = 0o700;
const MAX_RELATIVE_PATH_BYTES = 4096;
const MAX_PATH_COMPONENT_BYTES = 255;
const CLASSIFICATIONS = [
  'clean',
  'source-only-update',
  'runtime-drift',
  'conflict',
  'new',
  'stale',
] as const;
const FORBIDDEN_BASENAMES = new Set([
  'auth.json',
  'oauth.json',
  'agent.db',
]);
const FORBIDDEN_ROOT_DIRECTORIES = new Set([
  'sessions',
  'blobs',
  'cache',
  'npm',
  'git',
  'tmp',
]);

export type RuntimeClassification = (typeof CLASSIFICATIONS)[number];
export type RuntimeState = 'blocked' | 'changes' | 'clean';
export type RuntimeTargetKind = 'missing' | 'file' | 'directory' | 'obstruction';
export type RuntimeFileReason =
  | 'not-yet-applied'
  | 'unowned-target-matches-source'
  | 'unowned-target-file'
  | 'unowned-target-obstruction'
  | 'target-is-not-a-file'
  | 'already-absent'
  | 'source-removed'
  | 'source-removed-runtime-changed'
  | 'runtime-file-missing'
  | 'source-changed-runtime-file-missing'
  | 'unchanged'
  | 'source-changed'
  | 'runtime-changed'
  | 'source-and-runtime-converged'
  | 'source-and-runtime-diverged';

export interface RuntimeError extends Error {
  code: string;
  details?: unknown;
}

export interface RuntimeManifestFile {
  sha256: string;
  executable: boolean;
  mode: number;
}

export interface RuntimeSourceFile extends RuntimeManifestFile {
  size: number;
}

export interface RuntimeTargetFile extends RuntimeManifestFile {
  size: number;
}

export interface RuntimeManifest {
  schemaVersion: typeof MANIFEST_VERSION;
  target: string;
  files: Record<string, RuntimeManifestFile>;
}

export interface ScannedRuntimeTree {
  root: string;
  digest: string;
  files: Record<string, RuntimeSourceFile>;
}

export interface RuntimeFileStatus {
  path: string;
  status: RuntimeClassification;
  classification: RuntimeClassification;
  label: string;
  reason: RuntimeFileReason;
  owned: boolean;
  blocking: boolean;
  source: RuntimeSourceFile | null;
  applied: RuntimeManifestFile | null;
  target: RuntimeTargetFile | null;
  targetKind: RuntimeTargetKind;
  obstruction: string | null;
}

export type RuntimeClassificationCounts = Record<RuntimeClassification, number> & {
  total: number;
};

export interface RuntimeStatusOptions {
  sourceDir: string;
  targetDir: string;
  manifestPath: string;
}

export interface RuntimeStatus {
  sourceDir: string;
  sourceDigest: string;
  targetDir: string;
  targetExists: boolean;
  targetMode: number | null;
  targetNeedsInitialization: boolean;
  manifestPath: string;
  manifestExists: boolean;
  manifest: RuntimeManifest | null;
  state: RuntimeState;
  classification: RuntimeClassification;
  counts: RuntimeClassificationCounts;
  hasChanges: boolean;
  hasRuntimeDrift: boolean;
  hasConflicts: boolean;
  hasBlockingConflict: boolean;
  canApply: boolean;
  canForceApply: boolean;
  files: RuntimeFileStatus[];
}

export type RuntimeAction =
  | { action: 'ensure-target'; mode: number }
  | {
      action: 'blocked';
      path: string;
      classification: RuntimeClassification;
      reason: RuntimeFileReason;
    }
  | {
      action: 'adopt' | 'write' | 'remove' | 'forget';
      path: string;
      classification: RuntimeClassification;
    }
  | { action: 'write-manifest' };

export interface ApplyRuntimeOptions extends RuntimeStatusOptions {
  dryRun?: boolean;
  force?: boolean;
}

interface ApplyRuntimeResultBase {
  applied: boolean;
  changed: boolean;
  force: boolean;
  actions: RuntimeAction[];
  before: RuntimeStatus;
  manifest: RuntimeManifest;
}

export interface RefusedApplyRuntimeResult extends ApplyRuntimeResultBase {
  ok: false;
  applied: false;
  changed: false;
  dryRun: boolean;
  refused: true;
  reason: 'unowned-or-obstructed-target' | 'runtime-drift-or-conflict';
  after: null;
}

export interface DryRunApplyRuntimeResult extends ApplyRuntimeResultBase {
  ok: true;
  applied: false;
  dryRun: true;
  refused: false;
  reason: null;
  after: null;
}

export interface CompletedApplyRuntimeResult extends ApplyRuntimeResultBase {
  ok: true;
  dryRun: false;
  refused: false;
  reason: null;
  after: RuntimeStatus;
}

export type ApplyRuntimeResult =
  | RefusedApplyRuntimeResult
  | DryRunApplyRuntimeResult
  | CompletedApplyRuntimeResult;

export type ParentTreeClassification = 'added' | 'removed' | 'modified' | 'unchanged';

export interface ParentTreeFileStatus {
  path: string;
  status: ParentTreeClassification;
  source: RuntimeSourceFile | null;
  parent: RuntimeSourceFile | null;
}

export interface ParentTreeDiff {
  directory: string;
  digest: string;
  counts: Record<ParentTreeClassification, number> & { total: number };
  files: ParentTreeFileStatus[];
}

export interface DiffTreesOptions {
  sourceDir: string;
  parentDir: string;
}

export interface DiffRuntimeOptions extends RuntimeStatusOptions {
  parentDir?: string | null;
}

export interface RuntimeDiffResult {
  sourceDir: string;
  targetDir: string;
  manifestPath: string;
  sourceDigest: string;
  runtime: RuntimeStatus;
  files: RuntimeFileStatus[];
  parent: ParentTreeDiff | null;
  text: null;
}

interface InternalFileMetadata extends RuntimeManifestFile {
  actualMode: number;
  size: number;
}

interface TargetInspection {
  kind: RuntimeTargetKind;
  metadata: InternalFileMetadata | null;
  obstruction?: string;
}

interface TargetRootInspection {
  exists: boolean;
  mode: number | null;
}

interface LoadedManifest {
  exists: boolean;
  manifest: RuntimeManifest | null;
  path: string;
}

function fail(code: string, message: string, details?: unknown): never {
  const error = new Error(message) as RuntimeError;
  error.code = code;
  if (details !== undefined) error.details = details;
  throw error;
}

function errorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object' || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function desiredMode(executable: boolean): number {
  return executable ? EXECUTABLE_MODE : FILE_MODE;
}

function sortStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isForbiddenComponent(component: string, index: number): boolean {
  const lower = component.toLowerCase();
  return (
    lower.startsWith('.env') ||
    lower.startsWith('.pia-') ||
    FORBIDDEN_BASENAMES.has(lower) ||
    (index === 0 && FORBIDDEN_ROOT_DIRECTORIES.has(lower.replace(/^\.+/, '')))
  );
}

function validateRelativePath(relativePath: string, context = 'path'): string[] {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    fail('PIA_INVALID_PATH', `${context} must be a non-empty relative path`);
  }
  if (
    relativePath.includes('\0') ||
    relativePath.includes('\\') ||
    path.posix.isAbsolute(relativePath)
  ) {
    fail('PIA_INVALID_PATH', `${context} is not a safe portable relative path: ${relativePath}`);
  }

  if (Buffer.byteLength(relativePath, 'utf8') > MAX_RELATIVE_PATH_BYTES) {
    fail('PIA_INVALID_PATH', `${context} exceeds ${MAX_RELATIVE_PATH_BYTES} UTF-8 bytes`);
  }

  const components = relativePath.split('/');
  if (components.some((component) => component === '' || component === '.' || component === '..')) {
    fail('PIA_PATH_TRAVERSAL', `${context} contains traversal or empty components: ${relativePath}`);
  }
  for (const [index, component] of components.entries()) {
    if (Buffer.byteLength(component, 'utf8') > MAX_PATH_COMPONENT_BYTES) {
      fail('PIA_INVALID_PATH', `${context} component exceeds ${MAX_PATH_COMPONENT_BYTES} UTF-8 bytes`, {
        component,
      });
    }
    if (isForbiddenComponent(component, index)) {
      fail('PIA_FORBIDDEN_PATH', `${context} contains forbidden runtime state: ${relativePath}`, {
        component,
      });
    }
  }
  return components;
}

function resolveInputPath(inputPath: string, context: string): string {
  if (typeof inputPath !== 'string' || inputPath.length === 0 || inputPath.includes('\0')) {
    fail('PIA_INVALID_PATH', `${context} must be a non-empty filesystem path`);
  }
  if (Buffer.byteLength(inputPath, 'utf8') > MAX_RELATIVE_PATH_BYTES) {
    fail('PIA_INVALID_PATH', `${context} exceeds ${MAX_RELATIVE_PATH_BYTES} UTF-8 bytes`);
  }
  return path.resolve(inputPath);
}

function resolveWithin(root: string, relativePath: string, context = 'path'): string {
  const components = validateRelativePath(relativePath, context);
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, ...components);
  if (resolvedPath === resolvedRoot || !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    fail('PIA_PATH_TRAVERSAL', `${context} escapes its root: ${relativePath}`);
  }
  return resolvedPath;
}

async function lstatMaybe(filePath: string): Promise<Stats | null> {
  try {
    return await fs.lstat(filePath);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return null;
    throw error;
  }
}

async function readOrdinaryFile(
  filePath: string,
  context: string,
): Promise<{ data: Buffer; metadata: InternalFileMetadata }> {
  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  let handle: FileHandle | undefined;
  try {
    handle = await fs.open(filePath, fsConstants.O_RDONLY | noFollow);
  } catch (error) {
    if (errorCode(error) === 'ELOOP') {
      fail('PIA_SYMLINK_REJECTED', `${context} is a symbolic link: ${filePath}`);
    }
    throw error;
  }

  try {
    const stat = await handle.stat();
    if (!stat.isFile()) {
      fail('PIA_NON_FILE_REJECTED', `${context} is not an ordinary file: ${filePath}`);
    }
    const data = await handle.readFile();
    const executable = (stat.mode & 0o111) !== 0;
    return {
      data,
      metadata: {
        sha256: sha256(data),
        executable,
        mode: desiredMode(executable),
        actualMode: stat.mode & 0o777,
        size: stat.size,
      },
    };
  } finally {
    await handle.close();
  }
}

function publicSourceMetadata(metadata: InternalFileMetadata): RuntimeSourceFile {
  return {
    sha256: metadata.sha256,
    executable: metadata.executable,
    mode: metadata.mode,
    size: metadata.size,
  };
}

function publicTargetMetadata(metadata: InternalFileMetadata): RuntimeTargetFile {
  return {
    sha256: metadata.sha256,
    executable: metadata.executable,
    mode: metadata.actualMode,
    size: metadata.size,
  };
}

function manifestMetadata(metadata: RuntimeSourceFile): RuntimeManifestFile {
  return {
    sha256: metadata.sha256,
    executable: metadata.executable,
    mode: desiredMode(metadata.executable),
  };
}

function sameLogicalFile(
  left: Pick<RuntimeManifestFile, 'sha256' | 'executable'> | null,
  right: Pick<RuntimeManifestFile, 'sha256' | 'executable'> | null,
): boolean {
  return (
    left !== null &&
    right !== null &&
    left.sha256 === right.sha256 &&
    left.executable === right.executable
  );
}

function targetMatchesManifest(
  target: InternalFileMetadata | null,
  manifest: RuntimeManifestFile | null,
): boolean {
  return (
    target !== null &&
    manifest !== null &&
    target.sha256 === manifest.sha256 &&
    target.actualMode === manifest.mode
  );
}

function targetMatchesSource(target: InternalFileMetadata | null, source: RuntimeSourceFile | null): boolean {
  return (
    target !== null &&
    source !== null &&
    target.sha256 === source.sha256 &&
    target.actualMode === source.mode
  );
}

function targetContentMatchesSource(
  target: InternalFileMetadata | null,
  source: RuntimeSourceFile | null,
): boolean {
  return target !== null && source !== null && target.sha256 === source.sha256;
}

function digestFileEntries(files: Readonly<Record<string, RuntimeSourceFile>>): string {
  const digest = createHash('sha256');
  for (const [relativePath, metadata] of Object.entries(files).sort(([left], [right]) => sortStrings(left, right))) {
    digest.update(relativePath);
    digest.update('\0');
    digest.update(metadata.sha256);
    digest.update('\0');
    digest.update(metadata.executable ? 'x' : '-');
    digest.update('\0');
  }
  return digest.digest('hex');
}

/**
 * Scan a declarative agent tree without following links or accepting runtime state.
 */
export async function scanTree(root: string): Promise<ScannedRuntimeTree> {
  const absoluteRoot = resolveInputPath(root, 'source root');
  const rootStat = await lstatMaybe(absoluteRoot);
  if (rootStat === null) fail('PIA_SOURCE_MISSING', `Source directory does not exist: ${absoluteRoot}`);
  if (rootStat.isSymbolicLink()) {
    fail('PIA_SYMLINK_REJECTED', `Source directory is a symbolic link: ${absoluteRoot}`);
  }
  if (!rootStat.isDirectory()) {
    fail('PIA_NOT_DIRECTORY', `Source root is not a directory: ${absoluteRoot}`);
  }

  const entries: Array<[string, RuntimeSourceFile]> = [];

  async function visit(directory: string, prefix: string): Promise<void> {
    const children = await fs.readdir(directory, { withFileTypes: true });
    children.sort((left: Dirent, right: Dirent) => sortStrings(left.name, right.name));

    for (const child of children) {
      const relativePath = prefix === '' ? child.name : `${prefix}/${child.name}`;
      validateRelativePath(relativePath, 'source path');
      const childPath = path.join(directory, child.name);
      const stat = await fs.lstat(childPath);
      if (stat.isSymbolicLink()) {
        fail('PIA_SYMLINK_REJECTED', `Source path is a symbolic link: ${relativePath}`);
      }
      if (stat.isDirectory()) {
        await visit(childPath, relativePath);
        continue;
      }
      if (!stat.isFile()) {
        fail('PIA_NON_FILE_REJECTED', `Source path is not an ordinary file: ${relativePath}`);
      }

      const { metadata } = await readOrdinaryFile(childPath, 'source path');
      entries.push([relativePath, publicSourceMetadata(metadata)]);
    }
  }

  await visit(absoluteRoot, '');
  entries.sort(([left], [right]) => sortStrings(left, right));
  const files = Object.fromEntries(entries);
  return {
    root: absoluteRoot,
    digest: digestFileEntries(files),
    files,
  };
}

export async function treeDigest(root: string): Promise<string> {
  return (await scanTree(root)).digest;
}

function validateManifest(
  rawManifest: unknown,
  expectedTarget: string,
  manifestPath: string,
): RuntimeManifest {
  if (!isPlainObject(rawManifest) || rawManifest.schemaVersion !== MANIFEST_VERSION) {
    fail('PIA_INVALID_MANIFEST', `Unsupported or malformed runtime manifest: ${manifestPath}`);
  }
  if (typeof rawManifest.target !== 'string' || rawManifest.target !== expectedTarget) {
    fail('PIA_MANIFEST_TARGET_MISMATCH', `Runtime manifest belongs to a different target: ${manifestPath}`, {
      expected: expectedTarget,
      actual: rawManifest.target,
    });
  }
  if (!isPlainObject(rawManifest.files)) {
    fail('PIA_INVALID_MANIFEST', `Runtime manifest files must be an object: ${manifestPath}`);
  }

  const entries: Array<[string, RuntimeManifestFile]> = [];
  for (const [relativePath, metadata] of Object.entries(rawManifest.files)) {
    validateRelativePath(relativePath, 'manifest path');
    if (
      !isPlainObject(metadata) ||
      typeof metadata.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(metadata.sha256) ||
      typeof metadata.executable !== 'boolean' ||
      metadata.mode !== desiredMode(metadata.executable)
    ) {
      fail('PIA_INVALID_MANIFEST', `Invalid file metadata in runtime manifest: ${relativePath}`);
    }
    entries.push([
      relativePath,
      {
        sha256: metadata.sha256,
        executable: metadata.executable,
        mode: metadata.mode,
      },
    ]);
  }
  entries.sort(([left], [right]) => sortStrings(left, right));
  return {
    schemaVersion: MANIFEST_VERSION,
    target: expectedTarget,
    files: Object.fromEntries(entries),
  };
}

async function loadManifest(manifestPath: string, targetDir: string): Promise<LoadedManifest> {
  const absoluteManifestPath = resolveInputPath(manifestPath, 'manifest path');
  const stat = await lstatMaybe(absoluteManifestPath);
  if (stat === null) return { exists: false, manifest: null, path: absoluteManifestPath };
  if (stat.isSymbolicLink()) {
    fail('PIA_SYMLINK_REJECTED', `Runtime manifest is a symbolic link: ${absoluteManifestPath}`);
  }
  if (!stat.isFile()) {
    fail('PIA_INVALID_MANIFEST', `Runtime manifest is not an ordinary file: ${absoluteManifestPath}`);
  }

  const { data } = await readOrdinaryFile(absoluteManifestPath, 'runtime manifest');
  let parsed: unknown;
  try {
    parsed = JSON.parse(data.toString('utf8'));
  } catch (error) {
    fail('PIA_INVALID_MANIFEST', `Runtime manifest is not valid JSON: ${absoluteManifestPath}`, {
      cause: errorMessage(error),
    });
  }
  return {
    exists: true,
    manifest: validateManifest(parsed, path.resolve(targetDir), absoluteManifestPath),
    path: absoluteManifestPath,
  };
}

async function inspectTarget(targetDir: string, relativePath: string): Promise<TargetInspection> {
  const absoluteTarget = resolveInputPath(targetDir, 'runtime target');
  const components = validateRelativePath(relativePath, 'target path');
  const targetRoot = await inspectTargetRoot(absoluteTarget);
  if (!targetRoot.exists) return { kind: 'missing', metadata: null };

  let current = absoluteTarget;
  for (let index = 0; index < components.length; index += 1) {
    current = path.join(current, components[index]);
    const stat = await lstatMaybe(current);
    if (stat === null) return { kind: 'missing', metadata: null };
    if (stat.isSymbolicLink()) {
      fail('PIA_SYMLINK_REJECTED', `Managed runtime path is a symbolic link: ${relativePath}`);
    }

    const isLeaf = index === components.length - 1;
    if (!isLeaf) {
      if (!stat.isDirectory()) {
        return {
          kind: 'obstruction',
          metadata: null,
          obstruction: components.slice(0, index + 1).join('/'),
        };
      }
      continue;
    }

    if (stat.isDirectory()) {
      return { kind: 'directory', metadata: null, obstruction: relativePath };
    }
    if (!stat.isFile()) {
      fail('PIA_NON_FILE_REJECTED', `Managed runtime path is not an ordinary file: ${relativePath}`);
    }
    const { metadata } = await readOrdinaryFile(current, 'managed runtime path');
    return { kind: 'file', metadata };
  }

  fail('PIA_INVALID_PATH', `Target path did not contain a file name: ${relativePath}`);
}

async function inspectTargetRoot(targetDir: string): Promise<TargetRootInspection> {
  const absoluteTarget = resolveInputPath(targetDir, 'runtime target');
  const stat = await lstatMaybe(absoluteTarget);
  if (stat === null) return { exists: false, mode: null };
  if (stat.isSymbolicLink()) {
    fail('PIA_SYMLINK_REJECTED', `Runtime target is a symbolic link: ${absoluteTarget}`);
  }
  if (!stat.isDirectory()) {
    fail('PIA_NOT_DIRECTORY', `Runtime target is not a directory: ${absoluteTarget}`);
  }
  return { exists: true, mode: stat.mode & 0o777 };
}

function classifyFile(
  relativePath: string,
  source: RuntimeSourceFile | null,
  base: RuntimeManifestFile | null,
  targetInspection: TargetInspection,
): RuntimeFileStatus {
  const target = targetInspection.kind === 'file' ? targetInspection.metadata : null;
  let status: RuntimeClassification;
  let reason: RuntimeFileReason;
  let blocking = false;

  if (base === null) {
    if (targetInspection.kind === 'missing') {
      status = 'new';
      reason = 'not-yet-applied';
    } else if (targetContentMatchesSource(target, source)) {
      // A first apply may be interrupted after its atomic target write but before
      // the manifest write. Matching bytes are safe to adopt; buildActions still
      // rewrites the file when its final private mode is not yet correct.
      status = 'source-only-update';
      reason = 'unowned-target-matches-source';
    } else {
      status = 'conflict';
      reason = targetInspection.kind === 'file' ? 'unowned-target-file' : 'unowned-target-obstruction';
      blocking = true;
    }
  } else if (targetInspection.kind !== 'file' && targetInspection.kind !== 'missing') {
    status = source !== null && sameLogicalFile(source, base) ? 'runtime-drift' : 'conflict';
    reason = 'target-is-not-a-file';
    blocking = true;
  } else if (source === null) {
    if (target === null || targetMatchesManifest(target, base)) {
      status = 'stale';
      reason = target === null ? 'already-absent' : 'source-removed';
    } else {
      status = 'conflict';
      reason = 'source-removed-runtime-changed';
    }
  } else if (target === null) {
    if (sameLogicalFile(source, base)) {
      status = 'runtime-drift';
      reason = 'runtime-file-missing';
    } else {
      status = 'conflict';
      reason = 'source-changed-runtime-file-missing';
    }
  } else {
    const sourceUnchanged = sameLogicalFile(source, base);
    const runtimeUnchanged = targetMatchesManifest(target, base);
    if (sourceUnchanged && runtimeUnchanged) {
      status = 'clean';
      reason = 'unchanged';
    } else if (!sourceUnchanged && runtimeUnchanged) {
      status = 'source-only-update';
      reason = 'source-changed';
    } else if (sourceUnchanged && !runtimeUnchanged) {
      status = 'runtime-drift';
      reason = 'runtime-changed';
    } else if (targetMatchesSource(target, source)) {
      status = 'source-only-update';
      reason = 'source-and-runtime-converged';
    } else {
      status = 'conflict';
      reason = 'source-and-runtime-diverged';
    }
  }

  return {
    path: relativePath,
    status,
    classification: status,
    label: status.replaceAll('-', ' '),
    reason,
    owned: base !== null,
    blocking,
    source,
    applied: base,
    target: target === null ? null : publicTargetMetadata(target),
    targetKind: targetInspection.kind,
    obstruction: targetInspection.obstruction ?? null,
  };
}

function dominantClassification(counts: RuntimeClassificationCounts): RuntimeClassification {
  if (counts.conflict > 0) return 'conflict';
  if (counts['runtime-drift'] > 0) return 'runtime-drift';
  if (counts['source-only-update'] > 0) return 'source-only-update';
  if (counts.new > 0) return 'new';
  if (counts.stale > 0) return 'stale';
  return 'clean';
}

export async function getRuntimeStatus({
  sourceDir,
  targetDir,
  manifestPath,
}: RuntimeStatusOptions): Promise<RuntimeStatus> {
  if (sourceDir === undefined || targetDir === undefined || manifestPath === undefined) {
    fail('PIA_INVALID_ARGUMENT', 'sourceDir, targetDir, and manifestPath are required');
  }

  const source = await scanTree(sourceDir);
  const absoluteTarget = resolveInputPath(targetDir, 'runtime target');
  const targetRoot = await inspectTargetRoot(absoluteTarget);
  const loadedManifest = await loadManifest(manifestPath, absoluteTarget);
  const manifestFiles = loadedManifest.manifest?.files ?? {};
  const relativePaths = [...new Set([...Object.keys(source.files), ...Object.keys(manifestFiles)])].sort(sortStrings);
  const files: RuntimeFileStatus[] = [];

  for (const relativePath of relativePaths) {
    const sourceMetadata = source.files[relativePath] ?? null;
    const baseMetadata = manifestFiles[relativePath] ?? null;
    const targetInspection = await inspectTarget(absoluteTarget, relativePath);
    files.push(classifyFile(relativePath, sourceMetadata, baseMetadata, targetInspection));
  }

  const counts: RuntimeClassificationCounts = {
    clean: 0,
    'source-only-update': 0,
    'runtime-drift': 0,
    conflict: 0,
    new: 0,
    stale: 0,
    total: files.length,
  };
  for (const file of files) counts[file.status] += 1;
  const hasRuntimeDrift = counts['runtime-drift'] > 0;
  const hasConflicts = counts.conflict > 0;
  const hasBlockingConflict = files.some((file) => file.blocking);
  const targetNeedsInitialization = !targetRoot.exists || targetRoot.mode !== DIRECTORY_MODE;
  const hasChanges =
    targetNeedsInitialization || !loadedManifest.exists || files.some((file) => file.status !== 'clean');

  return {
    sourceDir: source.root,
    sourceDigest: source.digest,
    targetDir: absoluteTarget,
    targetExists: targetRoot.exists,
    targetMode: targetRoot.mode,
    targetNeedsInitialization,
    manifestPath: loadedManifest.path,
    manifestExists: loadedManifest.exists,
    manifest: loadedManifest.manifest,
    state: hasRuntimeDrift || hasConflicts ? 'blocked' : hasChanges ? 'changes' : 'clean',
    classification: dominantClassification(counts),
    counts,
    hasChanges,
    hasRuntimeDrift,
    hasConflicts,
    hasBlockingConflict,
    canApply: !hasRuntimeDrift && !hasConflicts,
    canForceApply: !hasBlockingConflict,
    files,
  };
}

async function mkdirPrivate(directory: string): Promise<boolean> {
  const stat = await lstatMaybe(directory);
  if (stat !== null) {
    if (stat.isSymbolicLink()) fail('PIA_SYMLINK_REJECTED', `Directory is a symbolic link: ${directory}`);
    if (!stat.isDirectory()) fail('PIA_NOT_DIRECTORY', `Expected a directory: ${directory}`);
    return false;
  }
  await fs.mkdir(directory, { recursive: true, mode: DIRECTORY_MODE });
  return true;
}

async function ensureTargetParent(targetDir: string, relativePath: string): Promise<void> {
  const absoluteTarget = resolveInputPath(targetDir, 'runtime target');
  const components = validateRelativePath(relativePath, 'target path');
  await mkdirPrivate(absoluteTarget);
  await fs.chmod(absoluteTarget, DIRECTORY_MODE);

  let current = absoluteTarget;
  for (const component of components.slice(0, -1)) {
    current = path.join(current, component);
    const stat = await lstatMaybe(current);
    if (stat === null) {
      await fs.mkdir(current, { mode: DIRECTORY_MODE });
    } else {
      if (stat.isSymbolicLink()) fail('PIA_SYMLINK_REJECTED', `Target directory is a symbolic link: ${current}`);
      if (!stat.isDirectory()) fail('PIA_NOT_DIRECTORY', `Target parent is not a directory: ${current}`);
    }
    await fs.chmod(current, DIRECTORY_MODE);
  }
}

async function fsyncDirectory(directory: string): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    handle = await fs.open(directory, fsConstants.O_RDONLY);
    await handle.sync();
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EBADF'].includes(errorCode(error) ?? '')) throw error;
  } finally {
    await handle?.close();
  }
}

async function atomicWrite(
  filePath: string,
  data: string | Uint8Array,
  mode: number,
  { noReplace = false }: { noReplace?: boolean } = {},
): Promise<void> {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.pia-${path.basename(filePath)}-${process.pid}-${randomBytes(8).toString('hex')}`,
  );
  let handle: FileHandle | null = null;
  try {
    handle = await fs.open(temporaryPath, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL, mode);
    await handle.writeFile(data);
    await handle.chmod(mode);
    await handle.sync();
    await handle.close();
    handle = null;

    if (noReplace) {
      await fs.link(temporaryPath, filePath);
      await fs.unlink(temporaryPath);
    } else {
      await fs.rename(temporaryPath, filePath);
    }
    await fs.chmod(filePath, mode);
    await fsyncDirectory(directory);
  } catch (error) {
    await handle?.close().catch(() => {});
    await fs.unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

function sameTargetSnapshot(currentInspection: TargetInspection, priorFile: RuntimeFileStatus): boolean {
  if (priorFile.targetKind === 'missing') return currentInspection.kind === 'missing';
  if (priorFile.targetKind !== 'file' || currentInspection.kind !== 'file') return false;
  if (currentInspection.metadata === null || priorFile.target === null) return false;
  return (
    currentInspection.metadata.sha256 === priorFile.target.sha256 &&
    currentInspection.metadata.actualMode === priorFile.target.mode
  );
}

function nextManifestFromStatus(status: RuntimeStatus): RuntimeManifest {
  const entries: Array<[string, RuntimeManifestFile]> = status.files
    .flatMap((file): Array<[string, RuntimeManifestFile]> =>
      file.source === null ? [] : [[file.path, manifestMetadata(file.source)]],
    )
    .sort(([left], [right]) => sortStrings(left, right));
  return {
    schemaVersion: MANIFEST_VERSION,
    target: status.targetDir,
    files: Object.fromEntries(entries),
  };
}

function manifestsEqual(left: RuntimeManifest | null, right: RuntimeManifest): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildActions(
  status: RuntimeStatus,
  nextManifest: RuntimeManifest,
  force: boolean,
): RuntimeAction[] {
  const actions: RuntimeAction[] = [];
  if (status.targetNeedsInitialization) {
    actions.push({ action: 'ensure-target', mode: DIRECTORY_MODE });
  }
  for (const file of status.files) {
    if (file.status === 'clean') continue;
    if ((file.status === 'runtime-drift' || file.status === 'conflict') && !force) {
      actions.push({ path: file.path, action: 'blocked', classification: file.status, reason: file.reason });
      continue;
    }
    if (file.blocking) {
      actions.push({ path: file.path, action: 'blocked', classification: file.status, reason: file.reason });
      continue;
    }
    if (file.source !== null) {
      if (
        file.target !== null &&
        file.target.sha256 === file.source.sha256 &&
        file.target.mode === file.source.mode
      ) {
        actions.push({ path: file.path, action: 'adopt', classification: file.status });
      } else {
        actions.push({ path: file.path, action: 'write', classification: file.status });
      }
    } else if (file.target !== null) {
      actions.push({ path: file.path, action: 'remove', classification: file.status });
    } else {
      actions.push({ path: file.path, action: 'forget', classification: file.status });
    }
  }

  if (!status.manifestExists || !manifestsEqual(status.manifest, nextManifest)) {
    actions.push({ action: 'write-manifest' });
  }
  return actions;
}

async function revalidateSourceFile(sourceDir: string, file: RuntimeFileStatus): Promise<Buffer> {
  if (file.source === null) {
    fail('PIA_INTERNAL_ERROR', `Write action has no source file: ${file.path}`);
  }
  const sourcePath = resolveWithin(sourceDir, file.path, 'source path');
  const stat = await lstatMaybe(sourcePath);
  if (stat === null || stat.isSymbolicLink() || !stat.isFile()) {
    fail('PIA_SOURCE_CHANGED', `Source file changed during apply: ${file.path}`);
  }
  const { data, metadata } = await readOrdinaryFile(sourcePath, 'source path');
  if (metadata.sha256 !== file.source.sha256 || metadata.executable !== file.source.executable) {
    fail('PIA_SOURCE_CHANGED', `Source file changed during apply: ${file.path}`);
  }
  return data;
}

async function performWrite(status: RuntimeStatus, file: RuntimeFileStatus): Promise<void> {
  if (file.source === null) {
    fail('PIA_INTERNAL_ERROR', `Write action has no source file: ${file.path}`);
  }
  const data = await revalidateSourceFile(status.sourceDir, file);
  await ensureTargetParent(status.targetDir, file.path);
  const currentTarget = await inspectTarget(status.targetDir, file.path);
  if (!sameTargetSnapshot(currentTarget, file)) {
    fail('PIA_TARGET_CHANGED', `Runtime file changed during apply: ${file.path}`);
  }
  const destination = resolveWithin(status.targetDir, file.path, 'target path');
  await atomicWrite(destination, data, file.source.mode, {
    noReplace: currentTarget.kind === 'missing',
  });
}

async function performAdopt(status: RuntimeStatus, file: RuntimeFileStatus): Promise<void> {
  await revalidateSourceFile(status.sourceDir, file);
  const currentTarget = await inspectTarget(status.targetDir, file.path);
  if (!sameTargetSnapshot(currentTarget, file)) {
    fail('PIA_TARGET_CHANGED', `Runtime file changed during apply: ${file.path}`);
  }
}

async function performRemove(status: RuntimeStatus, file: RuntimeFileStatus): Promise<void> {
  const currentTarget = await inspectTarget(status.targetDir, file.path);
  if (!sameTargetSnapshot(currentTarget, file)) {
    fail('PIA_TARGET_CHANGED', `Runtime file changed during apply: ${file.path}`);
  }
  const destination = resolveWithin(status.targetDir, file.path, 'target path');
  await fs.unlink(destination);
  await fsyncDirectory(path.dirname(destination));
}

async function writeManifest(manifestPath: string, manifest: RuntimeManifest): Promise<void> {
  const directory = path.dirname(manifestPath);
  const created = await mkdirPrivate(directory);
  if (created) await fs.chmod(directory, DIRECTORY_MODE);

  const existing = await lstatMaybe(manifestPath);
  if (existing?.isSymbolicLink()) {
    fail('PIA_SYMLINK_REJECTED', `Runtime manifest is a symbolic link: ${manifestPath}`);
  }
  if (existing !== null && !existing.isFile()) {
    fail('PIA_INVALID_MANIFEST', `Runtime manifest is not an ordinary file: ${manifestPath}`);
  }
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  await atomicWrite(manifestPath, serialized, FILE_MODE, { noReplace: existing === null });
}

export async function applyRuntime({
  sourceDir,
  targetDir,
  manifestPath,
  dryRun = false,
  force = false,
}: ApplyRuntimeOptions): Promise<ApplyRuntimeResult> {
  const before = await getRuntimeStatus({ sourceDir, targetDir, manifestPath });
  const nextManifest = nextManifestFromStatus(before);
  const actions = buildActions(before, nextManifest, force);
  const ordinaryRefusal = !force && (before.hasRuntimeDrift || before.hasConflicts);
  const hardRefusal = before.hasBlockingConflict;
  const refused = ordinaryRefusal || hardRefusal;

  if (refused) {
    return {
      ok: false,
      applied: false,
      changed: false,
      dryRun: Boolean(dryRun),
      force: Boolean(force),
      refused: true,
      reason: hardRefusal ? 'unowned-or-obstructed-target' : 'runtime-drift-or-conflict',
      actions,
      before,
      after: null,
      manifest: nextManifest,
    };
  }

  if (dryRun) {
    return {
      ok: true,
      applied: false,
      changed: actions.length > 0,
      dryRun: true,
      force: Boolean(force),
      refused: false,
      reason: null,
      actions,
      before,
      after: null,
      manifest: nextManifest,
    };
  }

  for (const action of actions) {
    if (action.action === 'ensure-target') {
      await mkdirPrivate(before.targetDir);
      await fs.chmod(before.targetDir, DIRECTORY_MODE);
    } else if (action.action === 'write') {
      const file = before.files.find((candidate) => candidate.path === action.path);
      if (file === undefined) fail('PIA_INTERNAL_ERROR', `Missing status for write action: ${action.path}`);
      await performWrite(before, file);
    } else if (action.action === 'adopt') {
      const file = before.files.find((candidate) => candidate.path === action.path);
      if (file === undefined) fail('PIA_INTERNAL_ERROR', `Missing status for adopt action: ${action.path}`);
      await performAdopt(before, file);
    } else if (action.action === 'remove') {
      const file = before.files.find((candidate) => candidate.path === action.path);
      if (file === undefined) fail('PIA_INTERNAL_ERROR', `Missing status for remove action: ${action.path}`);
      await performRemove(before, file);
    }
  }
  if (actions.some((action) => action.action === 'write-manifest')) {
    await writeManifest(before.manifestPath, nextManifest);
  }

  const after = await getRuntimeStatus({ sourceDir, targetDir, manifestPath });
  return {
    ok: true,
    applied: actions.length > 0,
    changed: actions.length > 0,
    dryRun: false,
    force: Boolean(force),
    refused: false,
    reason: null,
    actions,
    before,
    after,
    manifest: nextManifest,
  };
}

function compareParentTrees(source: ScannedRuntimeTree, parent: ScannedRuntimeTree): ParentTreeDiff {
  const paths = [...new Set([...Object.keys(source.files), ...Object.keys(parent.files)])].sort(sortStrings);
  const files: ParentTreeFileStatus[] = paths.map((relativePath) => {
    const sourceMetadata = source.files[relativePath] ?? null;
    const parentMetadata = parent.files[relativePath] ?? null;
    let status: ParentTreeClassification;
    if (parentMetadata === null) status = 'added';
    else if (sourceMetadata === null) status = 'removed';
    else if (sameLogicalFile(sourceMetadata, parentMetadata)) status = 'unchanged';
    else status = 'modified';
    return {
      path: relativePath,
      status,
      source: sourceMetadata,
      parent: parentMetadata,
    };
  });
  const counts: ParentTreeDiff['counts'] = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
    total: files.length,
  };
  for (const file of files) counts[file.status] += 1;
  return {
    directory: parent.root,
    digest: parent.digest,
    counts,
    files,
  };
}

export async function diffTrees({ sourceDir, parentDir }: DiffTreesOptions): Promise<ParentTreeDiff> {
  if (!sourceDir || !parentDir) {
    fail('PIA_INVALID_ARGUMENT', 'sourceDir and parentDir are required');
  }
  const [source, parent] = await Promise.all([scanTree(sourceDir), scanTree(parentDir)]);
  return compareParentTrees(source, parent);
}

export async function diffRuntime({
  sourceDir,
  targetDir,
  manifestPath,
  parentDir = undefined,
}: DiffRuntimeOptions): Promise<RuntimeDiffResult> {
  const runtime = await getRuntimeStatus({ sourceDir, targetDir, manifestPath });
  let parent: ParentTreeDiff | null = null;
  if (parentDir !== undefined && parentDir !== null) {
    parent = await diffTrees({ sourceDir, parentDir });
  }
  return {
    sourceDir: runtime.sourceDir,
    targetDir: runtime.targetDir,
    manifestPath: runtime.manifestPath,
    sourceDigest: runtime.sourceDigest,
    runtime,
    files: runtime.files,
    parent,
    text: null,
  };
}
