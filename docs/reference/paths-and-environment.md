# Paths and environment

All paths below are defaults. `~` means the current operating-system user's home
directory.

## Source and private roots

| Purpose | Default | Override |
|---|---|---|
| Source checkout | Resolved from the running `src/`/launcher checkout | `PIA_SOURCE_ROOT` |
| Config root | `${XDG_CONFIG_HOME:-~/.config}/pi-agents` | `XDG_CONFIG_HOME` |
| State root | `${XDG_STATE_HOME:-~/.local/state}/pi-agents` | `PIA_STATE_HOME`, otherwise `XDG_STATE_HOME` |
| Saved selection | `<config-root>/selection.json` | Derived from config root |

`PIA_STATE_HOME` replaces the entire state root; it is not a parent into which
`pi-agents` is appended. `PIA_SOURCE_ROOT` is useful for tests or for pointing an
installed launcher at an uncommitted development checkout.

## State layout

```text
<state-root>/
  manifests/<engine>/<combo>.json
  runtime/pi/<combo>/agent/
  sessions/<engine>/<combo>/<project-key>/
  sessions/<engine>/shared/<group>/<project-key>/
  handoffs/<content-addressed-artifact>.md
```

OMP materialized configuration is not placed under `runtime/omp`. `pia` names
the native profile `pia-<combo>` and asks OMP for its config path. The returned
absolute path must end in `pia-<combo>/agent`; `pia` rejects those final two
components when either is a symlink or non-directory. It does not currently
walk and reject symlinks in earlier ancestors, so the OMP installation and its
parent directories remain part of the trusted filesystem boundary.

Private directories are created as `0700` and private JSON/files as `0600` on
POSIX. Source JSON created by `derive` or lineage acknowledgement is `0644`.
Windows uses the user profile's ACL instead of POSIX mode checks.

## Session project keys

The leaf key is:

```text
<sanitized-working-directory-basename>-<12-hex-sha256-prefix>
```

The hash is computed from the canonical absolute working directory. The
basename is normalized, made filesystem-safe, and bounded to 120 characters.
This distinguishes two repositories with the same basename while keeping paths
readable. A missing path is still normalized deterministically.

## Public environment variables

| Variable | Effect |
|---|---|
| `PIA_COMBO` | Overrides the selection saved by `pia use` |
| `PIA_SOURCE_ROOT` | Uses another checkout as source |
| `PIA_STATE_HOME` | Replaces all default private state |
| `XDG_STATE_HOME` | Parent for default state when `PIA_STATE_HOME` is unset |
| `XDG_CONFIG_HOME` | Parent for saved selection |
| `PIA_PI_BIN` | Pi executable name or path instead of `pi` |
| `PIA_OMP_BIN` | OMP executable name or path instead of `omp` |

Executable overrides are passed directly to safe process resolution. `pia` does
not enable shell parsing for child processes.

## Child environment and arguments

For Pi, `pia` sets:

```text
PI_CODING_AGENT_DIR=<resolved Pi runtime agent directory>
```

For OMP, it removes inherited Pi/OMP profile variables and passes:

```text
--profile=pia-<combo>
```

For both engines, `pia` removes inherited
`PI_CODING_AGENT_SESSION_DIR`, creates the selected private session leaf, and
passes:

```text
--session-dir <session leaf>
```

Then it appends one-off native arguments supplied after the CLI `--` separator.
The selected session's working directory is used for fork and handoff launches.

## Color environment

Human-readable output follows these common controls:

| Variable | Behavior |
|---|---|
| `NO_COLOR` | Disable color when set to a non-empty value |
| `NODE_DISABLE_COLORS` | Disable Node/CLI color |
| `FORCE_COLOR` | Force color according to its normal Node semantics |
| `CLICOLOR_FORCE` | A non-zero value forces color |

Machine-facing JSON, generated completion, package versions, selected IDs, and
handoff artifact paths remain uncolored.

## Shell completion and source discovery

Generated completion scripts interpolate the checkout source root but honor a
runtime `PIA_SOURCE_ROOT`. They scan `combos/pi/` and `combos/omp/` directly,
which avoids starting Node on each Tab press and exposes newly pulled combos
without regenerating completion.

## Do not relocate private state by copying

Use environment overrides before creating state, or move it through an explicit
reviewed migration. Manifests bind to an exact absolute runtime target and are
validated on read; copying a manifest to a different target causes a refusal
rather than silently adopting the new location.
