import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { TestContext } from 'node:test';

import {
  applyRuntime,
  diffRuntime,
  getRuntimeStatus,
  scanTree,
  treeDigest,
} from '../src/runtime.ts';
import type {
  ApplyRuntimeResult,
  CompletedApplyRuntimeResult,
  RuntimeFileStatus,
  RuntimeStatus,
} from '../src/runtime.ts';

interface RuntimeFixture {
  root: string;
  sourceDir: string;
  targetDir: string;
  manifestPath: string;
}

async function fixture(t: TestContext): Promise<RuntimeFixture> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pia-runtime-'));
  const sourceDir = path.join(root, 'source');
  const targetDir = path.join(root, 'target');
  const manifestPath = path.join(root, 'state', 'manifest.json');
  await fs.mkdir(sourceDir, { recursive: true });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, sourceDir, targetDir, manifestPath };
}

async function write(filePath: string, contents: string | Uint8Array, mode = 0o644): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, { mode });
  await fs.chmod(filePath, mode);
}

async function mode(filePath: string): Promise<number> {
  return (await fs.stat(filePath)).mode & 0o777;
}

function byPath(status: Pick<RuntimeStatus, 'files'>, relativePath: string): RuntimeFileStatus {
  const file = status.files.find((candidate) => candidate.path === relativePath);
  assert.ok(file, `missing runtime status for ${relativePath}`);
  return file;
}

function completed(result: ApplyRuntimeResult): CompletedApplyRuntimeResult {
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, false);
  if (!result.ok || result.dryRun) throw new Error('expected a completed apply result');
  return result;
}

test('scanTree is deterministic and records hashes plus executable intent', async (t: TestContext) => {
  const { sourceDir } = await fixture(t);
  await write(path.join(sourceDir, 'z.txt'), 'z\n', 0o755);
  await write(path.join(sourceDir, 'nested', 'a.txt'), 'a\n', 0o644);

  const first = await scanTree(sourceDir);
  assert.deepEqual(Object.keys(first.files), ['nested/a.txt', 'z.txt']);
  assert.match(first.files['nested/a.txt'].sha256, /^[a-f0-9]{64}$/);
  assert.equal(first.files['nested/a.txt'].executable, false);
  assert.equal(first.files['nested/a.txt'].mode, 0o600);
  assert.equal(first.files['z.txt'].executable, true);
  assert.equal(first.files['z.txt'].mode, 0o700);
  assert.equal(first.digest, await treeDigest(sourceDir));

  await fs.utimes(path.join(sourceDir, 'z.txt'), new Date(), new Date());
  assert.equal(await treeDigest(sourceDir), first.digest, 'timestamps do not affect the tree digest');
  await fs.chmod(path.join(sourceDir, 'z.txt'), 0o644);
  assert.notEqual(await treeDigest(sourceDir), first.digest, 'the executable bit affects the digest');
});

test('scanTree rejects symlinks, special files, and forbidden runtime state', async (t: TestContext) => {
  const { sourceDir } = await fixture(t);
  await write(path.join(sourceDir, 'real.txt'), 'ok');
  await fs.symlink('real.txt', path.join(sourceDir, 'link.txt'));
  await assert.rejects(scanTree(sourceDir), { code: 'PIA_SYMLINK_REJECTED' });
  await fs.unlink(path.join(sourceDir, 'link.txt'));

  for (const relativePath of [
    'auth.json',
    'nested/oauth.json',
    '.env.production',
    'cache/item',
    '.git/config',
    '.pia-leftover',
  ]) {
    const isolated = path.join(path.dirname(sourceDir), `forbidden-${relativePath.replaceAll('/', '-')}`);
    await fs.mkdir(isolated, { recursive: true });
    await write(path.join(isolated, relativePath), 'secret');
    await assert.rejects(scanTree(isolated), { code: 'PIA_FORBIDDEN_PATH' }, relativePath);
  }

  if (process.platform !== 'win32') {
    const fifoSource = path.join(path.dirname(sourceDir), 'fifo-source');
    await fs.mkdir(fifoSource);
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync('mkfifo', [path.join(fifoSource, 'pipe')]);
    if (result.status === 0) {
      await assert.rejects(scanTree(fifoSource), { code: 'PIA_NON_FILE_REJECTED' });
    }
  }
});

