# Troubleshooting

Start with the current roots and dependencies:

```sh
pia doctor
pia list --tree
```

For machine-readable diagnostics use `pia doctor --json`. Fatal wrapper errors
exit `2`; a blocked `status` or refused `apply` exits `1`; a launched Pi/OMP
process forwards its own exit code.

## No combo is selected

**Symptom:** `No combo selected` when running `pia`, `pia run`, or `pia current`.

```sh
pia list
pia use pi/base
pia current
```

An explicit run argument or `PIA_COMBO` overrides the saved selection.

## Pi or OMP is not found or not authenticated

`pia doctor` reports missing agent binaries as warnings because you may use only
one engine. It probes versions, not provider authentication or model access.
Install the selected harness separately, then verify its command:

```sh
pi --version
omp --version
```

Override nonstandard executable locations with `PIA_PI_BIN` or `PIA_OMP_BIN`.
A combo does not necessarily reuse the unprofiled harness's stored login:

- Pi runs with `PI_CODING_AGENT_DIR` pointing at the combo runtime, so an
  upstream-written `auth.json` is combo-specific.
- OMP runs with `--profile=pia-<combo>`; its native profile isolates auth,
  settings, sessions, and caches.
- Credentials supplied by environment variables follow the upstream provider
  rules and can be shared by the parent shell.

Authenticate by launching the selected combo, or reproduce an OMP problem in
the same profile, for example:

```sh
pia run pi/base --
pia run omp/base --
omp --profile=pia-base config path
omp --profile=pia-base
```

Provider login, model entitlements, and billing remain upstream concerns; never
copy the resulting credential files into combo source.

## OMP profile resolution is rejected

`pia` runs `omp --profile=pia-<combo> config path` and requires the final path to
be absolute and shaped as `pia-<combo>/agent`. The profile directory and
`agent/` must not be symlinks.

If resolution fails, run the equivalent native command and inspect its final
output line. Do not bypass the shape check with a manually copied runtime tree;
fix the OMP installation/profile behavior or executable override.

## Source validation fails

The implementation attaches internal error codes to many failures, although the
current CLI prints the human message rather than the code. Codes useful when
reading source/tests include:

| Internal code | Meaning |
|---|---|
| `PIA_SOURCE_MISSING` | A scanned source directory is absent; combo loading may instead print an uncoded missing-`agent/` message |
| `PIA_SYMLINK_REJECTED` | A source root, directory, or file is a symlink |
| `PIA_NON_FILE_REJECTED` | A socket/device/FIFO or other special entry was found |
| `PIA_FORBIDDEN_PATH` | A credential/runtime filename or root store is present |
| `PIA_INVALID_PATH` | A path is empty, non-portable, or over a byte limit |
| `PIA_PATH_TRAVERSAL` | A component could escape or ambiguously address the root |

Move credentials, sessions, package stores, caches, blobs, databases, and `.env`
files out of the combo. Replace symlinks with reviewed ordinary files or a
package reference understood by the harness. The full list is in
[Security and data boundaries](../concepts/security-and-data-boundaries.md).

## Apply reports runtime drift or conflict

```sh
pia status <combo>
pia diff <combo> --runtime
```

- `runtime-drift`: a previously managed runtime path changed independently.
- `conflict`: source and runtime diverged, a managed path disappeared at the
  wrong time, or a target obstruction exists.

If the runtime edit is intentional, copy it into the combo and review it. If
Git source should win, `pia apply <combo> --force` can repair previously managed
paths. It still refuses unowned files/directories and other obstructions.

## Parent changed since review

A stale digest warns but does not automatically merge or block standalone use:

```sh
pia lineage <child>
pia diff <child> --parent
# Review and adapt the changes.
pia lineage <child> --ack
```

Do not acknowledge until the complete-copy child remains valid independently.

## Session selector is missing or ambiguous

```sh
pia sessions <combo>
pia fork <from> <to> --session <longer-id-prefix> --
```

Use a longer unique prefix or, when necessary, an absolute path returned by
`sessions`. ID prefixes and `--latest` resolve inside the source combo's
effective engine/project/history root. The current implementation parses an
absolute selector directly and does not enforce that containment, so do not
supply an untrusted or unrelated path. `--latest` is convenient but can choose
a different file after concurrent work; use an explicit ID for reproducible
operations.

## Fork is rejected across engines

Raw Pi and OMP sessions are not wire-compatible. A fork must remain within one
engine. Use a handoff for a cross-engine transfer:

```sh
pia handoff pi/base omp/base --latest --goal "Continue this task" --no-run
```

## Handoff fails before launch

Check all prerequisites:

```sh
git rev-parse --is-inside-work-tree
git rev-parse --verify HEAD
git status --short
python3 --version
gitleaks version
pia doctor
```

The literal `python3` command must report Python 3.9 or newer, and `gitleaks`
must report version 8.25.0 or newer. `pia doctor` checks only whether these
commands are present, not their versions. Source provenance requires the source
session to use a readable, non-bare Git working tree with at least one commit
and a resolvable `HEAD`. The tracked redactor and `.gitleaks.toml` must exist.
Parsing, redaction, secret verification, size fitting, and artifact writes are
fail-closed. Fix the reported prerequisite
rather than disabling validation.

## A native agent argument is rejected

Wrapper-owned runtime/credential flags cannot be supplied through combo
metadata or certain target operations. Place normal native arguments after
`--`:

```sh
pia run pi/base -- --model provider/model
```

Fork/handoff own target-session creation and reject `--continue`, `--resume`,
`--session`, `--fork`, `--session-dir`, and `--no-session` in target arguments.
Do not put `--no-session` in combo `launchArgs`; the current metadata validator
does not catch that particular conflict.

## The child process exits non-zero

After a successful apply, `pia` returns the Pi or OMP exit code unchanged. Run
the same harness with a minimal native command, then compare the resolved combo,
working directory, and arguments. Use `pia status` first so a clean runtime is
not mistaken for an upstream agent failure.

## Completion is stale or absent

Regenerate the shell adapter after pulling CLI/completion changes. Combo names
are scanned from the checkout at completion time, so missing new combos usually
indicate the adapter points at another source root. Check `PIA_SOURCE_ROOT` and
the launcher resolved by `PATH`.
