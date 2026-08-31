---
kind: product-profile
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://code.claude.com/docs/en/overview
  - https://code.claude.com/docs/en/platforms
  - https://code.claude.com/docs/en/how-claude-code-works
  - https://code.claude.com/docs/en/memory
  - https://code.claude.com/docs/en/tools-reference
  - https://code.claude.com/docs/en/permissions
  - https://code.claude.com/docs/en/sandboxing
  - https://code.claude.com/docs/en/sessions
  - https://code.claude.com/docs/en/data-usage
  - https://code.claude.com/docs/en/zero-data-retention
  - https://code.claude.com/docs/en/features-overview
  - https://code.claude.com/docs/en/agents
  - https://code.claude.com/docs/en/agent-view
  - https://code.claude.com/docs/en/workflows
  - https://code.claude.com/docs/en/agent-sdk/overview
  - https://code.claude.com/docs/en/feature-availability
  - https://github.com/anthropics/claude-code/blob/v2.1.251/LICENSE.md
  - https://api.github.com/repos/anthropics/claude-code/releases/latest
confidence: high
---

# Claude Code

> **Editorial classification:** Claude Code is profiled here as a multi-surface agentic coding product and harness. This is a documentation-based classification, not a benchmark result or security certification.

## Scope and surfaces

Claude Code is the harness around Claude models that gathers context, chooses actions, invokes tools, and verifies results. It is not the Claude model or service itself. First-party surfaces include the terminal CLI, VS Code and JetBrains integrations, Desktop, web, and mobile access to Cloud or Remote Control sessions. Anthropic says they use the same underlying engine, but that is an architecture statement—not feature parity, shared history, or identical settings. The CLI is described as the most complete surface **for terminal-native work**; scripting and the Claude Agent SDK are CLI-only, while richer clients expose other workflows ([overview](https://code.claude.com/docs/en/overview), [platforms](https://code.claude.com/docs/en/platforms)).

Execution is a separate axis. Local sessions act on the user's machine; Cloud sessions use Anthropic-managed VMs or organization-operated environments; Remote Control keeps execution and file access local while a remote UI controls the session. Remote Control is neither a cloud VM nor isolation: traffic passes through Anthropic over TLS and its transcript is stored on Anthropic servers while connected ([how it works](https://code.claude.com/docs/en/how-claude-code-works), [security](https://code.claude.com/docs/en/security)).

## Instructions and context

Persistent authored guidance comes from managed, user, project, and local `CLAUDE.md` files. Ancestor files load at launch, descendant files load when relevant paths are read, and discovered files are concatenated rather than treated as simple overrides. `.claude/rules/*.md` may be unconditional or path-scoped. Auto memory is repository-scoped, machine-local, and contextual guidance—not policy enforcement ([memory](https://code.claude.com/docs/en/memory)).

Context also contains conversation history, file and tool results, Skills, and MCP metadata. Claude Code clears older tool results and compacts long conversations; compaction is lossy, so durable requirements belong in version-controlled instructions and durable artifacts, not only early chat turns ([context window](https://code.claude.com/docs/en/context-window)). Cloud sessions use committed project settings and managed policy, not uncommitted user/project-local settings from a developer machine.

## Tools and execution

The [tools reference](https://code.claude.com/docs/en/tools-reference) is a **conditional catalog**, not a promise that every tool exists in every session. It covers file editing and search, Bash, web access, code intelligence, interaction, tasks, worktrees, scheduling, Skills, subagents, messaging, and workflows. Availability varies by surface, platform, provider, model, version, configuration, and session scope. For example, LSP requires a code-intelligence plugin plus a language-server binary and is inactive in cloud sessions; scheduled tasks are session-scoped rather than durable system cron by default.

Built-in file tools and Bash have different enforcement paths. Commands run with the user's environment and can cause external effects; tool output and fetched content remain untrusted inputs.

## Permissions/trust/sandbox

Permission rules resolve `deny`, then `ask`, then `allow`; Claude Code—not the model or `CLAUDE.md`—enforces them. Modes include Manual, `acceptEdits`, `plan`, `auto`, `dontAsk`, and `bypassPermissions`. `auto` uses a classifier and is conditional by plan, model, provider, and surface; it is not a safety guarantee. `bypassPermissions` is intended only for an outer isolated environment, and explicit deny rules still apply ([permissions](https://code.claude.com/docs/en/permissions), [permission modes](https://code.claude.com/docs/en/permission-modes)).

The OS-enforced sandbox confines Bash and its child processes on supported macOS, Linux, and WSL2 configurations. It does not directly confine Read/Edit/Write or computer-use tools, is unavailable on native Windows and WSL1, permits broad reads by default, and does not normally inspect TLS. Anthropic explicitly says it is not a complete isolation boundary ([sandboxing](https://code.claude.com/docs/en/sandboxing)). Workspace, MCP, plugin, and project-hook trust are separate decisions; no prompt-injection defense is complete.

## Sessions and recovery

CLI sessions are saved continuously as plaintext JSONL under `~/.claude/projects/` by default. Resume continues one session ID; `/branch` or `--fork-session` copies history into a new one. Simultaneously opening one session without forking can interleave messages, and CLI, Desktop, web, and VS Code maintain distinct history stores ([sessions](https://code.claude.com/docs/en/sessions)).

Checkpoints can restore conversation and edits made through Claude's file-editing tools. They are not Git and do not cover Bash changes, most subagent edits, concurrent external changes, deployments, databases, or API side effects ([checkpointing](https://code.claude.com/docs/en/checkpointing)).

## Extensibility

The official vocabulary matters: `CLAUDE.md` and rules provide context; Skills package on-demand instructions and resources; hooks handle lifecycle events; MCP supplies external tools/data; plugins package and distribute components ([extensibility overview](https://code.claude.com/docs/en/features-overview)). Hooks are not uniformly deterministic enforcement: command/HTTP/MCP handlers, model-backed prompt or experimental agent handlers, event-specific blocking, best-effort matching, and fail-open timeout behavior differ ([hooks](https://code.claude.com/docs/en/hooks)).

MCP supports Streamable HTTP, deprecated SSE, stdio, and WebSocket with transport-specific limits. WebSocket lacks OAuth and listing support; ToolSearch schema deferral is generally enabled but can vary by provider and configuration ([MCP](https://code.claude.com/docs/en/mcp)). Plugins, hooks, MCP servers, monitors, and executables can run trusted code or invoke external services with user credentials.

## Orchestration

[Anthropic distinguishes](https://code.claude.com/docs/en/agents) subagents, Agent view, agent teams, and dynamic workflows. Subagents are isolated delegated contexts that normally return only a final result. Agent teams are experimental and disabled by default; they add a fixed lead, peer sessions, a shared task list, and messaging, but no automatic checkout isolation. Agent view is a research-preview UI for independent background sessions: supervisor state survives restarts, updates, and sleep, but shutdown stops processes; completed unpinned sessions normally stop after about an hour, and memory pressure or transcript cleanup can also end resumability ([Agent view](https://code.claude.com/docs/en/agent-view)).

Dynamic workflows are documented script-owned orchestration: an isolated JavaScript runtime coordinates many subagents while intermediate results remain in variables. They are a specific current surface with documented concurrency and runtime limits, not evidence that every Claude Code session performs autonomous multi-agent planning ([workflows](https://code.claude.com/docs/en/workflows)). Cross-session messages carry plain text, never user authority or permission approval.

## Model/provider boundary

Claude models supply inference; Claude Code supplies the coding harness. The **Claude Agent SDK** is a separate Python/TypeScript embedding library that packages the Claude Code loop and tools for developer-hosted infrastructure. It is not the direct Client SDK and not Anthropic-hosted Managed Agents; the integrator owns subprocess isolation, resources, persistence, and deployment ([Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview)).

Claude Code can use Anthropic access and documented third-party platforms, but server-backed features differ by provider, model, plan, and policy ([feature availability](https://code.claude.com/docs/en/feature-availability)). Stable routing requires explicit provider-native identifiers: an Anthropic model ID, a Bedrock ID/profile ARN/custom identifier, a Google version name, or a Foundry deployment name. Dynamic aliases are not pins ([model configuration](https://code.claude.com/docs/en/model-config)).

## Platform/license/status

The public `anthropics/claude-code` repository is **not** an open-source grant: its license says all rights reserved and points to Anthropic's Commercial Terms ([license](https://github.com/anthropics/claude-code/blob/v2.1.251/LICENSE.md)). SDK licensing is component-specific: the [Python Agent SDK license](https://github.com/anthropics/claude-agent-sdk-python/blob/af5ff1b9f2f279575f89b78f17572c6e35fbc2b6/LICENSE) is MIT, while the [TypeScript Agent SDK license](https://github.com/anthropics/claude-agent-sdk-typescript/blob/75667f1f76e800bb845b0a0e211df79fedfc9e86/LICENSE.md) is all-rights-reserved; neither relicenses Claude Code, models, hosted services, trademarks, or dependencies.

> **Fact, release snapshot:** GitHub release metadata marks Claude Code `v2.1.251` non-draft and non-prerelease, created and published on 2026-08-28, and latest at the 2026-08-31 cutoff ([release API](https://api.github.com/repos/anthropics/claude-code/releases/latest)). “Latest” must not be carried forward without rechecking.

## Change signals

Recheck the release channel, provider/model matrix, permission defaults, preview labels, data-retention terms, and service status. Live documentation is mutable. Anthropic's applicable first-party commercial standard currently states 30-day server retention; third-party deployments follow their provider agreements. Local transcripts also default to 30-day cleanup, except sessions started or most recently continued in Desktop or Cowork unless `desktopSessionCleanupPeriodDays` is set ([data usage](https://code.claude.com/docs/en/data-usage)). Zero Data Retention requires separate enablement for a qualified organization and covers only qualifying authentication/provider paths ([ZDR](https://code.claude.com/docs/en/zero-data-retention)). Status observations are not uptime guarantees.

## Open questions

> **Open question:** Which provider, authentication path, plan, model identifier, region, and managed policies should a deployment assume? That choice changes the feature and data-policy matrix.

Also verify the latest release at publication time. Any product embedding or preinstalling Claude Code or an Agent SDK should obtain license-specific legal review rather than infer rights from repository visibility.

## Primary sources

- [Claude Code overview](https://code.claude.com/docs/en/overview) and [platforms](https://code.claude.com/docs/en/platforms)
- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- [Memory and instruction discovery](https://code.claude.com/docs/en/memory)
- [Tools reference](https://code.claude.com/docs/en/tools-reference)
- [Permissions](https://code.claude.com/docs/en/permissions) and [sandboxing](https://code.claude.com/docs/en/sandboxing)
- [Sessions](https://code.claude.com/docs/en/sessions) and [data usage](https://code.claude.com/docs/en/data-usage)
- [Parallel-agent patterns](https://code.claude.com/docs/en/agents), [Agent view](https://code.claude.com/docs/en/agent-view), and [dynamic workflows](https://code.claude.com/docs/en/workflows)
- [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [Feature availability](https://code.claude.com/docs/en/feature-availability)
- [Claude Code license](https://github.com/anthropics/claude-code/blob/v2.1.251/LICENSE.md) and [latest-release API](https://api.github.com/repos/anthropics/claude-code/releases/latest)
