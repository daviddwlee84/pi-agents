---
kind: product-profile
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://geminicli.com/docs/
  - https://geminicli.com/docs/cli/gemini-md/
  - https://geminicli.com/docs/reference/policy-engine/
  - https://geminicli.com/docs/cli/sandbox/
  - https://geminicli.com/docs/core/subagents/
  - https://github.com/google-gemini/gemini-cli/blob/v0.57.0/packages/cli/src/config/settingsSchema.ts
  - https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals
  - https://github.com/google-gemini/gemini-cli/releases/tag/v0.57.0
confidence: high
---

# Gemini CLI

## Scope and surfaces

Gemini CLI is Google’s open-source terminal agent for working with Gemini models
and local project context. `gemini` starts an interactive REPL; prompts can also
arrive positionally, through `-p/--prompt`, stdin, or a non-TTY. Headless mode
supports text, one JSON object, or streaming JSONL events. IDE companion
integration and ACP mode add editor/client interfaces
([overview](https://geminicli.com/docs/),
[headless mode](https://geminicli.com/docs/cli/headless/)).

!!! warning "Fact — consumer access changed"
    Since 2026-06-18, requests authenticated with consumer Google accounts for
    Gemini Code Assist for individuals, Google AI Pro, and Google AI Ultra have
    not been processed by Gemini CLI; Google directs those users to Antigravity
    CLI. Standard/Enterprise access and paid API-key authentication were not
    ended by that notice
    ([deprecation](https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals)).
    Continued releases do not prove an unchanged roadmap, while the transition
    does not establish project EOL.

## Instructions and context

`GEMINI.md` is the default instruction file. Gemini CLI combines global,
workspace/ancestor, and just-in-time context discovered when tools enter a path,
stopping at a trusted root. `/memory show` displays combined context and
`/memory reload` rescans it; `@file.md` imports other files. `context.fileName`
can configure alternatives such as `AGENTS.md`
([GEMINI.md](https://geminicli.com/docs/cli/gemini-md/)). This persistent
hierarchical context is distinct from on-demand Agent Skills, custom commands,
and the system-prompt override.

## Tools and execution

Built-ins cover shell execution; file listing, reading, searching, replacing,
and writing; user questions; session todos; an experimental dependency tracker;
MCP resources; skill activation; Plan Mode; Google web search; and URL fetch.
The todo tool is a session-scoped progress list, not a durable workflow; the
experimental tracker is the separate session DAG
([tools](https://geminicli.com/docs/reference/tools/)).

Plan Mode is a read-oriented research/design workflow whose default policy
permits selected reads, research subagents, skills, questions, read-only MCP,
and plan-directory Markdown. User policy may widen it, and approved headless
execution transitions to YOLO, so Plan Mode is not an immutable sandbox
([Plan Mode](https://geminicli.com/docs/cli/plan-mode/)).

## Permissions/trust/sandbox

The Policy Engine returns `allow`, `deny`, or `ask_user`; reads are generally
allowed while writes and shell commands ask. `ask_user` becomes denial in
headless mode. Approval modes include `default`, `autoEdit`, `plan`, and `yolo`.
Workspace `.gemini/policies` are explicitly documented as non-functional, so
they should not be treated as a protection boundary
([Policy Engine](https://geminicli.com/docs/reference/policy-engine/)).

**Fact.** The immutable v0.57.0 schema leaves legacy full-process sandboxing
undefined and defaults tool sandboxing to false. Sandbox mechanisms can be
enabled separately and include macOS Seatbelt, containers, Windows Native
Sandbox, gVisor, and experimental LXC/LXD
([v0.57.0 schema](https://github.com/google-gemini/gemini-cli/blob/v0.57.0/packages/cli/src/config/settingsSchema.ts),
[sandbox](https://geminicli.com/docs/cli/sandbox/)). Do not summarize this as
“sandboxed by default.”

!!! question "Open question — first-party default conflict"
    The Trusted Folders guide says folder trust is disabled by default, while
    the v0.57.0 schema and generated configuration set
    `security.folderTrust.enabled` to true. Both claims remain source-scoped;
    neither is silently chosen as the timeless default
    ([Trusted Folders](https://geminicli.com/docs/cli/trusted-folders/)).

Trust, policy, and sandboxing are complementary: trust suppresses project-owned
configuration in untrusted folders, policy decides whether a tool may run, and
a sandbox constrains permitted execution. A fail-closed trust/A2A filtering fix
merged to `main` on 2026-08-28, after v0.57.0; it is not attributed to that
release ([PR #29099](https://github.com/google-gemini/gemini-cli/pull/29099)).

## Sessions and recovery

Sessions are saved per project under `~/.gemini/tmp/<project_hash>/chats/` and
include prompts, responses, tool I/O, and token data. They can be resumed, with
a documented default 30-day cleanup that also removes associated plans,
trackers, outputs, and activity logs
([sessions](https://geminicli.com/docs/cli/session-management/)). Checkpointing
and rewind must be enabled and center on AI file edits; shell side effects and
manual edits are outside their general rollback model.

Local transcripts do not imply local inference: prompts and context go to the
selected Google service. Anonymous usage statistics default on and are
separate from OpenTelemetry, which defaults off
([configuration](https://geminicli.com/docs/reference/configuration/)).

## Extensibility

**Extensions** are the installable bundle mechanism and may provide commands,
context, Skills, hooks, subagents, policies, themes, and MCP servers. Agent
Skills progressively disclose `SKILL.md` after user consent
([Skills](https://geminicli.com/docs/cli/skills/)). Event-driven command hooks
can alter or block lifecycle operations and run with user privileges. They are
not uniformly synchronous: hook groups may run concurrently, `PreCompress` is
asynchronous, and `SessionEnd` is best-effort. Malformed ordinary stdout can
fail open; exit code 2 or valid denial JSON is required for a security block
([hooks](https://geminicli.com/docs/hooks/reference/)).

MCP supports stdio, SSE, and Streamable HTTP. Direct configuration with
`trust: true` bypasses confirmations for that server; it does not turn the
server into a trusted sandbox component
([MCP](https://geminicli.com/docs/tools/mcp-server/)). The initial
`@google/gemini-cli-sdk` supports an agent, streaming, sessions, instructions,
and custom tools, but repository design notes do not establish CLI parity and
list hooks, subagents, extensions, ACP, and approvals/policies as unimplemented,
with contradictory skills status. This is a repository-design observation at
[`0bd1d439`](https://github.com/google-gemini/gemini-cli/blob/0bd1d439751478771c45d3d0895a6a9760554bf4/packages/sdk/SDK_DESIGN.md), not a supported-feature or stability contract.

## Orchestration

Local subagents are specialist tools with separate prompts, context loops,
models, limits, and optional tool/MCP isolation. Current docs list built-ins and
custom definitions, prohibit recursive subagent calls, and label
extension-provided subagents preview
([subagents](https://geminicli.com/docs/core/subagents/)). The browser agent is
separate and disabled by default. Remote agents use A2A; ACP instead connects
Gemini CLI to an editor/client. These protocols should not be collapsed into a
single “multi-agent” capability.

## Model/provider boundary

The documented access routes are Google service/authentication backends:
Gemini Code Assist, the Gemini Developer API through `GEMINI_API_KEY`, and
Vertex AI credentials. They are not three provider-plugin implementations, and
no general third-party model-provider interface is documented
([authentication](https://geminicli.com/docs/get-started/authentication/)).
`/model` and `--model` do not control subagent models. Experimental local Gemma
routing classifies work locally but still sends task inference to hosted Gemini
models.

## Platform/license/status

Google recommends macOS 15+, Windows 11 24H2+, or Ubuntu 20.04+, Node.js 20+,
an internet connection, and a supported region
([installation](https://geminicli.com/docs/get-started/installation/)). The
Gemini CLI repository is
[Apache-2.0 licensed](https://github.com/google-gemini/gemini-cli/blob/v0.57.0/LICENSE).
That license does not transfer to hosted Gemini services, models, trademarks,
or Antigravity.

## Change signals

At the cutoff, [v0.57.0](https://github.com/google-gemini/gemini-cli/releases/tag/v0.57.0)
was a non-prerelease release dated 2026-08-25; the
[v0.58.0-preview.0](https://github.com/google-gemini/gemini-cli/releases/tag/v0.58.0-preview.0) and
[v0.59.0 nightly](https://github.com/google-gemini/gemini-cli/releases/tag/v0.59.0-nightly.20260830.g0bd1d4397) channels were also active. A live
[changelog page](https://geminicli.com/docs/changelogs/latest/) still named
v0.55.1 “latest stable,” and several pages retained pre-transition consumer-auth
text. Release tags, live docs, and `main` must therefore be cited as different
snapshots.

## Open questions

**Open questions.** Which stable release first includes the post-v0.57.0 trust
fix? When will trust/sandbox defaults and consumer-auth pages be reconciled?
What compatibility and feature contract will the SDK adopt? What maintenance
scope will remain after development consolidation behind Antigravity?

## Primary sources

- [Gemini CLI documentation](https://geminicli.com/docs/)
- [Policy Engine](https://geminicli.com/docs/reference/policy-engine/) and [sandboxing](https://geminicli.com/docs/cli/sandbox/)
- [v0.57.0 settings schema](https://github.com/google-gemini/gemini-cli/blob/v0.57.0/packages/cli/src/config/settingsSchema.ts)
- [Consumer-account deprecation](https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals)
- [v0.57.0 release](https://github.com/google-gemini/gemini-cli/releases/tag/v0.57.0)
