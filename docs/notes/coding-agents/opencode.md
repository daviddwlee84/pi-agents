---
kind: product-profile
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://opencode.ai/docs/
  - https://opencode.ai/docs/server/
  - https://opencode.ai/docs/agents/
  - https://opencode.ai/docs/permissions/
  - https://opencode.ai/docs/providers/
  - https://opencode.ai/docs/share/
  - https://github.com/anomalyco/opencode/blob/10765ff2a9da8c3b88e4de873aa383a49c318912/SECURITY.md
  - https://github.com/anomalyco/opencode/releases/tag/v1.18.25
  - https://api.github.com/repos/anomalyco/opencode/releases/latest
confidence: high
---

# OpenCode

## Scope and surfaces

OpenCode is an open-source coding agent “built for the terminal,” but it is not
TUI-only. `opencode [project]` opens the TUI, while `opencode run`, `serve`,
`web`, `attach`, and `acp` expose other workflows. A normal TUI starts an
OpenCode server and acts as its client; the same architecture supports a browser
UI, beta Desktop App, IDE/ACP clients, a headless server, and the generated
JavaScript/TypeScript SDK ([CLI](https://opencode.ai/docs/cli/),
[server](https://opencode.ai/docs/server/)).

**Fact.** The MIT-licensed OpenCode client and **OpenCode Zen** are different
things. Zen is an optional OpenCode-maintained model gateway/provider; using the
client does not require Zen ([Zen](https://opencode.ai/docs/zen/)).

## Instructions and context

OpenCode walks upward for project `AGENTS.md` and reads the global
`~/.config/opencode/AGENTS.md`. If OpenCode-native files are absent, it can use
project/global `CLAUDE.md` and Claude-compatible skill locations. Configuration
`instructions` may add files, globs, or remote URLs; references merely written
inside `AGENTS.md` are not expanded automatically
([rules](https://opencode.ai/docs/rules/)).

Configuration is merged from several layers rather than replaced wholesale.
The docs give a numbered precedence order, but discuss `OPENCODE_CONFIG_DIR`
separately and do not place it relative to every layer. Treat its complete
precedence as an **open question**, not a settled total order
([config](https://opencode.ai/docs/config/)).

## Tools and execution

Documented tools include `bash`, file read/search/edit/write operations,
`apply_patch`, `skill`, `todowrite`, web fetch/search, questions, and an
experimental model-callable `lsp` tool. `edit` permission covers all modifying
file tools, and wildcard groups can match built-in and MCP tools
([tools](https://opencode.ai/docs/tools/)). Optional LSP server diagnostics are
a separate feature from that experimental `lsp` tool.

## Permissions/trust/sandbox

Rules resolve to `allow`, `ask`, or `deny`; ordered pattern rules use the last
match. Most permissions default to `allow`. `external_directory` and repeated
identical `doom_loop` calls default to `ask`; reads are generally allowed except
for `.env`, while `.env.example` is allowed. An “always” approval lasts for the
current session, and `--auto` converts asks to approvals but never overrides an
explicit denial ([permissions](https://opencode.ai/docs/permissions/)).

!!! warning "Fact — permissions are not isolation"
    OpenCode’s security policy explicitly says it does **not** sandbox the
    agent. Prompts provide awareness and confirmation, not containment; the
    project recommends Docker or a VM where isolation is required
    ([security policy](https://github.com/anomalyco/opencode/blob/10765ff2a9da8c3b88e4de873aa383a49c318912/SECURITY.md)).

`opencode serve` binds to `127.0.0.1:4096` by default and exposes OpenAPI at
`/doc`. Server authentication is absent unless `OPENCODE_SERVER_PASSWORD` is
set. Changing the bind address or enabling discovery therefore changes the
network boundary ([server](https://opencode.ai/docs/server/)).

## Sessions and recovery

Sessions are **persisted locally** and exposed through the TUI, CLI, server, and
SDK. They can be continued, forked, summarized, reverted, exported, and linked
as parent/child sessions. “Persisted” is deliberate: the docs do not promise
backup, synchronization, schema stability, retention, or durable delivery
([troubleshooting](https://opencode.ai/docs/troubleshooting/)). Automatic and
manual compaction exist, but the trigger and summary-fidelity guarantees are
not documented.

Sharing is a separate hosted action. `/share` uploads the complete conversation
and metadata and creates a link usable by anyone who has it until `/unshare`;
`share: "disabled"` prevents sharing ([share](https://opencode.ai/docs/share/)).
OpenCode's [Enterprise documentation](https://opencode.ai/docs/enterprise/) states that its service does not store code or context; that service-side claim does not cover an explicitly shared conversation or the configured model provider. Ordinary model calls, local session files, optional sharing, and provider-side retention therefore remain separate data paths.

## Extensibility

Agent Skills are on-demand `SKILL.md` packages found in OpenCode-native,
`.claude/skills`, and `.agents/skills` paths. Custom agents define role, model,
tools, and permissions; commands are reusable prompt templates. JavaScript or
TypeScript plugins register hooks and tools, and custom tools receive session,
agent, directory, and worktree context. Plugins and custom tools execute local
code without a documented plugin sandbox and may replace a built-in name
([skills](https://opencode.ai/docs/skills/),
[plugins](https://opencode.ai/docs/plugins/),
[custom tools](https://opencode.ai/docs/custom-tools/)).

Local subprocess and remote HTTP MCP servers are supported, including OAuth and
tool filters. Enabled schemas enter model context, so server trust and context
cost need review ([MCP](https://opencode.ai/docs/mcp-servers/)). The generated
`@opencode-ai/sdk` can launch or connect to the server and stream events; its
documentation states no formal compatibility policy
([SDK](https://opencode.ai/docs/sdk/)).

## Orchestration

OpenCode distinguishes **Primary agents** from **Subagents**. Primary agents
invoke subagents through Task; users can invoke them directly with
`@agent-name`; each delegation creates a child session. `permission.task`
controls agent-to-agent calls, not direct user invocation, and `hidden` removes
a name from autocomplete rather than making it unreachable
([agents](https://opencode.ai/docs/agents/)).

The General subagent is documented as able to run multiple units of work in
parallel. This is delegated parallel work, not evidence of a persistent team
system: scheduling guarantees, concurrency limits, shared-team state,
inter-agent messaging, worktree isolation, and merge semantics are not specified.

## Model/provider boundary

OpenCode uses the AI SDK and Models.dev and advertises **“75+ LLM providers.”**
That is a source-attributed lower-bound-style claim, not an audited exact count
or proof of uniform capabilities. Models use `provider/model` identifiers; local
and self-hosted OpenAI-compatible endpoints are supported. Authentication may
come from `/connect`, environment variables, OAuth, provider CLIs, or cloud
credential chains ([providers](https://opencode.ai/docs/providers/),
[models](https://opencode.ai/docs/models/)). Provider billing, retention,
regions, tool support, and context limits remain provider-specific.

## Platform/license/status

The CLI is distributed for macOS, Linux, and Windows; the Windows guide
recommends WSL for development-tool and filesystem behavior. The README labels
Desktop **BETA**, while downloads use `stable` update-channel links—two
source-specific labels that do not establish universal GA or surface parity
([downloads](https://opencode.ai/download)). The client repository is
[MIT-licensed](https://github.com/anomalyco/opencode/blob/10765ff2a9da8c3b88e4de873aa383a49c318912/LICENSE); that
license does not govern Zen, model services, or third-party integrations.

## Change signals

At the cutoff, GitHub’s latest non-draft, non-prerelease release was
[v1.18.25](https://github.com/anomalyco/opencode/releases/tag/v1.18.25),
published 2026-08-28; the [official release API](https://api.github.com/repos/anomalyco/opencode/releases/latest) supplied the ordering and draft/prerelease flags for that observation. Reviewed live documentation tracked `dev`, not necessarily
the release commit. A `dev` observation therefore must not be back-projected
into v1.18.25 without checking the tag.

## Open questions

**Open questions.** What are session and credential retention/encryption
properties? What exact compaction threshold and preservation policy apply? How
is `OPENCODE_CONFIG_DIR` ordered against every configuration source? Which SDK
structured-output field and compatibility contract are canonical for a given
version?

## Primary sources

- [OpenCode documentation](https://opencode.ai/docs/)
- [Agents](https://opencode.ai/docs/agents/) and [permissions](https://opencode.ai/docs/permissions/)
- [Server](https://opencode.ai/docs/server/) and [SDK](https://opencode.ai/docs/sdk/)
- [Security policy](https://github.com/anomalyco/opencode/blob/10765ff2a9da8c3b88e4de873aa383a49c318912/SECURITY.md)
- [v1.18.25 release](https://github.com/anomalyco/opencode/releases/tag/v1.18.25)
