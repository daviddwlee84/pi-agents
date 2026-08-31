---
kind: product-profile
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://learn.chatgpt.com/docs
  - https://learn.chatgpt.com/docs/codex/cli
  - https://learn.chatgpt.com/docs/non-interactive-mode
  - https://learn.chatgpt.com/docs/app
  - https://learn.chatgpt.com/docs/cloud
  - https://learn.chatgpt.com/docs/app-server
  - https://learn.chatgpt.com/docs/codex-sdk
  - https://learn.chatgpt.com/docs/agent-configuration/agents-md
  - https://learn.chatgpt.com/docs/agent-approvals-security
  - https://learn.chatgpt.com/docs/agent-configuration/subagents
  - https://learn.chatgpt.com/docs/open-source
  - https://developers.openai.com/blog/codex-as-a-platform
  - https://github.com/openai/codex/blob/rust-v0.151.0/LICENSE
  - https://github.com/openai/codex/releases/tag/rust-v0.151.0
confidence: high
---

# OpenAI Codex

> **Editorial classification:** Codex is treated here as a layered coding-agent platform: models provide inference, an open harness manages the agent loop, and local and managed products expose different surfaces. “Layered platform” is an evidence-backed editorial classification, not an official exclusive category or benchmark judgment.

## Scope and surfaces