test('resource directories may use names that are reserved only at the agent root', async (t: TestContext) => {
  const { sourceDir } = await fixture(t);
  await write(path.join(sourceDir, 'skills/git/SKILL.md'), '# Git\n');
  await write(path.join(sourceDir, 'extensions/cache/index.ts'), 'export default () => {};\n');
  const tree = await scanTree(sourceDir);
  assert.ok(tree.files['skills/git/SKILL.md']);
  assert.ok(tree.files['extensions/cache/index.ts']);
});

test('initial apply is atomic, private, idempotent, and preserves unowned files', async (t: TestContext) => {
  const { sourceDir, targetDir, manifestPath } = await fixture(t);
  await write(path.join(sourceDir, 'settings.json'), '{"theme":"dark"}\n');
  await write(path.join(sourceDir, 'extensions', 'tool.js'), 'export default 1;\n', 0o755);
  await write(path.join(targetDir, 'local-note.txt'), 'leave me alone', 0o644);

  const result = completed(await applyRuntime({ sourceDir, targetDir, manifestPath }));
  assert.equal(result.ok, true);
  assert.equal(result.applied, true);
  assert.equal(result.after.state, 'clean');
  assert.equal(await fs.readFile(path.join(targetDir, 'local-note.txt'), 'utf8'), 'leave me alone');
  assert.equal(await mode(targetDir), 0o700);
  assert.equal(await mode(path.join(targetDir, 'extensions')), 0o700);
  assert.equal(await mode(path.join(targetDir, 'settings.json')), 0o600);
  assert.equal(await mode(path.join(targetDir, 'extensions', 'tool.js')), 0o700);
  assert.equal(await mode(manifestPath), 0o600);

  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  assert.deepEqual(Object.keys(manifest.files), ['extensions/tool.js', 'settings.json']);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.target, path.resolve(targetDir));
  assert.deepEqual(manifest.files['settings.json'], {
    sha256: byPath(result.after, 'settings.json').source?.sha256,
    executable: false,
    mode: 0o600,
  });

  const second = await applyRuntime({ sourceDir, targetDir, manifestPath });
  assert.equal(second.ok, true);
  assert.equal(second.applied, false);
  assert.equal(second.changed, false);
  assert.deepEqual(second.actions, []);
});

test('an interrupted first apply recovers matching content and writes the missing manifest', async (t: TestContext) => {
  const { sourceDir, targetDir, manifestPath } = await fixture(t);
  await write(path.join(sourceDir, 'already-written.txt'), 'same bytes');
  await write(path.join(sourceDir, 'not-written-yet.txt'), 'remaining bytes');
  await write(path.join(sourceDir, 'wrong-permissions.txt'), 'same content, wrong mode');
  await write(path.join(targetDir, 'already-written.txt'), 'same bytes', 0o600);
  await write(path.join(targetDir, 'wrong-permissions.txt'), 'same content, wrong mode', 0o644);

  const before = await getRuntimeStatus({ sourceDir, targetDir, manifestPath });
  const recoverable = byPath(before, 'already-written.txt');
  assert.equal(recoverable.status, 'source-only-update');
  assert.equal(recoverable.reason, 'unowned-target-matches-source');
  assert.equal(recoverable.blocking, false);
  assert.equal(byPath(before, 'wrong-permissions.txt').reason, 'unowned-target-matches-source');
  assert.equal(before.canApply, true);

  const result = completed(await applyRuntime({ sourceDir, targetDir, manifestPath }));
  assert.deepEqual(
    result.actions.map((action) => action.action),
    ['ensure-target', 'adopt', 'write', 'write', 'write-manifest'],
  );
  assert.equal(await fs.readFile(path.join(targetDir, 'already-written.txt'), 'utf8'), 'same bytes');
  assert.equal(await fs.readFile(path.join(targetDir, 'not-written-yet.txt'), 'utf8'), 'remaining bytes');
  assert.equal(await mode(path.join(targetDir, 'wrong-permissions.txt')), 0o600);
  assert.equal(result.after.state, 'clean');
  assert.equal(result.after.manifestExists, true);
});

