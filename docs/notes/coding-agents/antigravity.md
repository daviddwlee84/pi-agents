---
kind: product-profile
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://antigravity.google/docs/home
  - https://antigravity.google/docs/permissions
  - https://antigravity.google/docs/cli/sandbox
  - https://antigravity.google/docs/subagents
  - https://antigravity.google/docs/models
  - https://antigravity.google/docs/enterprise
  - https://antigravity.google/blog/introducing-google-antigravity-sdk
  - https://github.com/google-antigravity/antigravity-sdk-python/tree/ac516c7709e3baf225c09d8b9d112b07b70066ff
  - https://github.com/google-antigravity/antigravity-cli/tree/556846a4bb94117222f53846896c7eb0d645307e
  - https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/
  - https://bughunters.google.com/learn/invalid-reports/ai-products/antigravity-known-issues
confidence: medium
---

# Google Antigravity

## Scope and surfaces

Google Antigravity is an umbrella “agentic development platform,” not one CLI or
one IDE. As of the cutoff, its separately versioned surfaces were:

- **Antigravity 2.0 v2.11.0**, a standalone desktop command center;
- **Antigravity CLI v1.1.22**, a Go terminal/TUI product;
- **Antigravity for IDEs v2.5.5**, editor integrations; and
- **Google Antigravity SDK v0.1.15**, a Python API around the harness.

