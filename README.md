# pi-agents

`pi-agents` keeps multiple [Pi](https://github.com/earendil-works/pi) and
[Oh My Pi](https://omp.sh/) harness combinations in one Git repository. Its
`pia` CLI selects a combo, safely materialises its configuration into private
runtime state, and launches the matching agent without putting credentials or
session history in Git.

The design stays deliberately small: each combo contains a complete config
tree, derived combos are normal copies with explicit lineage metadata, and
parent changes are reviewed rather than merged implicitly.

`pia` is written in [Node-native TypeScript](https://nodejs.org/download/release/v22.21.0/docs/api/typescript.html).
Node 22.19+ executes the erasable
`.ts` sources directly, so deployed checkouts need no build step or runtime
packages; TypeScript and Node type definitions are development-only tools used
by `npm run typecheck` and CI.

## Quick start

Requirements: Node.js 22.19 or newer, plus `pi` and/or `omp` for the combos you
want to run.

```sh
git clone https://github.com/daviddwlee84/pi-agents.git
cd pi-agents
npm link

pia doctor
pia list --tree
pia apply pi/base --dry-run
pia run pi/base --
```

`pia run` safely applies the selected source before launch and stops on runtime
drift or an unowned collision. You can also save a default instead of naming
the combo every time:

```sh
pia use pi/base
pia current
pia run -- --model provider/model
```

Selection precedence is an explicit argument, then `PIA_COMBO`, then the value
saved by `pia use`. Run `./bin/pia` directly if you do not want a global npm
link.

The compatibility snapshot for the current implementation is **Pi 0.84.4**
and **OMP 18.0.11**. Tests cover the wrapper's behavior and pinned session
fixtures; run `pia doctor` and a smoke launch when using a different upstream
version.

## What is included

- `combos/pi/base`: neutral upstream Pi configuration.
- `combos/pi/vanilla`: Pi with project/global resource discovery disabled by
  launch flags.
- `combos/omp/base`: neutral OMP native profile configuration.
- Strict source-to-runtime synchronisation with drift detection and dry runs.
- Per-combo or explicitly shared session storage, same-engine forks, and
  deterministic redacted handoffs across harnesses.

Start with [combo authoring](docs/combos.md), then read
[architecture](docs/architecture.md),
[sessions and handoff](docs/sessions-and-handoff.md), the
[ecosystem snapshot](docs/ecosystem.md), and the optional
[chezmoi integration](docs/chezmoi.md).

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
