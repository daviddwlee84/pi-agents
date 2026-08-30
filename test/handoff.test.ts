import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';

import {
  FAILED_TOOL_EXCERPT_BYTES,
  collectGitProvenance,
  createHandoff,
  renderHandoff,
  type GitProvenance,
  type HandoffCommandOptions,
  type HandoffCommandRunner,
  type HandoffSession,
  type RenderHandoffOptions,
} from '../src/handoff.ts';
import {
  buildActiveBranch,
  type SessionEntry,
  type SessionHeader,
} from '../src/sessions.ts';

interface SessionFixtureFields {
  id?: string;
  cwd?: string;
  path?: string;
  title?: string;
}

interface CommandCall {
  command: string;
  args: string[];
  options: HandoffCommandOptions;
}

async function fixture(t: TestContext): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pia-handoff-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

function header(id = 'session-id'): SessionHeader {
  return {
    type: 'session',
    version: 3,
    id,
    timestamp: '2026-08-30T00:00:00.000Z',
    cwd: '/work/project',
  };
}

function entry(
  type: string,
  id: string,
  parentId: string | null,
  fields: Record<string, unknown> = {},
): SessionEntry {
  return { type, id, parentId, timestamp: `2026-08-30T00:00:${id.slice(-2)}.000Z`, ...fields };
}

function message(
  id: string,
  parentId: string | null,
  role: string,
  content: unknown,
  fields: Record<string, unknown> = {},
): SessionEntry {
  return entry('message', id, parentId, { message: { role, content, ...fields } });
}

function session(entries: SessionEntry[], fields: SessionFixtureFields = {}): HandoffSession {
  return {
    id: fields.id || 'session-id',
    cwd: fields.cwd || '/work/project',
    path: fields.path || '/state/session.jsonl',
    title: fields.title,
    entries,
    activeBranch: buildActiveBranch(entries),
  };
}

const git = {
  branch: 'feature/handoff',
  head: '0123456789abcdef',
  status: ' M src/file.ts',
  diffStat: ' src/file.ts | 2 ++',
} satisfies GitProvenance;

test('handoff rendering is deterministic and omits thinking, images, tool arguments, and successful output', () => {
  const hugeFailure = `failure-start\n${'x'.repeat(FAILED_TOOL_EXCERPT_BYTES * 2)}\nfailure-end`;
  const entries = [
    message('00000001', null, 'user', [
      { type: 'text', text: 'Implement the parser.' },
      { type: 'image', data: 'BASE64-IMAGE-SHOULD-NOT-APPEAR', mimeType: 'image/png' },
    ]),
    message('00000002', '00000001', 'assistant', [
      { type: 'thinking', thinking: 'PRIVATE REASONING SHOULD NOT APPEAR' },
      { type: 'text', text: 'I inspected the format.' },
      { type: 'toolCall', id: 'call-1', name: 'read', arguments: { token: 'TOOL-ARG-SECRET' } },
    ]),
    message('00000003', '00000002', 'toolResult', [{ type: 'text', text: 'SUCCESS-OUTPUT' }], {
      toolName: 'read',
      isError: false,
    }),
    message('00000004', '00000003', 'toolResult', [{ type: 'text', text: hugeFailure }], {
      toolName: 'bash',
      isError: true,
    }),
    message('00000005', '00000004', 'assistant', [{ type: 'text', text: 'I found the failure.' }]),
  ];
  const options = {
    sourceEngine: 'pi',
    sourceCombo: 'pi/base',
    session: session(entries, { title: 'Parser work' }),
    goal: 'Continue the implementation safely.',
    git,
  } satisfies RenderHandoffOptions;
  const first = renderHandoff(options);
  const second = renderHandoff(options);
  assert.equal(first.content, second.content);
  assert.match(first.content, /Implement the parser\./);
  assert.match(first.content, /I inspected the format\./);
  assert.match(first.content, /Tools used: `read`/);
  assert.match(first.content, /Failed tool: `bash`/);
  assert.match(first.content, /failed tool output truncated/);
  assert.doesNotMatch(first.content, /failure-end/);
  assert.doesNotMatch(first.content, /PRIVATE REASONING/);
  assert.doesNotMatch(first.content, /BASE64-IMAGE/);
  assert.doesNotMatch(first.content, /TOOL-ARG-SECRET/);
  assert.doesNotMatch(first.content, /SUCCESS-OUTPUT/);
});

