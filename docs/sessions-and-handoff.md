# Sessions and handoff

Configuration can be copied safely; live session files cannot. `pia` therefore
separates normal history, same-engine forks, and cross-harness handoffs into
three explicit operations.

## Session isolation

An isolated combo stores history below:

```text
${PIA_STATE_HOME:-${XDG_STATE_HOME:-~/.local/state}/pi-agents}/
  sessions/<engine>/<combo-name>/<project-key>/
```

With `history.mode: shared`, the leaf instead uses:

```text
sessions/<engine>/shared/<group>/<project-key>/
```

The project key is derived from the canonical working directory. Thus two
projects do not accidentally resume one another, and a shared group never
crosses the Pi/OMP boundary. Use `pia sessions <combo>` to inspect the sessions
available under the combo's effective policy.

## Same-engine forks

```sh
pia fork pi/base pi/research --latest -- <target arguments>
pia fork pi/base pi/research --session <id-or-path> -- <target arguments>
```

The first two arguments are source and target combo IDs. Forking is allowed
only when both use the same engine. `--latest` selects the newest source session;
`--session` accepts an unambiguous session-ID prefix from the source combo's
effective session root, or an explicit absolute path.

`pia` delegates to the target harness's native `--fork` behavior and creates a
new target session; it does not append to or byte-copy the source session. Use a
fork when the target should retain the native conversation tree and both sides
understand exactly the same session format.

Although both snapshots use a session format identified as version 3, they are
not wire-compatible. OMP includes a title slot and additional entry types, so
raw cross-harness session sharing is prohibited. See the pinned
[Pi session loader](https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/coding-agent/src/core/session-manager.ts#L548-L553)
and [OMP session format](https://github.com/can1357/oh-my-pi/blob/51f03804476c3fd3c15748ae07e4849d1efc883b/docs/session.md#L61-L66).

## Deterministic handoff

```sh
pia handoff pi/research omp/base --latest \
  --goal "Continue the provider comparison" -- <target arguments>
```

Handoff supports same- or cross-engine transfer. It reads the selected source
session without changing it and produces a private Markdown artifact under
`$PIA_STATE_HOME/handoffs/`. Generation is local and deterministic; it does not
ask another model to summarise the transcript.

The extractor:

1. Prefers the newest compaction summary; if none exists, keeps the first user
   goal and a bounded set of recent messages.
2. Adds source, target, and session provenance, canonical working directory,
   Git branch, `HEAD`, status, and diff-stat.
3. Excludes hidden thinking, images, tool arguments, and successful tool
   output. Failed tool output is capped at 2 KiB.
4. Caps the document at 128 KiB and reports omitted or truncated blocks.
5. Runs the agent-history-hygiene redactor, then validates with `gitleaks`.
   Any redaction or validation failure aborts the handoff.
6. Writes the artifact with mode `0600` and starts a fresh target session with
   it as the first attachment.

Use `--session <id-or-absolute-path>` instead of `--latest` to select
explicitly. `--max-bytes N` can lower or raise the 128 KiB default (minimum
4096). Use `--no-run` to generate the document without launching the target:

```sh
pia handoff pi/research omp/base --session <id-or-path> \
  --goal "Continue the provider comparison" --no-run
```

Review the generated file before sharing it outside the machine. Redaction is a
fail-closed safety boundary, not a promise that arbitrary prose contains no
sensitive business context.

Malformed session data, a missing source session, Git provenance failure in the
current project, an unavailable redactor or `gitleaks`, and an oversized/unsafe
artifact all fail before target launch. `pia doctor` checks the required helper
commands.
