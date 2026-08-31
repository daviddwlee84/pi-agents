# Combos

A combo is one complete, selectable agent setup. Its ID is `<engine>/<name>`,
where `engine` is `pi` or `omp`. `pia` copies reviewed configuration rather than
merging an inheritance graph at launch time.

## Included examples

| ID | Maturity | Purpose |
|---|---|---|
| `pi/base` | `learning` | Neutral Pi agent directory |
| `pi/vanilla` | `learning` | Derived Pi setup with project/global resources disabled by launch flags |
| `omp/base` | `learning` | Neutral OMP native profile |

These are intentionally empty or minimal. They demonstrate isolation and
lineage; they are not model-, provider-, or team-specific production configs.

## Layout

```text
combos/pi/research/
  combo.json
  agent/
    settings.json
    AGENTS.md
    skills/
    extensions/
```

`agent/` is a complete managed tree, not a delta. Do not place auth, `.env*`,
sessions, databases, package stores, caches, or blobs in it. See
[Security and data boundaries](../concepts/security-and-data-boundaries.md) for
the enforced rules.

## Metadata

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

| Field | Contract |
|---|---|
| `$schema` | Optional editor/schema URI |
| `schemaVersion` | Must be `1` |
| `description` | Non-empty human explanation |
| `maturity` | `experimental`, `learning`, or `production` |
| `launchArgs` | Non-secret native arguments used on every launch |
| `history` | Isolated, or shared within a named same-engine group |
| `derivedFrom` / `parentDigest` | Paired lineage fields written by `derive` |

Combo and shared-group names are 1–60 lowercase safe-name characters. They
start with a letter or digit, may contain letters, digits, `.`, `_`, and `-`,
and may not end with a dot. This also keeps `pia-<name>` valid as an OMP profile.

Shared history is explicit:

```json
{
  "history": {
    "mode": "shared",
    "group": "daily-coding"
  }
}
```

It still remains separated by engine and canonical project directory.

## Create a child

Start from a setup you understand:

```sh
pia derive pi/base pi/research \
  --description "Pi setup for source-backed research"
```

This copies the full parent tree, writes `derivedFrom`, and records the current
parent digest. Edit and review the child as a standalone configuration.

When a parent changes:

```sh
pia lineage pi/research
pia diff pi/research --parent
# Copy or adapt only the changes you have reviewed.
pia lineage pi/research --ack
```

`--ack` updates the recorded digest; it does not merge files. Run it only after
review. Parent and child must use the same engine, and lineage cycles are
rejected.

## Choose launch arguments carefully

`launchArgs` must not contain wrapper-owned or secret-bearing flags such as
`--profile`, `--alias`, `--session-dir`, `--cwd`, `--config`, resume/fork
routing, or `--api-key`. Put one-off arguments after the `pia run ... --`
separator and keep secrets in the upstream auth mechanism or environment.

!!! warning "Current `--no-session` gap"
    The executable validator and JSON Schema currently allow `--no-session` in
    `launchArgs`, even though `pia` also injects `--session-dir`. Fork and
    handoff target arguments reject `--no-session`. Treat it as unsupported and
    do not rely on the resulting upstream argument interaction. The
    [schema reference](../reference/combo-schema.md) records this known gap.

## Inspect, apply, and run

```sh
pia list --tree
pia lineage pi/research
pia status pi/research
pia diff pi/research --runtime
pia apply pi/research --dry-run
pia apply pi/research
pia run pi/research -- <native arguments>
```

A normal apply refuses managed runtime drift and source/runtime conflicts.
Review the runtime diff, carry intentional changes back to `agent/`, or use
`--force` only to reassert source over paths already owned by `pia`. Unowned
collisions are never overwritten.

## Production checklist

Before changing `maturity` to `production`:

- [ ] The full `agent/` tree and package/extension sources were reviewed.
- [ ] No credentials or mutable state are tracked.
- [ ] `pia apply <combo> --dry-run` contains only expected actions.
- [ ] Pi or OMP can install/resolve referenced packages in a clean runtime.
- [ ] Session history mode and sharing group are deliberate.
- [ ] Parent lineage is current.
- [ ] `pia doctor` and a real smoke launch pass on the target platform.
- [ ] Permission, sandbox, and network policies are defined by the harness or
      execution environment; `pia` does not supply them.
