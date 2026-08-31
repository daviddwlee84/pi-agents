---
kind: ecosystem-product-note
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://www.deepseek.com/harness/en/
  - https://github.com/deepseek-ai/deepseek-harness
  - https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.2
confidence: high
---

# DeepSeek Harness

DeepSeek Harness (`dsh`) is DeepSeek’s open-source agent harness. DeepSeek frames
an agent as “Model + Harness”: the model supplies intelligence, while the harness
connects it to environments, tools, sessions, and ongoing work
([overview](https://www.deepseek.com/harness/en/)). It is not a DeepSeek model,
Pi distribution, or drop-in Pi terminal client.

!!! warning "Fact — developer preview"
    DeepSeek labels Harness a developer preview; the tagged README promises
    compatibility-breaking changes, and the safety notice says the software is
    unaudited and not production-ready. Run it least-privileged in a disposable
    VM, container, or dedicated environment
    ([README](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/README.md),
    [SAFETY.md](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/SAFETY.md)).

## Versions and distribution channels

The channels did not identify one universal “latest” build on 2026-08-31:

| Channel | Verified state |
|---|---|
| GitHub | `dsh-v0.1.2-alpha.2`, a prerelease published 2026-08-30 |
| npm `alpha` | `0.1.2-alpha.2` |
| npm `latest` and `next` | `0.1.1-rc.2`; plain `npx @deepseek-ai/dsh web` followed this default channel |
| PyPI runtime binary | `0.1.1rc1`; wheels for Linux x64/arm64 and macOS 14+ arm64, with no Windows wheel or source distribution for that version |

The exact Node range `^22.19.0 || >=24.0.0` belongs to the tagged private
[root workspace manifest](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/package.json) and source-build contract; the published
[`@deepseek-ai/dsh` manifest](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/apps/cli/package.json) does not declare an `engines` field. Likewise, Windows x64 is a source-documented
Python target, not a downloadable Python runtime artifact in the verified PyPI
release. Pin both version and channel
([GitHub release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.2),
[npm metadata](https://registry.npmjs.org/@deepseek-ai%2Fdsh),
[PyPI metadata](https://pypi.org/pypi/deepseek-harness-runtime-bin/0.1.1rc1/json)).

## Cordis and “Everything is a Plugin”

Cordis is the underlying lifecycle, service, typed-event, and reversible-effect
framework. DeepSeek Harness is the assembled product. Its architecture composes
model adapters, tool registries, session logs, the agent loop, persistence,
sandbox services, and UI through plugins rather than hard-wiring them into one
privileged application core
([Cordis primer](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/cordis-primer.md),
[architecture](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/architecture.md)).

“Everything is a Plugin” describes capability composition. It does not mean the
Cordis substrate, CLI launcher, package manager, or runtime loader is itself a
replaceable Harness plugin. Keep these terms distinct:

- a **Profile** is a runnable process composition;
- a **Bundle** distributes a configuration layer;
- an **Agent Preset** supplies one Session’s tools, prompts, and Skills.

## Profiles and the Standard preset

The `dsh` launcher ships profiles for a local browser UI (`web`), one-shot
execution (`headless`), JSON-RPC SDK servers (`sdk` and `sdk-minimal`), and an
ACP stdio server (`acp`). `dsh web` binds to `127.0.0.1:3080` by default and
rejects `--host 0.0.0.0`; SSH suppresses automatic browser opening
([CLI reference](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/apps/cli/reference/README.md)).
The TypeScript and Python SDKs drive a complete runtime over newline-delimited
JSON-RPC; ACP is a separate automation profile, not that SDK protocol.
`sdk-minimal` is intentionally not a safe/full default: it omits settings,
managed credentials, telemetry, Web tools, subagents, instruction discovery,
runtime context, and compaction, and pins `danger-full-access`; use it only
inside an appropriate outer isolation boundary
([Python SDK guide](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/user/guide/python-sdk.md)).

Within a Session, the **Standard** Agent Preset is the full coding-agent
composition: file editing, shell execution, retrieval, Skills, planning, goals,
subagents, and workflows. Source also ships `ptc`, `minimal`, and `cordis`
presets. Tagged
[UI locale source](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/client/ui-agent-preset/src/client/locales.ts) maps `cordis` to “Creator mode” and calls `ptc` “PTC mode”;
the product page’s “Code Mode” label has no reviewed explicit equivalence to
preset ID `ptc` ([Agent Presets](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/preset/agent-presets/README.md)).

## Tools, permissions, and confinement

Base-backed sessions default to the `workspace-write` permission preset and
approval policy `ask`. Only `allowed-once` grants the requested action;
rejection, cancellation, missing/throwing answerers, or an unavailable approval
channel deny it. A separate `danger-full-access` preset uses approval policy
`never`
([permission presets](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/permission-presets.md),
[approval](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/approval.md)).

The process-sandbox vocabulary—`read-only`, `workspace-write`, and
`danger-full-access`—governs filesystem effects for selected capabilities, not
all authority. Reads and network access remain available in base profiles;
process visibility depends on the backend. Linux bwrap/Landlock, macOS Seatbelt,
and a Windows restricted-token/ACL runner are selected locally, and Windows or
older Landlock enforcement can be reported as partial. This is not synonymous
with credential, network, plugin, or VM isolation
([sandbox reference](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/sandbox.md)).

## Sessions and extensions

A Session is an append-only, event-sourced log from which model messages,
trajectory views, resume, fork, replay, and telemetry are derived. Records can
include raw stream chunks, assembled messages, tool calls/results, injected
context, route metadata, and effective request headers. JSONL and opt-in SQLite
persistence preserve the logical stream; compaction changes the model-visible
surface with a durable summary while retaining raw log evidence
([sessions](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/session.md),
[persistence](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/persistence.md)).

Native Cordis plugins are the broad extension plane. A git dependency’s allowed
`prepare` script runs during installation outside the agent sandbox, so plugins
must be reviewed and pinned
([publishing guide](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/user/develop/basic/publish.md)). Model-authored plugins in the `cordis` preset are ephemeral,
can affect other Sessions in the process, and should be trusted like shell access
([dynamic Cordis](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/user/develop/practice/dynamic-cordis.md),
[preset](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/preset/agent-presets/presets/cordis/agent.cordis.yml)). Other surfaces are narrower:

- **Skills** are layered instruction packages whose bodies load on demand.
- **MCP** is opt-in and bridges external tools only—not Resources, Prompts, or
  task-required tools. Stdio server commands are trusted executables outside the
  agent sandbox
  ([MCP client](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/mcp/mcp-client/README.md),
  [CLI reference](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/apps/cli/reference/README.md)).
- **Hooks** provide partial Claude Code and Codex command-hook compatibility;
  each bridge documents unsupported events, handlers, payloads, discovery, and
  output semantics.

## Workflows and orchestration

Subagents can be one-shot or continuable children backed by durable Sessions.
The Workflow seam lets model-written JavaScript coordinate `agent`, `pipeline`,
`parallel`, `phase`, and `log` operations in a worker thread. Although timers,
filesystem, network, and Node globals are not intentionally injected, the
`node:vm` context is explicitly escapable; it is containment, not a security
boundary
([workflow](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/workflow.md),
[worker warning](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/workflow/workflow-worker-thread/README.md)).
Schedules are best-effort, session-local reminders—not cron, exactly-once jobs,
or external notifications.

Agent Teams requires a separate qualification: its architecture exists in the
tagged source, but private experimental packages are excluded from official npm,
CLI, Web, and Python release payloads. It is source-checkout-only experimental
work, not a disabled row in the shipped base
([experimental profile](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/experimental/agent-team-profile/README.md)).

## Model adapters and the Pi boundary

Harness selects models through replaceable `ctx.llm` adapters. The tag includes
a direct `deepseek-official` adapter and a multi-provider adapter backed by
Pi’s reusable `pi-ai` library
([Harness adapter](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/llm/llm-pi-ai/README.md),
[`pi-ai`](https://github.com/earendil-works/pi/blob/853a80d26c90a14c1886f0ebb8ffaae133ca2185/packages/ai/README.md)).
Library reuse does not import Pi’s coding-agent loop, CLI, sessions, Extensions,
identity, release policy, permissions, or support boundary. No reviewed source
establishes an integrated local-inference engine; support for a company or
self-hosted endpoint only establishes a configurable remote endpoint.

!!! note "Inference — editorial comparison scope"
    DeepSeek Harness and Pi are comparable at the harness/runtime layer because
    both projects describe themselves there. DeepSeek Harness exposes a
    plugin-composed, multi-profile runtime; Pi’s primary product is a minimal
    terminal coding harness. This classification is editorial, not a vendor
    claim of compatibility or a feature-quality ranking.

“Local by default” applies to default storage and feedback-gated session
telemetry, not network isolation. Normal model, Web, MCP, plugin, and tool calls
can transmit content. The direct DeepSeek adapter also sends attribution,
anonymous/session identifiers, and—when preparation succeeds—the active plugin
package inventory with official requests
([adapter behavior](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/packages/llm/llm-deepseek/README.md),
[feedback/telemetry behavior](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/apps/cli/reference/README.md),
[data processing](https://www.deepseek.com/harness/en/data-processing/)).
That policy page gives no explicit revision date, concrete retention period, or
deletion schedule. Harness code is covered by the tagged
[MIT license](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/LICENSE); bundled third-party terms remain separately recorded in
[THIRD_PARTY_NOTICES.md](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/THIRD_PARTY_NOTICES.md), and external payload/service terms remain separate.

!!! question "Open question — lifecycle"
    No reviewed first-party source gives a GA date, API-stability roadmap,
    support SLA, security-audit schedule, or complete cross-profile platform
    matrix. Recheck the exact release and distribution channel before adoption.

## Primary sources

- [DeepSeek Harness overview](https://www.deepseek.com/harness/en/)
- [README, `dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/README.md)
- [Architecture, `dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/architecture.md)
- [CLI behavior reference, `dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/apps/cli/reference/README.md)
- [Sandbox reference, `dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/subsystems/sandbox.md)
- [Safety notice, `dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/SAFETY.md)
- [MIT license, `dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/LICENSE)