test('a source-only update applies normally and converged edits only update the manifest', async (t: TestContext) => {
  const { sourceDir, targetDir, manifestPath } = await fixture(t);
  const sourceFile = path.join(sourceDir, 'settings.json');
  const targetFile = path.join(targetDir, 'settings.json');
  await write(sourceFile, 'one');
  await applyRuntime({ sourceDir, targetDir, manifestPath });

  await write(sourceFile, 'two');
  let status = await getRuntimeStatus({ sourceDir, targetDir, manifestPath });
  assert.equal(byPath(status, 'settings.json').status, 'source-only-update');
  const update = await applyRuntime({ sourceDir, targetDir, manifestPath });
  assert.equal(update.ok, true);
  assert.equal(await fs.readFile(targetFile, 'utf8'), 'two');

  await write(sourceFile, 'three');
  await write(targetFile, 'three', 0o600);
  status = await getRuntimeStatus({ sourceDir, targetDir, manifestPath });
  assert.equal(byPath(status, 'settings.json').reason, 'source-and-runtime-converged');
  const converged = completed(await applyRuntime({ sourceDir, targetDir, manifestPath }));
  assert.equal(converged.actions.some((action) => action.action === 'adopt'), true);
  assert.equal(converged.actions.some((action) => action.action === 'write'), false);
  assert.equal(converged.after.state, 'clean');
});

test('runtime drift is refused by default and force reasserts source content and mode', async (t: TestContext) => {
  const { sourceDir, targetDir, manifestPath } = await fixture(t);
  await write(path.join(sourceDir, 'config.json'), 'source');
  await applyRuntime({ sourceDir, targetDir, manifestPath });
  await write(path.join(targetDir, 'config.json'), 'runtime', 0o644);

  const status = await getRuntimeStatus({ sourceDir, targetDir, manifestPath });
  assert.equal(byPath(status, 'config.json').status, 'runtime-drift');
  const refused = await applyRuntime({ sourceDir, targetDir, manifestPath });
  assert.equal(refused.ok, false);
  assert.equal(refused.refused, true);
  assert.equal(await fs.readFile(path.join(targetDir, 'config.json'), 'utf8'), 'runtime');

  const forced = completed(await applyRuntime({ sourceDir, targetDir, manifestPath, force: true }));
  assert.equal(forced.ok, true);
  assert.equal(await fs.readFile(path.join(targetDir, 'config.json'), 'utf8'), 'source');
  assert.equal(await mode(path.join(targetDir, 'config.json')), 0o600);
  assert.equal(forced.after.state, 'clean');
});

test('divergent source and runtime edits conflict until force chooses source', async (t: TestContext) => {
  const { sourceDir, targetDir, manifestPath } = await fixture(t);
  await write(path.join(sourceDir, 'config.json'), 'base');
  await applyRuntime({ sourceDir, targetDir, manifestPath });
  await write(path.join(sourceDir, 'config.json'), 'source edit');
  await write(path.join(targetDir, 'config.json'), 'runtime edit', 0o600);

  const status = await getRuntimeStatus({ sourceDir, targetDir, manifestPath });
  assert.equal(byPath(status, 'config.json').status, 'conflict');
  assert.equal((await applyRuntime({ sourceDir, targetDir, manifestPath })).refused, true);
  const forced = await applyRuntime({ sourceDir, targetDir, manifestPath, force: true });
  assert.equal(forced.ok, true);
  assert.equal(await fs.readFile(path.join(targetDir, 'config.json'), 'utf8'), 'source edit');
});

