---
kind: product-note
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://pi.dev/
  - https://pi.dev/news/2026/5/7/pi-has-a-new-home
  - https://github.com/earendil-works/pi/releases/tag/v0.84.4
  - https://api.github.com/repos/earendil-works/pi/releases?per_page=20
  - https://github.com/earendil-works/pi/blob/v0.84.4/README.md
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/package.json
  - https://pi.dev/docs/latest/usage
  - https://pi.dev/docs/latest/providers
  - https://github.com/earendil-works/pi/blob/v0.84.4/packages/ai/README.md
  - https://pi.dev/docs/latest/windows
  - https://pi.dev/docs/latest/termux
  - https://github.com/earendil-works/pi/blob/v0.84.4/LICENSE
confidence: high
---

# Pi overview

Pi calls itself a **minimal agent harness**: a small coding-agent core intended to be
shaped through configuration and extensions rather than a bundled catalogue of
workflows. It is terminal-first in its presentation, but not terminal-only: the
product also exposes print/JSON modes, stdio RPC, and an SDK
([Pi](https://pi.dev/), [usage](https://pi.dev/docs/latest/usage)).

> **Fact — snapshot scope.** This page uses `v0.84.4`, published on 2026-08-28,
> as the release snapshot. It was the newest published non-draft,
> non-prerelease release observed on 2026-08-31. That description does **not**
> mean stable, LTS, or production-supported; Pi publishes no corresponding
> lifecycle or supported-version promise. The [official release API](https://api.github.com/repos/earendil-works/pi/releases?per_page=20)
> supplied the cutoff ordering and `draft`/`prerelease` flags; the
> [immutable tag](https://github.com/earendil-works/pi/releases/tag/v0.84.4)
> anchors release contents.

## Canonical upstream and migration

The canonical upstream is now
[`earendil-works/pi`](https://github.com/earendil-works/pi). Pi announced the
long-term move from `badlogic/pi-mono` on 2026-05-07. npm package scopes moved
from `@mariozechner/*` to `@earendil-works/*`, while the executable remained
`pi`; old-scope `0.73.1` was the transition endpoint and new-scope releases
started at `0.74.0`. Existing configuration and sessions were intended to remain
in place, and the old packages were deprecated rather than made the current
identity ([migration announcement](https://pi.dev/news/2026/5/7/pi-has-a-new-home)).

Use current repository and package names in new work. Historical names are useful
only when explaining migration or interpreting older links.

## Minimal by design

Pi’s homepage explicitly lists several things the core does not bundle: MCP,
subagents, permission dialogs, plan mode, built-in to-do tracking, and background
shell execution. Its proposed answer is composition—Extensions, Pi packages,
containers, `tmux`, or another external mechanism—not hidden built-ins
([Pi](https://pi.dev/)).

> **Observation.** “Minimal” is vendor positioning, not a claim that Pi has the
> fewest components, the smallest attack surface, or better task quality than
> another harness.

The default cross-platform tools are `read`, `write`, `edit`, and `bash`.
`grep`, `find`, and `ls` are additional built-ins; `powershell` is optional and
Windows-only. Flags can allowlist, exclude, or disable tools
([usage](https://pi.dev/docs/latest/usage)). A small default does not reduce tool
authority: the process and its loaded Extensions operate with the invoking
user’s privileges unless an external boundary is added.

## Package responsibilities

The v0.84.4 README presents five principal monorepo packages
([tagged README](https://github.com/earendil-works/pi/blob/v0.84.4/README.md)):

| Package | Responsibility |
| --- | --- |
| `@earendil-works/pi-ai` | Provider/model-facing LLM API and streaming |
| `@earendil-works/pi-agent-core` | Agent loop, state, tools, queues, and events |
| `@earendil-works/pi-tui` | Terminal rendering and UI components |
| `@earendil-works/pi-coding-agent` | `pi` CLI, sessions, resources, and integration modes |
| `@earendil-works/pi-telemetry` | Vendor-neutral telemetry contracts; no exporter by default |

> **Editorial classification.** These are documented packages and
> responsibilities, not a formally declared five-layer architecture.
> `pi-telemetry` is cross-cutting, and the README list is not a complete workspace
> inventory.

The v0.84.4 source tree also contains
[`@earendil-works/pi-client`](https://github.com/earendil-works/pi/blob/v0.84.4/packages/client/package.json),
[`@earendil-works/pi-protocol`](https://github.com/earendil-works/pi/blob/v0.84.4/packages/protocol/package.json), the explicitly experimental
[`@earendil-works/pi-server`](https://github.com/earendil-works/pi/blob/v0.84.4/packages/server/package.json), a Node
[SQLite session backend](https://github.com/earendil-works/pi/blob/v0.84.4/packages/session-backends/sqlite-node/package.json), and a private
[evals workspace](https://github.com/earendil-works/pi/blob/v0.84.4/packages/evals/package.json). These are **source-snapshot observations**, not claims that all
are stable public product surfaces.

A **Pi package** is a different concept from those npm workspace packages: it is
the distribution unit for Extensions, skills, prompt templates, and themes. The
terms should not be collapsed into “plugin.”

## User and integration interfaces

Pi supports four main ways to drive the coding-agent loop:

- the interactive TUI, including steering and follow-up message queues;
- print mode and newline-delimited JSON lifecycle/streaming output;
- bidirectional LF-delimited JSON RPC over a child process’s stdin/stdout; and
- SDK embedding through `@earendil-works/pi-coding-agent`.

A separate remote-session stack—`pi-client`, `pi-protocol`, and `pi-server`—was
present at cutoff commit `853a80d`. It uses four-byte-length-prefixed,
definite-length CBOR and is not the CLI's LF-delimited JSON
[RPC mode](https://pi.dev/docs/latest/rpc). The pinned
[protocol README](https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/protocol/README.md) gives no compatibility promise, while the
[server README](https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/server/README.md) marks the server experimental.

## Provider boundary

In `pi-ai`, a `Provider` owns provider identity, authentication, model catalogue,
and streaming behavior; a `Model` carries a provider-specific ID plus capability,
limit, and cost metadata. Calls route through the owning provider while
credentials, headers, cancellation, and provider-specific options remain request
concerns
([`pi-ai` README](https://github.com/earendil-works/pi/blob/v0.84.4/packages/ai/README.md)).
`models.json` can configure supported API shapes; nonstandard authentication,
dynamic discovery, or custom streaming requires an Extension-defined provider.

The live provider page is a time-sensitive catalogue and includes Google Vertex
AI as a distinct cloud path. Its “login” entries do not share one entitlement or
billing model: for example, Claude Pro/Max third-party harness use relies on
separately billed extra usage, OpenRouter OAuth creates a user-controlled key
billed from OpenRouter credits, Radius is an OAuth gateway, and xAI also supports
API keys. Describe these as heterogeneous authentication paths, not uniform
“subscription access” ([providers](https://pi.dev/docs/latest/providers)).
Provider choice also determines where prompts go and which provider’s retention,
training, residency, and billing terms apply; Pi’s configuration docs establish
no single downstream data policy.

## Platform, runtime, and license

The tagged coding-agent package requires Node.js `>=22.19.0` and exposes the
`pi` binary
([manifest](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/package.json)).
First-party guides document Windows through Git Bash, with optional PowerShell,
and Android through Termux; on ARM64 Termux some optional native dependencies are
skipped and image clipboard paste is unavailable
([Windows](https://pi.dev/docs/latest/windows),
[Termux](https://pi.dev/docs/latest/termux)). These guides are workflows, not a
comprehensive support matrix.

The repository code is MIT-licensed; the tagged license carries “Copyright (c)
2025 Mario Zechner,” while the current site separately attributes stewardship to
Earendil Inc. and contributors
([license](https://github.com/earendil-works/pi/blob/v0.84.4/LICENSE)). That code
license does not establish terms for third-party models, providers, or services.

## Primary sources

- [Pi homepage and positioning](https://pi.dev/)
- [Migration to Earendil](https://pi.dev/news/2026/5/7/pi-has-a-new-home)
- [Pi v0.84.4 release](https://github.com/earendil-works/pi/releases/tag/v0.84.4)
- [v0.84.4 monorepo README](https://github.com/earendil-works/pi/blob/v0.84.4/README.md)
- [Provider documentation](https://pi.dev/docs/latest/providers)
- [`pi-ai` package documentation (v0.84.4)](https://github.com/earendil-works/pi/blob/v0.84.4/packages/ai/README.md)
- [v0.84.4 MIT license](https://github.com/earendil-works/pi/blob/v0.84.4/LICENSE)
