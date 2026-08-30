# Chezmoi integration

The recommended chezmoi contract is intentionally narrow: let chezmoi maintain
a read-only external checkout at `~/.local/share/pi-agents`, and add that
checkout's `bin/` directory to `PATH` only when the executable exists. `pia`
writes runtime state elsewhere, so no agent credentials or sessions enter the
external checkout.

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

## Presence-gated PATH

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

Preview and apply from the dotfiles workflow:

```sh
chezmoi diff
chezmoi apply
chezmoi apply --refresh-externals   # force a refresh before 168h
pia doctor
pia list --tree
```

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
- Keep chezmoi responsible only for checkout availability and PATH wiring.

This preserves a clean ownership boundary: chezmoi deploys the tool, Git tracks
combo intent, and `pia` owns private runtime synchronisation.