Google says they share an underlying harness, but that does not establish
feature, settings, model, security, data-policy, license, or lifecycle parity
([home](https://antigravity.google/docs/home),
[surface guide](https://cloud.google.com/blog/topics/developers-practitioners/choosing-your-surface-antigravity-20-antigravity-cli-antigravity-ide-or-antigravity-sdk)).
Google’s names also conflict: current pages use “Antigravity for IDEs,”
“Antigravity IDE,” and “Antigravity Extensions,” while enterprise material
retains a distinct “standalone Antigravity IDE.” This profile therefore uses
**IDE/editor integrations** unless a source-specific name matters.

!!! note "Fact — Gemini CLI is separate"
    Antigravity CLI is the consumer successor to Gemini CLI, not a rename of the
    same repository or binary. Consumer Gemini CLI traffic moved on 2026-06-18,
    while Gemini CLI remained available for Standard/Enterprise and paid
    API-key paths. The migration guide covers selected visual settings, auth
    tokens, extensions/plugins, commands/Skills, MCP, and context paths. Hook
    and conversation-history migration are not documented, and full settings or
    behavior parity is not established
    ([transition](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/),
    [migration](https://antigravity.google/docs/cli/gcli-migration)).

## Instructions and context

Antigravity CLI recognizes workspace-root `GEMINI.md` or `AGENTS.md` at startup.
Antigravity 2.0 also documents global `~/.gemini/GEMINI.md` and workspace/Git-root
Markdown Rules under `.agents/rules` (with legacy `.agent/rules` support).
Rules can be manual, always on, model-selected, or glob-activated
([best practices](https://antigravity.google/docs/cli/best-practices),
[rules and workflows](https://antigravity.google/docs/rules-workflows)).

**Open question.** First-party pages do not define exact precedence when
`AGENTS.md` and `GEMINI.md` coexist, nested files appear, or global/workspace
Rules and Skills conflict. Desktop-global and CLI-global Skills also use
different documented directories.

## Tools and execution

Antigravity 2.0 exposes file and command operations, web search/browser
interaction, Skills, MCP, plans, subagents, and reviewable **Artifacts** such as
plans, diffs, diagrams, screenshots, and browser recordings. Its desktop surface
uses a visual review pane; Antigravity CLI separately documents a keyboard review
panel and terminal approval signal
([overview](https://antigravity.google/docs/overview),
[Artifacts](https://antigravity.google/docs/artifacts)). IDE navigation lists
artifact-related pages, but equivalent IDE review semantics—and any SDK Artifact
surface—are not established by that source. Artifacts improve inspectability;
they are not proof of correctness, rollback, retention, or mandatory approval.

## Permissions/trust/sandbox

The permission engine covers files, URLs, commands, unsandboxed operations, and
MCP with `Deny > Ask > Allow`. Normal project reads and writes are auto-allowed;
unconfigured commands, web/browser actuation, MCP, and external paths generally
ask. Broadened file, URL, or MCP grants from an approval last for the current
turn ([permissions](https://antigravity.google/docs/permissions)).

Terminal sandboxing is a separate layer and is disabled by default. The CLI
sandbox page describes Linux nsjail, macOS `sandbox-exec`, and Windows
AppContainer, while the unified permissions page says sandboxing is preview on
macOS/Linux and “coming to Windows.” Windows sandbox availability is therefore
**unresolved**, not normalized into either claim
([CLI sandbox](https://antigravity.google/docs/cli/sandbox)). **Antigravity for
IDEs Strict Mode** restricts access outside the workspace, forces review for
terminal/browser-JavaScript/Artifact actions, enables its terminal sandbox, and
disables network access ([IDE settings](https://antigravity.google/docs/ide/settings)).
The cited source does not establish identical Strict Mode semantics for
Antigravity 2.0, CLI, or SDK, and the mode is not a prompt-injection guarantee.

!!! danger "Fact — acknowledged security limitations"
    Google Bug Hunters acknowledges unresolved classes involving indirect
    prompt injection and local-file exfiltration, plus prompt-driven command
    execution under Auto/Turbo terminal policy. The notice supplies no affected
    or fixed version range
    ([known issues](https://bughunters.google.com/learn/invalid-reports/ai-products/antigravity-known-issues)).

Consumer and enterprise data claims must remain separate. Consumer Terms state
that Google records and stores service interactions; a Settings preference
controls specified improvement use, employees or contractors may review
interactions under the Terms, and deletion is a separate support request. Changing
the improvement preference is not documented as disabling recording or storage.
Enterprise operation is under Google Cloud terms and controls; claims
about a customer private environment still include logging to a selected Cloud
project and do not mean on-device-only processing
([terms](https://antigravity.google/terms),
[enterprise](https://antigravity.google/docs/enterprise)).

## Sessions and recovery

CLI conversation history is scoped to the directory where `agy` runs and can be
resumed by command or ID. The Hooks reference documents persistent local logs at
`~/.gemini/antigravity-cli/brain/<conversationId>/.system_generated/logs/transcript.jsonl`
for CLI and the parallel `~/.gemini/antigravity/brain/...` path for Antigravity
2.0 ([Hooks](https://antigravity.google/docs/hooks)). Retention, deletion,
encryption, and whether a server-side copy also exists remain undocumented
([conversations](https://antigravity.google/docs/cli/conversations)). The CLI can
clone/import an Antigravity 2.0 thread’s history, context, and tool trajectories;
ongoing synchronization is not documented
([resume](https://antigravity.google/docs/cli/commands/resume)). `/fork` branches
conversation history, not files.

## Extensibility

Skills use progressive disclosure from `SKILL.md`. Persistent Rules differ from
slash-invoked procedural Workflows. Local command Hooks cover pre/post tool and
invocation events plus Stop. Plugins bundle namespaced Skills, Rules, Hooks, and
MCP; desktop and CLI plugin directories/lifecycles differ. MCP supports local
stdio and remote HTTP/SSE with several authentication paths, and calls default
to Ask ([Skills](https://antigravity.google/docs/skills),
[Hooks](https://antigravity.google/docs/hooks),
[MCP](https://antigravity.google/docs/mcp)). Local servers, hooks, and plugins
execute configured code and belong in the extension supply-chain boundary.

The separately distributed Google Antigravity SDK supports tools, Skills, MCP,
policies, approvals, hooks, sessions, triggers, and subagents. It was announced
as **Research Preview**. The reviewed
[Python SDK tree](https://github.com/google-antigravity/antigravity-sdk-python/tree/ac516c7709e3baf225c09d8b9d112b07b70066ff) and
[license](https://github.com/google-antigravity/antigravity-sdk-python/blob/ac516c7709e3baf225c09d8b9d112b07b70066ff/LICENSE) are Apache-2.0, while its
[pinned README](https://github.com/google-antigravity/antigravity-sdk-python/blob/ac516c7709e3baf225c09d8b9d112b07b70066ff/README.md) says runnable wheels include a compiled platform runtime. The complete
reviewed public tree did not expose that runtime's source; this is a cutoff tree
observation, not a claim about unpublished source elsewhere
([SDK announcement](https://antigravity.google/blog/introducing-google-antigravity-sdk)).

## Orchestration

Parents can launch parallel background subagents with fresh context. Modes are
inherit, branch (a Git worktree), and share; parent safety scopes flow to
children, approvals return to the main interface, agents can message known
relatives/peers, and nesting is capped at ten levels. Paid-plan **Teamwork** is a
distinct higher-level feature, not a synonym for ordinary subagents
([subagents](https://antigravity.google/docs/subagents/)).

Scheduled Tasks create recurring background conversations; Sidecars are managed
background processes with cron-like scheduling and restart policy. Their
timezone, missed-run, overlap, identity, sandbox, secrets, network, and resource
semantics are not specified ([Sidecars](https://antigravity.google/docs/sidecars/)).
Remote Control is another boundary: browser/mobile clients operate a desktop or
headless host, but work still requires that host online
([Remote Control](https://antigravity.google/docs/remote-control)).

## Model/provider boundary

The published multi-model matrix is scoped to Antigravity 2.0 and varies by
plan; it does not prove identical CLI, IDE, SDK, or Enterprise availability or
arbitrary-provider support ([models](https://antigravity.google/docs/models)).
The SDK documents Gemini API and Gemini Enterprise Agent Platform/Vertex paths.
Its pinned [v0.1.15 changelog](https://github.com/google-antigravity/antigravity-sdk-python/blob/ac516c7709e3baf225c09d8b9d112b07b70066ff/google/antigravity/CHANGELOG.md) records local Gemma through LiteRT-LM and local
OpenAI-compatible endpoints such as Ollama, LM Studio, or vLLM, with MCP and
subagent support added to those local paths. This does not establish hosted
OpenAI support, arbitrary-provider parity, or the same backends on other
Antigravity surfaces. One announcement called remote Google Cloud harness execution roadmap, while a
later Google Cloud article said deployment requires “zero code changes”; current
SDK docs provide no matching remote-deployment procedure. Operational
availability remains **an open question**.

## Platform/license/status

Antigravity 2.0 documents macOS 12+, Windows 10+, and Linux requirements.
However, the same first-party platform surface says x86 Mac is unsupported while
publishing an Intel download; Intel support is unresolved rather than absent
([getting started](https://antigravity.google/docs/getting-started)).

Do not transfer Gemini CLI’s Apache-2.0 license to Antigravity CLI. At the
cutoff, the complete reviewed [Antigravity CLI tree at `556846a4`](https://github.com/google-antigravity/antigravity-cli/tree/556846a4bb94117222f53846896c7eb0d645307e) contained documentation/examples but no root license, build manifest, or implementation tree. That frozen public tree therefore did not establish an open-source grant, so this note does not label the CLI open source; this does not prove that no terms apply outside the reviewed tree. The SDK’s Apache-2.0 declaration
applies to that repository/package scope, with the compiled-runtime caveat; it
does not license the platform or hosted services.

## Change signals

The [November 2025 launch](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/) was explicitly public preview; current pages do not settle GA, stability, support window, or SLA for every surface. The SDK’s Research Preview
label is separate. Changelog rollouts are progressive, and the four products
have independent versions. Never abbreviate the cutoff to “desktop/IDE 2.11.0”:
v2.11.0 is Antigravity 2.0, while IDE/editor integrations were v2.5.5.

## Open questions

**Open questions.** Which naming and lifecycle labels will Google standardize?
Is Windows sandboxing available, and what does Intel download availability mean
for support? Where and how long are consumer conversations and Artifacts stored?
Is SDK cloud-harness deployment operational? What are Sidecar scheduler and
isolation semantics, and which models are available on each separately
versioned surface?

## Primary sources

- [Google Antigravity documentation](https://antigravity.google/docs/home)
- [Permissions](https://antigravity.google/docs/permissions) and [CLI sandbox](https://antigravity.google/docs/cli/sandbox)
- [Subagents](https://antigravity.google/docs/subagents) and [models](https://antigravity.google/docs/models)
- [Gemini CLI transition](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)
- [Known security issues](https://bughunters.google.com/learn/invalid-reports/ai-products/antigravity-known-issues)
