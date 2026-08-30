# Combos

A combo is one complete, selectable agent setup. Its identifier is
`<engine>/<name>`, where the engine is `pi` or `omp`. Names are 1–60 characters,
start with a lowercase letter or digit, use lowercase letters, digits, dots,
underscores, or hyphens, and do not end in a dot. The shared restriction keeps
the generated `pia-<name>` value valid as an OMP profile.

## Directory and metadata

```text
combos/pi/research/
  combo.json
  agent/
    settings.json
    AGENTS.md
    skills/
    extensions/
```

`agent/` mirrors the configuration files that should be managed at runtime. It
must be a complete, readable setup rather than a delta against another combo.

A minimal `combo.json` is:

```json
{
  "$schema": "../../../schema/combo.schema.json",
  "schemaVersion": 1,
  "description": "Research-oriented upstream Pi harness.",
  "maturity": "experimental",
  "launchArgs": [],
  "history": {
    "mode": "isolated"
  }
}
```

The fields are:

- `schemaVersion`: currently `1`.
- `description`: a short human explanation of the combo's purpose.
- `maturity`: `experimental`, `learning`, or `production`.
- `launchArgs`: non-secret agent arguments applied on every launch.
- `history`: `isolated`, or `shared` with a named same-engine group.
- `derivedFrom` and `parentDigest`: a paired lineage reference written by
  `pia derive`.

Example shared history policy:

```json
{
  "history": {
    "mode": "shared",
    "group": "daily-coding"
  }
}
```

Sharing is still separated by engine and canonical project directory. It does
not make Pi and OMP JSONL files interchangeable. Group names follow the same
1–60 character/no-trailing-dot safety rule as combo names.

Do not put auth tokens, API keys, `.env` files, sessions, blobs, package stores,
or caches in `agent/`. Reference packages from configuration; let the harness
install or cache them in runtime state.

## Derive and maintain a combo

Create a child from an existing combo:

```sh
pia derive pi/base pi/research
```

This makes a full copy, sets `derivedFrom`, and records a digest of the reviewed
parent. There is no live inheritance. Edit the child normally and commit it as
a standalone configuration.

When a parent changes:

```sh
pia lineage pi/research
pia diff pi/research --parent
# manually copy or adapt only the changes you want
pia lineage pi/research --ack
```

`--ack` only records the current parent digest. It must be run after the review,
not as a way to hide an unresolved warning. Lineage must remain within one
engine and cycles are rejected.

## Inspect and use combos

```sh
pia list
pia list --tree
pia list --json

pia use pi/research
pia current

pia status pi/research
pia diff pi/research --runtime
pia apply pi/research --dry-run
pia apply pi/research
pia run pi/research -- <pi arguments>
```

`pia run` can omit its combo after `pia use` or `PIA_COMBO`; an explicit run
argument always wins. The management command signatures shown here require
explicit combo IDs so mutations and diagnostics have an unambiguous target.

If a managed runtime file was edited directly, normal apply fails without
changing anything. Review the diff and either carry the intended edit back to
`agent/`, or use `pia apply <combo> --force` to discard drift on paths that
`pia` previously owned. Unmanaged runtime files are preserved.

`launchArgs` cannot contain wrapper-owned options such as profile, session,
cwd, config, resume/fork routing, or API-key flags. Put one-off agent options
after `--`; keep secrets in the harness's private auth mechanism or environment.

## Command map

In the table, `<session-selector>` means either `--latest` or
`--session <id-or-absolute-path>`.

| Command | Purpose |
|---|---|
| `pia list [--tree|--json]` | Discover combos and lineage |
| `pia use <combo>` / `pia current` | Save or print the default selection |
| `pia derive <parent> <child> [--description TEXT]` | Copy a combo and record lineage |
| `pia lineage <combo> [--ack]` | Inspect or acknowledge a parent digest |
| `pia status <combo>` | Summarise source/runtime health |
| `pia diff <combo> [--runtime|--parent]` | Show managed runtime or lineage differences |
| `pia apply <combo> [--dry-run|--force]` | Safely materialise source configuration |
| `pia run [combo] -- <args>` | Safely apply, then launch the selected harness |
| `pia sessions <combo>` | List sessions visible to that combo |
| `pia fork <from> <to> <session-selector> -- <args>` | Native same-engine session fork |
| `pia handoff <from> <to> <session-selector> --goal TEXT [--no-run] -- <args>` | Redacted context transfer |
| `pia doctor [--json]` | Check binaries, versions, source safety, and helpers |
| `pia completion <zsh\|bash\|powershell>` | Emit native shell completion code |
