# Chezmoi integration

The recommended chezmoi contract is narrow: let chezmoi maintain an
**operationally immutable deployment mirror** at `~/.local/share/pi-agents`, and
add its `bin/` directory to `PATH` only when the platform launcher exists.
`pia` writes private runtime state elsewhere.

The mirror is not filesystem-enforced read-only. Treat it as immutable so
`git pull --ff-only` can refresh it safely; author combos in a normal development
checkout, review/commit them, then refresh the external.

This repository does not edit a dotfiles repository. Apply the following recipes
in your own chezmoi source.

## Public external checkout

Add an entry like this to `.chezmoiexternal.toml.tmpl`:

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

The repository is public, so chezmoi can clone the external without GitHub
authentication or repository authorization. Do not put a token in this file or
a combo.

## Presence-gated PATH on macOS and Linux

```sh
PIA_EXTERNAL_ROOT="$HOME/.local/share/pi-agents"
if [ -x "$PIA_EXTERNAL_ROOT/bin/pia" ]; then
  export PATH="$PIA_EXTERNAL_ROOT/bin:$PATH"
fi
unset PIA_EXTERNAL_ROOT
```

The guard keeps a first bootstrap or failed clone from adding a dead entry. The
launcher derives `PIA_SOURCE_ROOT` from its own mirror, so no override is needed.
Node 22.19+ executes the tracked TypeScript directly; do not run `npm install`
or create `dist/` in the mirror.

## Windows launchers and PATH

The same external appears at `%USERPROFILE%\.local\share\pi-agents`. Gate your
managed user-PATH entry on the cmd launcher:

```powershell
$piaRoot = Join-Path $HOME ".local\share\pi-agents"
$piaBin = Join-Path $piaRoot "bin"
if (Test-Path (Join-Path $piaBin "pia.cmd")) {
    $env:Path = "$piaBin;$env:Path"
}
```

Persist that directory through your dotfiles repository's canonical Windows
PATH mechanism rather than appending from `$PROFILE` on every shell start.
PowerShell resolves `pia.ps1`; cmd.exe resolves `pia.cmd`. Both remain tied to
the same checkout revision.

The PowerShell launcher preserves literal target argv boundaries for `run` and
its tested passthrough separator. `fork` and `handoff` do not currently
reconstruct PowerShell's consumed `--` separator, so do not assume the same
passthrough guarantee for those commands on Windows. The cmd launcher uses
normal cmd.exe quoting and is intended for trusted interactive commands.
`.gitattributes` keeps both Windows launchers in CRLF form.

## Generate completion from the mirror

`pia completion zsh`, `bash`, and `powershell` emit native scripts. Resolve the
mirror launcher explicitly during a first apply, because the parent shell may
not yet see the new PATH.

Use the mirror's Git revision as the cache/freshness key: completion logic or
combo metadata can change even when `bin/pia` does not. Generated completers
scan combo directories on each completion, so new combo names do not require
regeneration.

Typical destinations are:

```text
~/.zfunc/_pia
${XDG_DATA_HOME:-~/.local/share}/bash-completion/completions/pia
```

On Windows, feed `pia completion powershell` into your dotfiles repository's
normal generated-profile cache.

## Refresh and verify

```sh
chezmoi diff
chezmoi apply
chezmoi apply --refresh-externals
pia doctor
pia list --tree
```

A `--ff-only` failure usually means the mirror has a local edit or its history
cannot fast-forward. Do not force-reset it blindly: inspect the change, move any
intentional work to a development checkout, restore the mirror, and refresh.

## Boundaries

- Keep credentials, sessions, manifests, handoffs, packages, and caches outside
  chezmoi and the mirror.
- Do not copy combo files directly into `~/.pi` or `~/.omp`; run `pia apply`.
- Do not author with `pia derive` or `pia lineage --ack` in the mirror.
- For temporary testing of uncommitted work, point an installed launcher at a
  development checkout with `PIA_SOURCE_ROOT=/path/to/checkout` (or set the
  equivalent PowerShell environment variable).
- Keep chezmoi responsible only for checkout availability, PATH, and generated
  completion wiring.

This preserves the ownership chain: chezmoi deploys the CLI mirror, Git tracks
combo intent, and `pia` controls private runtime synchronization.
