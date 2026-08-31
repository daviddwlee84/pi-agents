# CLI reference

`pia` is the repository's Node-native TypeScript command. Run `pia --help` for
the compact built-in synopsis; this page documents behavior intended for humans
and scripts.

## Global forms

| Form | Result |
|---|---|
| `pia`, with no subcommand | Run the selected combo |
| `pia help`, `pia -h`, `pia --help` | Print help |
| `pia -V`, `pia --version` | Print the package version |

Selection for `run` is resolved in this order: explicit combo, `PIA_COMBO`, then
the value saved by `pia use`.

## Commands

### `run`

```text
pia run [combo] -- [native args...]
```

Safely applies the selected combo, creates its project-scoped session root, and
launches Pi or OMP. The arguments after `--` follow checked-in `launchArgs` and
the wrapper's `--session-dir`. The child exit code becomes the `pia` exit code.

Running bare `pia` is equivalent to `pia run` with no explicit combo or native
arguments.

### `use` and `current`

```text
pia use <combo>
pia current
```

`use` validates and saves the combo ID, then prints the ID and selection-file
path on separate lines. `current` prints the effective saved/`PIA_COMBO` value;
it fails when no valid combo is selected.

### `list`

```text
pia list [--tree] [--json]
```

Lists discovered combos. The default is a tab-separated human summary; `--tree`
shows lineage; `--json` takes precedence and returns an array:

```json
[
  {
    "id": "pi/base",
    "$schema": "../../../schema/combo.schema.json",
    "schemaVersion": 1,
    "description": "Neutral upstream Pi profile with isolated runtime state.",
    "maturity": "learning",
    "launchArgs": [],
    "history": { "mode": "isolated" }
  }
]
```

### `derive`

```text
pia derive <parent> <child> [--description TEXT]
```

Copies the complete parent combo, writes same-engine lineage metadata, and
prints the child ID. `--description=value` and `--description value` are both
accepted. The parent is not a live overlay.

### `lineage`

```text
pia lineage <combo> [--ack] [--json]
```

Shows ancestors, review state, and direct descendants. `--ack` records the
current parent digest before displaying the result; it never merges content.

```json
{
  "combo": "pi/vanilla",
  "ancestors": [
    {
      "id": "pi/base",
      "digest": "sha256:…",
      "reviewed": true,
      "recordedDigest": "sha256:…"
    }
  ],
  "descendants": []
}
```

The ellipsis above represents a 64-character lowercase digest in real output.

### `status`

```text
pia status <combo> [--json]
```

Classifies the managed source/runtime relationship. Human output omits clean
files. A blocked status exits `1`.

JSON wraps the runtime status with resolved paths:

```json
{
  "targetDir": "/home/user/.local/state/pi-agents/runtime/pi/base/agent",
  "manifestPath": "/home/user/.local/state/pi-agents/manifests/pi/base.json",
  "sessionDir": "/home/user/.local/state/pi-agents/sessions/pi/base/project-a1b2c3d4e5f6",
  "status": {
    "state": "clean",
    "classification": "clean",
    "hasChanges": false,
    "hasRuntimeDrift": false,
    "hasConflicts": false,
    "canApply": true,
    "canForceApply": true,
    "counts": {
      "clean": 1,
      "source-only-update": 0,
      "runtime-drift": 0,
      "conflict": 0,
      "new": 0,
      "stale": 0,
      "total": 1
    },
    "files": []
  }
}
```

Real `status` includes additional source, target, manifest, mode, and per-file
metadata; do not parse only the abbreviated example.

### `diff`

```text
pia diff <combo> [--runtime | --parent] [--json]
```

Runtime mode is the default. It reports only source/manifest-managed paths, not
unowned target-only files. `--parent` compares a derived combo's `agent/` tree
with its parent and does not require resolving the runtime target. The two mode
flags are mutually exclusive.

Runtime JSON contains `sourceDir`, `targetDir`, `manifestPath`, `sourceDigest`,
`runtime`, `files`, `parent: null`, and `text: null`. Parent JSON contains:

```json
{
  "directory": "/checkout/combos/pi/base/agent",
  "digest": "…",
  "counts": {
    "added": 0,
    "removed": 0,
    "modified": 1,
    "unchanged": 0,
    "total": 1
  },
  "files": [
    {
      "path": "settings.json",
      "status": "modified",
      "source": { "sha256": "…", "executable": false, "mode": 384, "size": 3 },
      "parent": { "sha256": "…", "executable": false, "mode": 384, "size": 3 }
    }
  ]
}
```

### `apply`

```text
pia apply <combo> [--dry-run] [--force] [--json]
```

Plans and, unless dry-running, materializes the managed tree. `--force` can
repair paths already owned by the manifest; it cannot overwrite an unowned
collision. A refused apply exits `1`.

The JSON envelope includes resolved `targetDir`, `manifestPath`, `sessionDir`,
and a discriminated `result`:

```json
{
  "targetDir": "/state/runtime/pi/base/agent",
  "manifestPath": "/state/manifests/pi/base.json",
  "sessionDir": "/state/sessions/pi/base/project-a1b2c3d4e5f6",
  "result": {
    "ok": true,
    "applied": false,
    "changed": true,
    "dryRun": true,
    "force": false,
    "refused": false,
    "reason": null,
    "actions": [
      { "action": "ensure-target", "mode": 448 },
      { "action": "write", "path": "settings.json", "classification": "new" },
      { "action": "write-manifest" }
    ],
    "after": null
  }
}
```