test('latest compaction or reset boundary determines the portable context window', () => {
  const compacted = [
    message('00000001', null, 'user', 'old user context'),
    message('00000002', '00000001', 'assistant', [{ type: 'text', text: 'old assistant context' }]),
    entry('compaction', '00000003', '00000002', { summary: 'Summary of the old work.' }),
    message('00000004', '00000003', 'user', 'request after compaction'),
    message('00000005', '00000004', 'assistant', [{ type: 'text', text: 'reply after compaction' }]),
  ];
  const compactedResult = renderHandoff({
    sourceEngine: 'pi',
    sourceCombo: 'pi/base',
    session: session(compacted),
    goal: 'Continue.',
    git,
  });
  assert.deepEqual(compactedResult.boundary, { type: 'compaction', id: '00000003', sourceIndex: 2 });
  assert.match(compactedResult.content, /Summary of the old work\./);
  assert.match(compactedResult.content, /request after compaction/);
  assert.doesNotMatch(compactedResult.content, /old user context/);

  const reset = [
    ...compacted,
    entry('reset_boundary', '00000006', '00000005'),
    message('00000007', '00000006', 'user', 'fresh request after reset'),
  ];
  const resetResult = renderHandoff({
    sourceEngine: 'omp',
    sourceCombo: 'omp/base',
    session: session(reset),
    goal: 'Continue fresh work.',
    git,
  });
  assert.deepEqual(resetResult.boundary, { type: 'reset_boundary', id: '00000006', sourceIndex: 5 });
  assert.match(resetResult.content, /fresh request after reset/);
  assert.doesNotMatch(resetResult.content, /Summary of the old work/);
  assert.doesNotMatch(resetResult.content, /request after compaction/);
});

test('byte limiting preserves the first goal and newest context while reporting omissions', () => {
  const entries: SessionEntry[] = [];
  let parentId: string | null = null;
  for (let index = 1; index <= 14; index += 1) {
    const id = String(index).padStart(8, '0');
    const role = index % 2 === 1 ? 'user' : 'assistant';
    const marker = index === 1 ? 'FIRST-CONVERSATION-GOAL' : index === 14 ? 'NEWEST-CONTEXT' : `middle-${index}`;
    const content = role === 'assistant'
      ? [{ type: 'text', text: `${marker} ${'x'.repeat(260)}` }]
      : `${marker} ${'x'.repeat(260)}`;
    entries.push(message(id, parentId, role, content));
    parentId = id;
  }
  const result = renderHandoff({
    sourceEngine: 'pi',
    sourceCombo: 'pi/base',
    session: session(entries),
    goal: 'TARGET-HANDOFF-GOAL',
    git,
    maxBytes: 1_800,
  });
  assert.ok(result.bytes <= 1_800);
  assert.ok(result.omittedBlocks > 0);
  assert.match(result.content, /TARGET-HANDOFF-GOAL/);
  assert.match(result.content, /FIRST-CONVERSATION-GOAL/);
  assert.match(result.content, /NEWEST-CONTEXT/);
  assert.match(result.content, /conversation block\(s\) omitted/);
});

test('Git provenance uses captured command output and never needs inherited stdio', async () => {
  const calls: CommandCall[] = [];
  const runner: HandoffCommandRunner = (command, args, options) => {
    calls.push({ command, args, options });
    const key = args.join(' ');
    const stdout = {
      'branch --show-current': 'main\n',
      'rev-parse HEAD': 'deadbeef\n',
      'status --short --untracked-files=all': '',
      'diff --stat --no-ext-diff HEAD': ' a.ts | 1 +\n',
    }[key];
    return { status: 0, stdout, stderr: '' };
  };
  assert.deepEqual(await collectGitProvenance({ repoRoot: '/repo', commandRunner: runner }), {
    cwd: '/repo',
    branch: 'main',
    head: 'deadbeef',
    status: '',
    diffStat: ' a.ts | 1 +',
  });
  assert.equal(calls.length, 4);
  assert.ok(calls.every((call) => call.command === 'git' && call.options.cwd === '/repo'));
});