test('stale files are removed only when unchanged unless force is explicit', async (t: TestContext) => {
  const clean = await fixture(t);
  await write(path.join(clean.sourceDir, 'old.txt'), 'old');
  await applyRuntime(clean);
  await fs.unlink(path.join(clean.sourceDir, 'old.txt'));
  let status = await getRuntimeStatus(clean);
  assert.equal(byPath(status, 'old.txt').status, 'stale');
  const removed = completed(await applyRuntime(clean));
  await assert.rejects(fs.access(path.join(clean.targetDir, 'old.txt')), { code: 'ENOENT' });
  assert.equal(removed.after.files.length, 0);

  const changed = await fixture(t);
  await write(path.join(changed.sourceDir, 'old.txt'), 'old');
  await applyRuntime(changed);
  await fs.unlink(path.join(changed.sourceDir, 'old.txt'));
  await write(path.join(changed.targetDir, 'old.txt'), 'runtime edit', 0o600);
  status = await getRuntimeStatus(changed);
  assert.equal(byPath(status, 'old.txt').status, 'conflict');
  assert.equal((await applyRuntime(changed)).refused, true);
  assert.equal(await fs.readFile(path.join(changed.targetDir, 'old.txt'), 'utf8'), 'runtime edit');
  const forced = await applyRuntime({ ...changed, force: true });
  assert.equal(forced.ok, true);
  await assert.rejects(fs.access(path.join(changed.targetDir, 'old.txt')), { code: 'ENOENT' });
});

test('new source files never overwrite unowned runtime files, even with force', async (t: TestContext) => {
  const { sourceDir, targetDir, manifestPath } = await fixture(t);
  await write(path.join(sourceDir, 'collision.txt'), 'declarative');
  await write(path.join(targetDir, 'collision.txt'), 'runtime-owned', 0o600);

  const status = await getRuntimeStatus({ sourceDir, targetDir, manifestPath });
  const collision = byPath(status, 'collision.txt');
  assert.equal(collision.status, 'conflict');
  assert.equal(collision.owned, false);
  assert.equal(collision.blocking, true);
  assert.equal(status.canForceApply, false);

  const forced = await applyRuntime({ sourceDir, targetDir, manifestPath, force: true });
  assert.equal(forced.refused, true);
  assert.equal(forced.reason, 'unowned-or-obstructed-target');
  assert.equal(await fs.readFile(path.join(targetDir, 'collision.txt'), 'utf8'), 'runtime-owned');
  await assert.rejects(fs.access(manifestPath), { code: 'ENOENT' });
});

test('dry-run reports actions without creating target or manifest', async (t: TestContext) => {
  const { sourceDir, targetDir, manifestPath } = await fixture(t);
  await write(path.join(sourceDir, 'config.json'), '{}');
  const result = await applyRuntime({ sourceDir, targetDir, manifestPath, dryRun: true });
  assert.equal(result.ok, true);
  assert.equal(result.applied, false);
  assert.deepEqual(
    result.actions.map((action) => action.action),
    ['ensure-target', 'write', 'write-manifest'],
  );
  await assert.rejects(fs.access(targetDir), { code: 'ENOENT' });
  await assert.rejects(fs.access(manifestPath), { code: 'ENOENT' });
});

test('an empty source still creates and secures the exact runtime target', async (t: TestContext) => {
  const { root, sourceDir, targetDir, manifestPath } = await fixture(t);
  const result = completed(await applyRuntime({ sourceDir, targetDir, manifestPath }));
  assert.equal(result.ok, true);
  assert.equal(await mode(targetDir), 0o700);
  assert.equal(result.after.targetExists, true);
  assert.equal(result.after.state, 'clean');
  assert.deepEqual(result.manifest.files, {});

  const outside = path.join(root, 'outside');
  const linkedTarget = path.join(root, 'linked-target');
  const linkedManifest = path.join(root, 'linked-state', 'manifest.json');
  await fs.mkdir(outside);
  await fs.symlink(outside, linkedTarget);
  await assert.rejects(
    getRuntimeStatus({ sourceDir, targetDir: linkedTarget, manifestPath: linkedManifest }),
    { code: 'PIA_SYMLINK_REJECTED' },
  );
});

