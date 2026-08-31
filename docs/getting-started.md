# Getting started

This guide takes a new checkout from zero to a controlled first launch. `pia`
runs directly from the repository: there is no compiled `dist/` tree and no
runtime npm dependency installation.

## Prerequisites

| Requirement | Needed for |
|---|---|
| Node.js 22.19 or newer | Every `pia` command |
| Git | Cloning and lineage workflows; handoff provenance also requires a readable, non-bare Git working tree for the source session, with at least one commit and a resolvable `HEAD` |
| [Pi](https://github.com/earendil-works/pi) and/or [Oh My Pi](https://omp.sh/) | Running a combo for that engine |
| The literal `python3` executable, version 3.9 or newer, on `PATH`, and [`gitleaks`](https://github.com/gitleaks/gitleaks) 8.25.0 or newer on `PATH` | Creating a handoff |

Install Pi or OMP with its own first-party instructions. `pia` does not log in
to a provider or select a model on your behalf. Because it launches Pi with a
combo-specific agent directory and OMP with a combo-specific profile, a stored
login in the unprofiled native harness is not necessarily the login used by a
combo. Complete any required authentication in the selected `pia run` context;
environment-provided credentials remain subject to the upstream harness rules.
Credentials written by the harness stay private and are never accepted in combo
source.

!!! note "`doctor` warnings and handoff"
    Missing `python3`, `gitleaks`, Pi, or OMP appears as a warning because not
    every command needs every helper. For `python3` and `gitleaks`, `doctor`
    checks command presence, not the required versions; verify those minimums
    separately. A handoff still fails closed when either helper is unavailable.

## Get the private checkout

```sh
git clone https://github.com/daviddwlee84/pi-agents.git
cd pi-agents
```

The repository is private at this release, so GitHub authentication and
repository access are required. Run the platform launcher directly:

=== "macOS / Linux"

    ```sh
    ./bin/pia --version
    ```

=== "PowerShell"

    ```powershell
    .\bin\pia.ps1 --version
    ```

=== "cmd.exe"

    ```bat
    bin\pia.cmd --version
    ```

Add `bin/` to `PATH` to use the short command `pia`. `npm link` is an optional
convenience for a **development checkout**, not an npm-published installation:

```sh
npm link
pia --version
```

`npm install` or `npm ci` is needed only when contributing, type-checking, or
running the test suite. The remaining examples assume `pia` resolves on `PATH`;
otherwise substitute the absolute platform launcher from this checkout.

## Understand the included combos

```sh
pia list --tree
```

The first release includes:

| Combo | Intent |
|---|---|
| `pi/base` | Upstream-default Pi configuration with isolated history; normal project/global discovery remains active |
| `pi/vanilla` | Derived Pi learning baseline with approvals and discovered extensions, skills, prompts, themes, and context files disabled by launch flags |
| `omp/base` | Upstream-default OMP native profile with isolated history |

All three have `maturity: learning`. Their settings are intentionally empty or
minimal. Here, “upstream-default” means the harness can still discover resources
and apply its normal trust/permission behavior; it does not mean isolated or
sandboxed. `pia` controls materialization and session routing, not model tools,
shell commands, network access, extensions, or child processes. Use
`pi/vanilla` when you want the narrower Pi discovery baseline, and still review
the effective upstream permission/environment boundary before launch.

A first launch may ask you to complete model, provider, or authentication setup
inside the combo-specific Pi directory or OMP profile. That private state belongs
to the upstream harness, not this repository.

## Inspect and choose the target project

Do not stay in the `pi-agents` checkout unless that is the repository you intend
the agent to work on. The current directory becomes the child process working
directory and contributes to the project-scoped session key:

```sh
cd /path/to/your-project
pia doctor
```

`doctor` checks the Node version, Git, command presence for optional handoff
helpers, installed harness binaries, discovered combo validity, and selection.
It reports the
resolved source/config/state roots but does not probe whether each root is
currently usable, and it does not verify provider login or model access.

Choose the installed engine. `--dry-run` computes the exact apply plan without
changing runtime state:

=== "Pi upstream defaults"

    ```sh
    pia apply pi/base --dry-run
    pia apply pi/base
    pia run pi/base --
    ```

=== "Pi narrow discovery baseline"

    ```sh
    pia apply pi/vanilla --dry-run
    pia apply pi/vanilla
    pia run pi/vanilla --
    ```

=== "Oh My Pi"

    ```sh
    pia apply omp/base --dry-run
    pia apply omp/base
    pia run omp/base --
    ```

Complete any upstream authentication prompt in this selected context. `run`
performs the safe apply again before every launch. It stops before the agent
starts when source validation, runtime drift, a conflict, or an unowned
collision blocks the operation.

## Select a default and pass native arguments

```sh
pia use pi/base
pia current
pia run -- --model provider/model
```

Selection precedence is:

1. an explicit combo supplied to `run`;
2. `PIA_COMBO`;
3. the selection saved by `pia use`.

Normal arguments after `--` are passed to the selected harness. `pia` still
rejects wrapper-owned `--profile`, `--alias`, `--session-dir`, `--cwd`, and
`--api-key` before launch. Keep the separator so it can distinguish wrapper
arguments from native Pi or OMP arguments. Running `pia` without a subcommand is
shorthand for running the selected combo.

## Enable completion

=== "zsh"

    ```sh
    mkdir -p ~/.zfunc
    pia completion zsh > ~/.zfunc/_pia
    ```

=== "bash"

    ```sh
    mkdir -p "${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion/completions"
    pia completion bash > "${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion/completions/pia"
    ```

=== "PowerShell"

    ```powershell
    pia completion powershell | Out-String | Invoke-Expression
    ```

Completion reads combo directories directly, so newly pulled or derived combos
appear without regenerating the script. The [chezmoi guide](guides/chezmoi.md)
shows how to cache and deploy completion from an external checkout.

## Update or remove a checkout

Update a normal development checkout with your normal reviewed Git workflow.
For the chezmoi mirror, use its `--ff-only` refresh flow rather than editing the
mirror in place.

To remove a development link before deleting a checkout:

```sh
npm unlink --global pi-agents
```

Deleting the checkout does not delete private state. Review these locations
separately before removing them:

```text
${XDG_CONFIG_HOME:-~/.config}/pi-agents/
${PIA_STATE_HOME:-${XDG_STATE_HOME:-~/.local/state}/pi-agents}/
```

They can contain the saved selection, Pi materialized configs, manifests,
sessions, and handoff artifacts. OMP materialization lives outside this state
root in its native profile. Resolve each profile you actually used before any
cleanup:

```sh
omp --profile=pia-base config path
```

Review the returned `pia-<combo>` profile tree, not only its `agent/` leaf. It
can contain upstream-managed credentials, caches, and other private state. Do
not recursively remove either the `pia` roots or an OMP profile as part of an
unattended uninstall.

## Next steps

- Create a reviewed setup with [Combos](guides/combos.md).
- Learn what can be copied with [Security and data boundaries](concepts/security-and-data-boundaries.md).
- Use sessions safely with [Sessions and handoff](guides/sessions-and-handoff.md).
- Look up every command in the [CLI reference](reference/cli.md).