test('createHandoff redacts, verifies stdin, and atomically saves a private artifact', async (t) => {
  const root = await fixture(t);
  const repoRoot = path.join(root, 'repo');
  const projectCwd = path.join(root, 'work-project');
  const stateRoot = path.join(root, 'state');
  const sessionPath = path.join(root, 'source.jsonl');
  const redactorPath = path.join(root, 'redactor.py');
  const gitleaksConfig = path.join(root, 'gitleaks.toml');
  await fs.mkdir(repoRoot);
  await fs.mkdir(projectCwd);
  await fs.writeFile(redactorPath, '# fake\n');
  await fs.writeFile(gitleaksConfig, '# fake\n');
  await fs.writeFile(sessionPath, `${[
    header('safe-session'),
    message('00000001', null, 'user', 'The value TOPSECRET must be scrubbed.'),
  ].map((record) => JSON.stringify(record)).join('\n')}\n`);

  const calls: CommandCall[] = [];
  const runner: HandoffCommandRunner = async (command, args, options) => {
    calls.push({ command, args, options });
    if (command === 'git') {
      assert.equal(options.cwd, projectCwd);
      const key = args.join(' ');
      const stdout = {
        'branch --show-current': 'main\n',
        'rev-parse HEAD': 'abc123\n',
        'status --short --untracked-files=all': '',
        'diff --stat --no-ext-diff HEAD': '',
      }[key];
      return { status: 0, stdout, stderr: '' };
    }
    if (command === 'python3') {
      assert.equal(options.cwd, repoRoot);
      assert.deepEqual(args.slice(0, 4), [redactorPath, '--fix', '--working-dir', '--paths']);
      const markdown = path.join(args[4]!, 'handoff.md');
      const content = await fs.readFile(markdown, 'utf8');
      await fs.writeFile(markdown, content.replaceAll('TOPSECRET', '[REDACTED:test]'));
      return { status: 0, stdout: 'scanner fingerprint must stay captured', stderr: '' };
    }
    if (command === 'gitleaks') {
      assert.equal(options.cwd, repoRoot);
      if (typeof options.input !== 'string') throw new Error('Expected captured stdin');
      assert.match(options.input, /\[REDACTED:test\]/);
      assert.doesNotMatch(options.input, /TOPSECRET/);
      assert.deepEqual(args.slice(0, 3), ['stdin', '--config', gitleaksConfig]);
      return { status: 0, stdout: '', stderr: '' };
    }
    throw new Error(`Unexpected command: ${command}`);
  };

  const result = await createHandoff({
    sourceEngine: 'pi',
    sourceCombo: 'pi/base',
    targetEngine: 'omp',
    targetCombo: 'omp/base',
    sessionPath,
    goal: 'Continue safely.',
    stateRoot,
    repoRoot,
    projectCwd,
    commandRunner: runner,
    redactorPath,
    gitleaksConfig,
  });
  assert.match(result.artifactPath, new RegExp(`${path.join(stateRoot, 'handoffs')}.+\\.md$`));
  assert.match(result.content, /\[REDACTED:test\]/);
  assert.match(result.content, /Target combo: `omp\/base`/);
  assert.deepEqual(result.target, { engine: 'omp', combo: 'omp/base' });
  assert.equal(result.projectCwd, projectCwd);
  assert.equal(path.dirname(result.artifactPath), path.join(stateRoot, 'handoffs'));
  assert.equal(await fs.readFile(result.artifactPath, 'utf8'), result.content);
  assert.equal((await fs.stat(result.artifactPath)).mode & 0o777, 0o600);
  assert.equal((await fs.stat(path.dirname(result.artifactPath))).mode & 0o777, 0o700);
  assert.equal(result.redactionStatus, 0);
  assert.equal(result.verificationStatus, 0);
  assert.equal(calls.filter((call) => call.command === 'python3').length, 1);
  assert.equal(calls.filter((call) => call.command === 'gitleaks').length, 1);
});

test('secret verification and redaction failures are fail-closed without echoing captured output', async (t) => {
  const root = await fixture(t);
  const repoRoot = path.join(root, 'repo');
  const stateRoot = path.join(root, 'state');
  const sessionPath = path.join(root, 'source.jsonl');
  const redactorPath = path.join(root, 'redactor.py');
  const gitleaksConfig = path.join(root, 'gitleaks.toml');
  await fs.mkdir(repoRoot);
  await fs.writeFile(redactorPath, '# fake\n');
  await fs.writeFile(gitleaksConfig, '# fake\n');
  await fs.writeFile(sessionPath, `${JSON.stringify(header('fail-session'))}\n`);

  const runner = (failureCommand: string): HandoffCommandRunner => async (command, args) => {
    if (command === 'git') {
      const stdout = args[0] === 'rev-parse' ? 'abc123\n' : args[0] === 'branch' ? 'main\n' : '';
      return { status: 0, stdout, stderr: '' };
    }
    if (command === failureCommand) {
      return { status: 1, stdout: 'SENSITIVE-SCANNER-OUTPUT', stderr: 'SENSITIVE-ERROR' };
    }
    return { status: 0, stdout: '', stderr: '' };
  };

  for (const [failureCommand, code] of [
    ['python3', 'PIA_HANDOFF_REDACTION_FAILED'],
    ['gitleaks', 'PIA_HANDOFF_SECRET_SCAN_FAILED'],
  ]) {
    await assert.rejects(
      createHandoff({
        sourceEngine: 'pi',
        sourceCombo: 'pi/base',
        sessionPath,
        goal: 'Continue.',
        stateRoot,
        repoRoot,
        commandRunner: runner(failureCommand),
        redactorPath,
        gitleaksConfig,
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok('code' in error);
        assert.equal(error.code, code);
        assert.doesNotMatch(error.message, /SENSITIVE/);
        return true;
      },
    );
  }
  await assert.rejects(fs.access(path.join(stateRoot, 'handoffs')), { code: 'ENOENT' });
});
