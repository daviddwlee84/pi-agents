# Combo schema

Each combo is a directory at `combos/<engine>/<name>/` with `combo.json` and an
ordinary `agent/` directory. The repository supports schema version `1`.

## ID and name rules

`engine` is `pi` or `omp`. A name:

- has 1–60 characters;
- begins with a lowercase ASCII letter or digit;
- continues with lowercase letters, digits, `.`, `_`, or `-`;
- does not end with a dot.

The same safe-name rule applies to shared-history groups. A derived combo must
use the same engine as its parent.

## Complete shape

```json
{
  "$schema": "../../../schema/combo.schema.json",
  "schemaVersion": 1,
  "description": "Research-oriented upstream Pi harness.",
  "maturity": "experimental",
  "launchArgs": ["--no-themes"],
  "history": {
    "mode": "shared",
    "group": "research"
  },
  "derivedFrom": "pi/base",
  "parentDigest": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
}
```

No additional fields are accepted.

| Field | Required | Rules |
|---|---:|---|
| `$schema` | No | String for editor discovery; normally relative to `schema/combo.schema.json` |
| `schemaVersion` | Yes | Exactly `1` |
| `description` | Yes | Non-empty string |
| `maturity` | Yes | `experimental`, `learning`, or `production` |
| `launchArgs` | No | Array of strings; defaults to empty in executable validation |
| `history` | Yes | Exactly one of the shapes below |
| `derivedFrom` | Paired | Valid same-engine combo ID |
| `parentDigest` | Paired | `sha256:` plus 64 lowercase hexadecimal characters |

The lineage pair must appear together.

## History variants

Isolated history:

```json
{ "history": { "mode": "isolated" } }
```

Named sharing:

```json
{ "history": { "mode": "shared", "group": "daily-coding" } }
```

No other keys are accepted inside either object. Shared history remains scoped
to one engine and canonical project directory.

## Maturity is documentation, not enforcement

`experimental`, `learning`, and `production` communicate intent in `pia list`.
They do not change permissions, validation, apply policy, or launch behavior.
Use the [production checklist](../guides/combos.md#production-checklist) before
promoting a combo.

## `launchArgs` boundary

The validator rejects a literal `--`, `-r`, `-c`, and these long flags (both
bare and `--flag=value` forms):

```text
--profile  --alias  --session-dir  --cwd  --config
--fork     --resume --session      --continue  --api-key
```

This prevents metadata from taking over runtime/profile/session routing or
embedding a common secret-bearing option. It is not a general secret scanner,
and ordinary strings after a native flag can still be sensitive. Keep secrets
out of Git.

!!! warning "Known `--no-session` mismatch"
    Schema version 1 and `src/combos.ts` currently do **not** reject
    `--no-session`, while `pia` still appends `--session-dir` and fork/handoff
    target validation rejects that flag. Do not use it in `launchArgs`. This
    documentation records current behavior; it does not redefine it.

## Schema versus runtime validation

`schema/combo.schema.json` provides JSON Schema editor assistance. The
executable source of truth is `validateComboMetadata()` plus lineage loading in
`src/combos.ts`.

`npm run check` parses the schema file to ensure it is valid JSON, but it does
not currently run a JSON Schema validator over combo files. It loads every
combo through the executable validator, scans every `agent/` tree with runtime
safety rules, verifies parent digests, checks launchers, and scans combo content
with `gitleaks` when available.

The schema does not describe filesystem safety. A metadata-valid combo can
still fail because `agent/` contains a symlink, forbidden runtime path, special
file, or unsafe portable path. See
[Security and data boundaries](../concepts/security-and-data-boundaries.md).

## Lineage digest

`pia derive` creates a full copy and records a deterministic SHA-256 digest of
the parent metadata and managed **content** tree. Executable intent is
normalized out of the tree-content portion, so an executable-bit-only parent
change does not make lineage stale. `pia lineage --ack` updates only the digest
after manual review; it does not alter child files.