test('manifest validation rejects target mismatch, traversal, and oversized paths', async (t: TestContext) => {
  const { sourceDir, targetDir, manifestPath } = await fixture(t);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await write(
    manifestPath,
    `${JSON.stringify({ schemaVersion: 1, target: `${targetDir}-other`, files: {} })}\n`,
    0o600,
  );
  await assert.rejects(getRuntimeStatus({ sourceDir, targetDir, manifestPath }), {
    code: 'PIA_MANIFEST_TARGET_MISMATCH',
  });

  await write(
    manifestPath,
    `${JSON.stringify({
      schemaVersion: 1,
      target: path.resolve(targetDir),
      files: {
        '../escape': { sha256: '0'.repeat(64), executable: false, mode: 0o600 },
      },
    })}\n`,
    0o600,
  );
  await assert.rejects(getRuntimeStatus({ sourceDir, targetDir, manifestPath }), {
    code: 'PIA_PATH_TRAVERSAL',
  });

  await write(
    manifestPath,
    `${JSON.stringify({
      schemaVersion: 1,
      target: path.resolve(targetDir),
      files: {
        [`${'a'.repeat(256)}.json`]: { sha256: '0'.repeat(64), executable: false, mode: 0o600 },
      },
    })}\n`,
    0o600,
  );
  await assert.rejects(getRuntimeStatus({ sourceDir, targetDir, manifestPath }), {
    code: 'PIA_INVALID_PATH',
  });
});

test('managed target symlinks are rejected instead of followed', async (t: TestContext) => {
  const { root, sourceDir, targetDir, manifestPath } = await fixture(t);
  await write(path.join(sourceDir, 'config.json'), 'safe');
  await applyRuntime({ sourceDir, targetDir, manifestPath });
  const outside = path.join(root, 'outside.json');
  await write(outside, 'outside');
  await fs.unlink(path.join(targetDir, 'config.json'));
  await fs.symlink(outside, path.join(targetDir, 'config.json'));

  await assert.rejects(getRuntimeStatus({ sourceDir, targetDir, manifestPath }), {
    code: 'PIA_SYMLINK_REJECTED',
  });
  assert.equal(await fs.readFile(outside, 'utf8'), 'outside');
});

test('diffRuntime reports only managed runtime paths and optional parent changes', async (t: TestContext) => {
  const { root, sourceDir, targetDir, manifestPath } = await fixture(t);
  const parentDir = path.join(root, 'parent');
  await write(path.join(parentDir, 'common.txt'), 'parent');
  await write(path.join(parentDir, 'removed.txt'), 'parent only');
  await write(path.join(sourceDir, 'common.txt'), 'child');
  await write(path.join(sourceDir, 'added.txt'), 'child only');
  await applyRuntime({ sourceDir, targetDir, manifestPath });
  await write(path.join(targetDir, 'common.txt'), 'runtime edit', 0o600);
  await write(path.join(targetDir, 'unowned.txt'), 'do not report', 0o600);

  const result = await diffRuntime({ sourceDir, targetDir, manifestPath, parentDir });
  assert.deepEqual(
    result.files.map((file) => file.path),
    ['added.txt', 'common.txt'],
  );
  assert.equal(byPath(result.runtime, 'common.txt').status, 'runtime-drift');
  assert.ok(result.parent);
  assert.deepEqual(
    Object.fromEntries(result.parent.files.map((file) => [file.path, file.status])),
    {
      'added.txt': 'added',
      'common.txt': 'modified',
      'removed.txt': 'removed',
    },
  );
  assert.equal(result.text, null);
});