A refusal has `ok: false`, `refused: true`, and reason
`runtime-drift-or-conflict` or `unowned-or-obstructed-target`. Full results also
contain `before` and the proposed manifest; completed applies contain `after`.
Numeric modes are decimal JSON representations of POSIX `0700`/`0600`.

### `sessions`

```text
pia sessions <combo> [--json]
```

Lists direct `.jsonl` files in the effective engine/combo-or-group/project root,
newest first. Human output is tab-separated ID, title, modification time, and
absolute path.

!!! warning "JSON includes conversation content"
    `--json` serializes complete parsed records: `engine`, title/title slot,
    header, ID, cwd, `entries`, `activeBranch`, path/filePath, modification time,
    modification milliseconds, and size. Treat it as sensitive. Its shape is
    intended for diagnostics, not as a redacted export format.

```json
[
  {
    "engine": "pi",
    "id": "abcdef123456",
    "cwd": "/work/project",
    "entries": [],
    "activeBranch": [],
    "path": "/state/sessions/pi/base/project-hash/session.jsonl",
    "filePath": "/state/sessions/pi/base/project-hash/session.jsonl",
    "mtime": "2026-08-31T00:00:00.000Z",
    "mtimeMs": 1788134400000,
    "size": 128
  }
]
```

### `fork`

```text
pia fork <from> <to> (--session ID|PATH | --latest) -- [target args...]
```

Requires exactly one selector and two combos with the same engine. It resolves
the source session, launches the target from the source working directory, and
passes native `--fork <absolute-session-path>`. Target-session routing flags are
rejected. The child exit code is forwarded.

### `handoff`

```text
pia handoff <from> <to> (--session ID|PATH | --latest) \
  --goal TEXT [--max-bytes N] [--no-run] -- [target args...]
```

Requires one selector and a non-empty goal. `--goal=value` / `--goal value` and
`--max-bytes=value` / `--max-bytes value` are accepted. The default cap is
131072 bytes; the minimum is 4096. Source provenance requires the source
session to use a readable, non-bare Git working tree with at least one commit
and a resolvable `HEAD`.

The command prints the generated artifact path first. With `--no-run`, that is
the only command output. Otherwise it launches a fresh target session whose
stdout/stderr follows on the inherited streams and whose exit code is forwarded.
See [Sessions and handoff](../guides/sessions-and-handoff.md).

### `doctor`

```text
pia doctor [--json]
```

Checks the Node version; command presence for Git and the optional literal
`python3`/`gitleaks` handoff helpers; Pi/OMP binary probes; discovered ordinary
combo directories; source safety; and selection. It does not check the helper
versions: handoff requires `python3` version 3.9 or newer and `gitleaks` version
8.25.0 or newer. It reports resolved source/config/state root strings without
validating that each path is usable. Handoff source provenance still requires
the source session to use a readable, non-bare Git working tree with at least
one commit and a resolvable `HEAD`; `doctor` does not validate that state.
Symlinked combo-directory entries are skipped by discovery rather than diagnosed. Missing Pi, OMP, `python3`, or
`gitleaks` is a warning. No saved selection is currently reported as an **ok**
check with detail `none`, even though bare `pia` and `pia current` still require
`PIA_COMBO` or `pia use`. An invalid Node version or discovered combo tree is an
error. An empty discovery set currently reports `0 valid` rather than failing.

```json
{
  "checks": [
    { "name": "node", "ok": true, "detail": "22.19.0", "severity": "error" },
    { "name": "gitleaks", "ok": false, "detail": "not found", "severity": "warning" },
    { "name": "combos", "ok": true, "detail": "3 valid", "severity": "error" }
  ]
}
```

Doctor exits `1` only when at least one failed check has `severity: "error"`.

### `completion`

```text
pia completion <zsh | bash | powershell>
```

Emits a native script on stdout. `pwsh` is accepted as an undocumented alias for
`powershell`. Completion output is never colorized.

## Option parsing

Named value options accept `--name=value` and `--name value`. Boolean flags are
removed wherever they occur before the passthrough separator. Unknown remaining
arguments are errors. `--` splits wrapper arguments from native target
arguments; it is significant for `run`, `fork`, and `handoff`.

## Output and color

Human status, tree, and action output uses semantic color when the destination
stream supports it. Non-empty `NO_COLOR` and `NODE_DISABLE_COLORS` disable
color; `FORCE_COLOR` and non-zero `CLICOLOR_FORCE` can force it.

JSON, versions, combo IDs, completion code, and handoff artifact paths remain
plain. Fatal diagnostics and lineage warnings go to stderr; structured command
results go to stdout.

## Exit status

| Status | Meaning |
|---:|---|
| `0` | Wrapper command completed successfully |
| `1` | `status` is blocked, `apply` was refused, or `doctor` has a failed error-severity check |
| `2` | CLI parsing, validation, source/runtime operation, or prerequisite failed before launch |
| Child status | `run`, launching `fork`, and launching `handoff` forward the upstream process result |
