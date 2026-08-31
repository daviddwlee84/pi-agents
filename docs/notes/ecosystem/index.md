---
kind: ecosystem-index
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://pi.dev/
  - https://github.com/earendil-works/pi
  - https://github.com/earendil-works/pi-chat
  - https://github.com/can1357/oh-my-pi
  - https://github.com/nicobailon/pi-mcp-adapter
  - https://www.deepseek.com/harness/en/
  - https://github.com/deepseek-ai/deepseek-harness
confidence: high
---

# Pi harness ecosystem

This map explains where `pia` sits among upstream harnesses, forks, adapters, and
other products. It is a dated first-party-source review, not a benchmark,
security audit, endorsement, or claim that one harness is best.

!!! info "Fact — compatibility baseline"
    Repository tests currently pin Pi `0.84.4` and Oh My Pi `18.0.11`. That is a
    compatibility snapshot, not a promise about every later release. See the
    site’s [compatibility statement](../../reference/compatibility.md).

## Four different layers

| Layer | What it owns | Example | What it is not |
|---|---|---|---|
| Pi core | Agent loop, terminal client, tools, sessions, providers, RPC, and SDK | `earendil-works/pi`, CLI `pi` | Every optional workflow or integration |
| Independent fork | Its own product, CLI, packages, defaults, and releases | `can1357/oh-my-pi`, CLI `omp` | A Pi Extension or official Pi tier |
| Adapter | A separately installed integration with its own contract | `pi-mcp-adapter` | A capability built into Pi core |
| Separate harness/runtime | Its own loop, composition model, clients, and release boundary | DeepSeek Harness, CLI `dsh` | A Pi distribution merely because it reuses a Pi library |

These boundaries matter more than family resemblance. A fork does not inherit
current compatibility, an adapter does not expand Pi’s core contract, and a
shared library does not transfer product identity, permissions, license, or
support.

## Pi core: deliberately small

Pi describes itself as a minimal agent harness. The `pi` product includes the
coding-agent loop and terminal, built-in tools, sessions, model/provider access,
JSON output, stdio RPC, and an SDK. It expects users to compose more opinionated
workflows with Extensions, skills, prompt templates, themes, and Pi packages
([Pi coding-agent README](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/README.md)).

Pi explicitly leaves MCP, subagents, permission dialogs, plan mode, built-in
todos, and background shell execution out of the default core
([tagged coding-agent README](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/README.md)). It separately documents that it has no built-in sandbox
([security](https://pi.dev/docs/latest/security)). First-party examples show how
Extensions can add some of these behaviors, but examples remain optional
compositions rather than built-in guarantees
([subagent example](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/examples/extensions/subagent/README.md)).

## OMP: related lineage, independent product

[Oh My Pi](oh-my-pi.md) is a coding-focused fork with its own `omp` CLI,
`@oh-my-pi/*` packages, Rust components, profiles, integrated tools,
orchestration features, defaults, and release history. These are concrete
integrated capabilities, not evidence of a general quality ranking. OMP is not a
plugin installed into Pi and should not be documented as a compatible feature
tier. Fork lineage alone does not make Pi and OMP config,
sessions, policies, or extensions interchangeable
([OMP README](https://github.com/can1357/oh-my-pi/blob/v18.0.11/README.md)).

## Adapters: name the dependency

MCP support in a Pi setup should name the Extension or package that supplies it.
For example, `pi-mcp-adapter` is a community adapter with its own configuration,
server lifecycle, and trust boundary
([adapter README](https://github.com/nicobailon/pi-mcp-adapter/blob/ff234b862359e722bf4dc1c99cde62278d4b8eb3/README.md)).
A `pi.mcp` manifest field described by that adapter must not be presented as a
Pi package-manifest feature. Combos that depend on an adapter should pin, review,
and test it explicitly.

## Remote messaging is an external integration

Pi packages and extensions can connect a session to Discord, Telegram, or other
messaging systems, and a future Pi-only combo may pin one of those integrations.
That does not make remote messaging a `pia` core capability. `pia` does not
provide a messaging transport, authentication or admission, live session
orchestration, sandboxing, durable delivery, or service supervision.

Apply the same rule as for MCP: name the specific integration, pin it, and test
its behavior against the selected Pi version instead of attributing third-party
behavior to Pi itself. The Pi README links to the separate
[`earendil-works/pi-chat`](https://github.com/earendil-works/pi-chat) project as
a chat-automation option; its shared organization and upstream link do not by
themselves establish a support contract or compatibility with this repository's
Pi snapshot.

See the dated [IM gateway research](https://github.com/daviddwlee84/pi-agents/blob/main/backlog/pi-im-gateway.md)
for the selected session-router context contract, candidate evidence, and the
gates for moving from an external spike to an experimental combo or maintained
service.

## Other harnesses: compare the same layer

[DeepSeek Harness](deepseek-harness.md) is a separate Cordis-based runtime with
Web, headless, SDK, minimal-SDK, and ACP profiles. One of its model adapters uses
Pi’s reusable `pi-ai` package, but DeepSeek Harness retains its own agent loop,
plugin graph, sessions, permissions, sandbox implementation, CLI, status, and
license boundary. It is therefore comparable to Pi only at the **harness/runtime
layer**, not as a drop-in Pi terminal client.

!!! note "Inference — editorial classification"
    “Harness/runtime layer” is this site’s comparison category, inferred from
    each project’s first-party architecture and positioning. It is not a vendor
    interoperability claim and does not imply feature parity.

## Why `pia` remains thin

`pia` does not replace an agent loop, tool registry, provider layer, permission
system, or sandbox. Its narrower job is to keep reviewable combo source in Git,
materialize it into private runtime state, select Pi or OMP predictably, and keep
credentials, sessions, caches, and other mutable data outside combo source.

That separation is useful even where an engine has native profiles. OMP profiles
relocate OMP-native user state but do not isolate every project or external-tool
configuration source; Pi has different discovery primitives. `pia` gives both
engines one small source/runtime workflow without pretending their native
semantics are identical. Engine-specific features and adapters remain explicit
combo dependencies rather than abstractions copied into `pia`.

## Primary sources

- [Pi coding-agent README, `v0.84.4`](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/README.md)
- [Pi Extension examples, `v0.84.4`](https://github.com/earendil-works/pi/blob/v0.84.4/packages/coding-agent/examples/extensions/subagent/README.md)
- [`pi-chat`, commit `9adbd29`](https://github.com/earendil-works/pi-chat/tree/9adbd29b40ee27ff1decf0fc87cbe180b40924f5)
- [Oh My Pi README, `v18.0.11`](https://github.com/can1357/oh-my-pi/blob/v18.0.11/README.md)
- [`pi-mcp-adapter` README, commit `ff234b8`](https://github.com/nicobailon/pi-mcp-adapter/blob/ff234b862359e722bf4dc1c99cde62278d4b8eb3/README.md)
- [DeepSeek Harness architecture, `dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/docs/architecture.md)
