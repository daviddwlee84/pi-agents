# Chezmoi integration

The recommended chezmoi contract is intentionally narrow: let chezmoi maintain
a read-only external checkout at `~/.local/share/pi-agents` (the same path
below the Windows user profile), and add that checkout's `bin/` directory to
`PATH` only when the platform launcher exists. `pia` writes runtime state
elsewhere, so no agent credentials or sessions enter the external checkout.

This repository does not edit a dotfiles repository. The following snippets are
an integration recipe to apply there.

## External checkout

Add an entry like this to the dotfiles source `.chezmoiexternal.toml.tmpl`
(adjust the URL if the repository remote differs):

```toml
[".local/share/pi-agents"]
    type = "git-repo"
    url = "https://github.com/daviddwlee84/pi-agents.git"
    refreshPeriod = "168h"
    [".local/share/pi-agents".clone]
        args = ["--depth", "1"]
    [".local/share/pi-agents".pull]
        args = ["--ff-only"]
```

Treat this checkout as an immutable deployment mirror. `--ff-only` refreshes
will stop on local edits instead of overwriting them. Author combos in a normal
development checkout, commit and push them, then refresh the external.

## Presence-gated PATH on macOS and Linux

Add this to the shared shell environment template used by zsh/bash:

```sh
PIA_EXTERNAL_ROOT="$HOME/.local/share/pi-agents"
if [ -x "$PIA_EXTERNAL_ROOT/bin/pia" ]; then
  export PATH="$PIA_EXTERNAL_ROOT/bin:$PATH"
fi
unset PIA_EXTERNAL_ROOT
```

The guard keeps a first bootstrap or failed network clone from adding a dead
PATH entry. Because `bin/pia` derives its source root from its own checkout,
`PIA_SOURCE_ROOT` is unnecessary for this deployment.

No `npm install` or generated `dist/` tree is required in the external mirror:
Node 22.19+ executes the repository's erasable TypeScript sources directly.

## Windows launchers and PATH

The same external entry checks out to
`%USERPROFILE%\.local\share\pi-agents`. Add its `bin` directory through the
dotfiles repository's managed user-PATH mechanism, gated on the cmd launcher:

```powershell
$piaRoot = Join-Path $HOME ".local\share\pi-agents"
$piaBin = Join-Path $piaRoot "bin"
if (Test-Path (Join-Path $piaBin "pia.cmd")) {
    $env:Path = "$piaBin;$env:Path"
}
```

The snippet demonstrates the presence gate for the current process. Persist
the same directory through the dotfiles repository's canonical Windows PATH
surface instead of appending it from `$PROFILE` on every shell start.

PowerShell resolves `pia` to `bin\pia.ps1`; cmd.exe resolves it to
`bin\pia.cmd`. Both call the checkout's extensionless Node launcher, so the
CLI and combos remain tied to one Git revision. The PowerShell launcher keeps
literal argv boundaries; the cmd launcher follows normal cmd.exe quoting and
is intended for trusted interactive commands. Programmatic callers with
arbitrary input should use the PowerShell launcher. `.gitattributes` keeps the
two Windows launchers on CRLF checkouts.

Node 22.19+ remains required on Windows. Pi's npm package normally exposes
`pi.ps1` and `pi.cmd`, while the OMP binary installer exposes `omp.exe`; `pia`
resolves the PowerShell shim without `shell: true` and launches the native OMP
executable directly.

## Shell completion

`pia completion zsh`, `pia completion bash`, and
`pia completion powershell` emit sourceable native completion scripts. The
generated adapters complete commands and flags, and scan the checkout's local
`combos/pi` and `combos/omp` directories for combo positions such as
`pia use <Tab>`. A runtime `PIA_SOURCE_ROOT` override is honoured immediately.

On macOS/Linux, add `pia` to the existing post-apply completion generator so it
writes `~/.zfunc/_pia` and the bash-completion user file. Resolve the launcher
from `~/.local/share/pi-agents/bin/pia` explicitly: on a first apply the parent
shell may not yet have the new PATH. Use the external checkout's Git revision
as the freshness stamp because `bin/pia` itself may be unchanged while its
TypeScript or completion assets change.

On Windows, cache `pia completion powershell` through the profile's normal
generated-init mechanism and use the same checkout revision as an additional
cache stamp. This avoids paying the Node/TypeScript startup cost on every new
PowerShell process. The generated completer scans combo manifests directly on
each Tab press, so combo additions do not require regeneration.

Preview and apply from the dotfiles workflow:

```sh
chezmoi diff
chezmoi apply
chezmoi apply --refresh-externals   # force a refresh before 168h
pia doctor
pia list --tree
```

The same commands work in PowerShell after the managed user PATH is visible in
a new process. For a one-off checkout test, use `bin\pia.ps1 doctor` or
`bin\pia.cmd doctor` before changing PATH.

On this machine, edit the chezmoi source returned by `chezmoi source-path`, not
rendered files under `$HOME`. The natural locations are
`.chezmoiexternal.toml.tmpl` and the shared shell exports template.

## Boundaries

- Do not copy combo `agent/` files directly into `~/.pi`, `~/.omp`, or the
  dotfiles repository; use `pia apply`.
- Do not store auth, sessions, generated manifests, or handoffs in chezmoi.
- Do not run `pia derive` or `pia lineage --ack` against the external mirror;
  those are source-authoring operations.
- Use `PIA_SOURCE_ROOT=/path/to/dev/checkout` temporarily when testing
  uncommitted combo work with the installed CLI.
- In PowerShell, the equivalent is
  `$env:PIA_SOURCE_ROOT = "C:\path\to\dev\checkout"`.
- Keep chezmoi responsible only for checkout availability and PATH wiring.

This preserves a clean ownership boundary: chezmoi deploys the tool, Git tracks
combo intent, and `pia` owns private runtime synchronisation.
