# Architecture

`pia` separates version-controlled intent from mutable agent state. The Git
repository is the source of truth for combo definitions; it is never an agent's
live home directory.

## Data layout

```text
pi-agents/
  combos/<pi|omp>/<name>/
    combo.json             declarative metadata
    agent/                 complete managed config tree
  schema/combo.schema.json
  bin/pia
  src/*.ts                 Node-native erasable TypeScript

${XDG_CONFIG_HOME:-~/.config}/pi-agents/
  selection.json           value saved by `pia use`

${XDG_STATE_HOME:-~/.local/state}/pi-agents/
  manifests/               last-applied managed-file hashes and modes
  runtime/pi/<name>/agent/ Pi configuration runtime
  sessions/                isolated/shared session roots
  handoffs/                generated private Markdown artifacts
```

`PIA_SOURCE_ROOT` can point the CLI at another checkout. `PIA_STATE_HOME`
replaces the entire state root. These overrides are useful for tests and
advanced setups; normal users should let the CLI derive both paths.

For Pi, `pia` launches with `PI_CODING_AGENT_DIR` set to the combo's runtime
directory. For OMP, it uses a native profile named `pia-<combo-name>` and asks
`omp --profile ... config path` for the real location instead of assuming a
home or XDG layout. `PIA_PI_BIN` and `PIA_OMP_BIN` can override the executable
names.

## Source and runtime contract

Only files below a combo's `agent/` directory are managed. Downloaded packages,
credentials, sessions, caches, blobs, databases, and any other runtime-created
files stay outside Git or remain unowned in the runtime tree.

The source tree must not contain credentials, `.env` files, session/package/
cache stores, or symlinks. Runtime directories are
created with mode `0700`; managed files use `0600` or `0700` according to their
executable bit. Writes and manifest replacement are atomic.

The source uses only TypeScript syntax that Node can erase without code
generation. Runtime execution therefore stays build-free; `tsconfig.json` and
the development dependencies exist solely for strict `tsc --noEmit` checking.

Known runtime/credential paths are rejected structurally. `npm run check` also
runs gitleaks over combo content when the binary is available, while CI and the
existing pre-commit stack enforce the same secret scan before source is shared.

Each manifest records its exact absolute target and, for every managed relative
path, the content hash, executable bit, and mode. `pia apply` classifies paths
as follows:

| Source/runtime state | Result |
|---|---|
| New source path, unused target | Create it |
| Source changed, runtime still at last applied value | Update it |
| Runtime changed independently | Refuse the whole apply |
| Source and runtime both changed | Refuse the whole apply |
| Source removed, runtime unchanged | Remove the stale managed path |
| Source removed, runtime changed | Refuse unless forced |
| Target-only path never owned by `pia` | Preserve and omit from normal diff |
| New source collides with an unowned path or non-file obstruction | Always refuse |

`--dry-run` returns the same plan without writing. `--force` makes source win
for previously managed drift and conflicts, including modified stale files; it
does not overwrite unowned collisions. This keeps force bounded by the prior
manifest instead of turning it into a recursive replacement operation.

Use `pia status <combo>` for a summary and `pia diff <combo> --runtime` for
managed path details before applying.

## Selection and launch

A combo is selected in this order:

1. The combo argument passed to the command.
2. `PIA_COMBO`.
3. The persistent value written by `pia use`.

`pia run [combo] -- <agent arguments>` first performs the same safe apply, then
combines the combo's checked-in `launchArgs` with trailing arguments and
forwards the child process's exit code. Drift, conflicts, unsafe source files,
or unowned collisions abort before launch. A stale parent digest emits a warning
but does not block a standalone child combo.

Wrapper-owned routing/session flags and secret-bearing flags are rejected from
`launchArgs`; runtime invocation remains explicit. Session storage is resolved
from engine, combo history policy, and canonical working directory. See
[sessions and handoff](sessions-and-handoff.md).

## Why copies instead of inheritance

Pi does not expose a stable, general-purpose config inheritance contract, and
OMP's layers do not cover every harness asset uniformly. `pia derive` therefore
copies a complete combo and records its parent digest. The child remains usable
and understandable on its own. Parent changes produce a lineage warning and a
review workflow, never an implicit merge at launch time.

Declarative inheritance and three-way sync are intentionally deferred until
real usage demonstrates enough repeated maintenance to justify their conflict
rules. The research checkpoint is tracked in
[the backlog](../backlog/declarative-inheritance-three-way-sync.md).
