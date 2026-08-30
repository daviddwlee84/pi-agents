import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';

import {
  assertForkCompatible,
  buildActiveBranch,
  canonicalCwd,
  listSessions,
  parseSessionContent,
  parseSessionFile,
  projectKey,
  resolveSession,
  sessionLeafDir,
  type SessionEntry,
  type SessionHeader,
} from '../src/sessions.ts';

async function fixture(t: TestContext): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pia-sessions-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

function jsonl(records: readonly unknown[]): string {
  return `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
}

function piHeader(id: string, cwd = '/work/project'): SessionHeader {
  return { type: 'session', version: 3, id, timestamp: '2026-08-30T00:00:00.000Z', cwd };
}

function ompTitleSlot(title: string): string {
  const base = {
    type: 'title',
    v: 1,
    title,
    source: 'user',
    updatedAt: '2026-08-30T00:00:00.000Z',
    pad: '',
  };
  const unpadded = `${JSON.stringify(base)}\n`;
  base.pad = ' '.repeat(256 - Buffer.byteLength(unpadded));
  const result = `${JSON.stringify(base)}\n`;
  assert.equal(Buffer.byteLength(result), 256);
  return result;
}

function message(id: string, parentId: string | null, role: string, content: unknown): SessionEntry {
  return {
    type: 'message',
    id,
    parentId,
    timestamp: `2026-08-30T00:00:${id.slice(-2)}.000Z`,
    message: { role, content },
  };
}

test('project keys canonicalize cwd and session leaves isolate or share only by explicit policy', async (t) => {
  const root = await fixture(t);
  const project = path.join(root, 'My Project');
  const link = path.join(root, 'project-link');
  await fs.mkdir(project);
  await fs.symlink(project, link);

  assert.equal(canonicalCwd(link), canonicalCwd(project));
  assert.equal(projectKey(link), projectKey(project));
  assert.match(projectKey(project), /^My-Project-[a-f0-9]{12}$/);
  const longKey = projectKey(path.join(root, 'x'.repeat(1_000)));
  assert.ok(Buffer.byteLength(longKey, 'utf8') <= 160);
  assert.match(longKey, /-[a-f0-9]{12}$/);

  const isolated = sessionLeafDir({
    stateRoot: path.join(root, 'state'),
    engine: 'pi',
    comboName: 'base',
    cwd: project,
    history: { mode: 'isolated' },
  });
  assert.equal(isolated, path.join(root, 'state', 'sessions', 'pi', 'base', projectKey(project)));

  const shared = sessionLeafDir({
    stateRoot: path.join(root, 'state'),
    engine: 'pi',
    comboName: 'research',
    cwd: project,
    history: { mode: 'shared', group: 'daily' },
  });
  assert.equal(shared, path.join(root, 'state', 'sessions', 'pi', 'shared', 'daily', projectKey(project)));
  assert.match(sessionLeafDir({
    stateRoot: root,
    engine: 'pi',
    comboName: 'base',
    cwd: project,
    history: { mode: 'shared', group: 'a'.repeat(60) },
  }), new RegExp(`${'a'.repeat(60)}`));
  for (const group of ['../escape', 'daily.', 'a'.repeat(61)]) {
    assert.throws(
      () => sessionLeafDir({
        stateRoot: root,
        engine: 'pi',
        comboName: 'base',
        cwd: project,
        history: { mode: 'shared', group },
      }),
      { code: 'PIA_INVALID_SESSION_SCOPE' },
    );
  }
});

test('Pi parsing follows the last id-bearing entry parent chain and ignores abandoned branches', () => {
  const records = [
    piHeader('pi-session'),
    message('00000001', null, 'user', 'root goal'),
    message('00000002', '00000001', 'assistant', [{ type: 'text', text: 'abandoned answer' }]),
    message('00000003', '00000001', 'user', 'chosen branch'),
    message('00000004', '00000003', 'assistant', [{ type: 'text', text: 'chosen answer' }]),
    {
      type: 'session_info',
      id: '00000005',
      parentId: '00000004',
      timestamp: '2026-08-30T00:00:05.000Z',
      name: 'Named session',
    },
  ];
  const parsed = parseSessionContent(jsonl(records), { engine: 'pi', filePath: '/tmp/pi.jsonl' });
  assert.equal(parsed.id, 'pi-session');
  assert.equal(parsed.cwd, '/work/project');
  assert.equal(parsed.title, 'Named session');
  assert.deepEqual(parsed.activeBranch.map((entry) => entry.id), [
    '00000001',
    '00000003',
    '00000004',
    '00000005',
  ]);
  assert.deepEqual(buildActiveBranch(parsed).map((entry) => entry.id), parsed.activeBranch.map((entry) => entry.id));
});

test('OMP parsing accepts its optional fixed title slot and header-first legacy files', () => {
  const header = piHeader('omp-session', '/work/omp');
  header.title = 'header fallback';
  const content = `${ompTitleSlot('Current OMP title')}${jsonl([
    header,
    message('10000001', null, 'user', 'hello'),
  ])}`;
  const parsed = parseSessionContent(content, { engine: 'omp', filePath: '/tmp/omp.jsonl' });
  assert.equal(parsed.title, 'Current OMP title');
  assert.ok(parsed.titleSlot);
  assert.equal(parsed.titleSlot.type, 'title');
  assert.equal(parsed.entries.length, 1);

  const legacy = parseSessionContent(jsonl([header]), { engine: 'omp' });
  assert.equal(legacy.title, 'header fallback');
  assert.equal(legacy.titleSlot, undefined);
  assert.throws(() => parseSessionContent(content, { engine: 'pi' }), { code: 'PIA_FOREIGN_SESSION' });

  const shortSlot = `${JSON.stringify({
    type: 'title',
    v: 1,
    title: 'short',
    updatedAt: '2026-08-30T00:00:00.000Z',
    pad: '',
  })}\n${jsonl([header])}`;
  assert.throws(() => parseSessionContent(shortSlot, { engine: 'omp' }), { code: 'PIA_INVALID_SESSION' });
});

test('session parser rejects broken parent chains, duplicate IDs, and malformed headers', () => {
  assert.throws(
    () => parseSessionContent(jsonl([
      piHeader('broken'),
      message('00000001', 'missing', 'user', 'hello'),
    ]), { engine: 'pi' }),
    { code: 'PIA_INVALID_SESSION_TREE' },
  );
  assert.throws(
    () => parseSessionContent(jsonl([
      piHeader('duplicate'),
      message('00000001', null, 'user', 'one'),
      message('00000001', null, 'user', 'two'),
    ]), { engine: 'pi' }),
    { code: 'PIA_INVALID_SESSION_TREE' },
  );
  assert.throws(
    () => parseSessionContent(jsonl([{ type: 'message', id: 'no-header' }]), { engine: 'pi' }),
    { code: 'PIA_INVALID_SESSION' },
  );
});

test('list and resolve support newest, absolute paths, and unambiguous ID prefixes', async (t) => {
  const root = await fixture(t);
  const sessionDir = path.join(root, 'sessions');
  await fs.mkdir(sessionDir);
  const olderPath = path.join(sessionDir, 'older.jsonl');
  const newerPath = path.join(sessionDir, 'newer.jsonl');
  await fs.writeFile(olderPath, jsonl([piHeader('abc11111')]), 'utf8');
  await fs.writeFile(newerPath, jsonl([piHeader('def22222')]), 'utf8');
  await fs.utimes(olderPath, new Date(1_000), new Date(1_000));
  await fs.utimes(newerPath, new Date(2_000), new Date(2_000));

  const listed = await listSessions({ sessionDir, engine: 'pi' });
  assert.deepEqual(listed.map((session) => session.id), ['def22222', 'abc11111']);
  assert.equal((await resolveSession({ sessionDir, latest: true, engine: 'pi' })).id, 'def22222');
  assert.equal((await resolveSession({ sessionDir, selector: 'ABC', engine: 'pi' })).path, olderPath);
  assert.equal((await resolveSession({ sessionDir, selector: newerPath, engine: 'pi' })).id, 'def22222');
  assert.equal((await parseSessionFile(olderPath, { engine: 'pi' })).mtimeMs, 1_000);

  await fs.writeFile(path.join(sessionDir, 'ambiguous.jsonl'), jsonl([piHeader('abc99999')]), 'utf8');
  await assert.rejects(
    resolveSession({ sessionDir, selector: 'abc', engine: 'pi' }),
    { code: 'PIA_AMBIGUOUS_SESSION' },
  );
  await assert.rejects(resolveSession({ sessionDir, engine: 'pi' }), { code: 'PIA_SESSION_SELECTOR_REQUIRED' });
});

test('raw fork compatibility rejects foreign harness formats', () => {
  assert.equal(assertForkCompatible({ sourceEngine: 'pi', targetEngine: 'pi' }), true);
  assert.throws(
    () => assertForkCompatible({ sourceEngine: 'pi', targetEngine: 'omp' }),
    { code: 'PIA_FOREIGN_SESSION' },
  );
});
