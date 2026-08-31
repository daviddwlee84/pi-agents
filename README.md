# pi-agents

**Documentation:** [Read the live pi-agents documentation](https://daviddwlee84.github.io/pi-agents/) (English / 繁體中文)

`pi-agents` keeps multiple [Pi](https://github.com/earendil-works/pi) and
[Oh My Pi](https://omp.sh/) harness combinations in one Git repository. Its
`pia` CLI selects a combo, safely materialises its configuration into private
runtime state, and launches the matching agent without putting credentials or
session history in Git.

The design stays deliberately small: each combo contains a complete config
tree, derived combos are normal copies with explicit lineage metadata, and
parent changes are reviewed rather than merged implicitly.

`pia` does not install or update harness binaries, choose or manage models and
providers, manage credentials, or provide an execution sandbox. Authentication,
agent permissions, tools, processes, and network access remain upstream or
operating-system responsibilities.

`pia` is written in [Node-native TypeScript](https://nodejs.org/download/release/v22.21.0/docs/api/typescript.html).
Node 22.19+ executes the erasable
`.ts` sources directly, so deployed checkouts need no build step or runtime
packages; TypeScript and Node type definitions are development-only tools used
by `npm run typecheck` and CI.

## Quick start

| Capability | Prerequisites |
|---|---|
| Core `pia` commands | Node.js 22.19 or newer |
| `pia run` | Core requirements plus the `pi` or `omp` binary for the selected combo |
| `pia handoff` | Core requirements plus Git and a readable, non-bare Git working tree for the source session, with at least one commit and a resolvable `HEAD`; the literal `python3` executable version 3.9 or newer on `PATH` (`pia` currently does not accept `py.exe` or `python.exe` as substitutes); the tracked redactor and `gitleaks` policy; and `gitleaks` version 8.25.0 or newer on `PATH`; launching the result also needs the target harness |

`pia doctor` checks whether the `python3` and `gitleaks` commands are present; it
does not verify these required versions.

```sh
git clone https://github.com/daviddwlee84/pi-agents.git
cd pi-agents
PIA_CHECKOUT="$PWD"

# Work on the target project, not the pi-agents checkout.
cd /path/to/your-project

"$PIA_CHECKOUT/bin/pia" doctor
"$PIA_CHECKOUT/bin/pia" list --tree
"$PIA_CHECKOUT/bin/pia" apply pi/base --dry-run
"$PIA_CHECKOUT/bin/pia" run pi/base --
```

Each Pi combo uses its own agent directory and each OMP combo uses its own
`pia-<combo>` profile. A login stored by the unprofiled upstream harness may
therefore not apply. Complete any provider authentication requested in the
selected `pia run` context; environment credentials follow upstream rules and
credentials never belong in combo source.

Using the absolute launcher requires no npm setup. `npm link` is optional for a
development checkout; a chezmoi deployment can instead put `bin/` on `PATH`.
The direct platform launchers are:

```sh
./bin/pia --version              # macOS/Linux, from the checkout
```

```powershell
.\bin\pia.ps1 --version         # Windows PowerShell, from the checkout
```

```bat
bin\pia.cmd --version           # Windows cmd.exe, from the checkout
```

When `bin/` is on `PATH`, all three environments use the command name `pia`.
The PowerShell launcher reconstructs the `--` passthrough separator consumed by
PowerShell for `run` and preserves the child exit code. It does not yet
reconstruct that separator for `fork` or `handoff`, so those forms do not have
the same native target-argument passthrough guarantee on PowerShell. The cmd
launcher follows cmd.exe's normal quoting rules and is for trusted interactive
commands. If an npm-installed harness is exposed as a shim such as `pi.ps1`,
`pia` invokes it through a fixed `PowerShell -File` command and never enables
child-process shell parsing.

`pia run` safely applies the selected source before launch and stops on runtime
drift or an unowned collision. You can also save a default instead of naming
the combo every time:

```sh
pia use pi/base
pia current
pia run -- --model provider/model
```

Selection precedence is an explicit argument, then `PIA_COMBO`, then the value
saved by `pia use`.

`pia` can generate native completion for every managed shell:

```sh
pia completion zsh > ~/.zfunc/_pia
pia completion bash > "${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion/completions/pia"
```

```powershell
pia completion powershell | Out-String | Invoke-Expression
```

Completion discovers combo directories directly, so `pia use <Tab>` reflects
newly derived or pulled combos without launching another Node process. The
[chezmoi recipe](docs/guides/chezmoi.md) shows how a dotfiles repository can
generate and cache these scripts.

Human-readable output uses semantic terminal colours when the selected stream
supports them. `NO_COLOR` and `NODE_DISABLE_COLORS` disable colour;
`FORCE_COLOR` and non-zero `CLICOLOR_FORCE` can force it through a pipe. JSON,
completion code, versions, selected combo ids, and artifact paths always stay
plain for scripts.

The compatibility snapshot for the current implementation is **Pi 0.84.4**
and **OMP 18.0.11**. Tests cover the wrapper's behavior and pinned session
fixtures; run `pia doctor` and a smoke launch when using a different upstream
version.

## What is included

All shipped combos have `maturity: learning` and are intentionally minimal:

- `combos/pi/base`: neutral, upstream-default Pi configuration with normal
  project/global discovery and isolated history.
- `combos/pi/vanilla`: derived Pi learning baseline that disables approvals and
  discovered extensions, skills, prompts, themes, and context files by launch
  flags.
- `combos/omp/base`: neutral, upstream-default OMP native profile with isolated
  history.
- Strict source-to-runtime synchronisation with drift detection and dry runs.
- Per-combo or explicitly shared session storage, same-engine forks, and
  deterministic redacted handoffs across harnesses.

“Upstream-default” means normal resource discovery and upstream trust/permission
behavior remain active; it does not mean isolated, production-ready, or
sandboxed.

Start with the [documentation home](docs/index.md) and
[getting-started guide](docs/getting-started.md). The new docs tree also covers
[security and data boundaries](docs/concepts/security-and-data-boundaries.md),
the [CLI reference](docs/reference/cli.md),
[compatibility](docs/reference/compatibility.md),
[combo authoring](docs/guides/combos.md),
[architecture](docs/concepts/architecture.md),
[sessions and handoff](docs/guides/sessions-and-handoff.md),
[troubleshooting](docs/guides/troubleshooting.md), and
[research notes](docs/notes/index.md).

```sh
npm install --ignore-scripts   # development/type-check dependencies only
npm test
npm run typecheck
npm run check
```

<!-- project-knowledge-harness:readme-roadmap -->
## Roadmap & lessons learned

Future work is indexed in [TODO.md](TODO.md), with longer research under
[backlog/](backlog/). Past traps and their workarounds live under
[pitfalls/](pitfalls/).
<!-- project-knowledge-harness:readme-roadmap (end) -->
