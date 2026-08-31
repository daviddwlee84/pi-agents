# Architecture

`pia` separates version-controlled **intent** from mutable agent **state**. The
repository is the source of truth for combo definitions; it is never used as an
agent's live home directory.

## Ownership model

```text
pi-agents checkout                         private user state
──────────────────                         ──────────────────
combos/<engine>/<name>/                    config/selection.json
  combo.json                               state/manifests/...
  agent/  ── validate + materialize ─────► state/runtime/pi/...
                                           OMP native profile roots
                                           state/sessions/...
                                           state/handoffs/...
```

A combo contains one complete configuration tree. `pia` scans that tree without
following links, compares it with the last manifest and current target, and
writes only managed file paths. Creating a managed child can normalize existing
parent-directory permissions to `0700`, even when the directory itself is not
listed in the manifest. Pi and OMP continue to own credentials, downloaded
packages, caches, blobs, and other runtime-created data.

## Main modules

| Module | Responsibility |
|---|---|
| `src/cli.ts` | Argument parsing, dispatch, text/JSON output, and exit status |
| `src/combos.ts` | Combo validation, discovery, derivation, lineage, and digests |
| `src/runtime.ts` | Safe scanning, manifests, drift classification, per-file atomic writes, and recoverable apply |
| `src/harness.ts` | Pi/OMP target resolution, apply-before-run, environment, and arguments |
| `src/sessions.ts` | Project-scoped roots, Pi/OMP parsing, selectors, and fork compatibility |
| `src/handoff.ts` | Transcript extraction, Git provenance, redaction, verification, and artifacts |
| `src/paths.ts` | Source/config/state paths and private atomic JSON writes |
| `src/process.ts` | Child execution and safe Windows shim resolution without `shell: true` |
| `src/completion.ts` | Native completion generation |
| `src/ui.ts` | Dependency-free semantic terminal color |

The sources use Node-erasable TypeScript. Node 22.19+ executes them directly;
TypeScript and Node typings are development-only dependencies for strict
checking.

## Apply-before-run

A normal launch follows one path:

1. Resolve the combo from an explicit argument, `PIA_COMBO`, or saved selection.
2. Validate `combo.json`, its lineage, and every source path below `agent/`.
3. Resolve the engine-specific target and project-scoped session directory.
4. Compare source, the last manifest, and the live target.
5. Refuse blocking drift or collisions; otherwise apply actions sequentially
   with atomic replacement for each file, then write the manifest.
6. Launch the upstream binary and forward its exit code.

A multi-file apply is not transactional: if a later action fails, earlier
per-file changes can remain while the new manifest is not written. The next
status/apply recomputes the relationship rather than assuming the batch
completed.

For Pi, `pia` sets `PI_CODING_AGENT_DIR` to
`<state>/runtime/pi/<combo>/agent`. For OMP, it creates the native profile name
`pia-<combo>` and asks `omp --profile=<profile> config path` for the actual
`<profile>/agent` directory. It rejects an unexpected shape and checks the final
profile and `agent/` components for symlinks instead of guessing an OMP home
directory; earlier ancestor components remain part of the trusted OMP/filesystem
setup.

In both cases `pia` adds `--session-dir <resolved-session-directory>`, whose
value is the resolved project-scoped session leaf, not the project root.
Checked-in `launchArgs` come before one-off user arguments supplied after `--`.

## State and manifest model

Each manifest is bound to one absolute target and records, per managed relative
path:

- SHA-256 content hash;
- executable intent;
- expected private mode.

This gives `pia` a three-way view: current source, last applied state, and live
runtime. It can distinguish a safe source update from runtime drift, a true
conflict, a new file, and a stale managed file. See
[Security and data boundaries](security-and-data-boundaries.md) for the exact
classification and force rules.

## Sessions are a separate axis

The effective session root depends on engine, history policy, and a stable key
derived from the canonical working directory. Even `history.mode: shared`
remains engine- and project-scoped. A same-engine fork delegates to the target
harness's native format; a cross-engine transfer uses a new, redacted Markdown
handoff instead of copying JSONL.

See [Sessions and handoff](../guides/sessions-and-handoff.md).

## Why complete copies instead of inheritance

Pi does not expose one stable inheritance contract spanning settings, skills,
extensions, prompts, packages, and sessions. OMP offers profiles and richer
configuration layering, but those layers do not create a portable common model
for both engines.

`pia derive` therefore copies a complete combo and records `derivedFrom` plus a
content-oriented digest of the reviewed parent. Content or metadata changes
produce a lineage warning and manual review workflow; executable-bit-only
changes are intentionally normalized out of this digest. Parent changes are
never merged during launch. This makes each child understandable on its own and
keeps conflict policy explicit.

Declarative inheritance and three-way synchronization remain a research topic,
tracked in the repository's
[design backlog](https://github.com/daviddwlee84/pi-agents/blob/main/backlog/declarative-inheritance-three-way-sync.md).
