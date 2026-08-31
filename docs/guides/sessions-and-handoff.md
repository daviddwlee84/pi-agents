# Sessions and handoff

Configuration can be reviewed and materialized. Live conversation trees cannot
be assumed portable, so `pia` separates normal history, same-engine forks, and
lossy handoffs into explicit operations.

## Project-scoped history

An isolated combo stores sessions below:

```text
${PIA_STATE_HOME:-${XDG_STATE_HOME:-~/.local/state}/pi-agents}/
  sessions/<engine>/<combo-name>/<project-key>/
```

For `history.mode: shared`:

```text
sessions/<engine>/shared/<group>/<project-key>/
```

The project key is a bounded working-directory basename plus a 12-character
SHA-256 prefix of the canonical path. Sharing removes the combo layer only: it
never crosses an engine or project boundary.

List what a combo can see:

```sh
pia sessions pi/base
pia sessions pi/base --json
```

!!! warning "Session JSON is sensitive"
    `--json` returns parsed session records, including `entries` and the active
    branch—not only the ID/title/path summary shown to humans. Redirect and
    retain that output as conversation data.

## Select a session

Commands that need a source session accept exactly one selector:

- `--latest` chooses the newest file by modification time;
- `--session <id-prefix>` resolves one unambiguous ID prefix below the effective
  session root;
- `--session <absolute-path>` parses an explicit file directly after format and
  ordinary-file checks.

Ambiguous prefixes, malformed JSONL, and missing files fail before launch.

!!! warning "Absolute paths are not root-scoped"
    The current implementation does not check an absolute selector against the
    combo's effective session root. Use only absolute paths returned by
    `pia sessions <combo>` and treat any other path as an explicit trust
    decision. ID-prefix and `--latest` selection remain rooted in the effective
    session directory.

## Same-engine fork

```sh
pia fork pi/base pi/research --latest -- <target arguments>
pia fork pi/base pi/research --session <id-or-path> -- <target arguments>
```

Both combos must use the same engine. `pia` delegates to the target harness's
native `--fork` and creates a new target session; it never appends to or
byte-copies the source file.

Pi and OMP are not wire-compatible merely because both formats use version 3.
The pinned Pi [version and header](https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/coding-agent/src/core/session-manager.ts#L30-L39)
and [entry union](https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/coding-agent/src/core/session-manager.ts#L138-L150)
differ from OMP's [version-3 header and physical title slot](https://github.com/can1357/oh-my-pi/blob/51f03804476c3fd3c15748ae07e4849d1efc883b/docs/session.md#L59-L81)
and [larger entry taxonomy](https://github.com/can1357/oh-my-pi/blob/51f03804476c3fd3c15748ae07e4849d1efc883b/docs/session.md#L106-L124), so `pia`
permits native session forks only within one engine.

## Deterministic handoff

Use a handoff when the destination is a different engine or when you want a
reviewable, reduced context boundary:

```sh
pia handoff pi/research omp/base --latest \
  --goal "Continue the provider comparison" -- <target arguments>
```

Generation is local and deterministic; no model summarizes the source. The
extractor:

1. walks the active branch rather than every abandoned branch;
2. prefers the newest compaction summary or reset boundary, otherwise keeps the
   first user goal plus a bounded recent window;
3. includes source/target/session provenance and Git branch, HEAD, status, and
   diff-stat from the session project;
4. keeps visible user/assistant text and tool names;
5. excludes hidden thinking, images, tool arguments, and successful tool
   output; failed output is capped at 2 KiB;
6. fits the artifact to 128 KiB by default and reports omissions/truncation;
7. runs the tracked Python redactor, then validates the result with `gitleaks`;
8. writes a private content-addressed Markdown artifact and, unless requested
   otherwise, starts a fresh target session with that attachment.

Change the cap or generate without launching:

```sh
pia handoff pi/research omp/base --session <id-or-path> \
  --goal "Prepare a reviewed transfer" --max-bytes 65536 --no-run
```

`--max-bytes` must be an integer of at least 4096.

## Handoff prerequisites

A handoff needs all of the following in addition to the two combos:

- Git, and a readable, non-bare Git working tree for the source session, with at
  least one commit and a resolvable `HEAD`, for source provenance;
- the literal `python3` executable, version 3.9 or newer, on `PATH`;
- the tracked `.agents/skills/agent-history-hygiene/assets/redact_secrets.py`;
- the tracked `.gitleaks.toml` policy;
- `gitleaks` version 8.25.0 or newer on `PATH`.

`pia doctor` checks whether the `python3` and `gitleaks` commands are present; it
does not verify these required versions. Missing commands are warnings because
other commands can work without them. The handoff itself fails closed when
redaction, provenance, verification, parsing, size checks, or artifact
persistence fails.

## Review obligations

A redacted handoff is **lossy historical context**, not a trusted statement of
current repository state. The target prompt asks the agent to verify the working
tree again. Before sharing the file outside the machine, inspect it yourself:
ordinary prose may contain sensitive business context that no pattern-based
secret scanner can identify.

Use:

- normal history to continue within one combo;
- a fork for native same-engine conversation structure;
- a handoff for a bounded, auditable, same- or cross-engine transfer.
