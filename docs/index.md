# pi-agents

`pi-agents` keeps multiple [Pi](https://github.com/earendil-works/pi) and
[Oh My Pi](https://omp.sh/) harness configurations in Git. Its `pia` CLI
selects a **combo**, checks and materializes that configuration into private
runtime state, gives it a project-scoped session directory, and launches the
matching upstream agent.

```text
reviewed combo in Git
        │
        ▼
validate + plan + apply
        │
        ▼
private runtime configuration ──► Pi or Oh My Pi
        │                              │
        └──── manifest + drift checks  └──── private sessions
```

`pia` is deliberately a thin ownership boundary. It does **not** install Pi or
OMP, choose a model or provider, store credentials in this repository, or make
their session formats interchangeable.

## Start here

```sh
git clone https://github.com/daviddwlee84/pi-agents.git
cd pi-agents
PIA_CHECKOUT="$PWD"

"$PIA_CHECKOUT/bin/pia" doctor
"$PIA_CHECKOUT/bin/pia" list --tree
"$PIA_CHECKOUT/bin/pia" apply pi/base --dry-run

cd /path/to/your-project
"$PIA_CHECKOUT/bin/pia" run pi/base --
```

The final `cd` matters: the current directory controls the agent's working scope
and project-scoped history. The repository is currently private, so cloning
requires an account with access. Core `pia` commands require Node.js 22.19 or
newer; `run` also needs the selected upstream harness, while handoff additionally
needs Git; a readable, non-bare Git working tree for the source session, with at
least one commit and a resolvable `HEAD`; the literal `python3` executable version
3.9 or newer on `PATH`; the tracked redactor; and `gitleaks` version 8.25.0 or
newer on `PATH`. `pia doctor` checks whether those two helper commands are
present, not their versions.
See [Getting started](getting-started.md) for install, first-run, completion,
update, and removal instructions.

## What `pia` manages

| Managed by `pia` | Left to Pi / OMP or the user |
|---|---|
| Combo metadata and reviewed config files | Agent binary installation and updates |
| Safe source-to-runtime synchronization | Model/provider selection and billing |
| Runtime manifests and drift detection | Credentials and upstream auth stores |
| Per-combo or explicitly shared session roots | Packages, caches, blobs, and databases |
| Same-engine forks and redacted handoff artifacts | The upstream agent loop and tools |

The checked-in combos are intentionally neutral `learning` examples. They are
not production-ready model or provider configurations.

## Choose a path

<div class="grid cards" markdown>

-   🚀 **Use the CLI**

    Follow the [first-run path](getting-started.md), then learn how to
    [author combos](guides/combos.md).

-   🔐 **Understand the boundary**

    Read the [architecture](concepts/architecture.md) and the exact
    [security and data boundaries](concepts/security-and-data-boundaries.md).

-   💻 **Automate `pia`**

    Use the complete [CLI reference](reference/cli.md) and
    [paths and environment reference](reference/paths-and-environment.md).

-   📓 **Study agent harnesses**

    Browse the dated [research notes](notes/index.md) on Pi, ecosystems,
    coding agents, and harness-engineering practices.

</div>

## Design in one sentence

A combo is a complete, reviewable configuration copy; lineage is explicit,
runtime drift blocks launch, and mutable or sensitive state stays outside Git.