The family includes Codex CLI, `codex exec`, the Codex IDE extension, the ChatGPT desktop Codex experience, web/managed cloud tasks, TypeScript and Python Codex SDKs, and Codex App Server. They share parts of the Codex harness family but differ in execution location, capabilities, account boundary, configuration, and maturity ([documentation hub](https://learn.chatgpt.com/docs), [platform article](https://developers.openai.com/blog/codex-as-a-platform)). Local desktop, CLI, and IDE surfaces can share selected host configuration such as MCP; ChatGPT web does not read it, and cloud environments are configured separately.

Codex CLI is a local terminal agent; `codex exec` is its bounded non-interactive interface for scripts and CI. The desktop surface offers local, Worktree, and Cloud modes plus rich-client capabilities not present everywhere. Managed cloud tasks run remotely in configured OpenAI environments. The SDKs embed local Codex threads. App Server exposes the lifecycle and event protocol for rich clients—but the `app-server` command itself, not only WebSocket transport, is experimental and unsupported for production ([CLI](https://learn.chatgpt.com/docs/codex/cli), [cloud](https://learn.chatgpt.com/docs/cloud), [App Server](https://learn.chatgpt.com/docs/app-server)).

## Instructions and context

Codex discovers at most one non-empty global instruction file from `CODEX_HOME`, preferring `AGENTS.override.md` over `AGENTS.md`. In a project it walks root to current directory, selecting one instruction file per directory and concatenating root-to-leaf. Nearer text therefore appears later; describing this as “precedence” is prompt-ordering shorthand, not a documented semantic conflict resolver ([`AGENTS.md`](https://learn.chatgpt.com/docs/agent-configuration/agents-md)).

Threads persist turns and typed items as future context. Manual or automatic compaction replaces earlier content with a shorter representation. Local Memories are a separate, experimental feature that is off by default at the cutoff; generation and use are independently configurable under `CODEX_HOME`. They are not ChatGPT web memory or a substitute for version-controlled team rules ([Memories](https://learn.chatgpt.com/docs/customization/memories?surface=app), [configuration](https://learn.chatgpt.com/docs/config-file/config-reference)).

## Tools and execution

The harness surfaces sandboxed command execution, file changes, plans, web search, MCP calls, image operations, review, compaction, and collaboration activity. Exact availability depends on model, provider, client, workspace, and policy. Desktop/web browser support is not available in CLI or the IDE extension. Computer Use is an optional plugin/skill on supported macOS and Windows experiences, has separate application approvals, and cannot automate terminal applications or ChatGPT itself ([browser](https://learn.chatgpt.com/docs/browser), [Computer Use](https://learn.chatgpt.com/docs/computer-use)).

`codex exec` can stream JSONL events with `--json`, constrain a final result with `--output-schema`, resume a session, or avoid persistence with `--ephemeral`. It starts in a read-only sandbox; editing requires an explicit sandbox such as `--sandbox workspace-write`. `danger-full-access` belongs only inside an appropriately isolated outer environment ([non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)).

## Permissions/trust/sandbox

Sandbox policy limits local command authority; approval policy decides when a user must decide. They are independent. For a version-controlled folder, OpenAI recommends the Auto preset of `workspace-write` plus `on-request`; for a non-version-controlled folder, it recommends starting read-only. This is not one universal default ([approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security)).

On macOS, local enforcement uses Seatbelt. Linux uses `bwrap` plus seccomp by default; WSL2 uses the Linux implementation. Container constraints, missing helpers, or full-access selection can change that baseline. Under default `workspace-write`, existing `.git`, `.agents`, and `.codex` paths beneath a writable root are protected read-only, including resolved Git directories referenced by `.git` pointer files; this is not guaranteed under every profile.

Codex cloud uses an isolated OpenAI-managed container/environment. Setup may receive configured secrets and networking; secrets are removed before the offline-by-default agent phase. Hosted browser/search/connectors and local command-network policies are separate controls. External pages, MCP output, plugins, and repository instructions remain prompt-injection inputs.

## Sessions and recovery

A conversation is a thread containing turns and items. CLI supports create, resume, fork, compact, archive, rename, and delete; `/side` creates a temporary non-nestable fork. App Server supports durable or ephemeral threads, steering, interruption, pagination, and compaction. Desktop Worktree chats use isolated checkouts, normally detached HEAD, and can hand conversation plus code back to a local checkout ([worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees)).

> **Inference:** Compaction and summarized child-agent returns can omit details. Preserve diffs, tests, artifacts, and required instructions outside conversational context when exact reproducibility matters.

## Extensibility

Agent Skills package `SKILL.md` instructions and optional scripts/resources. Codex is an MCP client for local stdio and remote Streamable HTTP servers; local desktop, CLI, and IDE surfaces can share host MCP configuration, while ChatGPT web does not read it. The deprecated `codex mcp-server` bridge is not native subagent orchestration ([MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)).

Plugins are installable packages centered on skills and/or MCP; a catalog may additionally surface optional browser extensions, hooks, and scheduled-task templates where the host supports them. “Shared plugin directory” means a public catalog, not necessarily one local filesystem directory. The IDE extension does not support plugins, and account/workspace/authentication gating applies. Hooks are also not a complete security boundary: asynchronous hooks cannot block, some specialized paths can bypass ordinary hooks, and post-use hooks cannot undo effects ([plugins](https://learn.chatgpt.com/docs/plugins?surface=app), [hooks](https://learn.chatgpt.com/docs/hooks)).

## Orchestration

Native Codex subagents are child Codex threads with separate model/tool work and summarized returns. Built-in roles include `default`, `worker`, and read-focused `explorer`; custom agents can select instructions, models, effort, sandbox, MCP, and skills. Concurrency is configurable, but the docs publish neither a universal omitted-value default nor a hard nesting-depth limit ([subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)). Max and Ultra behavior is model-, surface-, account-, and setting-dependent; Ultra's proactive delegation is documented only for eligible ChatGPT Work accounts and supported models.

Other orchestration surfaces include parallel cloud tasks, SDK threads, App Server integrations, and worktrees. `/goal` is a separate persistent control mode for long-running, multi-step work on the documented ChatGPT desktop, interactive Codex CLI, and IDE surfaces; it may coexist with tools or agents but is not itself proof of multi-agent orchestration ([long-running work](https://learn.chatgpt.com/docs/long-running-work?surface=app)). Avoid overlapping write-heavy agents; using worktrees for isolated writes is operational synthesis, not proof of automatic isolation in every subagent mode.

## Model/provider boundary

A Codex model is inference; the Codex harness manages context, tools, execution, approvals, and events. Model access and hosted services are separate. Configurable providers expose base URLs, wire APIs, credentials, headers, retries, and streaming, but “OpenAI-compatible” does not guarantee every endpoint, search mode, reasoning summary, tool, authentication flow, or catalog works. Local OSS mode supports documented local runtimes, and Amazon Bedrock is a distinct direct provider path without ChatGPT authentication or Codex cloud ([advanced configuration](https://learn.chatgpt.com/docs/config-file/config-advanced), [Bedrock](https://learn.chatgpt.com/docs/amazon-bedrock)).

The Codex TypeScript SDK wraps the CLI over JSONL; the Python SDK uses App Server over JSON-RPC. Both are local harness integrations, separate from OpenAI's general Agents SDK and from managed cloud tasks ([SDK](https://learn.chatgpt.com/docs/codex-sdk)).

## Platform/license/status

OpenAI's [2025-10-06 Codex GA announcement](https://openai.com/index/codex-now-generally-available/) applies at product level, not to every component. Linux desktop and GitLab may retain preview/beta labels, and App Server remains experimental. OpenAI also lists Skills, Plugins, Codex Security components, and the universal cloud environment as open source; an open base environment does not make the hosted cloud service open source. The public `openai/codex` repository—including repository CLI, SDK, and App Server code—is Apache-2.0. That license does not cover models, hosted Codex services, the closed IDE extension, Codex cloud, branding, or third-party dependencies ([open-source inventory](https://learn.chatgpt.com/docs/open-source), [license](https://github.com/openai/codex/blob/rust-v0.151.0/LICENSE)).

> **Fact, release snapshot:** GitHub metadata marks `rust-v0.151.0` non-draft/non-prerelease and published on 2026-08-29; the [official releases API](https://api.github.com/repos/openai/codex/releases?per_page=20) showed no later stable release by the 2026-08-31 cutoff ([immutable release](https://github.com/openai/codex/releases/tag/rust-v0.151.0)). The ordering claim must be rechecked after that date.

## Change signals

Recheck release ordering, experimental APIs, Linux/GitLab maturity, model retirements, plan/region availability, and custom-provider compatibility. Most product docs are rolling pages. App Server docs and `main`-branch protocol details can move at different speeds, so source observations must be pinned before treating them as released contracts.

## Open questions

> **Open question:** What default applies when `agents.max_concurrent_threads_per_session` is omitted, and is a hard nesting-depth limit enforced?

The docs also do not give production-compatibility dates for App Server, a removal date for deprecated Chat Completions/provider paths or `codex mcp-server`, or one authoritative plan/region/workspace/model matrix.

## Primary sources

- [Codex documentation hub](https://learn.chatgpt.com/docs)
- [Codex CLI](https://learn.chatgpt.com/docs/codex/cli) and [non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Desktop app](https://learn.chatgpt.com/docs/app) and [Codex cloud](https://learn.chatgpt.com/docs/cloud)
- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [`AGENTS.md` guide](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security)
- [Native subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform)
- [Open-source inventory](https://learn.chatgpt.com/docs/open-source), [repository license](https://github.com/openai/codex/blob/rust-v0.151.0/LICENSE), and [`rust-v0.151.0`](https://github.com/openai/codex/releases/tag/rust-v0.151.0)
